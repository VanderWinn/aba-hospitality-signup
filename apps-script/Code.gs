/**
 * Ada Business Association — hospitality sign-up web app.
 *
 * Bound to (or opened by id):
 * https://docs.google.com/spreadsheets/d/1wVRyW_PRfB-rgPB716lWkqQraBBnw1lXuPH5o2-4u74/edit
 *
 * Deploy: Execute as Me, Who has access: Anyone. See SETUP.md.
 * Paste this file as Code.gs and Seed.gs beside it, then run setup.
 */

var SPREADSHEET_ID = '1wVRyW_PRfB-rgPB716lWkqQraBBnw1lXuPH5o2-4u74';

var SLOT_HEADERS = ['slotId', 'date', 'time', 'event', 'location', 'task', 'capacity'];
var SIGNUP_FIELDS = [
  'name', 'email', 'event', 'date', 'startTime', 'endTime', 'task', 'venue', 'address', 'capacity', 'createdAt', 'status',
  'signupId', 'slotId', 'source', 'token', 'oldTask', 'previousSlotId', 'sequence', 'reminderSent', 'updatedAt'
];
var SIGNUP_HEADERS = [
  'NAME', 'EMAIL', 'EVENT TYPE', 'DATE', 'START TIME', 'END TIME', 'TASK', 'VENUE', 'ADDRESS', 'CAPACITY', 'CREATED AT', 'STATUS',
  'SIGNUP ID', 'SLOT ID', 'SOURCE', 'TOKEN', 'OLD TASK', 'PREVIOUS SLOT ID', 'SEQUENCE', 'REMINDER SENT', 'UPDATED AT'
];
var SIGNUP_HIDDEN = ['signupId', 'slotId', 'source', 'token', 'oldTask', 'previousSlotId', 'sequence', 'reminderSent', 'updatedAt'];

var ABA_RULES = (function () {
  var ORG = 'Ada Business Association';
  var TITLE = 'Hospitality Jobs for ABA Board and Ambassadors';
  var TIMEZONE = 'America/Detroit';
  var RATE_WINDOW_MS = 10 * 60 * 1000;
  var RATE_MAX = 5;
  var MAX_NAME = 80;
  var MIN_NAME = 2;
  var MAX_EMAIL = 120;
  var MAX_LABEL = 120;

  function slotId(date, eventName, task) {
    return String(date) + '|' + String(eventName) + '|' + String(task);
  }

  function asText(value) {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && isFinite(value)) return String(value);
    return '';
  }

  function cleanName(value) {
    return asText(value).replace(/\s+/g, ' ').trim();
  }

  function normalizeEmail(value) {
    return asText(value).trim().toLowerCase();
  }

  function isValidEmail(email) {
    if (!email || email.length > MAX_EMAIL) return false;
    if (email.indexOf('..') !== -1) return false;
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
  }

  function isValidName(name) {
    return /^[\p{L}\p{M}0-9 .,'’\-]+$/u.test(name);
  }

  function sheetSafe(value) {
    var s = value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
    return s;
  }

  function unwrapSheetText(value) {
    var s = value == null ? '' : String(value);
    if (s.charAt(0) === "'" && /^[=+\-@\t\r]/.test(s.charAt(1) || '')) return s.slice(1);
    return s;
  }

  function todayKeyIn(date, timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date || new Date());
  }

  function todayKey(date) {
    return todayKeyIn(date, TIMEZONE);
  }

  function isActive(row) {
    var status = String(row && row.status || '').trim().toLowerCase();
    return status !== 'cancelled' && status !== 'needs-review' && status !== 'superseded';
  }

  function stamp(date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date || new Date());
    function get(type) {
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === type) return parts[i].value;
      }
      return '';
    }
    return get('year') + '-' + get('month') + '-' + get('day') + ' ' +
      get('hour') + ':' + get('minute') + ':' + get('second');
  }

  function formatSheetDate(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return todayKeyIn(value, 'America/New_York');
    }
    if (typeof value === 'number' && isFinite(value)) {
      var ms = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000;
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(ms));
    }
    var s = unwrapSheetText(value).trim();
    var match = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    var mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!mdy) return s;
    var year = Number(mdy[3]);
    if (year < 100) year += 2000;
    var month = Number(mdy[1]);
    var day = Number(mdy[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return s;
    return year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
  }

  function minutesToClock_(minutes) {
    var wrapped = ((minutes % 1440) + 1440) % 1440;
    var hour24 = Math.floor(wrapped / 60);
    var minute = wrapped % 60;
    var ap = hour24 >= 12 ? 'PM' : 'AM';
    var hour = hour24 % 12;
    if (hour === 0) hour = 12;
    return hour + ':' + (minute < 10 ? '0' : '') + minute + ' ' + ap;
  }

  function formatSheetTime(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
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
    if (typeof value === 'number' && isFinite(value)) {
      var whole = Math.floor(Math.abs(value));
      var minutes = Math.round((Math.abs(value) - whole) * 1440);
      if (whole <= 1 || Math.abs(value) - whole > 0) return minutesToClock_(minutes);
      return '';
    }
    return unwrapSheetText(value).trim();
  }

  function parseSignup(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, error: 'Invalid request.' };
    }
    var honeypot = body.company == null ? '' : String(body.company).trim();
    if (honeypot) {
      return { ok: false, error: 'Could not submit the form.', honeypot: true };
    }

    var name = cleanName(body.name);
    var email = normalizeEmail(body.email);
    var eventName = asText(body.event).trim();
    var date = asText(body.date).trim();
    var task = asText(body.task).trim();

    if (!name) return { ok: false, error: 'Enter your name.' };
    if (name.length < MIN_NAME || name.length > MAX_NAME) {
      return { ok: false, error: 'Name must be between 2 and 80 characters.' };
    }
    if (!isValidName(name)) {
      return { ok: false, error: "Name can only include letters, numbers, spaces, and . ' - ," };
    }
    if (!email) return { ok: false, error: 'Enter your email.' };
    if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address.' };
    if (!eventName || !date || !task || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: 'Choose an event and task.' };
    }
    if (eventName.length > MAX_LABEL || task.length > MAX_LABEL) {
      return { ok: false, error: 'That event or task is not on the sheet.' };
    }

    return {
      ok: true,
      value: {
        name: name,
        email: email,
        event: eventName,
        date: date,
        task: task,
        slotId: slotId(date, eventName, task)
      }
    };
  }

  function checkRateLimit(hitsByEmail, email, nowMs) {
    var list = (hitsByEmail[email] || []).filter(function (t) {
      return nowMs - t < RATE_WINDOW_MS;
    });
    if (list.length >= RATE_MAX) {
      hitsByEmail[email] = list;
      return false;
    }
    list.push(nowMs);
    hitsByEmail[email] = list;
    return true;
  }

  function findSlot(slots, id) {
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].slotId === id) return slots[i];
    }
    return null;
  }

  function decide(value, state, today) {
    var slot = findSlot(state.slots, value.slotId);
    if (!slot) return { ok: false, error: 'That event or task is not on the sheet.' };
    if (String(slot.date) < String(today)) {
      return { ok: false, error: 'This event is closed.' };
    }
    var capacity = Math.floor(Number(slot.capacity));
    if (!isFinite(capacity) || capacity < 1) {
      return { ok: false, error: 'That task is full.' };
    }
    var taken = 0;
    for (var i = 0; i < state.signups.length; i++) {
      var row = state.signups[i];
      if (row.slotId !== slot.slotId || !isActive(row)) continue;
      taken += 1;
      if (row.email && row.email === value.email) {
        return { ok: false, error: 'You are already signed up for this task.' };
      }
    }
    if (taken >= capacity) {
      return { ok: false, error: 'That task is full.' };
    }
    return {
      ok: true,
      signup: {
        slotId: slot.slotId,
        name: value.name,
        email: value.email,
        source: 'web'
      },
      slot: slot,
      message: 'You are signed up for ' + slot.task + '.'
    };
  }

  function publicCatalog(slots, signups, today) {
    var events = [];
    var index = {};
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var key = slot.date + '|' + slot.event;
      if (!index[key]) {
        index[key] = {
          date: slot.date,
          time: slot.time,
          name: slot.event,
          location: slot.location,
          tasks: []
        };
        events.push(index[key]);
      }
      var names = [];
      for (var s = 0; s < signups.length; s++) {
        if (!isActive(signups[s])) continue;
        if (signups[s].slotId === slot.slotId && signups[s].name) names.push(signups[s].name);
      }
      index[key].tasks.push({
        task: slot.task,
        capacity: Number(slot.capacity),
        names: names,
        timeLabel: slot.timeLabel || '',
        description: slot.description || '',
        roleDate: slot.roleDate || slot.date || '',
        roleStart: slot.roleStart || ''
      });
    }
    return {
      ok: true,
      org: ORG,
      title: TITLE,
      asOf: today,
      events: events
    };
  }

  return {
    ORG: ORG,
    TITLE: TITLE,
    TIMEZONE: TIMEZONE,
    RATE_MAX: RATE_MAX,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    slotId: slotId,
    cleanName: cleanName,
    normalizeEmail: normalizeEmail,
    isValidEmail: isValidEmail,
    sheetSafe: sheetSafe,
    unwrapSheetText: unwrapSheetText,
    todayKey: todayKey,
    todayKeyIn: todayKeyIn,
    isActive: isActive,
    stamp: stamp,
    formatSheetDate: formatSheetDate,
    formatSheetTime: formatSheetTime,
    parseSignup: parseSignup,
    checkRateLimit: checkRateLimit,
    decide: decide,
    publicCatalog: publicCatalog
  };
})();

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    return jsonOut_(handleGet_(scriptDeps_()));
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Could not read the sign-up sheet.' });
  }
}

