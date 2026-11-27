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

function portalCompany_(row) {
  return String((row && (row.company || row.organization || row.business)) || '').trim();
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

function portalMonthMeta_(key) {
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var shorts = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var month = Number(String(key).slice(5, 7));
  return {
    key: key,
    label: names[month - 1] || key,
    short: shorts[month - 1] || key,
    year: String(key).slice(0, 4)
  };
}

function portalVenue_(row, slots) {
  if (row && row.venue) return String(row.venue).trim();
  var slot = null;
  (slots || []).forEach(function (item) {
    if (!slot && portalSameRole_(row, item)) slot = item;
  });
  var location = String((slot && slot.location) || (row && row.location) || '');
  var prefix = String((row && row.event) || '') + ', ';
  if (prefix !== ', ' && location.indexOf(prefix) === 0) return location.slice(prefix.length);
  return location;
}

function portalChart_(rows, slots) {
  var monthMap = {};
  var peopleMap = {};
  var order = [];
  (rows || []).forEach(function (row) {
    var month = String(row.date).slice(0, 7);
    if (!monthMap[month]) monthMap[month] = 0;
    monthMap[month] += 1;
    var key = portalPersonKey_(row);
    if (!peopleMap[key]) {
      peopleMap[key] = { name: String(row.name || '').trim(), company: portalCompany_(row), total: 0, counts: {}, events: [] };
      order.push(key);
    }
    var person = peopleMap[key];
    if (!person.company) person.company = portalCompany_(row);
    person.total += 1;
    person.counts[month] = (person.counts[month] || 0) + 1;
    var matched = null;
    (slots || []).forEach(function (item) {
      if (!matched && portalSameRole_(row, item)) matched = item;
    });
    var seats = matched ? Number(matched.capacity) : 1;
    if (!isFinite(seats) || seats < 1) seats = 1;
    person.events.push({
      date: row.date,
      month: month,
      name: String(row.event || ''),
      task: String(row.task || ''),
      venue: portalVenue_(row, slots),
      capacity: seats,
      slot: String((matched && matched.slotId) || (row.date + '|' + row.event + '|' + row.task))
    });
  });
  var months = Object.keys(monthMap).sort().map(function (key) {
    var meta = portalMonthMeta_(key);
    meta.shifts = monthMap[key];
    return meta;
  });
  var people = order.map(function (key) {
    var person = peopleMap[key];
    var counts = {};
    months.forEach(function (month) { counts[month.key] = person.counts[month.key] || 0; });
    person.counts = counts;
    person.events.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return person;
  });
  people.sort(function (a, b) {
    if (b.total !== a.total) return b.total - a.total;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  var companyAvailable = false;
  people.forEach(function (person, index) {
    person.id = 'p' + (index + 1);
    if (person.company) companyAvailable = true;
  });
  return { months: months, people: people, companyAvailable: companyAvailable };
}

function portalSameRole_(row, slot) {
  if (row.slotId && slot.slotId && String(row.slotId) === String(slot.slotId)) return true;
  return row.date === slot.date && row.event === slot.event && row.task === slot.task;
}

function portalPreviousQuarter_(today) {
  var current = portalQuarter_(today);
  var parts = current.start.split('-');
  var dt = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  dt.setUTCDate(dt.getUTCDate() - 1);
  var year = dt.getUTCFullYear();
  var month = dt.getUTCMonth() + 1;
  var day = dt.getUTCDate();
  var prev = year + '-' + (month < 10 ? '0' : '') + month + '-' + (day < 10 ? '0' : '') + day;
  return portalQuarter_(prev);
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
  var quarterRows = rows.filter(function (row) { return between(row, quarter.start, quarter.end); });
  var yearRows = rows.filter(function (row) { return between(row, year + '-01-01', year + '-12-31'); });
  var quarterStats = portalTally_(quarterRows);
  var yearStats = portalTally_(yearRows);
  var previous = portalPreviousQuarter_(day);
  var previousRows = rows.filter(function (row) { return between(row, previous.start, previous.end); });
  var previousStats = portalTally_(previousRows);
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
      },
      previousQuarter: {
        label: previous.label,
        volunteers: previousStats.volunteers,
        shifts: previousStats.shifts
      }
    },
    capacity: {
      filled: filled,
      seats: seats,
      openRoles: openRoles,
      events: upcoming
    },
    chart: (function () {
      var chart = portalChart_(yearRows, slots);
      var opportunities = 0;
      (slots || []).forEach(function (slot) {
        if (!slot || !slot.date || String(slot.date).slice(0, 4) !== year) return;
        var seats = Number(slot.capacity);
        if (isFinite(seats) && seats > 0) opportunities += seats;
      });
      chart.opportunities = opportunities;
      return chart;
    })()
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

/**
 * Executive dashboard sheet. Not the hospitality sign-up spreadsheet.
 * Set Script Property DASHBOARD_SHEET_ID to the ABA Dashboard Data file id.
 * Do not deploy this until Donny is ready. Until then the page keeps the example data.
 */
var DASHBOARD_SHEET_KEY = 'DASHBOARD_SHEET_ID';
var DASHBOARD_TYPES = { 'Lunch & Learn': true, 'Ribbon Cutting': true, 'Happy Hour': true };

function dashboardEventType_(value) {
  var text = String(value || '').trim().toLowerCase();
  if (text === 'lunch & learn' || text === 'lunch and learn') return 'Lunch & Learn';
  if (text === 'ribbon cutting') return 'Ribbon Cutting';
  if (text === 'happy hour') return 'Happy Hour';
  return '';
}

function dashboardAudience_(value) {
  var text = String(value || '').trim().toLowerCase();
  if (text === 'member' || text === 'members') return 'Member';
  if (text === 'guest' || text === 'guests') return 'Guest';
  return '';
}

function dashboardIso_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    var zone = 'America/Detroit';
    try {
      if (typeof Session !== 'undefined' && Session.getScriptTimeZone) zone = Session.getScriptTimeZone() || zone;
    } catch (err) {}
    if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
      return Utilities.formatDate(value, zone, 'yyyy-MM-dd');
    }
    return value.getUTCFullYear() + '-' + ('0' + (value.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + value.getUTCDate()).slice(-2);
  }
  var text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return '';
}

