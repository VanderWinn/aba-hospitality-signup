const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');

function load() {
  const context = {
    Intl, Date, JSON, Math, Number, String, Object, Array,
    encodeURIComponent, decodeURIComponent, isFinite, Promise
  };
  context.globalThis = context;
  vm.createContext(context);
  ['aba-site/js/dashboard-model.js', 'aba-site/js/dashboard-data.js', 'aba-site/js/dashboard-directory.js', 'aba-site/js/dashboard-view.js'].forEach(function (file) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  });
  return context;
}

const sandbox = load();
const dash = sandbox.ABADashboard;
const dataApi = sandbox.ABADashboardData;
const source = dataApi.placeholderSource();

function view(state) {
  return dash.compute(source, Object.assign(dash.defaultState(source), state || {}));
}

test('the default year is the current fiscal year to date', () => {
  const home = view();
  assert.equal(source.example, true);
  assert.equal(source.asOf, '2026-11-24');
  assert.equal(dash.fiscalYearOf('2026-11-24'), 2027);
  assert.equal(dash.fiscalYearOf('2026-06-30'), 2026);
  assert.equal(dash.fiscalYearOf('2026-07-01'), 2027);
  const fy2026 = dash.fiscalBounds(2026);
  assert.equal(fy2026.start, '2025-07-01');
  assert.equal(fy2026.end, '2026-06-30');
  assert.equal(home.year, 2027);
  assert.equal(home.range.start, '2026-07-01');
  assert.equal(home.range.end, '2026-11-24');
  assert.equal(home.grouping, 'year');
  assert.deepEqual(Array.from(home.gains, (bucket) => bucket.label), ['FY2027']);
  assert.equal(home.gains[0].joins, 27);
  assert.equal(home.gains[0].losses, 15);
  assert.equal(home.gains[0].priorJoins, 13);
  assert.equal(home.gains[0].priorLosses, 14);
  assert.equal(home.gainLegend.current, 'FY2027');
  assert.equal(home.gainLegend.prior, 'FY2026');
  assert.deepEqual(Array.from(home.monthBuckets, (bucket) => bucket.label), ['FY2027']);
  assert.equal(home.members.value, 412);
  assert.equal(home.members.lastMonth, 409);
  assert.equal(home.members.lastQuarter, 404);
  assert.equal(home.members.lastYear, 400);
  assert.deepEqual(Array.from(home.members.labels), ['Month start', 'Quarter start', 'FY start']);
  assert.equal(home.members.tone, 'up');
  assert.equal(home.members.color, '#3F768B');
  assert.equal(home.newMembers.value, 27);
  assert.equal(home.newMembers.lastMonth, 8);
  assert.equal(home.newMembers.lastQuarter, 6);
  assert.equal(home.newMembers.lastYear, 13);
  assert.equal(home.net.value, 12);
  assert.equal(home.net.lastMonth, 5);
  assert.equal(home.net.lastQuarter, 4);
  assert.equal(home.net.lastYear, -1);
  assert.equal(home.events.value, 8);
  assert.equal(home.events.lastMonth, 7);
  assert.equal(home.events.lastQuarter, 5);
  assert.equal(home.events.lastYear, 5);
  assert.deepEqual(Array.from(home.eventSeries), [8]);
  assert.deepEqual(Array.from(home.eventLastYear), [5]);
  assert.equal(home.attendance.value, 287);
  assert.equal(home.attendance.lastMonth, 253);
  assert.equal(home.attendance.lastQuarter, 180);
  assert.equal(home.attendance.lastYear, 190);
  assert.deepEqual(Array.from(home.attendanceSeries), [287]);
  assert.deepEqual(Array.from(home.attendanceLastYear), [190]);
  assert.equal(home.pie.members, 177);
  assert.equal(home.pie.guests, 110);
  assert.equal(home.pie.memberPct, 62);
  assert.equal(home.pie.guestPct, 38);
  assert.equal(home.eventCounts.all, 8);
  assert.equal(home.eventCounts['Lunch & Learn'], 3);
  assert.equal(home.eventCounts['Ribbon Cutting'], 1);
  assert.equal(home.eventCounts['Happy Hour'], 4);
  const span = dash.inclusiveDays(home.range.start, home.range.end);
  const lastMonth = dash.shiftRange(home.range.start, home.range.end, 1);
  const lastQuarter = dash.shiftRange(home.range.start, home.range.end, 3);
  const lastYear = dash.priorYearRange(home.range.start, home.range.end);
  assert.equal(lastMonth.start, '2026-05-31');
  assert.equal(lastMonth.end, '2026-10-24');
  assert.equal(dash.inclusiveDays(lastMonth.start, lastMonth.end), span);
  assert.equal(lastQuarter.start, '2026-03-31');
  assert.equal(lastQuarter.end, '2026-08-24');
  assert.equal(dash.inclusiveDays(lastQuarter.start, lastQuarter.end), span);
  assert.equal(lastYear.start, '2025-07-01');
  assert.equal(lastYear.end, '2025-11-24');
  assert.equal(dash.inclusiveDays(lastYear.start, lastYear.end), span);
});