function doPost(e) {
  var raw = '';
  try {
    raw = e && e.postData && e.postData.contents ? String(e.postData.contents) : '';
  } catch (err) {
    raw = '';
  }
  try {
    return jsonOut_(interpretPost_(raw, scriptDeps_()));
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Could not submit the form.' });
  }
}

function interpretPost_(raw, deps) {
  raw = raw == null ? '' : String(raw);
  if (raw.length > 4000) return { ok: false, error: 'Invalid request.' };
  var body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch (err) {
    return { ok: false, error: 'Invalid request.' };
  }
  if (body && typeof body === 'object' && !Array.isArray(body) && body.action) {
    if (body.action === 'lookup') return lookupSignup_(body, deps);
    if (body.action === 'cancel') return cancelSignup_(body, deps);
    if (body.action === 'cancelByEmail') return cancelByEmail_(body, deps);
    if (body.action === 'move') return moveSignup_(body, deps);
    return { ok: false, error: 'Invalid request.' };
  }
  return processPost_(body, deps);
}

function handleGet_(deps) {
  var state = deps.readState();
  return ABA_RULES.publicCatalog(state.slots, state.signups, deps.today());
}

function processPost_(body, deps) {
  var parsed = ABA_RULES.parseSignup(body);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  if (!deps.rateLimit(parsed.value.email, deps.now())) {
    return { ok: false, error: 'Too many sign-up attempts. Please wait a few minutes and try again.' };
  }

  var result = { ok: false, error: 'Could not submit the form.' };
  var mail = null;
  var calendarChanges = [];
  var outcome;
  try {
    outcome = deps.withLock(function () {
      var state = deps.readState();
      var decision = ABA_RULES.decide(parsed.value, state, deps.today());
      if (!decision.ok) {
        result = { ok: false, error: decision.error };
        return;
      }
      var record = signupRecord_(decision, deps);
      if (record.email) {
        mail = buildMessage_(record, decision.slot, 'confirm');
        calendarChanges.push({ action: 'add', email: record.email, slot: decision.slot });
      }
      deps.appendSignup(record);
      result = { ok: true, message: decision.message };
    });
  } catch (err) {
    return { ok: false, error: 'Could not submit the form.' };
  }
  if (outcome === false) {
    return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
  }
  return finishWithCalendar_(result, mail, deps, calendarChanges);
}

function splitPlace_(location, eventName) {
  var text = String(location || '').trim();
  var prefix = String(eventName || '') + ', ';
  if (prefix !== ', ' && text.indexOf(prefix) === 0) text = text.slice(prefix.length).trim();
  var dash = text.match(/^(.*?)\s+-\s*(.+)$/) || text.match(/^(.*?)\s*-\s*(\d.*)$/);
  if (dash && dash[1] && /\d/.test(dash[2])) {
    return { venue: dash[1].trim(), address: dash[2].trim() };
  }
  var comma = text.indexOf(',');
  if (comma > 0 && /^\d/.test(text.slice(comma + 1).trim())) {
    return { venue: text.slice(0, comma).trim(), address: text.slice(comma + 1).trim() };
  }
  return { venue: text, address: '' };
}

function fullPlace_(venue, address) {
  var name = String(venue || '').trim();
  var street = String(address || '').trim();
  if (name && street) return name + ', ' + street;
  return name || street;
}

function placeFromEvents_(date, eventName, events) {
  var key = ABA_RULES.formatSheetDate(date);
  var list = events || [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].date) === String(key) && list[i].type === eventName) {
      return splitPlace_(list[i].location, list[i].type);
    }
  }
  return null;
}

function planSignupV4_(values, events) {
  var sourceHeader = (values[0] || []).map(function (cell) { return String(cell || '').trim(); });
  function cell(row, name) {
    var index = columnIndex_(sourceHeader, name);
    if (index === -1) return '';
    var value = row[index];
    return value == null ? '' : value;
  }
  var already = columnIndex_(sourceHeader, 'location') === -1 && columnIndex_(sourceHeader, 'venue') !== -1 && columnIndex_(sourceHeader, 'address') !== -1;
  var rows = [];
  var kept = 0;
  for (var r = 1; r < values.length; r++) {
    var src = values[r] || [];
    var blank = true;
    for (var c = 0; c < src.length; c++) {
      if (src[c] !== '' && src[c] != null) blank = false;
    }
    if (blank) continue;
    kept += 1;
    var record = {};
    SIGNUP_FIELDS.forEach(function (name) { record[name] = cell(src, name); });
    record.status = cell(src, 'status');
    if (!record.startTime && !record.endTime) {
      var clocks = splitStoredTime_(cell(src, 'time'));
      record.startTime = clocks.start;
      record.endTime = clocks.end;
    }
    if (!already) {
      var raw = cell(src, 'location');
      var place = placeFromEvents_(record.date, record.event, events) || splitPlace_(raw, record.event);
      record.venue = place.venue;
      record.address = place.address;
    }
    rows.push(SIGNUP_FIELDS.map(function (name) {
      var value = record[name];
      return value == null ? '' : value;
    }));
  }
  return { headers: SIGNUP_HEADERS.slice(), rows: rows, kept: kept, already: already, hidden: SIGNUP_HIDDEN.slice() };
}

function signupPlace_(slot) {
  if (slot && (slot.venue || slot.address)) return { venue: slot.venue || '', address: slot.address || '' };
  return splitPlace_(slot && slot.location, slot && slot.event);
}

function signupRecord_(decision, deps) {
  var slot = decision.slot;
  var place = signupPlace_(slot);
  return {
    name: decision.signup.name,
    email: decision.signup.email,
    event: slot.event,
    date: slot.date,
    time: (slot.roleStart && slot.roleEnd) ? slot.roleStart + '–' + slot.roleEnd : (slot.time || ''),
    startTime: slot.roleStart || '',
    endTime: slot.roleEnd || '',
    task: slot.task,
    venue: place.venue,
    address: place.address,
    location: fullPlace_(place.venue, place.address) || (slot.location || ''),
    capacity: slot.capacity,
    createdAt: deps.stamp(deps.now()),
    signupId: deps.newId(),
    slotId: slot.slotId,
    source: 'web',
    token: deps.newToken ? deps.newToken() : '',
    status: 'active',
    reminderSent: '',
    updatedAt: '',
    previousSlotId: '',
    sequence: 0
  };
}

function finishWithCalendar_(result, mail, deps, changes) {
  if (result && result.ok && changes && changes.length) {
    var invited = false;
    try {
      var run = deps && deps.calendarGuest ? deps.calendarGuest : syncCalendarGuests_;
      invited = run(changes) === true;
    } catch (err) {
      invited = false;
      try { Logger.log('Calendar update failed: ' + err); } catch (ignore) {}
    }
    if (invited && mail) mail.ics = '';
  }
  return deliverMail_(result, mail, deps);
}

function deliverMail_(result, mail, deps) {
  if (result && result.ok && mail && deps.sendMail) {
    try {
      deps.sendMail(mail);
    } catch (err) {
      result.message = (result.message || 'Saved.') + ' We could not send the confirmation email.';
    }
  }
  return result;
}

