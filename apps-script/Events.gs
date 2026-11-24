/**
 * Events tab plus a nightly mirror of the ABA event listing .docx.
 * EVENT_SYNC_MODE defaults to approve: midnight stores a review and emails
 * Donny. auto applies the mirror and notifies volunteers. Dry run only logs.
 * Run syncEventsFromDocDryRun, then installEventSyncTrigger. Deploy a new
 * web-app version so the approve and reject links can open.
 */

var ABA_EVENT_DOC_ID = '1rdUKglpJrISmHfy1elR68-oPzhii_wLA';
var EVENT_HEADERS = ['TYPE', 'DATE', 'START', 'END', 'LOCATION', 'SOURCE', 'ADDED AT'];
var EVENT_MONTHS_ = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12
};

function eventsTabPresent_() {
  if (typeof SpreadsheetApp === 'undefined') return false;
  var sheet = openSheet_().getSheetByName('Events');
  return !!(sheet && sheet.getLastRow() >= 1 && String(sheet.getRange(1, 1).getValue() || '').trim());
}

function eventHeaderCol_(headers, name) {
  var key = String(name).toLowerCase().replace(/[^a-z]/g, '');
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || '').toLowerCase().replace(/[^a-z]/g, '') === key) return i;
  }
  return -1;
}

function logEventProblem_(where, text, err) {
  var stack = err && err.stack ? '\n' + err.stack : '';
  var message = 'syncEventsFromDoc skipped ' + where + ': ' + text + (err ? ' ' + err : '') + stack;
  try { Logger.log(message); } catch (ignore) {}
  return message;
}

function formatClockInZone_(value, zone) {
  var parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).formatToParts(value);
  var hour = '';
  var minute = '';
  var ap = '';
  parts.forEach(function (part) {
    if (part.type === 'hour') hour = String(Number(part.value));
    if (part.type === 'minute') minute = part.value;
    if (part.type === 'dayPeriod') ap = part.value.toUpperCase();
  });
  return (hour + ':' + minute + ' ' + ap).replace(/\s+/g, ' ').trim();
}

function eventClockFromSheet_(value, display) {
  var shown = String(display == null ? '' : display).trim();
  var parsed = parseClock_(shown);
  if (parsed) return formatClock_(parsed.hour, parsed.minute);
  // A time-only Sheets cell is a Date on 1899-12-30. America/Detroit's local
  // mean time that year is about 32 minutes from modern Eastern time, so
  // formatting the Date in America/New_York turns 4:30 PM into 5:02 PM.
  if (value instanceof Date && !isNaN(value.getTime()) && value.getUTCFullYear() < 1905) {
    parsed = parseClock_(formatClockInZone_(value, 'America/Detroit'));
    if (parsed) return formatClock_(parsed.hour, parsed.minute);
  }
  if (value == null || value === '') return '';
  parsed = parseClock_(value);
  if (!parsed) return String(value instanceof Date ? '' : value).trim();
  return formatClock_(parsed.hour, parsed.minute);
}

function normalizeEventClock_(value, display) {
  return eventClockFromSheet_(value, display);
}

function readEventsTab_() {
  if (typeof SpreadsheetApp === 'undefined') return [];
  var sheet = openSheet_().getSheetByName('Events');
  if (!sheet || sheet.getLastRow() < 2) return [];
  var range = sheet.getDataRange();
  var values = range.getValues();
  var display = range.getDisplayValues ? range.getDisplayValues() : values;
  var headers = values[0];
  var typeCol = eventHeaderCol_(headers, 'type');
  var dateCol = eventHeaderCol_(headers, 'date');
  var startCol = eventHeaderCol_(headers, 'start');
  var endCol = eventHeaderCol_(headers, 'end');
  var locationCol = eventHeaderCol_(headers, 'location');
  var removedCol = eventHeaderCol_(headers, 'removedat');
  if (typeCol < 0 || dateCol < 0) return [];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    try {
      var type = String(values[r][typeCol] || '').trim();
      var date = ABA_RULES.formatSheetDate(values[r][dateCol]);
      if (!type || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      out.push({
        rowNumber: r + 1,
        type: type,
        date: date,
        start: startCol < 0 ? '' : eventClockFromSheet_(values[r][startCol], display[r][startCol]),
        end: endCol < 0 ? '' : eventClockFromSheet_(values[r][endCol], display[r][endCol]),
        location: locationCol < 0 ? '' : String(values[r][locationCol] || '').trim(),
        removedAt: removedCol < 0 ? '' : String(values[r][removedCol] || '').trim()
      });
    } catch (err) {
      logEventProblem_('Events row ' + (r + 1), String(values[r]), err);
    }
  }
  return out;
}

function cellSame_(before, after) {
  if (before instanceof Date || typeof before === 'number') return false;
  return String(before == null ? '' : before).trim() === String(after == null ? '' : after);
}

