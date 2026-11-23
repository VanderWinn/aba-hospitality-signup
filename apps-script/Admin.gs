/**
 * Website admin login. The password is never stored in the repo.
 * Script Properties hold ADMIN_SALT and ADMIN_PASSWORD_HASH only.
 * A login session lives in CacheService. Apps Script cache entries
 * cannot last longer than 6 hours, so that is the session length.
 */

var ADMIN_SESSION_SECONDS = 21600;
var ADMIN_LOCK_MS = 15 * 60 * 1000;
var ADMIN_MAX_FAILS = 5;
var ADMIN_GUARD_KEY = 'admin-login-guard';

function sha256Hex_(text) {
  if (typeof Utilities !== 'undefined' && Utilities.computeDigest) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
    return bytes.map(function (b) {
      var v = (b + 256) % 256;
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join('');
  }
  if (typeof ABA_SHA256 === 'function') return ABA_SHA256(String(text));
  return '';
}

function timingEqual_(a, b) {
  var left = String(a || '');
  var right = String(b || '');
  var len = Math.max(left.length, right.length);
  var diff = left.length === right.length ? 0 : 1;
  for (var i = 0; i < len; i++) {
    var x = i < left.length ? left.charCodeAt(i) : 0;
    var y = i < right.length ? right.charCodeAt(i) : 0;
    diff |= x ^ y;
  }
  return diff === 0;
}

function scriptAdminStore_() {
  var props = PropertiesService.getScriptProperties();
  var cache = CacheService.getScriptCache();
  return {
    now: function () { return Date.now(); },
    getSecret: function (key) { return props.getProperty(key) || ''; },
    putSecret: function (key, value) { props.setProperty(key, value); },
    getCache: function (key) { return cache.get(key); },
    putCache: function (key, value, seconds) { cache.put(key, value, seconds); },
    removeCache: function (key) { cache.remove(key); }
  };
}

function adminStore_(deps) {
  return deps && deps.adminStore ? deps.adminStore : scriptAdminStore_();
}

function newAdminSecret_() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  var seed = '';
  if (typeof Utilities !== 'undefined' && Utilities.getUuid) {
    seed = Utilities.getUuid() + Utilities.getUuid() + String(new Date().getTime());
  } else {
    seed = String(Math.random()) + String(new Date().getTime());
  }
  var hex = sha256Hex_(seed + 'aba-admin');
  var out = '';
  for (var i = 0; i < 20; i++) {
    var n = parseInt(hex.substr((i * 2) % Math.max(hex.length - 1, 1), 2), 16);
    if (isNaN(n)) n = i;
    out += alphabet.charAt(n % alphabet.length);
  }
  return out;
}

/**
 * Run once from the editor. Generates a password, stores only its salted
 * hash, and writes the password to the execution log. Save the log, then
 * clear it. Running this again replaces the password.
 */
function setAdminPassword() {
  var password = newAdminSecret_();
  var salt = newAdminSecret_();
  var hash = sha256Hex_(salt + '\n' + password);
  PropertiesService.getScriptProperties().setProperties({
    ADMIN_SALT: salt,
    ADMIN_PASSWORD_HASH: hash,
    ADMIN_SESSION_EPOCH: String(new Date().getTime())
  }, false);
  Logger.log('Admin password (save this, it will not be shown again): ' + password);
  return 'Admin password generated and stored. Read the execution log, save the password, then clear the log.';
}

function readLoginGuard_(store) {
  var raw = store.getCache(ADMIN_GUARD_KEY);
  if (!raw) return { fails: 0, lockedUntil: 0 };
  try {
    var parsed = JSON.parse(raw);
    return {
      fails: Math.floor(Number(parsed.fails)) || 0,
      lockedUntil: Math.floor(Number(parsed.lockedUntil)) || 0
    };
  } catch (err) {
    return { fails: 0, lockedUntil: 0 };
  }
}

function writeLoginGuard_(store, guard) {
  store.putCache(ADMIN_GUARD_KEY, JSON.stringify(guard), 900);
}

function adminEpoch_(store) {
  return store.getSecret('ADMIN_SESSION_EPOCH') || '1';
}