function dashboardToday_() {
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    return Utilities.formatDate(new Date(), 'America/Detroit', 'yyyy-MM-dd');
  }
  return '';
}

function executiveRowsToDashboard_(tabs, asOf) {
  tabs = tabs || {};
  var events = [];
  var seen = {};
  (tabs.events || []).forEach(function (row) {
    var date = dashboardIso_(row.date);
    var id = String(row.event_id || row.id || '').trim();
    var type = dashboardEventType_(row.event_type || row.type);
    if (!date || !id || !type || seen[id]) return;
    seen[id] = true;
    events.push({ id: id, date: date, type: type });
  });
  var counts = {};
  var signupCounts = {};
  (tabs.attendanceRecords || []).forEach(function (row) {
    var id = String(row.event_id || row.eventId || '').trim();
    var type = dashboardEventType_(row.event_type || row.eventType);
    if (!id || !seen[id] || !type) return;
    var outcome = String(row.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    var noShow = outcome === 'no_show' || outcome === 'noshow';
    var attended = outcome === 'attended';
    var registered = outcome === 'registered';
    if (attended) {
      var audience = dashboardAudience_(row.member_or_guest || row.audience);
      if (audience) {
        var key = id + '|' + audience;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    if (attended || noShow || registered) {
      if (!signupCounts[id]) signupCounts[id] = { eventId: id, signups: 0, noShows: 0 };
      signupCounts[id].signups += 1;
      if (noShow) signupCounts[id].noShows += 1;
    }
  });
  var attendance = Object.keys(counts).map(function (key) {
    var bits = key.split('|');
    return { eventId: bits[0], audience: bits[1], count: counts[key] };
  });
  var signups = Object.keys(signupCounts).map(function (id) { return signupCounts[id]; });
  var openings = (tabs.openings || []).map(function (row) {
    return {
      date: dashboardIso_(row.as_of || row.date),
      audience: dashboardAudience_(row.audience),
      eventType: dashboardEventType_(row.event_type) || '',
      count: row.count
    };
  }).filter(function (row) { return row.date && row.audience; });
  var changes = (tabs.changes || []).map(function (row) {
    return {
      date: dashboardIso_(row.date),
      audience: dashboardAudience_(row.audience),
      eventType: dashboardEventType_(row.event_type) || '',
      joins: row.joins,
      losses: row.losses
    };
  }).filter(function (row) { return row.date && row.audience; });
  return {
    example: false,
    asOf: asOf || dashboardToday_(),
    events: events,
    attendance: attendance,
    signups: signups,
    openings: openings,
    changes: changes
  };
}

function dashboardPasswordStatus_(body, deps) {
  deps = deps || {};
  var expected = deps.passwordHash;
  if (expected == null) {
    try {
      expected = PropertiesService.getScriptProperties().getProperty(PORTAL_PASSWORD_KEY);
    } catch (err) {
      expected = '';
    }
  }
  return portalPasswordStatus_(body && body.password, expected);
}

function dashboardSpreadsheet_(deps) {
  if (deps && deps.spreadsheet) return deps.spreadsheet;
  var id = deps && deps.sheetId;
  if (!id) {
    try {
      id = PropertiesService.getScriptProperties().getProperty(DASHBOARD_SHEET_KEY);
    } catch (err) {
      id = '';
    }
  }
  if (!id || typeof SpreadsheetApp === 'undefined') return null;
  return SpreadsheetApp.openById(id);
}

function dashboardSheetObjects_(sheet) {
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function (cell) {
    return String(cell || '').trim().toLowerCase().replace(/\s+/g, '_');
  });
  var rows = [];
  var r;
  for (r = 1; r < values.length; r++) {
    var row = {};
    var empty = true;
    headers.forEach(function (header, index) {
      if (!header) return;
      var cell = values[r][index];
      if (cell instanceof Date) cell = dashboardIso_(cell);
      row[header] = cell;
      if (cell !== '' && cell != null) empty = false;
    });
    if (!empty) rows.push(row);
  }
  return rows;
}

function executiveDashboardAction_(body, deps) {
  var status = dashboardPasswordStatus_(body, deps);
  if (status !== 'ok') {
    return {
      ok: false,
      status: 401,
      error: status === 'missing' ? 'The portal password is not set up yet.' : 'That password is not correct.'
    };
  }
  var tabs = deps && deps.tabs;
  if (!tabs) {
    var ss = dashboardSpreadsheet_(deps);
    if (!ss) return { ok: false, error: 'The dashboard sheet is not configured.' };
    tabs = {
      events: dashboardSheetObjects_(ss.getSheetByName('Events')),
      attendanceRecords: dashboardSheetObjects_(ss.getSheetByName('AttendanceRecords')),
      openings: dashboardSheetObjects_(ss.getSheetByName('MembershipOpening')),
      changes: dashboardSheetObjects_(ss.getSheetByName('Membership'))
    };
  }
  return { ok: true, dashboard: executiveRowsToDashboard_(tabs, deps && deps.asOf) };
}

/**
 * Password-checked names, contacts, and the Company and Person lists.
 * Aggregate cards use executiveDashboardAction_ and do not receive this payload.
 * Do not deploy until Donny sets DASHBOARD_SHEET_ID and publishes a new version.
 */
function executiveDrilldownAction_(body, deps) {
  var status = dashboardPasswordStatus_(body, deps);
  if (status !== 'ok') {
    return {
      ok: false,
      status: 401,
      error: status === 'missing' ? 'The portal password is not set up yet.' : 'That password is not correct.'
    };
  }
  if (deps && (deps.companies || deps.attendanceRecords || deps.roster)) {
    return {
      ok: true,
      companies: deps.companies || [],
      people: deps.people || [],
      attendanceRecords: deps.attendanceRecords || [],
      roster: deps.roster || []
    };
  }
  var ss = dashboardSpreadsheet_(deps);
  if (!ss) return { ok: false, error: 'The dashboard sheet is not configured.' };
  var pack = dashboardDrilldownFromSheets_(ss);
  return {
    ok: true,
    companies: pack.companies,
    people: pack.people,
    attendanceRecords: pack.attendanceRecords,
    roster: pack.roster
  };
}

function dashboardDrilldownFromSheets_(ss) {
  var records = [];
  var peopleSeen = {};
  var people = [];
  dashboardSheetObjects_(ss.getSheetByName('AttendanceRecords')).forEach(function (row) {
    var type = dashboardEventType_(row.event_type);
    var date = dashboardIso_(row.event_date || row.date);
    var name = String(row.name || '').trim();
    if (!type || !date || !name) return;
    var record = {
      name: name,
      audience: dashboardAudience_(row.member_or_guest),
      event: String(row.event_name || row.event || ''),
      eventType: type,
      eventId: String(row.event_id || ''),
      date: date,
      email: String(row.email || ''),
      phone: String(row.phone || row.mobile || ''),
      company: String(row.company || ''),
      status: String(row.status || '').toLowerCase()
    };
    Object.keys(row).forEach(function (key) {
      if (record[key] == null) record[key] = row[key];
    });
    records.push(record);
    var personKey = name + '|' + record.company;
    if (!peopleSeen[personKey]) {
      peopleSeen[personKey] = true;
      people.push({ name: name, company: record.company, audience: record.audience });
    }
  });
  people.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  var roster = dashboardSheetObjects_(ss.getSheetByName('Membership Roster')).map(function (row) {
    return {
      company: String(row.company || '').trim(),
      status: String(row.status || ''),
      joinDate: dashboardIso_(row.join_date),
      lostDate: dashboardIso_(row.lost_date)
    };
  }).filter(function (row) { return row.company; });
  var companies = [];
  var seen = {};
  roster.forEach(function (row) {
    if (String(row.status).toLowerCase() !== 'active' || seen[row.company]) return;
    seen[row.company] = true;
    companies.push(row.company);
  });
  companies.sort();
  return { companies: companies, people: people, attendanceRecords: records, roster: roster };
}

function portalSheetRows_(sheet) {
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function (cell) { return String(cell || '').trim().toLowerCase().replace(/\s+/g, '_'); });
  var rows = [];
  var r;
  for (r = 1; r < values.length; r++) {
    var row = {};
    var empty = true;
    headers.forEach(function (header, index) {
      if (!header) return;
      row[header] = values[r][index];
      if (values[r][index] !== '' && values[r][index] != null) empty = false;
    });
    if (!empty) rows.push(row);
  }
  return rows;
}

function portalCompanyNames_(sheet) {
  var seen = {};
  var names = [];
  portalSheetRows_(sheet).forEach(function (row) {
    var name = String(row.company_name || row.company || '').trim();
    if (!name || seen[name]) return;
    seen[name] = true;
    names.push(name);
  });
  names.sort();
  return names;
}

function portalAttendanceRecords_(sheet) {
  return portalSheetRows_(sheet).map(function (row) {
    var record = {
      name: String(row.name || ''),
      audience: String(row.member_or_guest || row.audience || ''),
      event: String(row.event || row.event_name || ''),
      date: String(row.date || ''),
      email: String(row.email || ''),
      phone: String(row.phone || row.mobile || ''),
      company: String(row.company || row.company_name || '')
    };
    Object.keys(row).forEach(function (key) {
      if (record[key] == null && key !== 'member_or_guest' && key !== 'event_name' && key !== 'company_name' && key !== 'mobile') {
        record[key] = row[key];
      }
    });
    return record;
  }).filter(function (row) { return row.name && row.date; });
}