function planEventsTabMigration_(headerRow, dataRows, displayRows) {
  var headers = (headerRow || []).map(function (cell) { return String(cell || '').trim(); });
  while (headers.length && !headers[headers.length - 1]) headers.pop();
  var changed = false;
  if (eventHeaderCol_(headers, 'type') < 0 || eventHeaderCol_(headers, 'date') < 0) {
    return { headers: headers, rows: dataRows || [], changed: false, kept: 0 };
  }
  if (eventHeaderCol_(headers, 'removedat') < 0) {
    headers.push('REMOVED AT');
    changed = true;
  }
  var dateCol = eventHeaderCol_(headers, 'date');
  var startCol = eventHeaderCol_(headers, 'start');
  var endCol = eventHeaderCol_(headers, 'end');
  var typeCol = eventHeaderCol_(headers, 'type');
  var kept = 0;
  var rows = (dataRows || []).map(function (source, index) {
    var shown = (displayRows && displayRows[index]) || [];
    var row = [];
    for (var c = 0; c < headers.length; c++) row.push(c < source.length ? source[c] : '');
    var type = typeCol >= 0 ? String(row[typeCol] || '').trim() : '';
    if (type) kept += 1;
    if (dateCol >= 0) {
      var date = ABA_RULES.formatSheetDate(row[dateCol]);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && !cellSame_(row[dateCol], date)) {
        row[dateCol] = date;
        changed = true;
      }
    }
    function putClock(col, fallback) {
      if (col < 0) return;
      var next = eventClockFromSheet_(row[col], shown[col]);
      if (!next && fallback) next = fallback;
      if (!next || cellSame_(row[col], next)) return;
      row[col] = next;
      changed = true;
    }
    putClock(startCol, '');
    var standard = standardEventWindow_(type);
    var startText = startCol >= 0 ? eventClockFromSheet_(row[startCol], shown[startCol]) : '';
    var endFallback = standard && startText === standard.start && endCol >= 0 && !eventClockFromSheet_(row[endCol], shown[endCol]) ? standard.end : '';
    putClock(endCol, endFallback);
    return row;
  });
  return { headers: headers, rows: rows, changed: changed, kept: kept };
}

function migrateEventsTab() {
  if (typeof SpreadsheetApp === 'undefined') return { changed: false, kept: 0 };
  var sheet = openSheet_().getSheetByName('Events');
  if (!sheet || sheet.getLastRow() < 1) return { changed: false, kept: 0 };
  var range = sheet.getDataRange();
  var values = range.getValues();
  var display = range.getDisplayValues ? range.getDisplayValues() : values;
  var plan = planEventsTabMigration_(values[0], values.slice(1), display.slice(1));
  if (!plan.changed) {
    try { Logger.log('Events tab already matches. Kept ' + plan.kept + ' events.'); } catch (err) {}
    return plan;
  }
  sheet.getRange(1, 1, 1, plan.headers.length).setValues([plan.headers]);
  sheet.getRange(1, 1, 1, plan.headers.length).setFontWeight('bold').setBackground('#407589').setFontColor('#ffffff');
  if (plan.rows.length) {
    sheet.getRange(2, 1, plan.rows.length, plan.headers.length).setValues(plan.rows);
    sheet.getRange(2, 1, plan.rows.length, plan.headers.length).setNumberFormat('@');
  }
  try { Logger.log('Events tab migrated in place. Kept ' + plan.kept + ' events.'); } catch (err) {}
  return plan;
}

function ensureEventsSheet_() {
  var ss = openSheet_();
  var sheet = ss.getSheetByName('Events');
  if (!sheet) sheet = ss.insertSheet('Events');
  if (sheet.getLastRow() < 1 || !String(sheet.getRange(1, 1).getValue() || '').trim()) {
    sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]);
    sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setFontWeight('bold').setBackground('#407589').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), EVENT_HEADERS.length).setNumberFormat('@');
  return sheet;
}

function appendEventRow_(sheet, event, source) {
  var stamp = ABA_RULES.stamp(new Date());
  sheet.appendRow([
    event.type,
    event.date,
    event.start || '',
    event.end || '',
    event.location || '',
    source || 'doc',
    stamp
  ]);
}

function seedEventsTab() {
  var sheet = ensureEventsSheet_();
  var have = readEventsTab_();
  var added = 0;
  abaFallbackEvents_().forEach(function (event) {
    var known = have.some(function (row) { return row.date === event.date && row.type === event.type; });
    if (known) return;
    appendEventRow_(sheet, event, 'seed');
    have.push(event);
    added += 1;
  });
  var summary = 'seedEventsTab added ' + added + ' event' + (added === 1 ? '' : 's') + '.';
  Logger.log(summary);
  return summary;
}

function docxBlobForUnzip_(blob) {
  var copy = blob && blob.copyBlob ? blob.copyBlob() : blob;
  if (copy && copy.setContentType) copy.setContentType('application/zip');
  return copy;
}

function docxPlainText_(blob) {
  var files = Utilities.unzip(docxBlobForUnzip_(blob));
  var xml = '';
  for (var i = 0; i < files.length; i++) {
    if (String(files[i].getName()) === 'word/document.xml') {
      xml = files[i].getDataAsString();
      break;
    }
  }
  if (!xml) return '';
  return xml.split(/<\/w:p>/).map(function (part) {
    var bits = [];
    var pattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    var match;
    while ((match = pattern.exec(part))) bits.push(match[1]);
    return bits.join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  }).join('\n');
}

function eventClock_(hour, minute, ap) {
  if (!ap) return '';
  var h = Number(hour);
  var m = minute ? String(minute) : '00';
  if (m.length === 1) m = '0' + m;
  return h + ':' + m + ' ' + ap.toUpperCase();
}

function inferMeridiem_(startHour, startMinute, endHour, endMinute) {
  var start = Number(startHour);
  var end = Number(endHour);
  var startMin = start * 60 + Number(startMinute || 0);
  var endMin = end * 60 + Number(endMinute || 0);
  if (endMin < startMin) return { start: start === 12 ? 'PM' : 'AM', end: 'PM' };
  var ap = start >= 8 && start <= 11 ? 'AM' : 'PM';
  return { start: ap, end: ap };
}