test('bottom charts use the same periods as member gains', () => {
  ['year', 'quarter', 'month', 'last12'].forEach((period) => {
    const page = view({ period: period });
    const gainLabels = Array.from(page.gains, (bucket) => bucket.label);
    const lineLabels = Array.from(page.monthBuckets, (bucket) => bucket.label);
    assert.deepEqual(lineLabels, gainLabels);
    assert.equal(page.eventSeries.length, gainLabels.length);
    assert.equal(page.eventLastYear.length, gainLabels.length);
    assert.equal(page.attendanceSeries.length, gainLabels.length);
    assert.equal(page.attendanceLastYear.length, gainLabels.length);
    assert.equal(page.pie.members + page.pie.guests, page.attendance.value);
  });
  const year = view({ period: 'year' });
  assert.deepEqual(Array.from(year.monthBuckets, (bucket) => bucket.label), ['FY2027']);
  assert.deepEqual(Array.from(year.eventSeries), [year.events.value]);
  assert.deepEqual(Array.from(year.eventLastYear), [year.events.lastYear]);
  assert.deepEqual(Array.from(year.attendanceSeries), [year.attendance.value]);
  assert.deepEqual(Array.from(year.attendanceLastYear), [year.attendance.lastYear]);
  const past = view({ year: 2026, period: 'year' });
  assert.deepEqual(Array.from(past.gains, (bucket) => bucket.label), ['FY2026']);
  assert.deepEqual(Array.from(past.monthBuckets, (bucket) => bucket.label), ['FY2026']);
});

test('a single period draws events and attendance as paired bars', () => {
  function paint(state) {
    return sandbox.ABADashboardView.render(Object.assign(view(state), { mobile: false, documents: { extras: [] } }));
  }
  function slice(html, start, end) {
    return html.split(start)[1].split(end)[0];
  }
  const year = view({ period: 'year' });
  const html = paint({ period: 'year' });
  const events = slice(html, 'card-events', 'card-attendance');
  const attendance = slice(html, 'card-attendance', 'card-pie');
  assert.match(events, /fill="#7D949C"/);
  assert.match(events, /fill="#3F768B"/);
  assert.match(events, />5</);
  assert.match(events, />8</);
  assert.match(events, /FY2026/);
  assert.match(events, /FY2027/);
  assert.equal(events.includes('<polyline'), false);
  assert.equal(events.includes('class="note"'), false);
  assert.match(attendance, />190</);
  assert.match(attendance, />287</);
  assert.equal(attendance.includes('class="note"'), false);
  assert.equal(year.eventSeries[0], 8);
  assert.equal(year.eventLastYear[0], 5);
  const quarter = paint({ period: 'quarter' });
  const quarterEvents = slice(quarter, 'card-events', 'card-attendance');
  assert.match(quarterEvents, /<polyline/);
  assert.match(quarterEvents, /class="note"/);
  assert.equal(quarterEvents.includes('fill="#7D949C"'), false);
  const month = view({ period: 'month' });
  const july = view({ period: 'month', bucket: month.gains[0].id });
  assert.equal(july.eventSeries.length, 1);
  const julyHtml = sandbox.ABADashboardView.render(Object.assign(july, { mobile: false, documents: { extras: [] } }));
  const julyEvents = slice(julyHtml, 'card-events', 'card-attendance');
  assert.match(julyEvents, new RegExp('>' + july.eventLastYear[0] + '<'));
  assert.match(julyEvents, new RegExp('>' + july.eventSeries[0] + '<'));
  assert.equal(julyEvents.includes('<polyline'), false);
});