function scriptDeps_() {
  return {
    now: function () { return Date.now(); },
    today: function () { return ABA_RULES.todayKey(new Date()); },
    stamp: function (nowMs) { return ABA_RULES.stamp(new Date(nowMs)); },
    rateLimit: cacheRateLimit_,
    withLock: withScriptLock_,
    readState: readState_,
    appendSignup: appendSignup_,
    updateSignup: updateSignup_,
    newId: function () { return Utilities.getUuid(); },
    newToken: newToken_,
    sendMail: sendMailApp_,
    calendarGuest: function (changes) { return syncCalendarGuests_(changes); },
    todayEastern: function () { return ABA_RULES.todayKeyIn(new Date(), ABA_CALENDAR_TZ); }
  };
}

function cacheRateLimit_(email, nowMs) {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'rl:' + email;
    var hits = [];
    var raw = cache.get(key);
    if (raw) {
      hits = JSON.parse(raw);
      if (!Array.isArray(hits)) hits = [];
    }
    var store = {};
    store[email] = hits;
    var allowed = ABA_RULES.checkRateLimit(store, email, nowMs);
    cache.put(key, JSON.stringify(store[email]), 600);
    return allowed;
  } catch (err) {
    return true;
  }
}

function withScriptLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return false;
  }
  try {
    fn();
    return true;
  } finally {
    lock.releaseLock();
  }
}

function openSheet_() {
  var active = null;
  try {
    active = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    active = null;
  }
  if (active && active.getId && active.getId() === SPREADSHEET_ID) return active;
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function readState_() {
  var ss = openSheet_();
  var signupsSheet = ss.getSheetByName('Signups');
  if (!signupsSheet) throw new Error('Sheet is not set up.');
  var parsed = rowsToState_([[]], signupsSheet.getDataRange().getValues());
  return { slots: abaCatalogSlots_(), signups: parsed.signups };
}

function abaCatalogSlots_() {
  return abaExpandEvents_();
}

function headerKey_(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function headerField_(name) {
  var key = headerKey_(name);
  if (key === 'eventtype' || key === 'eventname') return 'event';
  for (var i = 0; i < SIGNUP_FIELDS.length; i++) {
    if (headerKey_(SIGNUP_FIELDS[i]) === key) return SIGNUP_FIELDS[i];
  }
  if (key === 'time' || key === 'location') return key;
  return '';
}

function headerIndex_(headers, key) {
  for (var i = 0; i < headers.length; i++) {
    if (headerKey_(headers[i]) === key) return i;
  }
  return -1;
}

function columnIndex_(headers, field) {
  var want = headerField_(field) || headerKey_(field);
  var list = headers || [];
  for (var i = 0; i < list.length; i++) {
    var got = headerField_(list[i]);
    if (got && got === want) return i;
    if (headerKey_(list[i]) === headerKey_(field)) return i;
  }
  return -1;
}

function sheetField_(row, key) {
  var names = Object.keys(row || {});
  for (var i = 0; i < names.length; i++) {
    if (headerKey_(names[i]) === key && row[names[i]] != null && row[names[i]] !== '') return row[names[i]];
  }
  return '';
}

function tidyClock_(text) {
  var match = String(text || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return String(text || '').trim();
  return Number(match[1]) + ':' + match[2] + ' ' + match[3].toUpperCase();
}

function splitStoredTime_(value) {
  var text = ABA_RULES.formatSheetTime(value).replace(/^([A-Za-z]{3,9}\s+\d{1,2},\s*)/, '');
  text = text.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
  var both = text.match(/^(\d{1,2}:\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}:\d{2})\s*(AM|PM)$/i);
  if (both) {
    var endAp = both[4].toUpperCase();
    var startAp = (both[2] || endAp).toUpperCase();
    return { start: tidyClock_(both[1] + ' ' + startAp), end: tidyClock_(both[3] + ' ' + endAp) };
  }
  var one = text.match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
  if (one) return { start: tidyClock_(one[1] + ' ' + one[2]), end: '' };
  return { start: text, end: '' };
}

function clocksForRow_(row, slots) {
  var date = ABA_RULES.formatSheetDate(sheetField_(row, 'date') || row.date || '');
  var eventName = sheetField_(row, 'event') || row.event || '';
  var task = sheetField_(row, 'task') || row.task || '';
  var slotId = String(sheetField_(row, 'slotid') || row.slotId || (date && eventName && task ? date + '|' + eventName + '|' + task : ''));
  var slot = null;
  for (var i = 0; i < (slots || []).length; i++) {
    if (slots[i].slotId === slotId) { slot = slots[i]; break; }
  }
  if (slot && slot.roleStart) return { start: tidyClock_(slot.roleStart), end: tidyClock_(slot.roleEnd || '') };
  var stored = sheetField_(row, 'starttime') || row.startTime || '';
  if (stored) return { start: tidyClock_(ABA_RULES.formatSheetTime(stored)), end: tidyClock_(ABA_RULES.formatSheetTime(sheetField_(row, 'endtime') || row.endTime || '')) };
  return splitStoredTime_(sheetField_(row, 'time') || row.time || '');
}

function clockStart_(row) {
  return clocksForRow_(row, []).start;
}

function clockEnd_(row) {
  return clocksForRow_(row, []).end;
}

function clockRange_(row) {
  var clocks = clocksForRow_(row, []);
  if (clocks.start && clocks.end) return clocks.start + '–' + clocks.end;
  return clocks.start || ABA_RULES.formatSheetTime(sheetField_(row, 'time') || row.time || '');
}

function rowsToState_(slotValues, signupValues) {
  var slotObjects = tableObjects_(slotValues);
  var signupObjects = tableObjects_(signupValues);
  var slots = [];
  for (var i = 0; i < slotObjects.length; i++) {
    var slot = slotObjects[i];
    if (!slot.slotId || !slot.date || !slot.task) continue;
    slots.push({
      slotId: String(slot.slotId),
      date: ABA_RULES.formatSheetDate(slot.date),
      time: ABA_RULES.formatSheetTime(slot.time),
      event: String(slot.event || ''),
      location: String(slot.location || ''),
      task: String(slot.task || ''),
      capacity: Math.floor(Number(slot.capacity))
    });
  }
  var signups = [];
  for (var j = 0; j < signupObjects.length; j++) {
    var row = signupObjects[j];
    if (!row.slotId) continue;
    var parsedId = parseSlotId_(row.slotId);
    signups.push({
      rowNumber: row.__row,
      signupId: String(row.signupId || ''),
      slotId: String(row.slotId),
      name: ABA_RULES.unwrapSheetText(row.name).trim(),
      email: ABA_RULES.normalizeEmail(ABA_RULES.unwrapSheetText(row.email)),
      createdAt: row.createdAt == null ? '' : String(row.createdAt),
      source: String(row.source || ''),
      event: String(row.event || (parsedId && parsedId.event) || ''),
      date: ABA_RULES.formatSheetDate(row.date || (parsedId && parsedId.date) || ''),
      time: clockRange_(row),
      startTime: clockStart_(row),
      endTime: clockEnd_(row),
      task: String(row.task || (parsedId && parsedId.task) || ''),
      venue: String(row.venue || ''),
      address: String(row.address || ''),
      location: fullPlace_(row.venue, row.address) || String(row.location || ''),
      capacity: row.capacity === '' || row.capacity == null ? '' : Math.floor(Number(row.capacity)),
      token: String(row.token || '').trim(),
      status: String(sheetField_(row, 'status') || '').trim(),
      reminderSent: String(row.reminderSent || '').trim(),
      updatedAt: row.updatedAt == null ? '' : String(row.updatedAt),
      previousSlotId: String(row.previousSlotId || ''),
      sequence: Math.floor(Number(row.sequence || 0)) || 0
    });
  }
  return { slots: slots, signups: signups };
}

function tableObjects_(values) {
  if (!values || values.length < 2) return [];
  var header = [];
  for (var h = 0; h < values[0].length; h++) header.push(String(values[0][h] || '').trim());
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var empty = true;
    for (var c = 0; c < values[r].length; c++) {
      if (values[r][c] !== '' && values[r][c] != null) empty = false;
    }
    if (empty) continue;
    var obj = { __row: r + 1 };
    for (var i = 0; i < header.length; i++) {
      if (!header[i]) continue;
      var field = headerField_(header[i]) || header[i];
      obj[field] = values[r][i];
    }
    out.push(obj);
  }
  return out;
}

function signupValue_(name, row) {
  var field = headerField_(name) || name;
  var key = headerKey_(field);
  if (key === 'name' || key === 'email') return ABA_RULES.sheetSafe(sheetField_(row, key));
  if (key === 'date') {
    var iso = ABA_RULES.formatSheetDate(sheetField_(row, 'date'));
    if (!iso) return '';
    var parts = iso.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  if (key === 'starttime') return ABA_RULES.formatSheetTime(sheetField_(row, 'starttime'));
  if (key === 'endtime') return ABA_RULES.formatSheetTime(sheetField_(row, 'endtime'));
  if (key === 'time') return ABA_RULES.formatSheetTime(sheetField_(row, 'time'));
  if (row[field] != null) return row[field];
  if (row[name] != null) return row[name];
  return sheetField_(row, key);
}

function plainTextColumns_(sheet, headers) {
  var height = Math.max(sheet.getLastRow() + 20, 2);
  headers.forEach(function (name, col) {
    var key = headerKey_(name);
    if (key !== 'time' && key !== 'starttime' && key !== 'endtime') return;
    sheet.getRange(2, col + 1, height - 1, 1).setNumberFormat('@');
  });
}

function writeDateCells_(sheet, headers, startRow, grid) {
  var col = headerIndex_(headers, 'date');
  if (col === -1 || !grid.length) return;
  var values = [];
  for (var i = 0; i < grid.length; i++) {
    var iso = ABA_RULES.formatSheetDate(grid[i][col]);
    if (!iso) { values.push(['']); continue; }
    var parts = iso.split('-');
    values.push([new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))]);
  }
  var range = sheet.getRange(startRow, col + 1, grid.length, 1);
  range.setNumberFormat('M/d/yyyy');
  range.setValues(values);
}

