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
  ['js/dashboard-model.js', 'js/dashboard-data.js', 'js/dashboard-view.js'].forEach(function (file) {
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

test('the default year matches the concept 2b example figures', () => {
  const home = view();
  assert.equal(source.example, true);
  assert.equal(source.asOf, '2026-11-24');
  assert.equal(home.range.start, '2026-01-01');
  assert.equal(home.range.end, '2026-11-24');
  assert.equal(home.granularity, 'month');
  assert.deepEqual(Array.from(home.buckets, (bucket) => bucket.label), ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N']);
  assert.equal(home.members.value, 412);
  assert.equal(home.members.lastMonth, 409);
  assert.equal(home.members.lastQuarter, 404);
  assert.equal(home.members.lastYear, 385);
  assert.equal(home.members.tone, 'up');
  assert.equal(home.members.color, '#0077FF');
  assert.equal(home.newMembers.value, 50);
  assert.equal(home.newMembers.lastMonth, 45);
  assert.equal(home.newMembers.lastQuarter, 39);
  assert.equal(home.newMembers.lastYear, 40);
  assert.equal(home.net.value, 18);
  assert.equal(home.net.lastMonth, 16);
  assert.equal(home.net.lastQuarter, 12);
  assert.equal(home.net.lastYear, 11);
  assert.deepEqual(Array.from(home.gains, (bucket) => bucket.joins), [4, 2, 5, 3, 3, 6, 5, 3, 5, 8, 6]);
  assert.deepEqual(Array.from(home.gains, (bucket) => bucket.losses), [3, 1, 2, 6, 2, 3, 2, 5, 2, 3, 3]);
  assert.equal(home.events.value, 13);
  assert.equal(home.events.lastMonth, 12);
  assert.equal(home.events.lastQuarter, 11);
  assert.equal(home.events.lastYear, 11);
  assert.deepEqual(Array.from(home.eventSeries), [1, 1, 0, 1, 1, 1, 2, 1, 1, 2, 2]);
  assert.deepEqual(Array.from(home.eventLastYear), [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(home.attendance.value, 462);
  assert.equal(home.attendance.lastMonth, 450);
  assert.equal(home.attendance.lastQuarter, 448);
  assert.equal(home.attendance.lastYear, 415);
  assert.deepEqual(Array.from(home.attendanceSeries), [35, 32, 0, 38, 34, 36, 72, 33, 37, 75, 70]);
  assert.deepEqual(Array.from(home.attendanceLastYear), [38, 36, 35, 40, 37, 39, 42, 36, 38, 41, 33]);
  assert.equal(home.pie.members, 286);
  assert.equal(home.pie.guests, 176);
  assert.equal(home.pie.memberPct, 62);
  assert.equal(home.pie.guestPct, 38);
  assert.equal(home.eventCounts.all, 13);
  assert.equal(home.eventCounts['Lunch & Learn'], 5);
  assert.equal(home.eventCounts['Ribbon Cutting'], 3);
  assert.equal(home.eventCounts['Happy Hour'], 5);
  const span = dash.inclusiveDays(home.range.start, home.range.end);
  const lastMonth = dash.shiftRange(home.range.start, home.range.end, 1);
  const lastQuarter = dash.shiftRange(home.range.start, home.range.end, 3);
  const lastYear = dash.shiftRange(home.range.start, home.range.end, 12);
  assert.equal(lastMonth.start, '2025-12-01');
  assert.equal(lastMonth.end, '2026-10-24');
  assert.equal(dash.inclusiveDays(lastMonth.start, lastMonth.end), span);
  assert.equal(lastQuarter.start, '2025-10-01');
  assert.equal(lastQuarter.end, '2026-08-24');
  assert.equal(dash.inclusiveDays(lastQuarter.start, lastQuarter.end), span);
  assert.equal(lastYear.start, '2025-01-01');
  assert.equal(lastYear.end, '2025-11-24');
  assert.equal(dash.inclusiveDays(lastYear.start, lastYear.end), span);
});

test('quarter, month, a past year, and the trailing 12 months follow the period rules', () => {
  const quarter = view({ period: 'quarter' });
  assert.equal(quarter.range.start, '2026-10-01');
  assert.equal(quarter.range.end, '2026-11-24');
  assert.equal(quarter.granularity, 'week');
  assert.equal(quarter.events.value, 4);
  assert.equal(quarter.buckets.length > 4, true);
  const month = view({ period: 'month' });
  assert.equal(month.range.start, '2026-11-01');
  assert.equal(month.range.end, '2026-11-24');
  assert.equal(month.granularity, 'day');
  assert.equal(month.buckets.length, 24);
  assert.equal(month.events.value, 2);
  const past = view({ year: 2025, period: 'year' });
  assert.equal(past.range.start, '2025-01-01');
  assert.equal(past.range.end, '2025-12-31');
  assert.equal(past.buckets.length, 12);
  assert.equal(past.events.value > 0, true);
  const pastQuarter = view({ year: 2025, period: 'quarter' });
  assert.equal(pastQuarter.range.start, '2025-10-01');
  assert.equal(pastQuarter.range.end, '2025-12-31');
  const pastMonth = view({ year: 2025, period: 'month' });
  assert.equal(pastMonth.range.start, '2025-11-01');
  assert.equal(pastMonth.range.end, '2025-11-30');
  const trailing = view({ year: 2024, period: 'last12' });
  assert.equal(trailing.yearEnabled, false);
  assert.equal(trailing.range.start, '2025-12-01');
  assert.equal(trailing.range.end, '2026-11-24');
  assert.equal(trailing.granularity, 'month');
  assert.equal(trailing.buckets.length, 12);
});

test('the pie, event type, and bar filters recalculate the page', () => {
  const guests = view({ audience: 'Guest' });
  assert.equal(guests.attendance.value, 176);
  assert.equal(guests.events.value, 12);
  assert.notEqual(guests.members.value, 412);
  assert.notEqual(guests.newMembers.value, 50);
  const members = view({ audience: 'Member' });
  assert.equal(members.attendance.value, 286);
  assert.equal(members.members.value, 412);
  assert.equal(members.events.value, 13);
  const lunch = view({ eventType: 'Lunch & Learn' });
  assert.equal(lunch.events.value, 5);
  assert.ok(lunch.members.value < 412);
  const home = view();
  const january = view({ bucket: home.buckets[0].id });
  assert.equal(january.events.value, 1);
  assert.equal(january.newMembers.value, 4);
  assert.equal(january.bucket, home.buckets[0].id);
  const cleared = dash.applyAction(source, { audience: 'Guest', eventType: 'Happy Hour', bucket: 'x', year: 2025, period: 'month' }, { type: 'reset' });
  assert.equal(cleared.period, 'year');
  assert.equal(cleared.year, 2026);
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
});

test('the dashboard page is gated and the public sign-up does not link to it', () => {
  const page = fs.readFileSync(path.join(root, 'js/dashboard-page.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'home/dashboard.html'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'home/index.html'), 'utf8');
  const signup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(page, /aba-board-portal-password/);
  assert.match(page, /index\.html\?next=dashboard/);
  assert.equal(page.includes('localStorage'), false);
  assert.match(html, /noindex, nofollow/);
  assert.match(home, /href="dashboard\.html"/);
  assert.equal(signup.includes('dashboard.html'), false);
  assert.match(workflow, /home\/dashboard\.html/);
  assert.match(workflow, /dashboard-page\.js/);
  const hash = dash.stateHash({ year: 2025, period: 'quarter', eventType: 'Happy Hour', audience: 'Guest', from: '', to: '', bucket: '' });
  assert.equal(hash.includes('password'), false);
  const roundTrip = dash.stateFromHash(hash, source);
  assert.equal(roundTrip.year, 2025);
  assert.equal(roundTrip.period, 'quarter');
  assert.equal(roundTrip.audience, 'Guest');
  const rendered = sandbox.ABADashboardView.render(Object.assign(view(), { documents: { extras: [] }, mobile: false }));
  assert.match(rendered, /Example data/);
  assert.match(rendered, />412</);
  assert.match(rendered, /\+18/);
  assert.match(rendered, /Powered by Donny C\. Nguyen/);
  assert.match(rendered, /aba-logo\.png/);
  assert.equal(rendered.includes('WIREFRAME'), false);
  assert.equal(rendered.includes('@'), false);
  const guests = sandbox.ABADashboardView.render(Object.assign(view({ audience: 'Guest' }), { mobile: true }));
  assert.match(guests, /big-members/);
  assert.doesNotMatch(guests, />412</);
});