function pullEventClock_(text) {
  var range = String(text || '').match(/(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);
  if (range && (range[1] && range[4])) {
    var startAp = range[3] ? range[3].replace(/\./g, '') : '';
    var endAp = range[6] ? range[6].replace(/\./g, '') : '';
    if (!startAp && !endAp) {
      var inferred = inferMeridiem_(range[1], range[2], range[4], range[5]);
      startAp = inferred.start;
      endAp = inferred.end;
    } else {
      endAp = endAp || startAp;
      startAp = startAp || endAp;
    }
    if (startAp && endAp) {
      return {
        raw: range[0],
        start: eventClock_(range[1], range[2], startAp),
        end: eventClock_(range[4], range[5], endAp)
      };
    }
  }
  var one = String(text || '').match(/(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)/i);
  if (!one) return { raw: '', start: '', end: '' };
  return { raw: one[0], start: eventClock_(one[1], one[2], one[3].replace(/\./g, '')), end: '' };
}

function eventKind_(text) {
  var s = String(text || '').toLowerCase();
  if (/open house/.test(s) && /ribbon cutting/.test(s)) return { skip: 'ambiguous' };
  if (/open house/.test(s)) return { skip: 'out' };
  if (/grand opening/.test(s)) return { skip: 'out' };
  if (/multi[-\s]?chamber/.test(s)) return { skip: 'out' };
  if (/lunch\s*(?:&|and)\s*learn/.test(s)) return { type: 'Lunch & Learn' };
  if (/ribbon cutting/.test(s)) return { type: 'Ribbon Cutting' };
  if (/aba happy hour/.test(s)) return { type: 'Happy Hour' };
  if (/happy hour/.test(s)) return { skip: 'ambiguous' };
  return null;
}

function eventVenue_(rest, type, timeRaw) {
  var body = String(rest || '');
  if (timeRaw) body = body.replace(timeRaw, ' ');
  body = body.replace(/[–—]/g, '-').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim();
  body = body.replace(/^[,\-\s]+|[,\-\s]+$/g, '');
  if (type === 'Ribbon Cutting') {
    var named = body.match(/^(.*?)\s+ribbon cutting\b/i);
    if (named && named[1].replace(/^[-,\s]+|[-,\s]+$/g, '')) return named[1].replace(/^[-,\s]+|[-,\s]+$/g, '');
  }
  var parts = body.split(/\s+-\s+|,/).map(function (part) { return part.trim(); }).filter(Boolean);
  var venue = '';
  parts.forEach(function (part) {
    if (/happy hour|lunch|learn|ribbon cutting/i.test(part)) return;
    if (!venue) venue = part;
  });
  return venue;
}

function eventTimeWarning_(type, start, end) {
  if (type === 'Happy Hour' && (start !== '4:30 PM' || end !== '6:30 PM')) {
    return 'Happy Hour time is ' + (start || 'blank') + (end ? '-' + end : '') + ', not 4:30-6:30 PM';
  }
  if (type === 'Lunch & Learn' && (start !== '11:30 AM' || end)) {
    return 'Lunch & Learn time is ' + (start || 'blank') + (end ? '-' + end : '') + ', not 11:30 AM';
  }
  return '';
}

function sameRibbonBusiness_(location, venue) {
  var biz = String(venue || '').toLowerCase();
  if (!biz) return false;
  return String(location || '').toLowerCase().indexOf(biz) !== -1;
}

function eventVenueMatches_(location, type, venue) {
  var stored = String(location || '').replace(/\s+/g, ' ').trim();
  var name = String(venue || '').replace(/\s+/g, ' ').trim();
  if (!name) return !stored.replace(type, '').replace(/[,\s]/g, '');
  var storedLower = stored.toLowerCase();
  var nameLower = name.toLowerCase();
  var withType = (String(type || '') + ', ' + name).toLowerCase();
  if (storedLower === nameLower || storedLower === withType) return true;
  // The sheet keeps the street address after the venue name.
  if (storedLower.indexOf(withType + ',') === 0) return true;
  if (storedLower.indexOf(nameLower + ',') === 0) return true;
  return false;
}

function eventClockKey_(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function planEventSync_(text, existing, today) {
  var years = {};
  var firstLine = '';
  String(text || '').split(/\r?\n/).some(function (line) {
    if (!String(line || '').trim()) return false;
    firstLine = line;
    return true;
  });
  var titleYears = String(firstLine).match(/20\d\d/g);
  if (titleYears) titleYears.forEach(function (item) { years[item] = true; });
  var year = Number(Object.keys(years)[0] || String(today || '').slice(0, 4));
  var month = 0;
  var rows = (existing || []).map(function (event) {
    return {
      type: event.type,
      date: event.date,
      start: event.start || '',
      end: event.end || '',
      location: event.location || '',
      removedAt: event.removedAt || '',
      rowNumber: event.rowNumber || 0
    };
  });
  var added = [];
  var changed = [];
  var unchanged = 0;
  var past = 0;
  var inScope = 0;
  var skipped = { out: 0, ambiguous: 0, collision: 0 };
  var warnings = [];
  var seen = {};
  String(text || '').split(/\r?\n/).forEach(function (raw) {
    var line = String(raw || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line) return;
    try {
    var heading = line.match(/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\.?(?:\s+(20\d\d))?$/i);
    if (heading) {
      month = EVENT_MONTHS_[heading[1].toLowerCase()];
      if (heading[2]) {
        year = Number(heading[2]);
        years[heading[2]] = true;
      }
      return;
    }
    var named = line.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b\s*[-–—]?\s*(.*)$/i);
    var dayOnly = line.match(/^(\d{1,2})\s*[-–—]\s*(.*)$/);
    var day = 0;
    var rest = '';
    var lineMonth = month;
    if (named) {
      lineMonth = EVENT_MONTHS_[named[1].toLowerCase()];
      day = Number(named[2]);
      rest = named[3];
    } else if (dayOnly && month) {
      day = Number(dayOnly[1]);
      rest = dayOnly[2];
    } else {
      return;
    }
    if (!lineMonth || day < 1 || day > 31) return;
    var kind = eventKind_(rest);
    if (!kind) return;
    if (kind.skip) {
      skipped[kind.skip === 'out' ? 'out' : 'ambiguous'] += 1;
      return;
    }
    var clock = pullEventClock_(rest);
    if (!clock.start) {
      skipped.ambiguous += 1;
      warnings.push('skipped line (no time): ' + line);
      return;
    }
    var date = year + '-' + (lineMonth < 10 ? '0' : '') + lineMonth + '-' + (day < 10 ? '0' : '') + day;
    inScope += 1;
    if (date < String(today || '')) {
      past += 1;
      return;
    }
    var venue = eventVenue_(rest, kind.type, clock.raw);
    var warning = eventTimeWarning_(kind.type, clock.start, clock.end);
    var event = {
      type: kind.type,
      date: date,
      start: clock.start,
      end: clock.end || '',
      location: venue ? (kind.type + ', ' + venue) : (kind.type === 'Happy Hour' ? 'Happy Hour, TBD' : kind.type),
      venue: venue
    };
    var same = rows.filter(function (row) { return !row.removedAt && row.date === date && row.type === kind.type; });
    var key = date + '|' + kind.type;
    if (seen[key] && kind.type === 'Ribbon Cutting' && seen[key].venue !== venue) {
      skipped.collision += 1;
      return;
    }
    if (warning) warnings.push(date + ' ' + kind.type + ' ' + warning);
    if (!same.length) {
      rows.push(event);
      added.push(event);
      seen[key] = event;
      return;
    }
    var current = same[0];
    seen[key] = event;
    var storedStart = normalizeEventClock_(current.start);
    var storedEnd = normalizeEventClock_(current.end);
    var nextStart = normalizeEventClock_(event.start);
    var nextEnd = normalizeEventClock_(event.end);
    var standard = standardEventWindow_(kind.type);
    var blankStandardEnd = !storedEnd && standard && storedStart === standard.start && nextEnd === standard.end;
    var sameTime = storedStart === nextStart && (storedEnd === nextEnd || blankStandardEnd);
    var samePlace = eventVenueMatches_(current.location, kind.type, venue);
    if (samePlace) event.location = current.location || event.location;
    if (sameTime && samePlace) {
      unchanged += 1;
      return;
    }
    changed.push({ before: current, after: event });
    } catch (err) {
      skipped.bad = (skipped.bad || 0) + 1;
      warnings.push(logEventProblem_('line', line, err));
    }
  });
  var removed = [];
  rows.forEach(function (row) {
    if (row.removedAt || !row.date) return;
    var rowYear = String(row.date).slice(0, 4);
    if (!years[rowYear]) return;
    if (row.date < String(today || '')) return;
    if (row.type !== 'Happy Hour' && row.type !== 'Lunch & Learn' && row.type !== 'Ribbon Cutting') return;
    if (seen[row.date + '|' + row.type]) return;
    removed.push(row);
  });
  if (!inScope) {
    return {
      added: 0, changed: 0, removed: 0, unchanged: 0, existing: 0, past: 0, inScope: 0,
      years: Object.keys(years), skipped: skipped, warnings: [],
      addedEvents: [], changedEvents: [], removedEvents: [],
      error: 'The listing had no Ribbon Cutting, Happy Hour, or Lunch & Learn events.'
    };
  }
  return {
    added: added.length,
    changed: changed.length,
    removed: removed.length,
    unchanged: unchanged,
    existing: unchanged,
    past: past,
    inScope: inScope,
    years: Object.keys(years),
    skipped: skipped,
    warnings: warnings,
    addedEvents: added,
    changedEvents: changed,
    removedEvents: removed
  };
}

function eventSyncSummary_(plan, dryRun) {
  var skipped = plan.skipped.out + plan.skipped.ambiguous + plan.skipped.collision;
  return 'syncEventsFromDoc ' + (dryRun ? 'dry run: ' : '') + 'added ' + plan.added +
    ', changed ' + (plan.changed || 0) + ', removed ' + (plan.removed || 0) +
    ', unchanged ' + (plan.unchanged || 0) + ', past ' + plan.past +
    ', skipped ' + skipped +
    ' (out of scope: ' + plan.skipped.out +
    ', ambiguous: ' + plan.skipped.ambiguous +
    ', collision: ' + plan.skipped.collision + ').' +
    (dryRun ? ' Nothing was written.' : '');
}

function eventDocHash_(modifiedTime) {
  var text = String(modifiedTime || '');
  if (typeof ABA_SHA256 === 'function') return ABA_SHA256(text);
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var n = (b + 256) % 256;
    return (n < 16 ? '0' : '') + n.toString(16);
  }).join('');
}