function writePlainTextCells_(sheet, headers, startRow, grid) {
  headers.forEach(function (name, col) {
    var key = headerKey_(name);
    if (key !== 'time' && key !== 'starttime' && key !== 'endtime') return;
    if (!grid.length) return;
    var values = [];
    for (var i = 0; i < grid.length; i++) values.push([grid[i][col] == null ? '' : String(grid[i][col])]);
    var range = sheet.getRange(startRow, col + 1, grid.length, 1);
    range.setNumberFormat('@');
    range.setValues(values);
  });
}

function signupCells_(row) {
  return SIGNUP_HEADERS.map(function (name) { return signupValue_(name, row); });
}

function readHeaders_(sheet) {
  var last = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, last).getValues()[0].map(function (cell) {
    return String(cell || '').trim();
  });
}

function appendSignup_(row) {
  var sheet = openSheet_().getSheetByName('Signups');
  if (!sheet) throw new Error('Signups tab is missing.');
  if (row && Object.prototype.hasOwnProperty.call(row, 'status')) ensureStatusColumn_(sheet);
  var headers = readHeaders_(sheet);
  var values = headers.map(function (name) { return signupValue_(name, row); });
  var rowNumber = sheet.getLastRow() + 1;
  plainTextColumns_(sheet, headers);
  SpreadsheetApp.flush();
  sheet.getRange(rowNumber, 1, 1, values.length).setValues([values]);
  writeDateCells_(sheet, headers, rowNumber, [values]);
  writePlainTextCells_(sheet, headers, rowNumber, [values]);
}

function updateSignup_(rowNumber, fields) {
  var sheet = openSheet_().getSheetByName('Signups');
  if (!sheet) throw new Error('Signups tab is missing.');
  if (fields && Object.prototype.hasOwnProperty.call(fields, 'status')) ensureStatusColumn_(sheet);
  var headers = readHeaders_(sheet);
  plainTextColumns_(sheet, headers);
  if (fields.date != null || fields.time != null) SpreadsheetApp.flush();
  Object.keys(fields).forEach(function (name) {
    var col = columnIndex_(headers, name);
    if (col === -1) col = headers.indexOf(name);
    if (col === -1) {
      if (headerKey_(name) === 'status') throw new Error('The status column is missing.');
      return;
    }
    var cell = sheet.getRange(rowNumber, col + 1);
    var key = headerKey_(name);
    if (key === 'date') cell.setNumberFormat('M/d/yyyy');
    if (key === 'time' || key === 'starttime' || key === 'endtime' || key === 'status') cell.setNumberFormat('@');
    if (key === 'status') SpreadsheetApp.flush();
    cell.setValue(signupValue_(name, fields));
  });
}

function buildSeedRows_(seed) {
  var slotRows = [];
  var signupRows = [];
  var count = 0;
  seed.events.forEach(function (event) {
    event.tasks.forEach(function (task) {
      var id = ABA_RULES.slotId(event.date, event.name, task.task);
      slotRows.push([id, event.date, event.time, event.name, event.location, task.task, task.capacity]);
      (task.names || []).forEach(function (person) {
        count += 1;
        var name = typeof person === 'string' ? person : person.name;
        var place = splitPlace_(event.location, event.name);
        var record = {
          name: name,
          email: '',
          event: event.name,
          date: event.date,
          time: event.time,
          startTime: event.time,
          endTime: '',
          task: task.task,
          venue: place.venue,
          address: place.address,
          capacity: task.capacity,
          status: '',
          createdAt: seed.pulledAt || '',
          signupId: 'seed-' + String(count).padStart(2, '0'),
          slotId: id,
          source: 'seed',
          token: '',
          oldTask: '',
          previousSlotId: '',
          sequence: 0,
          reminderSent: '',
          updatedAt: ''
        };
        signupRows.push(SIGNUP_FIELDS.map(function (key) {
          var value = record[key];
          return value == null ? '' : value;
        }));
      });
    });
  });
  return { slotRows: slotRows, signupRows: signupRows };
}

function assertSeed_(seed) {
  var tasks = 0;
  var capacity = 0;
  var names = 0;
  seed.events.forEach(function (event) {
    event.tasks.forEach(function (task) {
      tasks += 1;
      capacity += Number(task.capacity);
      names += (task.names || []).length;
    });
  });
  if (seed.events.length !== 11 || tasks !== 59 || capacity !== 300 || names !== 24) {
    throw new Error('Seed data failed its integrity check.');
  }
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/**
 * Creates the Slots and Signups tabs and writes the Nov 17, 2026 seed.
 * Run this once from the Apps Script editor. Refuses to run twice.
 */
function setup() {
  var seed = abaSeedData();
  assertSeed_(seed);
  var built = buildSeedRows_(seed);
  var ss = openSheet_();
  try {
    ss.setSpreadsheetTimeZone(ABA_RULES.TIMEZONE);
  } catch (err) {
    Logger.log('Could not set the spreadsheet timezone. Continuing.');
  }

  var signupsSheet = getOrCreateSheet_(ss, 'Signups');
  if (signupsSheet.getLastRow() > 1) {
    throw new Error('Signups already has rows, so setup stopped to avoid duplicating them. The live sheet should run migrateV2 instead of setup.');
  }

  writeHeaders_(signupsSheet, SIGNUP_HEADERS);
  plainTextColumns_(signupsSheet, SIGNUP_HEADERS);
  SpreadsheetApp.flush();
  // getRange(row, column, numRows, numColumns) — the third argument is a count.
  signupsSheet.getRange(2, 1, built.signupRows.length, SIGNUP_HEADERS.length).setNumberFormat('@');
  signupsSheet.getRange(2, 1, built.signupRows.length, SIGNUP_HEADERS.length).setValues(built.signupRows);
  writeDateCells_(signupsSheet, SIGNUP_HEADERS, 2, built.signupRows);
  writePlainTextCells_(signupsSheet, SIGNUP_HEADERS, 2, built.signupRows);
  var emailCol = columnIndex_(SIGNUP_HEADERS, 'email') + 1;
  signupsSheet.getRange(1, emailCol).setNote('Email addresses stay in this sheet. The public page shows names only.');
  signupsSheet.getRange(1, columnIndex_(SIGNUP_HEADERS, 'token') + 1).setNote('Private manage token. Do not share this column.');
  sizeColumns_(signupsSheet, [180, 220, 160, 120, 100, 220, 360, 90, 180, 120, 280, 80, 220, 100, 130, 160, 220, 90]);

  var stray = ss.getSheetByName('Sheet1');
  if (stray && ss.getSheets().length > 1 && stray.getLastRow() === 0) {
    ss.deleteSheet(stray);
  }
  SpreadsheetApp.flush();

  var summary = 'Setup complete. ' + built.slotRows.length +
    ' tasks and ' + built.signupRows.length +
    ' existing sign-ups were written to this spreadsheet.';
  Logger.log(summary);
  try {
    SpreadsheetApp.getUi().alert(summary);
  } catch (err) {
    // Running outside the spreadsheet editor has no UI. The log and return value are enough.
  }
  return summary;
}

function writeHeaders_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#407589')
    .setFontColor('#ffffff');
}

function sizeColumns_(sheet, widths) {
  for (var i = 0; i < widths.length; i++) sheet.setColumnWidth(i + 1, widths[i]);
}

function newToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function sendMailApp_(message) {
  var options = {
    to: message.to,
    subject: message.subject,
    body: message.text,
    htmlBody: message.html,
    name: message.name || ABA_MAIL_NAME,
    replyTo: message.replyTo || ABA_MAIL_REPLY_TO
  };
  if (message.ics) {
    var method = /METHOD:CANCEL/.test(message.ics) ? 'CANCEL' : 'REQUEST';
    var blob = Utilities.newBlob(message.ics, 'text/calendar', 'invite.ics');
    blob.setName('invite.ics');
    blob.setContentType('text/calendar; method=' + method + '; charset=UTF-8');
    options.attachments = [blob];
  }
  MailApp.sendEmail(options);
}

function cleanToken_(value) {
  var token = String(value || '').trim();
  if (!/^[A-Za-z0-9]{32,80}$/.test(token)) return '';
  return token;
}

function findToken_(signups, token) {
  for (var i = 0; i < signups.length; i++) {
    if (signups[i].token === token) return signups[i];
  }
  return null;
}

function findSlotLocal_(slots, slotId) {
  for (var i = 0; i < slots.length; i++) {
    if (slots[i].slotId === slotId) return slots[i];
  }
  return null;
}

function countActive_(signups, slotId, exceptSignupId) {
  var n = 0;
  for (var i = 0; i < signups.length; i++) {
    var row = signups[i];
    if (row.slotId !== slotId || !ABA_RULES.isActive(row)) continue;
    if (exceptSignupId && row.signupId === exceptSignupId) continue;
    n += 1;
  }
  return n;
}

function emailTaken_(signups, slotId, email, exceptSignupId) {
  if (!email) return false;
  for (var i = 0; i < signups.length; i++) {
    var row = signups[i];
    if (row.slotId !== slotId || !ABA_RULES.isActive(row)) continue;
    if (exceptSignupId && row.signupId === exceptSignupId) continue;
    if (row.email && row.email === email) return true;
  }
  return false;
}

function copyFields_(row, fields) {
  var out = {};
  Object.keys(row || {}).forEach(function (key) { out[key] = row[key]; });
  Object.keys(fields || {}).forEach(function (key) { out[key] = fields[key]; });
  return out;
}

function slotForRow_(state, row) {
  return findSlotLocal_(state.slots, row.slotId) || {
    slotId: row.slotId,
    event: row.event,
    date: row.date,
    time: row.time,
    task: row.task,
    venue: row.venue || '',
    address: row.address || '',
    location: fullPlace_(row.venue, row.address) || row.location || '',
    capacity: row.capacity
  };
}

function lookupStatus_(row) {
  var status = String(row.status || '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'needs-review' || status === 'superseded') return status;
  return 'active';
}

function lookupSignup_(body, deps) {
  var token = cleanToken_(body.token);
  if (!token) return { ok: false, error: 'That link is not valid.' };
  var state = deps.readState();
  var row = findToken_(state.signups, token);
  if (!row) return { ok: false, error: 'That link is not valid.' };
  var slot = slotForRow_(state, row);
  return {
    ok: true,
    signup: {
      name: row.name,
      email: row.email,
      status: lookupStatus_(row),
      event: slot.event,
      date: slot.date,
      time: slot.time,
      timeLabel: slot.timeLabel || '',
      description: slot.description || '',
      roleDate: slot.roleDate || '',
      task: slot.task,
      location: fullPlace_(slot.venue, slot.address) || slot.location || ''
    }
  };
}

function sameSignupName_(a, b) {
  return ABA_RULES.cleanName(a).toLowerCase() === ABA_RULES.cleanName(b).toLowerCase();
}

function clockLabel_(value) {
  var text = tidyClock_(ABA_RULES.formatSheetTime(value));
  if (/^\d{1,2}:\d{2}\s+(AM|PM)$/.test(text)) return text;
  var split = splitStoredTime_(value);
  var start = tidyClock_(split.start);
  if (/^\d{1,2}:\d{2}\s+(AM|PM)$/.test(start)) return start;
  return '';
}

function cancelByEmail_(body, deps) {
  var email = ABA_RULES.normalizeEmail(body && body.email);
  var eventName = String(body && body.event || '').trim();
  var date = ABA_RULES.formatSheetDate(body && body.date);
  var task = String(body && body.task || '').trim();
  var start = clockLabel_(body && (body.startTime || ''));
  var name = ABA_RULES.cleanName(body && body.name);
  var mismatch = { ok: false, error: 'That email does not match this sign-up.' };
  if (!email || !ABA_RULES.isValidEmail(email)) return { ok: false, error: 'Enter the email you signed up with.' };
  if (!eventName || !task || !name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !start) return mismatch;
  if (!deps.rateLimit(email, deps.now())) {
    return { ok: false, error: 'Too many attempts. Please wait a few minutes and try again.' };
  }
  var result = mismatch;
  var mail = null;
  var calendarChanges = [];
  var outcome;
  try {
    outcome = deps.withLock(function () {
      var state = deps.readState();
      var slotId = ABA_RULES.slotId(date, eventName, task);
      var slot = findSlotLocal_(state.slots, slotId);
      var match = null;
      for (var i = 0; i < state.signups.length; i++) {
        var row = state.signups[i];
        if (!ABA_RULES.isActive(row) || !sameSignupName_(row.name, name)) continue;
        var sameSlot = row.slotId === slotId || (
          String(row.event || '') === eventName &&
          ABA_RULES.formatSheetDate(row.date) === date &&
          String(row.task || '') === task
        );
        if (!sameSlot) continue;
        var rowStart = clockLabel_(row.startTime);
        if (!rowStart && slot && slot.roleStart) rowStart = clockLabel_(slot.roleStart);
        if (!rowStart) rowStart = clockLabel_(row.time);
        if (rowStart !== start || row.email !== email) continue;
        match = row;
        break;
      }
      if (!match) {
        result = mismatch;
        return;
      }
      var fields = {
        status: 'cancelled',
        updatedAt: deps.stamp(deps.now()),
        sequence: (Math.floor(Number(match.sequence)) || 0) + 1
      };
      deps.updateSignup(match.rowNumber, fields);
      var mailSlot = slot || slotForRow_(state, match);
      if (match.email) {
        mail = buildMessage_(copyFields_(match, fields), mailSlot, 'cancel');
        calendarChanges.push({ action: 'remove', email: match.email, slot: mailSlot });
      }
      result = { ok: true, message: 'Your sign-up is cancelled.' };
    });
  } catch (err) {
    return { ok: false, error: 'Could not cancel the sign-up.' };
  }
  if (outcome === false) return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
  return finishWithCalendar_(result, mail, deps, calendarChanges);
}

function cancelSignup_(body, deps) {
  var token = cleanToken_(body.token);
  if (!token) return { ok: false, error: 'That link is not valid.' };
  var result = { ok: false, error: 'Could not cancel the sign-up.' };
  var mail = null;
  var calendarChanges = [];
  var outcome;
  try {
    outcome = deps.withLock(function () {
      var state = deps.readState();
      var row = findToken_(state.signups, token);
      if (!row) { result = { ok: false, error: 'That link is not valid.' }; return; }
      var slot = slotForRow_(state, row);
      if (!ABA_RULES.isActive(row)) {
        result = { ok: true, message: 'This sign-up is already cancelled.' };
        return;
      }
      var fields = {
        status: 'cancelled',
        updatedAt: deps.stamp(deps.now()),
        sequence: (Math.floor(Number(row.sequence)) || 0) + 1
      };
      deps.updateSignup(row.rowNumber, fields);
      if (row.email) {
        mail = buildMessage_(copyFields_(row, fields), slot, 'cancel');
        calendarChanges.push({ action: 'remove', email: row.email, slot: slot });
      }
      result = { ok: true, message: 'Your sign-up is cancelled.' };
    });
  } catch (err) {
    return { ok: false, error: 'Could not cancel the sign-up.' };
  }
  if (outcome === false) return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
  return finishWithCalendar_(result, mail, deps, calendarChanges);
}

function moveSignup_(body, deps) {
  var token = cleanToken_(body.token);
  if (!token) return { ok: false, error: 'That link is not valid.' };
  var eventName = String(body.event || '').trim();
  var date = String(body.date || '').trim();
  var task = String(body.task || '').trim();
  if (!eventName || !task || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Choose an open spot.' };
  }
  var slotId = ABA_RULES.slotId(date, eventName, task);
  var result = { ok: false, error: 'Could not update the sign-up.' };
  var mail = null;
  var calendarChanges = [];
  var outcome;
  try {
    outcome = deps.withLock(function () {
      var state = deps.readState();
      var row = findToken_(state.signups, token);
      if (!row) { result = { ok: false, error: 'That link is not valid.' }; return; }
      if (!ABA_RULES.isActive(row)) { result = { ok: false, error: 'This sign-up is already cancelled.' }; return; }
      var slot = findSlotLocal_(state.slots, slotId);
      if (!slot) { result = { ok: false, error: 'That event or task is not on the sheet.' }; return; }
      if (String(slot.date) < String(deps.today())) { result = { ok: false, error: 'This event is closed.' }; return; }
      if (slot.slotId === row.slotId) { result = { ok: false, error: 'You are already signed up for this task.' }; return; }
      if (emailTaken_(state.signups, slot.slotId, row.email, row.signupId)) {
        result = { ok: false, error: 'You are already signed up for this task.' }; return;
      }
      var capacity = Math.floor(Number(slot.capacity));
      if (!isFinite(capacity) || capacity < 1 || countActive_(state.signups, slot.slotId, row.signupId) >= capacity) {
        result = { ok: false, error: 'That task is full.' }; return;
      }
      var place = signupPlace_(slot);
      var fields = {
        event: slot.event,
        date: slot.date,
        time: (slot.roleStart && slot.roleEnd) ? slot.roleStart + '–' + slot.roleEnd : (slot.time || ''),
        startTime: slot.roleStart || '',
        endTime: slot.roleEnd || '',
        task: slot.task,
        venue: place.venue,
        address: place.address,
        location: fullPlace_(place.venue, place.address) || slot.location || '',
        capacity: slot.capacity,
        slotId: slot.slotId,
        previousSlotId: row.slotId,
        updatedAt: deps.stamp(deps.now()),
        reminderSent: '',
        sequence: (Math.floor(Number(row.sequence)) || 0) + 1,
        status: 'active'
      };
      var oldSlot = findSlotLocal_(state.slots, row.slotId) || slotForRow_(state, row);
      deps.updateSignup(row.rowNumber, fields);
      if (row.email) {
        mail = buildMessage_(copyFields_(row, fields), slot, 'move');
        calendarChanges.push({ action: 'remove', email: row.email, slot: oldSlot });
        calendarChanges.push({ action: 'add', email: row.email, slot: slot });
      }
      result = { ok: true, message: 'You are now signed up for ' + slot.task + '.' };
    });
  } catch (err) {
    return { ok: false, error: 'Could not update the sign-up.' };
  }
  if (outcome === false) return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
  return finishWithCalendar_(result, mail, deps, calendarChanges);
}

function runReminders_(deps) {
  var today = deps.todayEastern ? deps.todayEastern() : ABA_RULES.todayKeyIn(new Date(deps.now()), ABA_CALENDAR_TZ);
  var claimed = [];
  var outcome = deps.withLock(function () {
    var state = deps.readState();
    remindersDue_({ slots: state.slots, signups: state.signups }, today).forEach(function (item) {
      deps.updateSignup(item.signup.rowNumber, { reminderSent: item.slot.date });
      claimed.push(item);
    });
  });
  if (outcome === false) return { ok: false, error: 'The sheet is busy. Run sendReminders again.', sent: 0 };
  var sent = 0;
  claimed.forEach(function (item) {
    try {
      deps.sendMail(buildMessage_(item.signup, item.slot, 'reminder'));
      sent += 1;
    } catch (err) {
      try { deps.updateSignup(item.signup.rowNumber, { reminderSent: '' }); } catch (ignore) {}
    }
  });
  return { ok: true, sent: sent };
}

function sendReminders() {
  var result = runReminders_(scriptDeps_());
  if (!result.ok) return result.error;
  return 'Sent ' + result.sent + ' reminder' + (result.sent === 1 ? '' : 's') + '.';
}

function installTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var names = triggers.map(function (trigger) { return trigger.getHandlerFunction(); });
  var plan = planTriggerHandlers_(names);
  plan.deleteIndexes.forEach(function (index) { ScriptApp.deleteTrigger(triggers[index]); });
  if (!plan.create) return 'Reminder trigger already installed. It runs daily around 9:00 AM Eastern.';
  var builder = ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(9).nearMinute(0);
  try { builder.inTimezone(ABA_CALENDAR_TZ); } catch (err) {}
  builder.create();
  return 'Reminder trigger installed. It runs daily around 9:00 AM Eastern and emails a participant when their event is exactly 2 days away.';
}

