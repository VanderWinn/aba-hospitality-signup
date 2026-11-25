/* Placeholder facts for the membership and events dashboard, and the adapter
   that will later read the Google Sheet. Counts only: no names, emails, or phones.

   The example is a closed ledger. Member stock at the sketch dates is
   385 (2025-11-24), 404 (2026-08-24), 409 (2026-10-24), and 412 (2026-11-24).
   August 2026 joins and losses are split around the 24th so the same-length
   comparison windows land on the sketch figures. One event on 2025-11-27
   carries 69 attendees so those comparisons stay exact; a full-year 2025
   chart therefore spikes in November. */
(function (root) {
  'use strict';

  var TYPES = ['Lunch & Learn', 'Ribbon Cutting', 'Happy Hour'];

  function canonicalType(value) {
    var text = String(value || '').trim().toLowerCase();
    if (text === 'lunch & learn' || text === 'lunch and learn') return 'Lunch & Learn';
    if (text === 'ribbon cutting') return 'Ribbon Cutting';
    if (text === 'happy hour') return 'Happy Hour';
    return '';
  }

  function canonicalAudience(value) {
    var text = String(value || '').trim().toLowerCase();
    if (text === 'member' || text === 'members') return 'Member';
    if (text === 'guest' || text === 'guests') return 'Guest';
    return '';
  }

  function whole(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return Math.round(n);
  }

  function isISO(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  }

  var DROP = {
    email: 1, phone: 1, mobile: 1, attendee: 1, attendee_name: 1,
    first_name: 1, last_name: 1, firstname: 1, lastname: 1, name: 1
  };

  function field(row, names) {
    var found = '';
    Object.keys(row || {}).forEach(function (key) {
      if (found) return;
      var low = String(key).toLowerCase().replace(/\s+/g, '_');
      if (DROP[low]) return;
      if (names.indexOf(low) !== -1) found = row[key];
    });
    return found;
  }

  function deal(date, audience, joins, losses, seed) {
    var rows = TYPES.map(function (type) {
      return { date: date, audience: audience, eventType: type, joins: 0, losses: 0 };
    });
    var i;
    for (i = 0; i < joins; i++) rows[(seed + i) % 3].joins += 1;
    for (i = 0; i < losses; i++) rows[(seed + joins + i) % 3].losses += 1;
    return rows.filter(function (row) { return row.joins || row.losses; });
  }

  function pushEvent(events, attendance, id, date, type, member, guest) {
    events.push({ id: id, date: date, type: type });
    if (member) attendance.push({ eventId: id, audience: 'Member', count: member });
    if (guest) attendance.push({ eventId: id, audience: 'Guest', count: guest });
  }

  function exampleRecords() {
    var events = [];
    var attendance = [];
    var current = [
      ['e01', '2026-01-14', 'Lunch & Learn', 22, 13],
      ['e02', '2026-02-11', 'Ribbon Cutting', 20, 12],
      ['e03', '2026-04-08', 'Happy Hour', 24, 14],
      ['e04', '2026-05-13', 'Lunch & Learn', 21, 13],
      ['e05', '2026-06-10', 'Ribbon Cutting', 22, 14],
      ['e06', '2026-07-08', 'Lunch & Learn', 18, 26],
      ['e07', '2026-07-22', 'Happy Hour', 28, 0],
      ['e08', '2026-08-27', 'Lunch & Learn', 20, 13],
      ['e09', '2026-09-09', 'Happy Hour', 23, 14],
      ['e10', '2026-10-07', 'Ribbon Cutting', 30, 16],
      ['e11', '2026-10-21', 'Lunch & Learn', 18, 11],
      ['e12', '2026-11-05', 'Happy Hour', 24, 16],
      ['e13', '2026-11-18', 'Happy Hour', 16, 14]
    ];
    current.forEach(function (row) {
      pushEvent(events, attendance, row[0], row[1], row[2], row[3], row[4]);
    });

    var lastYearAttendance = [38, 36, 35, 40, 37, 39, 42, 36, 38, 41, 33];
    lastYearAttendance.forEach(function (total, index) {
      var member = Math.round(total * 286 / 462);
      var guest = total - member;
      var month = index + 1;
      var day = month < 10 ? '0' + month : String(month);
      pushEvent(events, attendance, 'y2025-' + day, '2025-' + day + '-10', TYPES[index % 3], member, guest);
    });
    pushEvent(events, attendance, 'y2025-11-late', '2025-11-27', 'Happy Hour', 43, 26);
    pushEvent(events, attendance, 'y2025-12', '2025-12-10', 'Lunch & Learn', 36, 22);
    var month;
    for (month = 1; month <= 12; month++) {
      var mm = month < 10 ? '0' + month : String(month);
      pushEvent(events, attendance, 'y2024-' + mm, '2024-' + mm + '-12', TYPES[(month - 1) % 3], 11, 7);
    }

    var memberMonths = [
      ['2025-01-10', 5, 3], ['2025-02-10', 5, 3], ['2025-03-10', 5, 3],
      ['2025-04-10', 4, 2], ['2025-05-10', 4, 2], ['2025-06-10', 4, 2],
      ['2025-07-10', 4, 2], ['2025-08-10', 4, 2], ['2025-09-10', 4, 2],
      ['2025-10-10', 1, 4], ['2025-11-10', 0, 4], ['2025-11-27', 8, 0],
      ['2025-12-10', 1, 0],
      ['2026-01-10', 4, 3], ['2026-02-10', 2, 1], ['2026-03-10', 5, 2],
      ['2026-04-10', 3, 6], ['2026-05-10', 3, 2], ['2026-06-10', 6, 3],
      ['2026-07-10', 5, 2], ['2026-08-10', 1, 0], ['2026-08-28', 2, 5],
      ['2026-09-10', 5, 2], ['2026-10-10', 8, 3], ['2026-11-10', 6, 3]
    ];
    var changes = [];
    memberMonths.forEach(function (row, index) {
      deal(row[0], 'Member', row[1], row[2], index).forEach(function (item) { changes.push(item); });
    });
    var guestMonths = [
      ['2025-06-15', 4, 1], ['2025-11-20', 3, 2]
    ];
    for (month = 1; month <= 11; month++) {
      var gday = month < 10 ? '0' + month : String(month);
      guestMonths.push(['2026-' + gday + '-20', 2, 1]);
    }
    guestMonths.forEach(function (row, index) {
      deal(row[0], 'Guest', row[1], row[2], index + 3).forEach(function (item) { changes.push(item); });
    });

    return {
      example: true,
      asOf: '2026-11-24',
      openings: [
        { date: '2024-12-31', audience: 'Member', eventType: 'Lunch & Learn', count: 125 },
        { date: '2024-12-31', audience: 'Member', eventType: 'Ribbon Cutting', count: 125 },
        { date: '2024-12-31', audience: 'Member', eventType: 'Happy Hour', count: 124 },
        { date: '2024-12-31', audience: 'Guest', eventType: 'Lunch & Learn', count: 6 },
        { date: '2024-12-31', audience: 'Guest', eventType: 'Ribbon Cutting', count: 6 },
        { date: '2024-12-31', audience: 'Guest', eventType: 'Happy Hour', count: 6 }
      ],
      events: events,
      attendance: attendance,
      changes: changes
    };
  }

  function normalize(raw) {
    var source = raw || {};
    var events = [];
    var seen = {};
    (source.events || []).forEach(function (row) {
      if (!isISO(row.date)) return;
      var type = canonicalType(row.type || row.eventType);
      var id = String(row.id || row.eventId || '').trim();
      if (!type || !id || seen[id]) return;
      seen[id] = true;
      events.push({ id: id, date: row.date, type: type });
    });
    var attendance = [];
    (source.attendance || []).forEach(function (row) {
      var id = String(row.eventId || '').trim();
      var audience = canonicalAudience(row.audience);
      var count = whole(row.count);
      if (!id || !seen[id] || !audience || !count) return;
      attendance.push({ eventId: id, audience: audience, count: count });
    });
    var openings = [];
    (source.openings || []).forEach(function (row) {
      if (!isISO(row.date)) return;
      var audience = canonicalAudience(row.audience);
      var type = canonicalType(row.eventType);
      var count = whole(row.count);
      if (!audience || !type || !count) return;
      openings.push({ date: row.date, audience: audience, eventType: type, count: count });
    });
    var changes = [];
    (source.changes || []).forEach(function (row) {
      if (!isISO(row.date)) return;
      var audience = canonicalAudience(row.audience);
      var type = canonicalType(row.eventType);
      var joins = whole(row.joins);
      var losses = whole(row.losses);
      if (!audience || !type || (!joins && !losses)) return;
      changes.push({ date: row.date, audience: audience, eventType: type, joins: joins, losses: losses });
    });
    return {
      example: source.example === true,
      asOf: isISO(source.asOf) ? source.asOf : '',
      openings: openings,
      events: events,
      attendance: attendance,
      changes: changes
    };
  }

  function sheetRows(value) {
    return Array.isArray(value) ? value : [];
  }

  function fromSheetTabs(tabs) {
    tabs = tabs || {};
    var events = sheetRows(tabs.events).map(function (row) {
      return {
        id: field(row, ['event_id', 'id']),
        date: field(row, ['date']),
        type: field(row, ['event_type', 'type'])
      };
    });
    var attendance = sheetRows(tabs.attendance).map(function (row) {
      return {
        eventId: field(row, ['event_id', 'id']),
        audience: field(row, ['audience']),
        count: field(row, ['count'])
      };
    });
    var openings = sheetRows(tabs.membershipOpening || tabs.opening).map(function (row) {
      return {
        date: field(row, ['as_of', 'date']),
        audience: field(row, ['audience']),
        eventType: field(row, ['event_type', 'type']),
        count: field(row, ['count'])
      };
    });
    var changes = sheetRows(tabs.membership).map(function (row) {
      return {
        date: field(row, ['date']),
        audience: field(row, ['audience']),
        eventType: field(row, ['event_type', 'type']),
        joins: field(row, ['joins']),
        losses: field(row, ['losses'])
      };
    });
    var normalized = normalize({
      example: false,
      asOf: field(tabs, ['as_of', 'asof']) || tabs.asOf || '',
      events: events,
      attendance: attendance,
      openings: openings,
      changes: changes
    });
    return normalized;
  }

  function placeholderSource() {
    return normalize(exampleRecords());
  }

  function loadExecutiveSource() {
    return Promise.resolve(placeholderSource());
  }

  root.ABADashboardData = {
    placeholderSource: placeholderSource,
    fromSheetTabs: fromSheetTabs,
    loadExecutiveSource: loadExecutiveSource,
    normalize: normalize
  };
})(typeof window !== 'undefined' ? window : globalThis);