test('quarter and month set the date window for every total', () => {
  const quarter = view({ period: 'quarter' });
  assert.equal(quarter.range.start, '2026-10-01');
  assert.equal(quarter.range.end, '2026-11-24');
  assert.equal(quarter.grouping, 'quarter');
  assert.equal(quarter.quarter, 2);
  assert.equal(quarter.year, 2027);
  assert.equal(quarter.stepper.label, 'Fiscal year');
  assert.equal(quarter.stepper.value, 'FY2027');
  assert.equal(quarter.segment, undefined);
  assert.equal(quarter.members.value, 412);
  assert.deepEqual(Array.from(quarter.members.labels), ['Month start', 'Quarter start', 'FY start']);
  assert.equal(quarter.members.lastMonth, 409);
  assert.equal(quarter.members.lastQuarter, 404);
  assert.equal(quarter.members.lastYear, 400);
  assert.deepEqual(Array.from(quarter.gains, (bucket) => bucket.label), ['Q1', 'Q2']);
  assert.equal(quarter.gains[0].priorJoins >= 0, true);
  assert.equal(quarter.gains[1].priorJoins >= 0, true);
  assert.deepEqual(Array.from(quarter.monthBuckets, (bucket) => bucket.label), ['Q1', 'Q2']);
  assert.equal(quarter.eventSeries.length, 2);
  const earlier = view({ period: 'quarter', year: 2027, quarter: 1 });
  assert.equal(earlier.quarter, 2);
  assert.equal(earlier.range.start, '2026-10-01');
  assert.equal(earlier.stepper.value, 'FY2027');
  const month = view({ period: 'month' });
  assert.equal(month.range.start, '2026-11-01');
  assert.equal(month.range.end, '2026-11-24');
  assert.equal(month.month, '2026-11');
  assert.equal(month.stepper.value, 'FY2027');
  assert.equal(month.segment, undefined);
  assert.equal(month.members.value, 412);
  assert.equal(month.members.lastYear, 400);
  assert.deepEqual(Array.from(month.newMembers.labels), ['Last month', 'Last quarter', 'Last year']);
  assert.deepEqual(Array.from(month.gains, (bucket) => bucket.label), ['J', 'A', 'S', 'O', 'N']);
  assert.equal(month.gains[4].joins, month.newMembers.value);
  assert.equal(month.eventSeries.length, 5);
  assert.equal(month.eventSeries[4], month.events.value);
  const julyBar = view({ period: 'month', bucket: month.gains[0].id });
  assert.equal(julyBar.range.start, '2026-11-01');
  assert.equal(julyBar.newMembers.value, 5);
  assert.equal(julyBar.events.value, 2);
  assert.equal(julyBar.eventSeries.length, 1);
  assert.equal(month.attendance.value < quarter.attendance.value, true);
  const ignoredJuly = view({ period: 'month', month: '2026-07' });
  assert.equal(ignoredJuly.month, '2026-11');
  assert.equal(ignoredJuly.range.start, '2026-11-01');
  const lunch = view({ period: 'quarter', eventTypes: ['Lunch & Learn'] });
  assert.equal(lunch.range.start, quarter.range.start);
  assert.equal(lunch.range.end, quarter.range.end);
  assert.ok(lunch.events.value < quarter.events.value);
  assert.ok(lunch.members.value > 0);
  assert.ok(lunch.members.value < quarter.members.value);
  const past = view({ year: 2026, period: 'year' });
  assert.equal(past.range.start, '2025-07-01');
  assert.equal(past.range.end, '2026-06-30');
  assert.deepEqual(Array.from(past.gains, (bucket) => bucket.label), ['FY2026']);
  assert.deepEqual(Array.from(past.monthBuckets, (bucket) => bucket.label), ['FY2026']);
  assert.equal(past.eventSeries.length, 1);
  assert.equal(past.eventSeries[0], past.events.value);
  assert.equal(past.eventLastYear[0], past.events.lastYear);
  assert.equal(past.events.value > 0, true);
  const pastQuarter = view({ year: 2026, quarter: 2, period: 'quarter' });
  assert.equal(pastQuarter.quarter, 4);
  assert.equal(pastQuarter.range.start, '2026-04-01');
  assert.equal(pastQuarter.range.end, '2026-06-30');
  assert.equal(pastQuarter.stepper.value, 'FY2026');
  assert.deepEqual(Array.from(pastQuarter.gains, (bucket) => bucket.label), ['Q1', 'Q2', 'Q3', 'Q4']);
  const pastMonth = view({ year: 2026, period: 'month', month: '2025-11' });
  assert.equal(pastMonth.month, '2026-06');
  assert.equal(pastMonth.range.start, '2026-06-01');
  assert.equal(pastMonth.range.end, '2026-06-30');
  assert.deepEqual(Array.from(pastMonth.gains, (bucket) => bucket.label), ['J', 'A', 'S', 'O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J']);
  const trailing = view({ year: 2024, period: 'last12' });
  assert.equal(trailing.yearEnabled, false);
  assert.equal(trailing.grouping, 'month');
  assert.equal(trailing.range.start, '2025-12-01');
  assert.equal(trailing.range.end, '2026-11-24');
  assert.equal(trailing.gains.length, 12);
  const jumped = dash.applyAction(source, { year: 2026, quarter: 1, period: 'year', month: '2026-03', from: '', to: '' }, { type: 'period', period: 'quarter' });
  assert.equal(jumped.quarter, 4);
  assert.equal(jumped.year, 2026);
  assert.equal(dash.compute(source, jumped).range.start, '2026-04-01');
  assert.equal(dash.compute(source, jumped).range.end, '2026-06-30');
  assert.equal(dash.compute(source, jumped).stepper.value, 'FY2026');
  const stepped = dash.applyAction(source, jumped, { type: 'year', year: 2027 });
  assert.equal(stepped.quarter, 2);
  assert.equal(dash.compute(source, stepped).range.end, '2026-11-24');
  assert.equal(dash.compute(source, stepped).stepper.value, 'FY2027');
  const monthJump = dash.applyAction(source, stepped, { type: 'period', period: 'month' });
  assert.equal(monthJump.year, 2027);
  assert.equal(monthJump.month, '2026-11');
  const priorYear = dash.applyAction(source, { year: 2027, period: 'month', month: '2026-11', quarter: 2 }, { type: 'year', year: 2026 });
  assert.equal(priorYear.month, '2026-06');
  assert.equal(dash.compute(source, priorYear).range.start, '2026-06-01');
  assert.equal(dash.compute(source, priorYear).range.end, '2026-06-30');
  const directory = sandbox.ABADirectory.build(source);
  const yearEvents = sandbox.ABADirectory.drill(directory, 'events', dash.compute(source, null, directory));
  const quarterEvents = sandbox.ABADirectory.drill(directory, 'events', dash.compute(source, { period: 'quarter' }, directory));
  const yearNew = sandbox.ABADirectory.drill(directory, 'newMembers', dash.compute(source, null, directory));
  const monthNew = sandbox.ABADirectory.drill(directory, 'newMembers', dash.compute(source, { period: 'month' }, directory));
  assert.ok(quarterEvents.rows.length > 0);
  assert.ok(quarterEvents.rows.length < yearEvents.rows.length);
  assert.ok(quarterEvents.rows.every((row) => row.date >= '2026-10-01' && row.date <= '2026-11-24'));
  assert.ok(monthNew.rows.length < yearNew.rows.length);
  assert.ok(monthNew.rows.every((row) => row.date >= '2026-11-01' && row.date <= '2026-11-24'));
});