/**
 * Rewrites Signups into the v2 columns, backfills capacity and tokens,
 * keeps every existing sign-up row, and removes the Slots tab.
 * Safe to run again.
 */
function migrateV2() {
  var ss = openSheet_();
  var sheet = ss.getSheetByName('Signups');
  if (!sheet) throw new Error('Signups tab is missing.');
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var before = 0;
  for (var r = 1; r < values.length; r++) {
    var empty = true;
    for (var c = 0; c < values[r].length; c++) {
      if (values[r][c] !== '' && values[r][c] != null) empty = false;
    }
    if (!empty) before += 1;
  }
  var result = migrateSignupTable_(values, abaCatalogSlots_(), SIGNUP_HEADERS, function () { return newToken_(); });
  if (result.kept !== before) {
    throw new Error('Migration stopped because it would change the number of sign-up rows.');
  }
  plainTextColumns_(sheet, SIGNUP_HEADERS);
  SpreadsheetApp.flush();
  sheet.getRange(1, 1, result.values.length, SIGNUP_HEADERS.length).setNumberFormat('@');
  sheet.getRange(1, 1, result.values.length, SIGNUP_HEADERS.length).setValues(result.values);
  writeDateCells_(sheet, result.values[0], 2, result.values.slice(1));
  writePlainTextCells_(sheet, result.values[0], 2, result.values.slice(1));
  if (lastRow > result.values.length) {
    sheet.getRange(result.values.length + 1, 1, lastRow - result.values.length, Math.max(lastCol, SIGNUP_HEADERS.length)).clearContent();
  }
  writeHeaders_(sheet, SIGNUP_HEADERS);
  sheet.getRange(1, columnIndex_(SIGNUP_HEADERS, 'email') + 1).setNote('Email addresses stay in this sheet. The public page shows names only.');
  sheet.getRange(1, columnIndex_(SIGNUP_HEADERS, 'token') + 1).setNote('Private manage token. Do not share this column.');
  var slots = ss.getSheetByName('Slots');
  var removed = false;
  if (slots && ss.getSheets().length > 1) {
    ss.deleteSheet(slots);
    removed = true;
  }
  SpreadsheetApp.flush();
  var summary = 'Migration complete. Kept ' + result.kept + ' sign-up rows. Filled ' +
    result.capacitiesFilled + ' capacities and ' + result.tokensFilled + ' tokens. ' +
    (removed ? 'Removed the Slots tab.' : 'The Slots tab was already gone.');
  Logger.log(summary);
  try { SpreadsheetApp.getUi().alert(summary); } catch (err) {}
  return summary;
}

/**
 * Remaps existing sign-up rows onto the role templates.
 * Does not delete rows. Safe to run again.
 */
function migrateV3() {
  var ss = openSheet_();
  var sheet = ss.getSheetByName('Signups');
  if (!sheet) throw new Error('Signups tab is missing. Run migrateV2 first.');
  var headers = readHeaders_(sheet);
  if (columnIndex_(headers, 'oldTask') === -1) {
    var col = headers.length + 1;
    sheet.getRange(1, col).setValue('Old Task');
    sheet.getRange(1, col).setFontWeight('bold').setBackground('#407589').setFontColor('#ffffff');
    sheet.getRange(1, col).setNote('Task name before the v3 role templates.');
  }
  var state = readState_();
  var plan = planRoleMigration_(state.signups, state.slots);
  plan.changes.forEach(function (change) {
    if (change.rowNumber) updateSignup_(change.rowNumber, change.fields);
  });
  SpreadsheetApp.flush();
  var review = plan.needsReview.map(function (row) {
    return row.date + ' ' + row.event + ' — ' + row.name + ' (' + row.task + ')';
  });
  var over = plan.overCapacity.map(function (row) {
    return row.date + ' ' + row.event + ' ' + row.task + ' has ' + row.names.length + ' people and capacity ' + row.capacity + ': ' + row.names.join(', ');
  });
  var summary = 'Migration v3 complete. Updated ' + plan.changes.length + ' rows. Needs review: ' +
    plan.needsReview.length + '. Over capacity: ' + plan.overCapacity.length + '.' +
    (review.length ? ' Review: ' + review.join('; ') + '.' : '') +
    (over.length ? ' Over capacity: ' + over.join('; ') + '.' : '');
  Logger.log(summary);
  try { SpreadsheetApp.getUi().alert(summary); } catch (err) {}
  return summary;
}