function eventPlanFingerprint_(plan) {
  function key(event) {
    event = event || {};
    return [event.date, event.type, event.start, event.end, event.location].join('|');
  }
  var parts = [];
  (plan.addedEvents || []).forEach(function (event) { parts.push('A:' + key(event)); });
  (plan.changedEvents || []).forEach(function (change) { parts.push('C:' + key(change.before) + '>' + key(change.after)); });
  (plan.removedEvents || []).forEach(function (event) { parts.push('R:' + key(event)); });
  return parts.sort().join('\n');
}

function eventSyncMode_(deps) {
  if (deps && deps.mode) return String(deps.mode).toLowerCase() === 'auto' ? 'auto' : 'approve';
  try {
    var mode = PropertiesService.getScriptProperties().getProperty('EVENT_SYNC_MODE');
    return String(mode || 'approve').toLowerCase() === 'auto' ? 'auto' : 'approve';
  } catch (err) {
    return 'approve';
  }
}

function loadPendingEventPlan_() {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty('ABA_EVENT_SYNC_PENDING');
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function savePendingEventPlan_(pending) {
  var json = JSON.stringify(pending);
  if (json.length > 8500) throw new Error('The pending event plan is too large to store.');
  PropertiesService.getScriptProperties().setProperty('ABA_EVENT_SYNC_PENDING', json);
}

function clearPendingEventPlan_() {
  PropertiesService.getScriptProperties().deleteProperty('ABA_EVENT_SYNC_PENDING');
}

function eventChangeFlags_(event, people) {
  var slots = {};
  expandEventSlots_(event).forEach(function (slot) { slots[slot.task] = slot; });
  var counts = {};
  var flags = [];
  (people || []).forEach(function (person) {
    counts[person.task] = (counts[person.task] || 0) + 1;
    if (!slots[person.task]) flags.push(person.name + ' is still signed up for ' + person.task + ', which is not a role on the updated event. The sign-up was kept.');
  });
  Object.keys(counts).forEach(function (task) {
    var slot = slots[task];
    if (slot && counts[task] > Number(slot.capacity)) {
      flags.push(task + ' now has ' + counts[task] + ' sign-ups and room for ' + slot.capacity + '. Everyone was kept.');
    }
  });
  return flags;
}

function peopleOnEvent_(signups, event) {
  var shown = event.after || event;
  return (signups || []).filter(function (row) {
    return ABA_RULES.isActive(row) && row.date === shown.date && row.event === shown.type;
  });
}

function eventReviewModel_(plan, signups) {
  return {
    added: (plan.addedEvents || []).map(function (event) { return { event: event, people: [] }; }),
    changed: (plan.changedEvents || []).map(function (change) {
      var affected = peopleOnEvent_(signups, change);
      return { before: change.before, after: change.after, people: affected, flags: eventChangeFlags_(change.after, affected) };
    }),
    removed: (plan.removedEvents || []).map(function (event) {
      return { event: event, people: peopleOnEvent_(signups, event) };
    })
  };
}

function eventsSheetColumn_(sheet, name) {
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  var index = eventHeaderCol_(headers, name);
  if (index >= 0) return index + 1;
  if (String(name).toLowerCase().replace(/[^a-z]/g, '') !== 'removedat') return -1;
  var next = last + 1;
  sheet.getRange(1, next).setValue('REMOVED AT').setFontWeight('bold').setBackground('#407589').setFontColor('#ffffff');
  return next;
}

function updateEventRow_(before, event) {
  var sheet = ensureEventsSheet_();
  var row = before && before.rowNumber;
  if (!row) return;
  function set(name, value) {
    var col = eventsSheetColumn_(sheet, name);
    if (col > 0) sheet.getRange(row, col).setValue(value);
  }
  set('start', event.start || '');
  set('end', event.end || '');
  set('location', event.location || '');
  var removed = eventsSheetColumn_(sheet, 'removedat');
  if (removed > 0) sheet.getRange(row, removed).setValue('');
}

function markEventRemoved_(event) {
  var sheet = ensureEventsSheet_();
  var col = eventsSheetColumn_(sheet, 'removedat');
  if (event && event.rowNumber && col > 0) sheet.getRange(event.rowNumber, col).setValue(ABA_RULES.stamp(new Date()));
}

function signupRoleSlot_(event, task) {
  var found = null;
  expandEventSlots_(event).forEach(function (slot) {
    if (slot.task === task) found = slot;
  });
  return found;
}

function eventWhenText_(event) {
  var date = typeof longDate_ === 'function' ? longDate_(event.date) : event.date;
  var time = event.end ? (event.start + '–' + event.end) : (event.start || '');
  return date + (time ? ', ' + time : '') + (event.location ? ' at ' + event.location : '');
}

function patchCalendarNotice_(calendarId, eventId, plan) {
  var zone = Session.getScriptTimeZone();
  var body = { summary: plan.title, description: plan.description, location: plan.location || '' };
  if (plan.allDay) {
    body.start = { date: Utilities.formatDate(plan.start, zone, 'yyyy-MM-dd') };
    body.end = { date: Utilities.formatDate(plan.end, zone, 'yyyy-MM-dd') };
  } else {
    body.start = { dateTime: Utilities.formatDate(plan.start, zone, "yyyy-MM-dd'T'HH:mm:ss"), timeZone: zone };
    body.end = { dateTime: Utilities.formatDate(plan.end, zone, "yyyy-MM-dd'T'HH:mm:ss"), timeZone: zone };
  }
  if (plan.signupId) body.extendedProperties = { private: { signupId: String(plan.signupId) } };
  Calendar.Events.patch(body, calendarId, calendarApiEventId_(eventId), { sendUpdates: 'all' });
}

function moveSignupCalendar_(person, slot) {
  var api = calendarClient_();
  var calendarId = api.getCalendarId();
  var located = locatePersonEvent_(api, calendarId, person.signupId);
  if (!located.id || !slot) return false;
  patchCalendarNotice_(calendarId, located.id, planCalendarEvent_(slot, person));
  return true;
}

function notifySignupOfEventChange_(person, before, after) {
  var slot = signupRoleSlot_(after, person.task);
  var roleTime = slot ? ((slot.timeLabel || (slot.roleStart + '–' + slot.roleEnd)) + ' Eastern') : 'Your current role';
  sendMailApp_(buildScheduleNotice_(person, {
    kind: 'changed',
    eventName: after.type,
    oldWhen: eventWhenText_(before),
    newWhen: eventWhenText_(after),
    roleTime: roleTime
  }));
  try {
    moveSignupCalendar_(person, slot);
  } catch (err) {
    try { Logger.log('Calendar move failed for ' + person.email + ': ' + err); } catch (ignore) {}
  }
}

function notifySignupOfEventRemoval_(person, event) {
  updateSignup_(person.rowNumber, { status: 'cancelled-by-event-removal', updatedAt: ABA_RULES.stamp(new Date()) });
  try {
    var api = calendarClient_();
    deletePersonEvent_(api, api.getCalendarId(), person.signupId);
  } catch (err) {
    try { Logger.log('Calendar cancel failed for ' + person.email + ': ' + err); } catch (ignore) {}
  }
  if (person.email) {
    sendMailApp_(buildScheduleNotice_(person, {
      kind: 'removed',
      eventName: event.type,
      oldWhen: eventWhenText_(event)
    }));
  }
}

function liveRow_(existing, event) {
  var rowNumber = event.rowNumber || 0;
  (existing || []).forEach(function (row) {
    if (row.date === event.date && row.type === event.type && !row.removedAt && row.rowNumber) rowNumber = row.rowNumber;
  });
  return rowNumber;
}

function applyEventMirror_(plan, deps, preview) {
  var signups = deps.signups || [];
  var notes = [];
  (plan.addedEvents || []).forEach(function (event) {
    notes.push('added ' + event.date + ' ' + event.type + ' ' + event.location);
    if (!preview && deps.write) deps.write(event);
  });
  (plan.changedEvents || []).forEach(function (change) {
    var event = change.after;
    var affected = peopleOnEvent_(signups, change);
    notes.push('changed ' + event.date + ' ' + event.type + ' from ' + (change.before.location || '') + ' ' + (change.before.start || '') + ' to ' + event.location + ' ' + event.start + (event.end ? '-' + event.end : ''));
    if (!preview && deps.update) {
      deps.update({
        rowNumber: liveRow_(deps.existing, change.before),
        date: change.before.date,
        type: change.before.type
      }, event);
    }
    affected.forEach(function (person) {
      var detail = person.name + ' <' + (person.email || '') + '> ' + person.task;
      if (preview) {
        notes.push('  would email and move calendar for ' + detail);
        return;
      }
      if (deps.notifyChange) deps.notifyChange(person, change.before, event);
      notes.push('  emailed event-changed and updated calendar for ' + detail);
    });
    var flags = deps.flagChange ? deps.flagChange(event, affected) : eventChangeFlags_(event, affected);
    flags.forEach(function (flag) { notes.push('  flag: ' + flag); });
  });
  (plan.removedEvents || []).forEach(function (event) {
    var affected = peopleOnEvent_(signups, event);
    notes.push('removed ' + event.date + ' ' + event.type);
    if (!preview && deps.remove) deps.remove({ rowNumber: liveRow_(deps.existing, event), date: event.date, type: event.type });
    affected.forEach(function (person) {
      var detail = person.name + ' <' + (person.email || '') + '> ' + person.task;
      if (preview) {
        notes.push('  would cancel ' + detail);
        return;
      }
      if (deps.notifyRemoval) deps.notifyRemoval(person, event);
      notes.push('  cancelled sign-up, calendar, and emailed ' + detail);
    });
  });
  return notes;
}

function liveEventSyncDeps_() {
  var file = DriveApp.getFileById(ABA_EVENT_DOC_ID);
  var modified = '';
  try { modified = file.getLastUpdated().toISOString(); } catch (err) { modified = String(file.getLastUpdated()); }
  var yearInName = String(file.getName() || '').match(/20\d\d/);
  var web = '';
  try { web = ScriptApp.getService().getUrl(); } catch (err) { web = ''; }
  var existing = readEventsTab_();
  if (!existing.length && !eventsTabPresent_()) existing = abaFallbackEvents_().slice();
  return {
    text: (yearInName ? yearInName[0] + '\n' : '') + docxPlainText_(file.getBlob()),
    today: ABA_RULES.todayKeyIn(new Date(), 'America/New_York'),
    existing: existing,
    signups: (function () {
      try { return readState_().signups; } catch (err) {
        logEventProblem_('sign-ups', 'Signups tab', err);
        return [];
      }
    })(),
    modifiedTime: modified,
    docHash: eventDocHash_(modified),
    webAppUrl: web,
    log: function (message) { Logger.log(message); },
    write: function (event) { appendEventRow_(ensureEventsSheet_(), event, 'doc'); },
    update: function (before, event) { updateEventRow_(before, event); },
    remove: function (event) { markEventRemoved_(event); },
    notifyChange: notifySignupOfEventChange_,
    notifyRemoval: notifySignupOfEventRemoval_,
    flagChange: eventChangeFlags_,
    mail: function (body) { MailApp.sendEmail('donny@vanderwinn.com', 'ABA event schedule sync', body); },
    mailReview: function (message) { sendMailApp_(message); },
    savePending: savePendingEventPlan_,
    loadPending: loadPendingEventPlan_,
    clearPending: clearPendingEventPlan_,
    newToken: newToken_,
    newId: function () { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }
  };
}

function buildPendingEventPlan_(plan, deps) {
  var token = deps.newToken ? deps.newToken() : newToken_();
  var id = deps.newId ? deps.newId() : token.slice(0, 16);
  return {
    id: id,
    token: token,
    hash: deps.docHash || eventDocHash_(deps.modifiedTime || ''),
    modifiedTime: deps.modifiedTime || '',
    fingerprint: eventPlanFingerprint_(plan),
    webAppUrl: deps.webAppUrl || '',
    plan: {
      added: plan.added,
      changed: plan.changed,
      removed: plan.removed,
      unchanged: plan.unchanged,
      past: plan.past,
      inScope: plan.inScope,
      skipped: plan.skipped,
      warnings: plan.warnings || [],
      addedEvents: plan.addedEvents || [],
      changedEvents: plan.changedEvents || [],
      removedEvents: plan.removedEvents || []
    }
  };
}

function pendingStillMatches_(pending, deps) {
  var currentHash = deps.docHash || eventDocHash_(deps.modifiedTime || '');
  if (pending.hash && currentHash && pending.hash !== currentHash) return false;
  if (!deps.text) return true;
  var plan = planEventSync_(deps.text, deps.existing, deps.today);
  return eventPlanFingerprint_(plan) === pending.fingerprint;
}

function syncEventsFromDoc(dryRun, deps) {
  var preview = dryRun === true || String(dryRun).toLowerCase() === 'true';
  if (!deps) {
    try {
      if (!preview) migrateEventsTab();
      deps = liveEventSyncDeps_();
    } catch (err) {
      var failure = 'syncEventsFromDoc error: could not read the event listing. Nothing was changed. ' + err + (err && err.stack ? '\n' + err.stack : '');
      try { Logger.log(failure); } catch (ignore) {}
      if (!preview) {
        try { MailApp.sendEmail('donny@vanderwinn.com', 'ABA event sync failed', failure); } catch (mailErr) {}
      }
      return failure;
    }
  }
  var plan = planEventSync_(deps.text, deps.existing, deps.today);
  if (!plan.inScope) {
    var empty = 'syncEventsFromDoc error: ' + (plan.error || 'The listing had no in-scope events.') + ' Nothing was changed.';
    deps.log(empty);
    if (!preview && deps.mail) deps.mail(empty);
    return empty;
  }
  plan.warnings.forEach(function (warning) { deps.log('syncEventsFromDoc warning: ' + warning); });
  var mode = eventSyncMode_(deps);
  var holding = preview || mode !== 'auto';
  var notes = applyEventMirror_(plan, deps, holding);
  notes.forEach(function (line) { deps.log('syncEventsFromDoc ' + line); });
  var summary = eventSyncSummary_(plan, preview);
  deps.log(summary);
  var work = plan.added || plan.changed || plan.removed;
  if (preview) {
    if (work && mode === 'approve') deps.log('syncEventsFromDoc approve mode would store a review and email Donny. No events, volunteer emails, or calendar changes.');
    if (!work) deps.log('syncEventsFromDoc no changes, so no review email.');
    return summary;
  }
  if (mode === 'approve') {
    if (!work) {
      if (deps.clearPending) deps.clearPending();
      deps.log('syncEventsFromDoc no changes, so no review email. Nothing was written.');
      return summary + ' No review email. Nothing was written.';
    }
    var pending = buildPendingEventPlan_(plan, deps);
    if (deps.savePending) deps.savePending(pending);
    var review = buildEventReviewMessage_(eventReviewModel_(plan, deps.signups), {
      id: pending.id,
      token: pending.token,
      webAppUrl: deps.webAppUrl || ''
    });
    if (deps.mailReview) deps.mailReview(review);
    else if (deps.mail) deps.mail(review.text);
    deps.log('syncEventsFromDoc stored review ' + pending.id + '. Nothing was written.');
    return summary + ' Stored for review. Nothing was written.';
  }
  if (work && deps.mail) deps.mail(summary + '\n\n' + notes.join('\n'));
  if (deps.clearPending) deps.clearPending();
  return summary;
}

function eventSyncGet_(params, pending) {
  var decision = params && params.eventSync;
  if (decision !== 'approve' && decision !== 'reject') return '';
  if (arguments.length > 1) return eventSyncReviewPage_(decision, params.token, pending);
  return eventSyncReviewPage_(decision, params.token);
}

function eventSyncReviewPage_(decision, token, pending) {
  var stored = arguments.length > 2 ? pending : loadPendingEventPlan_();
  var valid = stored && stored.token && String(stored.token) === String(token || '') && (decision === 'approve' || decision === 'reject');
  if (!valid) {
    return '<p style="font-family:Montserrat,Segoe UI,sans-serif;color:#39393a;">This review link is no longer valid. A newer scan may have replaced it.</p>';
  }
  var approve = decision === 'approve';
  var title = approve ? 'Approve all changes?' : 'Reject these changes?';
  var note = approve ? 'Opening this page does not apply them.' : 'Opening this page does not reject them.';
  var label = approve ? 'Approve all changes' : 'Reject';
  var action = approve ? 'approveEventSync' : 'rejectEventSync';
  var postUrl = stored.webAppUrl || '';
  try {
    if (!postUrl && typeof ScriptApp !== 'undefined') postUrl = ScriptApp.getService().getUrl();
  } catch (err) { postUrl = stored.webAppUrl || ''; }
  var plan = stored.plan || {};
  var lines = [];
  (plan.addedEvents || []).forEach(function (event) { lines.push('Add ' + event.date + ' ' + event.type); });
  (plan.changedEvents || []).forEach(function (change) { lines.push('Change ' + change.after.date + ' ' + change.after.type); });
  (plan.removedEvents || []).forEach(function (event) { lines.push('Remove ' + event.date + ' ' + event.type); });
  var list = lines.map(function (line) { return '<li>' + escapeHtmlMail_(line) + '</li>'; }).join('');
  return '<div style="font-family:Montserrat,Segoe UI,sans-serif;color:#39393a;background:#f2f2f2;padding:24px;">' +
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:6px solid #407589;padding:24px;">' +
    '<h1 style="font-size:22px;margin:0 0 8px;">' + title + '</h1>' +
    '<p>' + note + '</p>' +
    '<ul>' + list + '</ul>' +
    '<form method="post" action="' + escapeHtmlMail_(postUrl) + '">' +
    '<input type="hidden" name="action" value="' + action + '">' +
    '<input type="hidden" name="token" value="' + escapeHtmlMail_(token) + '">' +
    '<button type="submit" id="event-sync-go" style="padding:12px 18px;background:#407589;color:#ffffff;border:0;border-radius:999px;font-weight:700;">' + label + '</button>' +
    '</form>' +
    '<p style="margin-top:24px;color:#5c5c5c;">Ada Business Association</p></div></div>';
}

function eventSyncResultPage_(result) {
  var message = result && result.message ? result.message : 'Nothing was changed.';
  return '<div style="font-family:Montserrat,Segoe UI,sans-serif;color:#39393a;padding:24px;"><p>' +
    escapeHtmlMail_(message) + '</p><p style="color:#5c5c5c;">Ada Business Association</p></div>';
}

function finishEventSyncReview_(decision, token, options) {
  options = options || {};
  var deps = options.deps;
  if (!deps) {
    try { deps = liveEventSyncDeps_(); } catch (err) {
      return { ok: false, message: 'Could not read the event listing. Nothing was changed.' };
    }
  }
  var pending = deps.loadPending ? deps.loadPending() : loadPendingEventPlan_();
  if (!pending) return { ok: false, message: 'There is no pending event review.' };
  if (!options.editor && String(pending.token) !== String(token || '')) {
    return { ok: false, message: 'This review link is not valid.' };
  }
  if (decision === 'reject') {
    if (deps.clearPending) deps.clearPending();
    if (deps.log) deps.log('syncEventsFromDoc rejected review ' + pending.id + '. Nothing was written.');
    return { ok: true, message: 'Rejected. Nothing was changed.' };
  }
  if (decision !== 'approve') return { ok: false, message: 'This review link is not valid.' };
  if (!pendingStillMatches_(pending, deps)) {
    return { ok: false, message: 'The listing changed since this review. Nothing was applied. A new review will come at the next scan.' };
  }
  var notes = applyEventMirror_(pending.plan, deps, false);
  if (deps.clearPending) deps.clearPending();
  var summary = eventSyncSummary_(pending.plan, false);
  if (deps.mail) deps.mail(summary + '\n\n' + notes.join('\n'));
  if (deps.log) deps.log(summary);
  return { ok: true, message: 'Approved. The stored plan was applied.' };
}

function approvePendingEventChanges() {
  var result = finishEventSyncReview_('approve', '', { editor: true });
  Logger.log(result.message);
  return result.message;
}

function rejectPendingEventChanges() {
  var result = finishEventSyncReview_('reject', '', { editor: true });
  Logger.log(result.message);
  return result.message;
}

function setEventSyncModeAuto() {
  PropertiesService.getScriptProperties().setProperty('EVENT_SYNC_MODE', 'auto');
  var message = 'EVENT_SYNC_MODE is auto. Midnight sync will apply changes and notify volunteers.';
  Logger.log(message);
  return message;
}

function setEventSyncModeApprove() {
  PropertiesService.getScriptProperties().setProperty('EVENT_SYNC_MODE', 'approve');
  var message = 'EVENT_SYNC_MODE is approve. Midnight sync will email a review and wait for approval.';
  Logger.log(message);
  return message;
}

function syncEventsFromDocDryRun() {
  return syncEventsFromDoc(true);
}

function installEventSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var seen = false;
  for (var i = triggers.length - 1; i >= 0; i--) {
    if (triggers[i].getHandlerFunction() !== 'syncEventsFromDoc') continue;
    if (!seen) {
      seen = true;
      continue;
    }
    ScriptApp.deleteTrigger(triggers[i]);
  }
  if (!seen) {
    var builder = ScriptApp.newTrigger('syncEventsFromDoc').timeBased().everyDays(1).atHour(0);
    try { builder.inTimezone('America/New_York'); } catch (err) {}
    builder.create();
  }
  var summary = seen
    ? 'Event sync trigger already installed. It runs daily at midnight Eastern. The reminder trigger was not changed.'
    : 'Event sync trigger installed. It runs daily at midnight Eastern. The reminder trigger was not changed.';
  Logger.log(summary);
  return summary;
}
