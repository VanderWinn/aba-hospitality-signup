/**
 * Events tab plus a nightly add-only sync from the ABA event listing .docx.
 * Does not delete or edit events that are already on the tab.
 * Run seedEventsTab once, then syncEventsFromDocDryRun, then installEventSyncTrigger.
 */

var ABA_EVENT_DOC_ID = '1rdUKglpJrISmHfy1elR68-oPzhii_wLA';
var EVENT_HEADERS = ['TYPE', 'DATE', 'START', 'END', 'LOCATION', 'SOURCE', 'ADDED AT'];
var EVENT_MONTHS_ = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12
};

function readEventsTab_() {
  if (typeof SpreadsheetApp === 'undefined') return [];
  var ss = openSheet_();
  var sheet = ss.getSheetByName('Events');
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  function col(name) {
    var key = String(name).toLowerCase().replace(/[^a-z]/g, '');
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i] || '').toLowerCase().replace(/[^a-z]/g, '') === key) return i;
    }
    return -1;
  }
  var typeCol = col('type');
  var dateCol = col('date');
  var startCol = col('start');
  var endCol = col('end');
  var locationCol = col('location');
  if (typeCol < 0 || dateCol < 0) return [];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var type = String(values[r][typeCol] || '').trim();
    var date = ABA_RULES.formatSheetDate(values[r][dateCol]);
    if (!type || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({
      type: type,
      date: date,
      start: startCol < 0 ? '' : String(values[r][startCol] || '').trim(),
      end: endCol < 0 ? '' : String(values[r][endCol] || '').trim(),
      location: locationCol < 0 ? '' : String(values[r][locationCol] || '').trim()
    });
  }
  return out;
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

function docxPlainText_(blob) {
  var files = Utilities.unzip(blob);
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

function pullEventClock_(text) {
  var range = String(text || '').match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)?/i);
  if (range && (range[3] || range[6])) {
    var endAp = range[6] || range[3];
    var startAp = range[3] || endAp;
    return {
      raw: range[0],
      start: eventClock_(range[1], range[2], startAp),
      end: eventClock_(range[4], range[5], endAp)
    };
  }
  var one = String(text || '').match(/(\d{1,2})(?::(\d{2}))?\s*([ap]m)/i);
  if (!one) return { raw: '', start: '', end: '' };
  return { raw: one[0], start: eventClock_(one[1], one[2], one[3]), end: '' };
}

function eventKind_(text) {
  var s = String(text || '').toLowerCase();
  if (/\(test\)/.test(s)) return { skip: 'ambiguous' };
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

function planEventSync_(text, existing, today) {
  var yearMatch = String(text || '').match(/20\d\d/);
  var year = yearMatch ? Number(yearMatch[1] ? yearMatch[1] : yearMatch[0]) : Number(String(today || '').slice(0, 4));
  var month = 0;
  var rows = (existing || []).map(function (event) {
    return { type: event.type, date: event.date, location: event.location || '' };
  });
  var added = [];
  var existingCount = 0;
  var past = 0;
  var skipped = { out: 0, ambiguous: 0, collision: 0 };
  var warnings = [];
  String(text || '').split(/\r?\n/).forEach(function (raw) {
    var line = String(raw || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (!line) return;
    var heading = line.match(/^(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\.?(?:\s+(20\d\d))?$/i);
    if (heading) {
      month = EVENT_MONTHS_[heading[1].toLowerCase()];
      if (heading[2]) year = Number(heading[2]);
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
      return;
    }
    var date = year + '-' + (lineMonth < 10 ? '0' : '') + lineMonth + '-' + (day < 10 ? '0' : '') + day;
    if (date < String(today || '')) {
      past += 1;
      return;
    }
    var venue = eventVenue_(rest, kind.type, clock.raw);
    var warning = eventTimeWarning_(kind.type, clock.start, clock.end);
    var same = rows.filter(function (row) { return row.date === date && row.type === kind.type; });
    if (same.length) {
      if (kind.type === 'Ribbon Cutting' && !same.some(function (row) { return sameRibbonBusiness_(row.location, venue); })) {
        skipped.collision += 1;
        return;
      }
      existingCount += 1;
      return;
    }
    var event = {
      type: kind.type,
      date: date,
      start: clock.start,
      end: kind.type === 'Ribbon Cutting' ? (clock.end || '') : (clock.end || ''),
      location: venue ? (kind.type + ', ' + venue) : (kind.type === 'Happy Hour' ? 'Happy Hour, TBD' : kind.type)
    };
    if (warning) warnings.push(date + ' ' + kind.type + ' ' + warning);
    rows.push(event);
    added.push(event);
  });
  return {
    added: added.length,
    existing: existingCount,
    past: past,
    skipped: skipped,
    warnings: warnings,
    addedEvents: added
  };
}

function eventSyncSummary_(plan, dryRun) {
  var skipped = plan.skipped.out + plan.skipped.ambiguous + plan.skipped.collision;
  return 'syncEventsFromDoc ' + (dryRun ? 'dry run: ' : '') + 'added ' + plan.added +
    ', existing ' + plan.existing + ', past ' + plan.past +
    ', skipped ' + skipped +
    ' (out of scope: ' + plan.skipped.out +
    ', ambiguous: ' + plan.skipped.ambiguous +
    ', collision: ' + plan.skipped.collision + ').' +
    (dryRun ? ' Nothing was written.' : '');
}

function syncEventsFromDoc(dryRun, deps) {
  var preview = dryRun === true || String(dryRun).toLowerCase() === 'true';
  var own = !deps;
  if (!deps) {
    var file = DriveApp.getFileById(ABA_EVENT_DOC_ID);
    var yearInName = String(file.getName() || '').match(/20\d\d/);
    deps = {
      text: (yearInName ? yearInName[0] + '\n' : '') + docxPlainText_(file.getBlob()),
      today: ABA_RULES.todayKeyIn(new Date(), 'America/New_York'),
      existing: readEventsTab_(),
      log: function (message) { Logger.log(message); },
      write: function (event) {
        appendEventRow_(ensureEventsSheet_(), event, 'doc');
      },
      mail: function (body) {
        MailApp.sendEmail('donny@vanderwinn.com', 'ABA events added', body);
      }
    };
    if (!deps.existing.length) deps.existing = abaFallbackEvents_().slice();
  }
  var plan = planEventSync_(deps.text, deps.existing, deps.today);
  plan.warnings.forEach(function (warning) { deps.log('syncEventsFromDoc warning: ' + warning); });
  var summary = eventSyncSummary_(plan, preview);
  deps.log(summary);
  if (!preview) {
    if (own && !(readEventsTab_() || []).length) seedEventsTab();
    plan.addedEvents.forEach(function (event) { deps.write(event); });
    if (plan.added && deps.mail) {
      deps.mail(plan.addedEvents.map(function (event) {
        return event.date + ' ' + event.type + ' — ' + event.location + ' ' + event.start + (event.end ? '-' + event.end : '');
      }).join('\n'));
    }
  }
  return summary;
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