function hideSignupColumns_(sheet) {
  var headers = readHeaders_(sheet);
  var width = Math.max(sheet.getLastColumn(), headers.length, 1);
  sheet.showColumns(1, width);
  SIGNUP_HIDDEN.forEach(function (name) {
    var index = columnIndex_(headers, name);
    if (index !== -1) sheet.hideColumns(index + 1);
  });
}

/**
 * Splits location into venue and address, puts owner columns first,
 * and hides the internal columns. Does not delete rows or change statuses.
 * Safe to run again.
 */
function migrateV4() {
  var sheet = openSheet_().getSheetByName('Signups');
  if (!sheet) throw new Error('Signups tab is missing.');
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var before = 0;
  for (var r = 1; r < values.length; r++) {
    var blank = true;
    for (var c = 0; c < values[r].length; c++) {
      if (values[r][c] !== '' && values[r][c] != null) blank = false;
    }
    if (!blank) before += 1;
  }
  var plan = planSignupV4_(values, abaEvents_());
  if (plan.kept !== before) throw new Error('Migration stopped because it would change the number of sign-up rows.');
  if (plan.already) {
    hideSignupColumns_(sheet);
    var done = 'Migration v4 already applied. Venue and address are in place and internal columns stay hidden. No rows were changed.';
    Logger.log(done);
    try { SpreadsheetApp.getUi().alert(done); } catch (err) {}
    return done;
  }
  var width = plan.headers.length;
  var grid = [plan.headers].concat(plan.rows);
  plainTextColumns_(sheet, plan.headers);
  SpreadsheetApp.flush();
  sheet.getRange(1, 1, grid.length, width).setNumberFormat('@');
  sheet.getRange(1, 1, grid.length, width).setValues(grid);
  writeDateCells_(sheet, plan.headers, 2, plan.rows);
  writePlainTextCells_(sheet, plan.headers, 2, plan.rows);
  if (lastCol > width) sheet.getRange(1, width + 1, lastRow, lastCol - width).clearContent();
  if (lastRow > grid.length) sheet.getRange(grid.length + 1, 1, lastRow - grid.length, width).clearContent();
  writeHeaders_(sheet, plan.headers);
  sheet.getRange(1, columnIndex_(plan.headers, 'email') + 1).setNote('Email addresses stay in this sheet. The public page shows names only.');
  sheet.getRange(1, columnIndex_(plan.headers, 'token') + 1).setNote('Private manage token. Do not share this column. It stays hidden.');
  hideSignupColumns_(sheet);
  SpreadsheetApp.flush();
  var summary = 'Migration v4 complete. Split location into venue and address on ' + plan.kept +
    ' sign-up rows. Hid signupId, slotId, source, token, oldTask, and the other internal columns. Statuses were not changed.';
  Logger.log(summary);
  try { SpreadsheetApp.getUi().alert(summary); } catch (err2) {}
  return summary;
}

function planDateText_(headers, rows) {
  var targets = [];
  ['date', 'time'].forEach(function (name) {
    var col = headers.indexOf(name);
    if (col !== -1) targets.push({ name: name, col: col });
  });
  var changes = [];
  (rows || []).forEach(function (row, index) {
    targets.forEach(function (target) {
      var raw = row[target.col];
      if (raw == null || raw === '') return;
      var text = target.name === 'date' ? ABA_RULES.formatSheetDate(raw) : ABA_RULES.formatSheetTime(raw);
      var typed = raw instanceof Date || typeof raw === 'number';
      if (!typed && String(raw) === text) return;
      changes.push({ rowNumber: index + 2, column: target.col + 1, field: target.name, value: text });
    });
  });
  return changes;
}

/**
 * Rewrites Date-typed date and time cells as plain text.
 * Does not change any other column. Safe to run again. Logs only.
 */
function normalizeDatesV5() {
  var summary = 'normalizeDatesV5 was not run. Use migrateV5. It keeps owner formatting, shows dates as M/d/yyyy, and stores start and end times as text.';
  Logger.log(summary);
  return summary;
}

function planMigrateV5_(values, slots) {
  var headers = (values[0] || []).map(function (cell) { return String(cell || '').trim(); });
  var timeCol = headerIndex_(headers, 'time');
  var startCol = headerIndex_(headers, 'starttime');
  var endCol = headerIndex_(headers, 'endtime');
  var dateCol = headerIndex_(headers, 'date');
  var insert = timeCol !== -1 && startCol === -1;
  var working = headers.slice();
  if (insert) {
    working[timeCol] = 'Start Time';
    working.splice(timeCol + 1, 0, 'End Time');
    startCol = timeCol;
    endCol = timeCol + 1;
  }
  var dateValues = [];
  var timeValues = [];
  var taskEdits = [];
  var kept = 0;
  function shifted_(zeroBased) {
    var col = zeroBased;
    if (insert && timeCol !== -1 && zeroBased > timeCol) col += 1;
    return col + 1;
  }
  for (var r = 1; r < values.length; r++) {
    var src = values[r] || [];
    var blank = true;
    for (var c = 0; c < src.length; c++) {
      if (src[c] !== '' && src[c] != null) blank = false;
    }
    if (blank) continue;
    kept += 1;
    var record = { __row: r + 1 };
    headers.forEach(function (name, index) { if (name) record[name] = src[index]; });
    var iso = dateCol === -1 ? '' : ABA_RULES.formatSheetDate(src[dateCol]);
    if (dateCol !== -1 && iso) {
      var rawDate = src[dateCol];
      var typedDate = rawDate instanceof Date || typeof rawDate === 'number';
      var shown = !typedDate && String(rawDate).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      var shownIso = shown ? ABA_RULES.formatSheetDate(String(rawDate).trim()) : '';
      if (!(typedDate && ABA_RULES.formatSheetDate(rawDate) === iso) && shownIso !== iso) {
        dateValues.push({ rowNumber: r + 1, column: dateCol + 1, iso: iso });
      }
    }
    var taskCol = headerIndex_(headers, 'task');
    var slotCol = headerIndex_(headers, 'slotid');
    var oldCol = headerIndex_(headers, 'oldtask');
    if (String(record.task || '') === 'Networking Host') {
      var priorSlot = String(record.slotId || '');
      var renamedSlot = priorSlot ? priorSlot.replace(/\|Networking Host$/, '|Networking Ambassador') : '';
      if (!renamedSlot && record.date && record.event) {
        renamedSlot = ABA_RULES.formatSheetDate(record.date) + '|' + record.event + '|Networking Ambassador';
      }
      if (taskCol !== -1) {
        taskEdits.push({ rowNumber: r + 1, column: shifted_(taskCol), value: 'Networking Ambassador' });
      }
      if (renamedSlot && renamedSlot !== priorSlot && slotCol !== -1) {
        taskEdits.push({ rowNumber: r + 1, column: shifted_(slotCol), value: renamedSlot });
      }
      if (!String(record.oldTask || '').trim() && oldCol !== -1) {
        taskEdits.push({ rowNumber: r + 1, column: shifted_(oldCol), value: 'Networking Host' });
      }
      record.task = 'Networking Ambassador';
      if (renamedSlot) record.slotId = renamedSlot;
    }
    var clocks = clocksForRow_(record, slots);
    var currentStart = insert ? '' : (startCol === -1 ? '' : tidyClock_(ABA_RULES.formatSheetTime(src[startCol])));
    var currentEnd = insert ? '' : (endCol === -1 ? '' : tidyClock_(ABA_RULES.formatSheetTime(src[endCol])));
    if (clocks.start && (insert || currentStart !== clocks.start)) {
      timeValues.push({ rowNumber: r + 1, column: startCol + 1, value: clocks.start });
    }
    if ((clocks.end || insert || currentEnd) && (insert || currentEnd !== clocks.end)) {
      timeValues.push({ rowNumber: r + 1, column: endCol + 1, value: clocks.end || '' });
    }
  }
  return {
    insert: insert,
    timeColumn: timeCol,
    dateColumn: dateCol,
    startColumn: startCol,
    endColumn: endCol,
    headers: working,
    dateValues: dateValues,
    timeValues: timeValues,
    taskEdits: taskEdits,
    kept: kept
  };
}

/**
 * Shows dates as M/d/yyyy and splits time into start and end text.
 * Does not restyle the sheet, unhide columns, delete rows, or change statuses.
 * Safe to run again. Logs only.
 */