function issueAdminSession_(store) {
  var session = newAdminSecret_() + newAdminSecret_().slice(0, 12);
  session = session.replace(/[^A-Za-z0-9]/g, '').slice(0, 48);
  store.putCache('admin-session-' + session, adminEpoch_(store), ADMIN_SESSION_SECONDS);
  return session;
}

function notePasswordFailure_(store, guard, now) {
  guard.fails += 1;
  if (guard.fails >= ADMIN_MAX_FAILS) {
    guard.fails = 0;
    guard.lockedUntil = now + ADMIN_LOCK_MS;
  }
  writeLoginGuard_(store, guard);
  return guard.lockedUntil && now < guard.lockedUntil
    ? { ok: false, error: 'Too many tries. Try again in 15 minutes.' }
    : { ok: false, error: 'That password is not correct.' };
}

function adminSessionOk_(session, deps) {
  var token = String(session || '').trim();
  if (!/^[A-Za-z0-9]{32,80}$/.test(token)) return false;
  var store = adminStore_(deps);
  var found = store.getCache('admin-session-' + token);
  return timingEqual_(found || '', adminEpoch_(store));
}

function adminLogin_(body, deps) {
  var password = body && body.password != null ? String(body.password) : '';
  var store = adminStore_(deps);
  var result = { ok: false, error: 'That password is not correct.' };
  var outcome = deps.withLock(function () {
    var now = store.now();
    var guard = readLoginGuard_(store);
    if (guard.lockedUntil && now < guard.lockedUntil) {
      result = { ok: false, error: 'Too many tries. Try again in 15 minutes.' };
      return;
    }
    var salt = store.getSecret('ADMIN_SALT');
    var expected = store.getSecret('ADMIN_PASSWORD_HASH');
    if (!salt || !expected) {
      result = { ok: false, error: 'Admin login is not set up yet.' };
      return;
    }
    var actual = sha256Hex_(salt + '\n' + password);
    if (!timingEqual_(actual, expected)) {
      result = notePasswordFailure_(store, guard, now);
      return;
    }
    writeLoginGuard_(store, { fails: 0, lockedUntil: 0 });
    result = { ok: true, session: issueAdminSession_(store) };
  });
  if (outcome === false) return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
  return result;
}

function adminChangePassword_(body, deps) {
  var store = adminStore_(deps);
  var result = { ok: false, error: 'Could not change the password.' };
  var outcome = deps.withLock(function () {
    if (!adminSessionOk_(body && body.session, deps)) {
      result = { ok: false, error: 'Admin login expired.' };
      return;
    }
    var now = store.now();
    var guard = readLoginGuard_(store);
    if (guard.lockedUntil && now < guard.lockedUntil) {
      result = { ok: false, error: 'Too many tries. Try again in 15 minutes.' };
      return;
    }
    var current = body && body.current != null ? String(body.current) : '';
    var next = body && body.next != null ? String(body.next) : '';
    var confirm = body && body.confirm != null ? String(body.confirm) : '';
    var salt = store.getSecret('ADMIN_SALT');
    var expected = store.getSecret('ADMIN_PASSWORD_HASH');
    var actual = sha256Hex_(salt + '\n' + current);
    if (!salt || !expected || !timingEqual_(actual, expected)) {
      result = notePasswordFailure_(store, guard, now);
      return;
    }
    if (next.length < 12) {
      result = { ok: false, error: 'New password must be at least 12 characters.' };
      return;
    }
    if (next !== confirm) {
      result = { ok: false, error: 'New passwords do not match.' };
      return;
    }
    store.putSecret('ADMIN_SALT', newAdminSecret_());
    store.putSecret('ADMIN_PASSWORD_HASH', sha256Hex_(store.getSecret('ADMIN_SALT') + '\n' + next));
    store.putSecret('ADMIN_SESSION_EPOCH', String(now));
    writeLoginGuard_(store, { fails: 0, lockedUntil: 0 });
    result = { ok: true, session: issueAdminSession_(store), message: 'Password changed.' };
  });
  if (outcome === false) return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
  return result;
}

function adminLogout_(body, deps) {
  var token = String(body && body.session || '').trim();
  if (token) adminStore_(deps).removeCache('admin-session-' + token);
  return { ok: true };
}