test('a pasted from and to range does not override the fiscal window', () => {
  const ignored = dash.compute(source, {
    year: 2026, period: 'quarter', from: '2026-03-01', to: '2026-08-31', bucket: ''
  });
  assert.equal(ignored.range.start, '2026-04-01');
  assert.equal(ignored.range.end, '2026-06-30');
  assert.equal(ignored.yearEnabled, true);
  assert.deepEqual(Array.from(ignored.gains, (bucket) => bucket.label), ['Q1', 'Q2', 'Q3', 'Q4']);
  const hash = dash.stateHash({ year: 2026, period: 'quarter', from: '2026-03-01', to: '2026-08-31', bucket: '' });
  assert.equal(hash.includes('from='), false);
  assert.equal(hash.includes('to='), false);
  const roundTrip = dash.stateFromHash(hash + '&from=2026-03-01&to=2026-08-31', source);
  assert.equal(roundTrip.from, undefined);
  assert.equal(dash.compute(source, roundTrip).range.start, '2026-04-01');
});

test('the pie, event type, and bar filters recalculate the page', () => {
  const guests = view({ audience: 'Guest' });
  assert.equal(guests.attendance.value, 110);
  assert.equal(guests.events.value, 7);
  assert.notEqual(guests.members.value, 412);
  assert.notEqual(guests.newMembers.value, 27);
  const members = view({ audience: 'Member' });
  assert.equal(members.attendance.value, 177);
  assert.equal(members.members.value, 412);
  assert.equal(members.events.value, 8);
  const unfiltered = view();
  const lunch = view({ eventType: 'Lunch & Learn' });
  const ribbon = view({ eventType: 'Ribbon Cutting' });
  assert.equal(lunch.events.value, 3);
  assert.ok(lunch.members.value > 0);
  assert.ok(lunch.members.value < unfiltered.members.value);
  assert.ok(lunch.newMembers.value < unfiltered.newMembers.value);
  assert.notEqual(lunch.net.value, unfiltered.net.value);
  assert.ok(ribbon.members.value < unfiltered.members.value);
  assert.equal(lunch.gains[0].priorJoins <= unfiltered.gains[0].priorJoins, true);
  const months = view({ period: 'month' });
  const july = view({ period: 'month', bucket: months.gains[0].id });
  assert.equal(july.events.value, 2);
  assert.equal(july.newMembers.value, 5);
  assert.equal(july.eventSeries.length, 1);
  assert.equal(july.attendanceSeries.length, 1);
  assert.equal(july.bucket, months.gains[0].id);
  const cleared = dash.applyAction(source, { audience: 'Guest', eventType: 'Happy Hour', bucket: 'x', year: 2025, period: 'month' }, { type: 'reset' });
  assert.equal(cleared.period, 'year');
  assert.equal(cleared.year, 2027);
  assert.equal(cleared.audience, '');
  assert.equal(cleared.eventType, '');
  const again = dash.applyAction(source, { audience: 'Guest', period: 'year', year: 2026, from: '', to: '', eventType: '', bucket: '' }, { type: 'audience', audience: 'Guest' });
  assert.equal(again.audience, '');
});