function migrateV5() {
  var sheet = openSheet_().getSheetByName('Signups');
  if (!sheet) throw new Error('Signups tab is missing.');
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var width = Math.max(sheet.getLastColumn(), 1);
  var values = sheet.getRange(1, 1, lastRow, width).getValues();
  var before = 0;
  for (var r = 1; r < values.length; r++) {
    var blank = true;
    for (var c = 0; c < values[r].length; c++) {
      if (values[r][c] !== '' && values[r][c] != null) blank = false;
    }
    if (!blank) before += 1;
  }
  var plan = planMigrateV5_(values, abaCatalogSlots_());
  if (plan.kept !== before) throw new Error('Migration stopped because it would change the number of sign-up rows.');
  if (plan.insert && plan.timeColumn !== -1) {
    sheet.insertColumnAfter(plan.timeColumn + 1);
    sheet.getRange(1, plan.timeColumn + 1).setValue('Start Time');
    sheet.getRange(1, plan.timeColumn + 2).setValue('End Time');
  }
  plan.dateValues.forEach(function (change) {
    var parts = change.iso.split('-');
    var cell = sheet.getRange(change.rowNumber, change.column);
    cell.setNumberFormat('M/d/yyyy');
    cell.setValue(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  });
  if (plan.dateColumn !== -1 && lastRow >= 2) {
    sheet.getRange(2, plan.dateColumn + 1, lastRow - 1, 1).setNumberFormat('M/d/yyyy');
  }
  SpreadsheetApp.flush();
  plan.timeValues.forEach(function (change) {
    var cell = sheet.getRange(change.rowNumber, change.column);
    cell.setNumberFormat('@');
    cell.setValue(change.value);
  });
  plan.taskEdits.forEach(function (change) {
    sheet.getRange(change.rowNumber, change.column).setValue(change.value);
  });
  SpreadsheetApp.flush();
  var summary = 'Migration v5 complete. Kept ' + plan.kept + ' sign-up rows. Updated ' + plan.dateValues.length +
    ' dates to M/d/yyyy and ' + plan.timeValues.length + ' start/end time cells as text. Renamed ' +
    plan.taskEdits.filter(function (change) { return change.value === 'Networking Ambassador'; }).length +
    ' Networking Host rows to Networking Ambassador. Statuses and other formatting were not changed.';
  Logger.log(summary);
  return summary;
}

function hideInternalSignupColumns_(sheet) {
  var headers = readHeaders_(sheet);
  SIGNUP_HIDDEN.forEach(function (name) {
    var index = headerIndex_(headers, headerKey_(name));
    if (index !== -1) sheet.hideColumns(index + 1);
  });
}

/**
 * Inserts a visible status column immediately after createdAt when it is missing.
 * Does not backfill values and does not restyle existing columns.
 */
function ensureStatusColumn_(sheet) {
  var headers = readHeaders_(sheet);
  if (headerIndex_(headers, 'status') !== -1) return headers;
  var plan = planRestoreStatusV7_([headers]);
  var statusColumn;
  if (plan.insertAfter < 1) {
    sheet.insertColumnBefore(1);
    statusColumn = 1;
  } else {
    sheet.insertColumnAfter(plan.insertAfter);
    statusColumn = plan.insertAfter + 1;
  }
  var height = Math.max(sheet.getLastRow() + 20, 2);
  var column = sheet.getRange(1, statusColumn, height, 1);
  column.setNumberFormat('@');
  sheet.getRange(1, statusColumn).setValue('Status');
  SpreadsheetApp.flush();
  hideInternalSignupColumns_(sheet);
  return readHeaders_(sheet);
}

function isDonnyCancelledRow_(row) {
  var name = String(row.name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  var email = String(row.email || '').trim().toLowerCase();
  var eventName = String(row.event || '').replace(/\s+/g, ' ').trim().toLowerCase();
  var task = String(row.task || '').replace(/\s+/g, ' ').trim().toLowerCase();
  var ambassador = task === 'networking ambassador' || task === 'networking host';
  return name === 'donny nguyen' &&
    email === 'donny@vanderwinn.com' &&
    eventName === 'happy hour' &&
    row.date === '2026-12-09' &&
    ambassador;
}

function statusForRestoredRow_(row) {
  if (isDonnyCancelledRow_(row)) return 'cancelled';
  if (isFullLunchTask_(row.task)) {
    if (String(row.date || '').indexOf('2027-') === 0) return 'superseded';
    if (row.date === '2026-11-19') return 'needs-review';
  }
  return 'active';
}

function planRestoreStatusV7_(values) {
  var headers = (values[0] || []).map(function (cell) { return String(cell || '').trim(); });
  if (headerIndex_(headers, 'status') !== -1) {
    return { already: true, insertAfter: -1, statusColumn: -1, assignments: [] };
  }
  var createdCol = headerIndex_(headers, 'createdat');
  var insertAfter;
  if (createdCol !== -1) {
    insertAfter = createdCol + 1;
  } else {
    var beforeHidden = -1;
    for (var h = 0; h < headers.length; h++) {
      var key = headerKey_(headers[h]);
      var hidden = false;
      for (var n = 0; n < SIGNUP_HIDDEN.length; n++) {
        if (headerKey_(SIGNUP_HIDDEN[n]) === key) hidden = true;
      }
      if (hidden) { beforeHidden = h; break; }
    }
    insertAfter = beforeHidden === -1 ? headers.length : beforeHidden;
  }
  var assignments = [];
  for (var r = 1; r < values.length; r++) {
    var src = values[r] || [];
    var blank = true;
    for (var c = 0; c < src.length; c++) {
      if (src[c] !== '' && src[c] != null) blank = false;
    }
    if (blank) continue;
    var record = {};
    headers.forEach(function (name, index) {
      var field = headerField_(name);
      if (field) record[field] = src[index];
    });
    var row = {
      name: ABA_RULES.unwrapSheetText(record.name),
      email: ABA_RULES.normalizeEmail(ABA_RULES.unwrapSheetText(record.email)),
      event: String(record.event || '').trim(),
      task: String(record.task || '').trim(),
      date: ABA_RULES.formatSheetDate(record.date)
    };
    assignments.push({
      rowNumber: r + 1,
      name: String(row.name || '').replace(/\s+/g, ' ').trim(),
      email: row.email,
      event: row.event,
      task: row.task,
      date: row.date,
      status: statusForRestoredRow_(row)
    });
  }
  return {
    already: false,
    insertAfter: insertAfter,
    statusColumn: insertAfter < 1 ? 1 : insertAfter + 1,
    assignments: assignments
  };
}

/**
 * Puts the status column back after createdAt and fills it once.
 * Does not send email. Does not restyle the sheet. Safe to run again:
 * a second run does nothing when status is already present. Logs only.
 */
function restoreStatusV7() {
  var sheet = openSheet_().getSheetByName('Signups');
  if (!sheet) throw new Error('Signups tab is missing.');
  var lastRow = Math.max(sheet.getLastRow(), 1);
  var width = Math.max(sheet.getLastColumn(), 1);
  var values = sheet.getRange(1, 1, lastRow, width).getValues();
  var plan = planRestoreStatusV7_(values);
  if (plan.already) {
    var done = 'restoreStatusV7 found the status column. No rows were changed.';
    Logger.log(done);
    return done;
  }
  var statusColumn;
  if (plan.insertAfter < 1) {
    sheet.insertColumnBefore(1);
    statusColumn = 1;
  } else {
    sheet.insertColumnAfter(plan.insertAfter);
    statusColumn = plan.insertAfter + 1;
  }
  var headerCell = sheet.getRange(1, statusColumn);
  headerCell.setNumberFormat('@');
  headerCell.setValue('Status');
  var logged = [];
  if (plan.assignments.length) {
    var byRow = {};
    plan.assignments.forEach(function (item) { byRow[item.rowNumber] = item; });
    var columnValues = [];
    for (var r = 2; r <= lastRow; r++) {
      var item = byRow[r];
      columnValues.push([item ? item.status : '']);
      if (item && item.status !== 'active') {
        logged.push('Row ' + item.rowNumber + ' ' + item.name + ' ' + item.date + ' ' + item.event + ' ' + item.task + ' => ' + item.status);
      }
    }
    var range = sheet.getRange(2, statusColumn, columnValues.length, 1);
    range.setNumberFormat('@');
    SpreadsheetApp.flush();
    range.setValues(columnValues);
  }
  hideInternalSignupColumns_(sheet);
  SpreadsheetApp.flush();
  logged.forEach(function (line) { Logger.log(line); });
  var summary = 'restoreStatusV7 inserted status after createdAt and set ' + plan.assignments.length +
    ' rows. Non-active: ' + logged.length + '. No email was sent.' +
    (logged.length ? ' ' + logged.join('; ') + '.' : '');
  Logger.log(summary);
  return summary;
}
