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
var SIGNUP_HEADERS = ['signupId', 'slotId', 'name', 'email', 'createdAt', 'source'];

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

  function todayKey(date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date || new Date());
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
      return todayKey(value);
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
    return match ? match[1] : s;
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
      if (row.slotId !== slot.slotId) continue;
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
        if (signups[s].slotId === slot.slotId && signups[s].name) names.push(signups[s].name);
      }
      index[key].tasks.push({
        task: slot.task,
        capacity: Number(slot.capacity),
        names: names
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
    sheetSafe: sheetSafe,
    unwrapSheetText: unwrapSheetText,
    todayKey: todayKey,
    stamp: stamp,
    formatSheetDate: formatSheetDate,
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
  var outcome;
  try {
    outcome = deps.withLock(function () {
      var state = deps.readState();
      var decision = ABA_RULES.decide(parsed.value, state, deps.today());
      if (!decision.ok) {
        result = { ok: false, error: decision.error };
        return;
      }
      deps.appendSignup({
        signupId: deps.newId(),
        slotId: decision.signup.slotId,
        name: decision.signup.name,
        email: decision.signup.email,
        createdAt: deps.stamp(deps.now()),
        source: 'web'
      });
      result = { ok: true, message: decision.message };
    });
  } catch (err) {
    return { ok: false, error: 'Could not submit the form.' };
  }
  if (outcome === false) {
    return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
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
    newId: function () { return Utilities.getUuid(); }
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
  var slotsSheet = ss.getSheetByName('Slots');
  var signupsSheet = ss.getSheetByName('Signups');
  if (!slotsSheet || !signupsSheet) {
    throw new Error('Sheet is not set up.');
  }
  return rowsToState_(
    slotsSheet.getDataRange().getValues(),
    signupsSheet.getDataRange().getValues()
  );
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
      time: String(slot.time || ''),
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
    signups.push({
      signupId: String(row.signupId || ''),
      slotId: String(row.slotId),
      name: ABA_RULES.unwrapSheetText(row.name).trim(),
      email: ABA_RULES.normalizeEmail(ABA_RULES.unwrapSheetText(row.email)),
      createdAt: String(row.createdAt || ''),
      source: String(row.source || '')
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
    var obj = {};
    for (var i = 0; i < header.length; i++) {
      if (header[i]) obj[header[i]] = values[r][i];
    }
    out.push(obj);
  }
  return out;
}

function signupCells_(row) {
  return [
    row.signupId,
    row.slotId,
    ABA_RULES.sheetSafe(row.name),
    ABA_RULES.sheetSafe(row.email),
    row.createdAt,
    row.source
  ];
}

function appendSignup_(row) {
  var sheet = openSheet_().getSheetByName('Signups');
  if (!sheet) throw new Error('Signups tab is missing.');
  sheet.appendRow(signupCells_(row));
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
        signupRows.push([
          'seed-' + String(count).padStart(2, '0'),
          id,
          name,
          '',
          seed.pulledAt || '',
          'seed'
        ]);
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

  var slotsSheet = getOrCreateSheet_(ss, 'Slots');
  var signupsSheet = getOrCreateSheet_(ss, 'Signups');
  if (slotsSheet.getLastRow() > 1 || signupsSheet.getLastRow() > 1) {
    throw new Error('Slots or Signups already has rows, so setup stopped to avoid duplicating them. Delete those data rows (or the tabs) and run setup again if you mean to start over.');
  }

  writeHeaders_(slotsSheet, SLOT_HEADERS);
  writeHeaders_(signupsSheet, SIGNUP_HEADERS);
  // getRange(row, column, numRows, numColumns) — the third argument is a count.
  slotsSheet.getRange(2, 1, built.slotRows.length, SLOT_HEADERS.length).setNumberFormat('@');
  slotsSheet.getRange(2, 7, built.slotRows.length, 1).setNumberFormat('0');
  slotsSheet.getRange(2, 1, built.slotRows.length, SLOT_HEADERS.length).setValues(built.slotRows);
  signupsSheet.getRange(2, 1, built.signupRows.length, SIGNUP_HEADERS.length).setNumberFormat('@');
  signupsSheet.getRange(2, 1, built.signupRows.length, SIGNUP_HEADERS.length).setValues(built.signupRows);
  signupsSheet.getRange('D1').setNote('Email addresses stay in this sheet. The public page shows names only.');

  sizeColumns_(slotsSheet, [280, 110, 90, 160, 420, 260, 100]);
  sizeColumns_(signupsSheet, [120, 280, 200, 240, 180, 90]);

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
    .setBackground('#1e5c45')
    .setFontColor('#ffffff');
}

function sizeColumns_(sheet, widths) {
  for (var i = 0; i < widths.length; i++) sheet.setColumnWidth(i + 1, widths[i]);
}