function adminRoster_(body, deps) {
  if (!adminSessionOk_(body && body.session, deps)) return { ok: false, error: 'Admin login expired.' };
  var state = deps.readState();
  var people = [];
  (state.signups || []).forEach(function (row) {
    if (!ABA_RULES.isActive(row) || !row.signupId) return;
    people.push({
      signupId: row.signupId,
      name: row.name,
      slotId: row.slotId,
      event: row.event,
      date: row.date,
      task: row.task
    });
  });
  return { ok: true, people: people };
}

function adminAdd_(body, deps) {
  if (!adminSessionOk_(body && body.session, deps)) return { ok: false, error: 'Admin login expired.' };
  var parsed = ABA_RULES.parseSignup(body);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  var sendEmail = !(body && (body.sendEmail === false || body.sendEmail === 'false'));
  var result = { ok: false, error: 'Could not add the person.' };
  var mail = null;
  var calendarChanges = [];
  var outcome = deps.withLock(function () {
    var state = deps.readState();
    var slot = findSlotLocal_(state.slots, ABA_RULES.slotId(parsed.value.date, parsed.value.event, parsed.value.task));
    if (!slot) {
      result = { ok: false, error: 'That event or task is not on the sheet.' };
      return;
    }
    if (String(slot.date) < String(deps.today())) {
      result = { ok: false, error: 'This event is closed.' };
      return;
    }
    var active = 0;
    for (var i = 0; i < state.signups.length; i++) {
      var row = state.signups[i];
      if (row.slotId !== slot.slotId || !ABA_RULES.isActive(row)) continue;
      active += 1;
      if (row.email && row.email === parsed.value.email) {
        result = { ok: false, error: 'That email is already signed up for this role.' };
        return;
      }
    }
    var decision = { ok: true, signup: parsed.value, slot: slot };
    var record = signupRecord_(decision, deps);
    record.source = 'admin';
    if (sendEmail && record.email) mail = buildMessage_(record, slot, 'confirm');
    calendarChanges.push({
      action: 'add',
      email: record.email,
      signupId: record.signupId,
      token: record.token,
      slot: slot
    });
    deps.appendSignup(record);
    var full = active >= Math.floor(Number(slot.capacity));
    result = {
      ok: true,
      message: 'Added ' + record.name + ' to ' + slot.task + '.',
      warning: full ? 'This role is already full. The person was added anyway.' : ''
    };
  });
  if (outcome === false) return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
  var finished = finishWithCalendar_(result, mail, deps, calendarChanges);
  if (result.warning) finished.warning = result.warning;
  return finished;
}

function adminRemove_(body, deps) {
  if (!adminSessionOk_(body && body.session, deps)) return { ok: false, error: 'Admin login expired.' };
  var signupId = String(body && body.signupId || '').trim();
  if (!signupId) return { ok: false, error: 'That sign-up is no longer on the sheet.' };
  var sendEmail = !(body && (body.sendEmail === false || body.sendEmail === 'false'));
  var result = { ok: false, error: 'Could not remove the person.' };
  var mail = null;
  var calendarChanges = [];
  var outcome = deps.withLock(function () {
    var state = deps.readState();
    var match = null;
    for (var i = 0; i < state.signups.length; i++) {
      if (state.signups[i].signupId === signupId && ABA_RULES.isActive(state.signups[i])) {
        match = state.signups[i];
        break;
      }
    }
    if (!match) {
      result = { ok: false, error: 'That sign-up is no longer on the sheet.' };
      return;
    }
    var slot = findSlotLocal_(state.slots, match.slotId) || slotForRow_(state, match);
    var fields = {
      status: 'cancelled',
      updatedAt: deps.stamp(deps.now()),
      sequence: (Math.floor(Number(match.sequence)) || 0) + 1
    };
    deps.updateSignup(match.rowNumber, fields);
    if (sendEmail && match.email) mail = buildMessage_(copyFields_(match, fields), slot, 'cancel');
    if (match.email) {
      calendarChanges.push({
        action: 'remove',
        email: match.email,
        signupId: match.signupId,
        token: match.token,
        slot: slot
      });
    }
    result = { ok: true, message: 'Removed ' + match.name + '.' };
  });
  if (outcome === false) return { ok: false, error: 'The sheet is busy. Please try again in a moment.' };
  return finishWithCalendar_(result, mail, deps, calendarChanges);
}