test('the sheet adapter keeps counts and drops contact fields', () => {
  const parsed = dataApi.fromSheetTabs({
    asOf: '2026-11-24',
    events: [{
      date: '2026-01-14',
      event_id: 'x',
      event_type: 'Lunch & Learn',
      email: 'person@example.com',
      phone: '555-0100',
      name: 'Pat Example'
    }],
    attendance: [{ event_id: 'x', audience: 'Guest', count: 4, email: 'person@example.com', phone: '555-0199' }],
    membership: [{ date: '2026-01-10', audience: 'Member', event_type: 'Lunch & Learn', joins: 2, losses: 1, name: 'Pat Example' }],
    membershipOpening: [{ as_of: '2024-12-31', audience: 'Member', event_type: 'Lunch & Learn', count: 10, phone: '555-0101' }]
  });
  const body = JSON.stringify(parsed);
  assert.equal(body.includes('@'), false);
  assert.equal(body.includes('555'), false);
  assert.equal(body.includes('Pat'), false);
  assert.equal(parsed.example, false);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.attendance[0].count, 4);
  assert.equal(parsed.attendance[0].audience, 'Guest');
  assert.equal(JSON.stringify(source).includes('@'), false);
  assert.equal(JSON.stringify(source).toLowerCase().includes('phone'), false);
  assert.equal(JSON.stringify(source).toLowerCase().includes('email'), false);
  const kept = dataApi.fromSheetTabs({
    attendanceRecords: [{
      name: 'Avery Sample',
      member_or_guest: 'Guest',
      event: 'Happy Hour',
      date: '2026-04-08',
      email: 'avery.sample@example.com',
      phone: '555-0101',
      company: 'Visitor Co.',
      notes: 'Example visit'
    }],
    members: [{ company_name: 'Juniper Goods' }, { company_name: 'Ada River Cafe' }, { company_name: 'Visitor Co.' }]
  });
  assert.equal(kept.attendanceRecords[0].email, 'avery.sample@example.com');
  assert.equal(kept.attendanceRecords[0].phone, '555-0101');
  assert.equal(kept.attendanceRecords[0].notes, 'Example visit');
  assert.equal(Array.from(kept.companies).join('|'), 'Ada River Cafe|Juniper Goods|Visitor Co.');
  const directory = sandbox.ABADirectory.build(source);
  const plain = dash.compute(source, null, directory);
  const attendance = sandbox.ABADirectory.drill(directory, 'attendance', plain);
  assert.equal(attendance.rows.length, 287);
  assert.equal(attendance.rows[0].email.endsWith('@example.com'), true);
  assert.equal(String(attendance.rows[0].phone).indexOf('555-'), 0);
  assert.equal(attendance.columns.some((column) => column.key === 'notes'), true);
  const guestView = Object.assign({}, plain, { audience: 'Guest' });
  assert.equal(sandbox.ABADirectory.drill(directory, 'attendance', guestView).rows.length, 110);
  const company = dash.compute(source, {
    year: 2027, period: 'year', from: '', to: '', eventTypes: [], companies: ['Ada River Cafe'], people: [], nameQuery: '', audience: '', bucket: ''
  }, directory);
  assert.ok(company.attendance.value < 287);
  assert.ok(company.members.value < 412);
  const both = dash.applyAction(source, { year: 2026, period: 'month', from: '2026-03-01', to: '2026-06-30', eventTypes: ['Lunch & Learn', 'Happy Hour'], companies: ['Ada River Cafe'], people: ['Avery Sample'], nameQuery: 'sam', audience: 'Guest', bucket: 'x' }, { type: 'reset' });
  assert.equal(both.period, 'year');
  assert.equal(both.eventTypes.length, 0);
  assert.equal(both.companies.length, 0);
  assert.equal(both.people.length, 0);
  assert.equal(both.audience, '');
  assert.equal(both.bucket, '');
  const combo = dash.compute(source, {
    year: 2027, period: 'year', from: '', to: '',
    eventTypes: ['Lunch & Learn', 'Happy Hour'],
    companies: ['Ada River Cafe', 'Brookside Bakery'],
    people: ['Avery Demo'],
    nameQuery: '', audience: '', bucket: ''
  }, directory);
  assert.equal(combo.pie.members + combo.pie.guests, combo.attendance.value);
  const comboHtml = sandbox.ABADashboardView.render(Object.assign(combo, { mobile: false, documents: { extras: [] } }));
  if (combo.attendance.value === 1) {
    assert.equal(combo.pie.memberPct === 100 || combo.pie.guestPct === 100, true);
    assert.match(comboHtml, /100%/);
  }
  if (!combo.gains.some((bucket) => bucket.joins || bucket.losses)) {
    assert.match(comboHtml, /chart-empty is-gains/);
    assert.match(comboHtml, /No records/);
  }
  const emptyPie = sandbox.ABADashboardView.render(Object.assign({}, combo, {
    attendance: { value: 0, lastMonth: 0, lastQuarter: 0, lastYear: 0, tone: 'flat' },
    pie: { members: 0, guests: 0, memberPct: 0, guestPct: 0 },
    gains: [{ id: '2026-01-01:2026-11-24', label: '2026', joins: 0, losses: 0 }],
    mobile: false,
    documents: { extras: [] }
  }));
  assert.match(emptyPie, /No records/);
});

