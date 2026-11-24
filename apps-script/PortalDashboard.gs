/**
 * Read-only board portal dashboard. Names come back only after the portal
 * password matches Script Property PORTAL_PASSWORD_SHA256. Emails and phone
 * numbers are never included.
 *
 * Setup from the editor, once: setPortalPasswordHash('64-character-hex')
 */

var PORTAL_PASSWORD_KEY = 'PORTAL_PASSWORD_SHA256';

function setPortalPasswordHash(hash) {
  var clean = String(hash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(clean)) {
    throw new Error('Pass the 64-character SHA-256 hex hash, not the password.');
  }
  PropertiesService.getScriptProperties().setProperty(PORTAL_PASSWORD_KEY, clean);
  Logger.log('PORTAL_PASSWORD_SHA256 saved.');
  return 'PORTAL_PASSWORD_SHA256 saved.';
}

function portalSha256_(text) {
  var raw = String(text == null ? '' : text);
  if (typeof ABA_SHA256 === 'function') return ABA_SHA256(raw);
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var n = (bytes[i] + 256) % 256;
    out += (n < 16 ? '0' : '') + n.toString(16);
  }
  return out;
}

function portalPasswordStatus_(password, expectedHash) {
  var expected = String(expectedHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) return 'missing';
  var digest = portalSha256_(password);
  if (digest.length !== expected.length) return 'no';
  var diff = 0;
  for (var i = 0; i < expected.length; i++) {
    if (digest.charAt(i) !== expected.charAt(i)) diff += 1;
  }
  return diff === 0 ? 'ok' : 'no';
}

function portalQuarter_(today) {
  var year = Number(String(today).slice(0, 4));
  var month = Number(String(today).slice(5, 7));
  var quarter = Math.floor((month - 1) / 3);
  var startMonth = quarter * 3 + 1;
  var endMonth = startMonth + 2;
  var endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  function iso(m, d) {
    return year + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }
  return { label: 'Q' + (quarter + 1) + ' ' + year, start: iso(startMonth, 1), end: iso(endMonth, endDay) };
}

function portalPersonKey_(row) {
  var email = String(row.email || '').trim().toLowerCase();
  if (email) return 'e:' + email;
  return 'n:' + String(row.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function portalTally_(rows) {
  var by = {};
  var order = [];
  (rows || []).forEach(function (row) {
    var key = portalPersonKey_(row);
    if (!by[key]) {
      by[key] = { name: String(row.name || '').trim(), shifts: 0 };
      order.push(key);
    }
    by[key].shifts += 1;
  });
  var people = order.map(function (key) { return by[key]; });
  people.sort(function (a, b) {
    if (b.shifts !== a.shifts) return b.shifts - a.shifts;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  var shifts = 0;
  people.forEach(function (person) { shifts += person.shifts; });
  return { volunteers: people.length, shifts: shifts, people: people };
}

function portalSameRole_(row, slot) {
  if (row.slotId && slot.slotId && String(row.slotId) === String(slot.slotId)) return true;
  return row.date === slot.date && row.event === slot.event && row.task === slot.task;
}

function portalDashboard_(signups, slots, today) {
  var day = String(today || '');
  var year = day.slice(0, 4);
  var quarter = portalQuarter_(day);
  var rows = (signups || []).filter(function (row) {
    return ABA_RULES.isActive(row) && String(row.name || '').trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''));
  });
  function between(row, start, end) {
    return row.date >= start && row.date <= end;
  }
  var quarterStats = portalTally_(rows.filter(function (row) { return between(row, quarter.start, quarter.end); }));
  var yearStats = portalTally_(rows.filter(function (row) { return between(row, year + '-01-01', year + '-12-31'); }));
  var upcoming = [];
  var filled = 0;
  var seats = 0;
  var openRoles = 0;
  (slots || []).forEach(function (slot) {
    if (!slot || !slot.date || slot.date < day) return;
    var names = [];
    rows.forEach(function (row) {
      if (portalSameRole_(row, slot)) names.push(String(row.name).trim());
    });
    var capacity = Number(slot.capacity);
    if (!isFinite(capacity) || capacity < 0) capacity = 0;
    var taken = names.length;
    seats += capacity;
    filled += Math.min(taken, capacity);
    var open = taken < capacity;
    if (open) openRoles += 1;
    var key = slot.date + '|' + (slot.event || '');
    var event = null;
    for (var i = 0; i < upcoming.length; i++) {
      if (upcoming[i].key === key) event = upcoming[i];
    }
    if (!event) {
      var location = String(slot.location || '');
      var prefix = String(slot.event || '') + ', ';
      event = {
        key: key,
        date: slot.date,
        time: String(slot.time || ''),
        name: String(slot.event || ''),
        venue: location.indexOf(prefix) === 0 ? location.slice(prefix.length) : location,
        roles: []
      };
      upcoming.push(event);
    }
    event.roles.push({
      task: String(slot.task || ''),
      filled: taken,
      capacity: capacity,
      open: open,
      names: names
    });
  });
  upcoming.sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  upcoming.forEach(function (event) { delete event.key; });
  return {
    asOf: day,
    note: 'These counts include every hospitality volunteer. The sign-up sheet does not mark board or committee members. Shifts are counted by the event date.',
    participation: {
      quarter: {
        label: quarter.label,
        volunteers: quarterStats.volunteers,
        shifts: quarterStats.shifts,
        people: quarterStats.people
      },
      year: {
        label: year,
        volunteers: yearStats.volunteers,
        shifts: yearStats.shifts,
        people: yearStats.people
      }
    },
    capacity: {
      filled: filled,
      seats: seats,
      openRoles: openRoles,
      events: upcoming
    }
  };
}

function dashboardAction_(body, deps) {
  deps = deps || {};
  var expected = deps.passwordHash;
  if (expected == null) {
    try {
      expected = PropertiesService.getScriptProperties().getProperty(PORTAL_PASSWORD_KEY);
    } catch (err) {
      expected = '';
    }
  }
  var status = portalPasswordStatus_(body && body.password, expected);
  if (status !== 'ok') {
    return {
      ok: false,
      status: 401,
      error: status === 'missing' ? 'The portal password is not set up yet.' : 'That password is not correct.'
    };
  }
  var signups = deps.signups;
  var slots = deps.slots;
  var today = deps.today;
  if (!signups || !slots) {
    var state = readState_();
    signups = state.signups;
    slots = state.slots;
  }
  if (!today) today = ABA_RULES.todayKeyIn(new Date(), 'America/Detroit');
  return { ok: true, dashboard: portalDashboard_(signups, slots, today) };
}