test('only the three event types are counted, and other statuses stay on the records', () => {
  const parsed = dataApi.fromSheetTabs({
    asOf: '2026-11-25',
    events: [
      { date: '2026-10-08', event_id: 'l', event_type: 'Lunch & Learn' },
      { date: '2026-10-01', event_id: 'b', event_type: 'BOSS' },
      { date: '', event_id: 'old', event_type: 'Lunch & Learn' }
    ],
    attendance: [
      { event_id: 'l', audience: 'Member', count: 4 },
      { event_id: 'b', audience: 'Member', count: 9 }
    ],
    membership: [{ date: '2026-06-30', audience: 'Member', event_type: 'Lunch & Learn', joins: 0, losses: 112 }],
    attendanceRecords: [
      { name: 'Lu Example', date: '2026-10-08', event_type: 'Lunch & Learn', status: 'no_show', email: 'lu@example.com', registration_status: 'registered' },
      { name: 'Bo Example', date: '2026-10-01', event_type: 'BOSS', status: 'attended', email: 'bo@example.com' }
    ]
  });
  assert.deepEqual(Array.from(parsed.events, (event) => event.id), ['l']);
  assert.equal(parsed.attendance.length, 1);
  assert.equal(parsed.attendance[0].count, 4);
  assert.equal(parsed.attendanceRecords.length, 1);
  assert.equal(parsed.attendanceRecords[0].status, 'no_show');
  assert.equal(parsed.attendanceRecords[0].registration_status, 'registered');
  assert.equal(JSON.stringify(parsed.events).includes('BOSS'), false);
  const live = sandbox.ABADirectory.fromLive({
    companies: ['North Co'],
    roster: [{ company: 'North Co', status: 'Active', joinDate: '2020-01-01', lostDate: '' }],
    attendanceRecords: [
      { name: 'Ada North', company: 'North Co', audience: 'Member', eventType: 'Lunch & Learn', event: 'Lunch', eventId: 'l', date: '2026-10-08', status: 'attended', email: 'ada@example.com' },
      { name: 'Bea North', company: 'North Co', audience: 'Guest', eventType: 'Lunch & Learn', event: 'Lunch', eventId: 'l', date: '2026-10-08', status: 'no_show' },
      { name: 'Cam Boss', company: 'North Co', audience: 'Member', eventType: 'BOSS', event: 'BOSS', eventId: 'b', date: '2026-10-01', status: 'attended' },
      { name: 'Dee North', company: 'North Co', audience: 'Guest', eventType: 'Happy Hour', event: 'Hour', eventId: 'h', date: '2026-09-01', status: 'cancelled' },
      { name: 'Eve North', company: 'North Co', audience: 'Member', eventType: 'Ribbon Cutting', event: 'Cut', eventId: 'r', date: '2026-09-17', status: 'registered' }
    ]
  });
  assert.equal(live.attendance.length, 4);
  assert.equal(live.attendance.some((row) => row.eventType === 'BOSS'), false);
  const narrowed = dash.compute(parsed, {
    year: 2027, period: 'year', from: '', to: '', eventTypes: ['Happy Hour'], companies: ['North Co'], people: [], nameQuery: '', audience: '', bucket: ''
  }, live);
  assert.equal(narrowed.members.value, 0);
  const allTypes = dash.compute(parsed, {
    year: 2027, period: 'year', from: '', to: '', eventTypes: [], companies: ['North Co'], people: [], nameQuery: '', audience: '', bucket: ''
  }, live);
  assert.equal(allTypes.members.value, 1);
  assert.equal(narrowed.attendance.value, 0);
  assert.equal(narrowed.events.value, 0);
  const gs = { crypto: require('crypto'), ABA_SHA256: (text) => require('crypto').createHash('sha256').update(String(text)).digest('hex') };
  gs.globalThis = gs;
  vm.createContext(gs);
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/PortalDashboard.gs'), 'utf8'), gs, { filename: 'PortalDashboard.gs' });
  const built = gs.executiveRowsToDashboard_({
    events: [
      { date: '2026-10-08', event_id: 'l', event_type: 'Lunch & Learn' },
      { date: '2026-10-01', event_id: 'b', event_type: 'BOSS' },
      { date: '2025-03-25', event_id: 'c', event_type: 'Collaboration' }
    ],
    attendanceRecords: [
      { event_id: 'l', event_type: 'Lunch & Learn', status: 'attended', member_or_guest: 'Member' },
      { event_id: 'l', event_type: 'Lunch & Learn', status: 'no_show', member_or_guest: 'Guest' },
      { event_id: 'l', event_type: 'Lunch & Learn', status: 'cancelled', member_or_guest: 'Member' },
      { event_id: 'b', event_type: 'BOSS', status: 'attended', member_or_guest: 'Member' }
    ],
    changes: [{ date: '2026-06-30', audience: 'Member', event_type: 'Lunch & Learn', joins: 0, losses: 112 }]
  }, '2026-11-25');
  assert.deepEqual(Array.from(built.events, (event) => event.type), ['Lunch & Learn']);
  assert.equal(built.attendance.length, 1);
  assert.equal(built.attendance[0].count, 1);
  assert.equal(built.signups.length, 1);
  assert.equal(built.signups[0].eventId, 'l');
  assert.equal(built.signups[0].signups, 2);
  assert.equal(built.signups[0].noShows, 1);
  assert.equal(JSON.stringify(built.signups).includes('name'), false);
  assert.equal(built.example, false);
  assert.equal(JSON.stringify(built).toLowerCase().includes('email'), false);
  assert.equal(built.renewalRisk, null);
  assert.deepEqual(JSON.parse(JSON.stringify(built.businessTypes)), []);
  const types = gs.businessTypes_({
    roster: [
      { company: 'Cafe Example', status: 'Active' },
      { company: 'Two Hats', status: 'Active' },
      { company: 'Blank Co', status: 'Active' },
      { company: 'Missing Co', status: 'Active' },
      { company: 'Old Co', status: 'Deactivated' },
      { company: 'Cafe Example', status: 'Active' }
    ],
    members: [
      { company_name: 'Cafe Example', category: 'Restaurants' },
      { company_name: 'Two Hats', category: 'Marketing; Restaurants' },
      { company_name: 'Blank Co', category: '  ' },
      { company_name: 'Old Co', category: 'Insurance' }
    ]
  });
  assert.deepEqual(JSON.parse(JSON.stringify(types)), [
    { category: 'Restaurants', count: 2 },
    { category: 'Marketing', count: 1 },
    { category: 'Other / not listed', count: 2 }
  ]);
  assert.equal(JSON.stringify(types).includes('Cafe'), false);
  const attached = gs.dashboardAttachCategories_([
    { company: 'Cafe Example', status: 'Active', joinDate: '2024-01-01', lostDate: '' },
    { company: 'Blank Co', status: 'Active', joinDate: '2024-01-01', lostDate: '' }
  ], [
    { company_name: 'Cafe Example', category: 'Restaurants; Marketing' },
    { company_name: 'Blank Co', category: '' }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(attached[0].categories)), ['Restaurants', 'Marketing']);
  assert.deepEqual(JSON.parse(JSON.stringify(attached[1].categories)), []);
  assert.equal(JSON.stringify(attached).includes('@'), false);
  assert.equal(JSON.stringify(types).includes('Blank'), false);
  const risk = gs.renewalRisk_({
    attendanceRecords: [
      { event_type: 'Lunch & Learn', status: 'attended', email: 'new@example.com', date: '2026-10-08' },
      { event_type: 'Lunch & Learn', status: 'attended', email: 'old@example.com', date: '2025-11-01' }
    ],
    roster: [
      { company: 'New Co', email: 'new@example.com', status: 'Active', join_date: '2024-08-01' },
      { company: 'Old Co', email: 'old@example.com', status: 'Active', join_date: '2018-01-01' },
      { company: 'Mystery Co', status: 'Active' },
      { company: 'This Year Co', email: 'year@example.com', status: 'Active', join_date: '2026-08-01' },
      { company: 'Later Co', email: 'later@example.com', status: 'Active', join_date: '2026-11-26' },
      { company: 'Gone Co', email: 'gone@example.com', status: 'Deactivated', join_date: '2019-01-01', lost_date: '2026-06-30' }
    ]
  }, '2026-11-24');
  assert.equal(risk.cohort, 4);
  assert.equal(risk.zeroAttendance, 3);
  assert.equal(risk.byTenure.newer, 0);
  assert.equal(risk.byTenure.longer, 1);
  assert.equal(risk.byTenure.unknown, 1);
  assert.equal(risk.byTenure.thisYear, 1);
  assert.equal(risk.byTenure.newer + risk.byTenure.longer + risk.byTenure.unknown + risk.byTenure.thisYear, risk.zeroAttendance);
  assert.equal(risk.newerLabel, 'Joined 2022–2025');
  assert.equal(risk.longerLabel, 'Joined 2021 or earlier');
  assert.equal(risk.thisYearLabel, 'Joined this fiscal year');
  assert.equal(risk.lapseByBand[0].band, '0');
  assert.equal(risk.lapseByBand[0].lapsed, 1);
  assert.equal(JSON.stringify(risk).toLowerCase().includes('example.com'), false);
  const missing = gs.executiveDashboardAction_({ password: 'secret' }, { passwordHash: gs.ABA_SHA256('secret') });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /not configured/);
});

test('the same attendee is listed once and still matches every row', () => {
  const raw = [
    { name: 'Avery Sample', company: 'North Co', audience: 'Member', eventType: 'Lunch & Learn', event: 'Lunch', eventId: 'a', date: '2026-10-08', status: 'attended', email: 'avery@example.com' },
    { name: 'avery  sample', company: 'North Co', audience: 'Member', eventType: 'Happy Hour', event: 'Hour', eventId: 'b', date: '2026-11-01', status: 'attended', email: 'avery@example.com' },
    { name: 'AVERY SAMPLE', company: 'Ada River Cafe', audience: 'Guest', eventType: 'Ribbon Cutting', event: 'Cut', eventId: 'c', date: '2026-09-17', status: 'attended', email: 'Avery@Example.com' },
    { name: 'Blake Placeholder', company: 'North Co', audience: 'Guest', eventType: 'Lunch & Learn', event: 'Lunch', eventId: 'a', date: '2026-10-08', status: 'attended', email: 'blake@example.com' },
    { name: 'B. Placeholder', company: 'north  co', audience: 'Guest', eventType: 'Happy Hour', event: 'Hour', eventId: 'b', date: '2026-11-01', status: 'attended', email: 'Blake@Example.com' },
    { name: 'Casey Demo', company: 'north  co', audience: 'Member', eventType: 'Ribbon Cutting', event: 'Cut', eventId: 'c', date: '2026-09-17', status: 'attended', email: 'casey@example.com' }
  ];
  const before = {};
  raw.forEach((row) => {
    before[row.name.trim() + '|' + row.company] = true;
  });
  const live = sandbox.ABADirectory.fromLive({
    companies: ['North Co', 'north  co', 'Ada River Cafe'],
    roster: [
      { company: 'North Co', status: 'Active', joinDate: '2020-01-01' },
      { company: 'Ada River Cafe', status: 'Active', joinDate: '2020-01-01' }
    ],
    attendanceRecords: raw
  });
  assert.equal(Object.keys(before).length, 6);
  assert.equal(live.people.length, 3);
  assert.deepEqual(live.people.map((person) => person.name), ['Avery Sample', 'Blake Placeholder', 'Casey Demo']);
  assert.deepEqual(live.companies, ['Ada River Cafe', 'North Co']);
  assert.deepEqual(sandbox.ABADirectory.peopleForCompanies(live, ['Ada River Cafe']).map((person) => person.name), ['Avery Sample']);
  assert.deepEqual(sandbox.ABADirectory.peopleForCompanies(live, ['North Co']).map((person) => person.name), ['Avery Sample', 'Blake Placeholder', 'Casey Demo']);
  const picked = dash.compute(source, { year: 2027, period: 'year', people: ['Avery Sample'], companies: [], eventTypes: [], audience: '', bucket: '' }, live);
  assert.equal(picked.attendance.value, 3);
  assert.equal(picked.events.value, 3);
  assert.equal(sandbox.ABADirectory.drill(live, 'attendance', picked).rows.length, 3);
  const spelled = dash.compute(source, { year: 2027, period: 'year', people: ['Blake Placeholder'], companies: [], eventTypes: [], audience: '', bucket: '' }, live);
  assert.equal(spelled.attendance.value, 2);
  const company = dash.compute(source, { year: 2027, period: 'year', people: [], companies: ['North Co'], eventTypes: [], audience: '', bucket: '' }, live);
  assert.equal(company.attendance.value, 5);
  const shown = sandbox.ABADashboardView.render(Object.assign({}, picked, {
    personOptions: live.people,
    directory: { companies: live.companies },
    ui: { openMenu: 'person' },
    mobile: false,
    documents: { extras: [] }
  }));
  const options = new Set((shown.match(/data-person-option="([^"]+)"/g) || []).map((item) => item));
  assert.equal(options.size, 3);
  assert.match(shown, /data-person-option="Avery Sample"/);
  assert.equal(shown.includes('data-person-option="avery'), false);
});

test('the dashboard page is gated and the public sign-up does not link to it', () => {
  const page = fs.readFileSync(path.join(root, 'aba-site/js/dashboard-page.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'aba-site/dashboard/index.html'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'aba-site/index.html'), 'utf8');
  const signup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, 'aba-site/.github/workflows/pages.yml'), 'utf8');
  assert.match(page, /aba-board-portal-password/);
  assert.match(page, /index\.html\?next=dashboard/);
  assert.equal(page.includes('localStorage'), false);
  assert.match(html, /noindex, nofollow/);
  assert.match(html, /<title>Board &amp; Committee Portal<\/title>/);
  assert.match(home, /href="dashboard\/"/);
  assert.equal(signup.includes('dashboard.html'), false);
  assert.match(workflow, /dashboard\/index\.html/);
  assert.match(workflow, /dashboard-page\.js/);
  const hash = dash.stateHash({ year: 2025, period: 'quarter', eventType: 'Happy Hour', audience: 'Guest', from: '', to: '', bucket: '' });
  assert.equal(hash.includes('password'), false);
  const roundTrip = dash.stateFromHash(hash, source);
  assert.equal(roundTrip.year, 2025);
  assert.equal(roundTrip.period, 'quarter');
  assert.equal(roundTrip.audience, 'Guest');
  const rendered = sandbox.ABADashboardView.render(Object.assign(view(), { documents: { extras: [] }, mobile: false }));
  assert.match(rendered, /data-drill="members"/);
  assert.match(rendered, />Open</);
  assert.equal(/<a[^>]*data-drill/.test(rendered), false);
  assert.match(rendered, /Example data/);
  assert.match(rendered, />412</);
  assert.match(rendered, /Business Members/);
  assert.match(rendered, /Attendee Count/);
  assert.match(rendered, /Attendee Distribution/);
  assert.match(rendered, /Attendees/);
  assert.match(rendered, /FY start/);
  assert.equal(rendered.includes('>Members<'), false);
  assert.equal(rendered.includes('Attendance Distribution'), false);
  assert.equal(rendered.includes('data-run-toggle'), false);
  assert.equal(rendered.includes('Running total'), false);
  assert.equal(rendered.includes('data-segment-step'), false);
  assert.match(rendered, /Attendee/);
  assert.match(rendered, /All attendees/);
  assert.equal(rendered.includes('Search name'), false);
  assert.equal(rendered.includes('>Person<'), false);
  assert.match(rendered, /FY2027/);
  assert.match(rendered, /Jul 1, 2026 through Jun 30, 2027/);
  assert.match(rendered, /\+12/);
  assert.match(rendered, /Powered by Donny C\. Nguyen/);
  assert.match(rendered, /Board &amp; Committee Portal/);
  assert.equal(rendered.includes('ABA · Board'), false);
  assert.equal(rendered.includes('ABA Board'), false);
  assert.match(rendered, /class="mark" href="https:\/\/adabusinessassociation\.com\/" target="_blank" rel="noopener noreferrer" aria-label="Ada Business Association website"/);
  assert.match(rendered, /alt="Ada Business Association website"/);
  assert.equal((rendered.match(/aba-logo\.png/g) || []).length, 1);
  assert.equal(/<footer class="sig">[\s\S]*aba-logo/.test(rendered), false);
  assert.equal(rendered.includes('WIREFRAME'), false);
  assert.equal(rendered.includes('@'), false);
  const guests = sandbox.ABADashboardView.render(Object.assign(view({ audience: 'Guest' }), { mobile: true }));
  assert.match(guests, /big-members/);
  assert.doesNotMatch(guests, />412</);
});
