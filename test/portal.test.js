const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');

function loadPortal() {
  const context = { Intl, Date, JSON, Math, Number, String, Object, Array, encodeURIComponent, decodeURIComponent };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'aba-site/js/portal.js'), 'utf8'), context, { filename: 'portal.js' });
  return context.ABAPortal;
}

const portal = loadPortal();
const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8'));

test('the catalog becomes calendar events with venue, time, and category', () => {
  const events = portal.eventsFromCatalog(seed);
  const dec9 = events.find((event) => event.date === '2026-12-09');
  assert.equal(dec9.name, 'Happy Hour');
  assert.equal(dec9.time, '4:30 PM');
  assert.match(dec9.venue, /^Ada Hotel/);
  const upcoming = portal.upcomingEvents(events, '2026-11-24');
  assert.equal(upcoming.some((event) => event.date < '2026-11-24'), false);
  assert.equal(upcoming.some((event) => event.date === '2026-12-09'), true);
  const cells = portal.monthCells(2026, 12, events);
  const day = cells.find((cell) => cell && cell.iso === '2026-12-09');
  assert.equal(day.events.length, 1);
  assert.equal(day.events[0].name, 'Happy Hour');
  assert.equal(cells.length % 7, 0);
});

test('the portal password is a hash and the sign-up page does not link to it', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'aba-site/portal.json'), 'utf8'));
  assert.equal(config.passwordSha256, '7b85d87fd6d1af2728dee2eafc499539311143474fe851018ebe0e2fca999df6');
  const signup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(signup.includes('Board & Committee'), false);
  assert.equal(signup.includes('home/'), false);
  assert.equal(signup.includes('noindex'), false);
  const home = fs.readFileSync(path.join(root, 'aba-site/index.html'), 'utf8');
  assert.match(home, /noindex, nofollow/);
  assert.match(home, /ABA Board &amp; Committee Portal/);
  assert.match(home, /href="dashboard\/"/);
  assert.match(home, /https:\/\/vanderwinn\.github\.io\/aba-hospitality-signup\//);
  const docs = JSON.parse(fs.readFileSync(path.join(root, 'aba-site/docs.json'), 'utf8'));
  assert.equal(docs.documents[0].url, 'https://drive.google.com/drive/folders/1exeZ76nncawAQ15Jk9NjEa7jyDqro7mG');
  assert.match(docs.documents[1].url, /docs\.google\.com\/document\/d\/1QFfdzr5dWCLLq0zIy-Kj3Yc7ifw8T_-xWA6tH0ho5ec/);
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /home\/index\.html/);
  assert.match(workflow, /home\/dashboard\.html/);
  assert.equal(workflow.includes('aba-site'), false);
  const forward = fs.readFileSync(path.join(root, 'home/index.html'), 'utf8');
  const forwardDash = fs.readFileSync(path.join(root, 'home/dashboard.html'), 'utf8');
  assert.match(forward, /https:\/\/vanderwinn\.github\.io\/aba\//);
  assert.match(forwardDash, /https:\/\/vanderwinn\.github\.io\/aba\/dashboard\//);
  const page = fs.readFileSync(path.join(root, 'aba-site/js/portal-page.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'aba-site/css/portal.css'), 'utf8');
  const logic = fs.readFileSync(path.join(root, 'aba-site/js/portal.js'), 'utf8');
  const bundle = home + page + css + logic;
  assert.equal(/\blands?\b|\blanded\b|\blanding\b/i.test(bundle), false);
  assert.match(home, /id="portal-dashboard-body"/);
  assert.match(page, /sessionStorage/);
  assert.equal(page.includes('localStorage'), false);
  assert.match(page, /action: 'dashboard'/);
  const model = {
    note: 'Example note',
    participation: {
      quarter: { label: 'Q4 2026', volunteers: 2, shifts: 3, people: [] },
      year: { label: '2026', volunteers: 2, shifts: 4, people: [] }
    },
    capacity: {
      filled: 1,
      seats: 2,
      openRoles: 1,
      events: [{
        date: '2026-12-09',
        time: '4:30 PM',
        name: 'Happy Hour',
        venue: 'Ada Hotel',
        roles: [{ task: 'Set-Up', filled: 1, capacity: 2, open: true, names: ['Example Volunteer A'] }]
      }]
    },
    chart: {
      months: [
        { key: '2026-10', label: 'October', short: 'Oct', shifts: 1 },
        { key: '2026-11', label: 'November', short: 'Nov', shifts: 3 }
      ],
      people: [
        { id: 'p1', name: 'Example Volunteer A', total: 3, counts: { '2026-10': 0, '2026-11': 3 }, events: [{ date: '2026-11-19', month: '2026-11', name: 'Lunch & Learn', task: 'Door Greeter', venue: 'Amway' }] },
        { id: 'p2', name: 'Example Volunteer B', total: 1, counts: { '2026-10': 1, '2026-11': 0 }, events: [{ date: '2026-10-14', month: '2026-10', name: 'Happy Hour', task: 'Set-Up', venue: 'Ada Hotel' }] }
      ]
    }
  };
  model.asOf = '2026-11-24';
  model.chart.opportunities = 4;
  model.participation.previousQuarter = { label: 'Q3 2026', volunteers: 0, shifts: 0 };
  const html = portal.renderDashboard(model);
  assert.match(html, /Shifts filled/);
  assert.match(html, /Events covered/);
  assert.match(html, /Top volunteer/);
  assert.match(html, /Last 12 months/);
  assert.match(html, /Reset/);
  assert.match(html, /data-range-date="from"/);
  assert.match(html, /Dec ’25/);
  assert.match(html, /Nov ’26/);
  assert.match(html, /Shifts by month/);
  assert.match(html, /Total/);
  assert.match(html, /Top volunteers/);
  assert.match(html, /Events that need people/);
  assert.match(html, /data-person="p1"/);
  assert.match(html, /No upcoming events in this period/);
  assert.match(html, /This quarter vs last quarter/);
  assert.match(html, /compare-bar is-focus/);
  assert.match(html, /compare-value">3</);
  assert.match(html, /compare-value">0</);
  const october = portal.renderDashboard(model, null, { range: 'custom', from: '2026-10-01', to: '2026-10-31' });
  assert.match(october, /This period vs the one before/);
  assert.match(october, /compare-value">1</);
  assert.match(html, /Example data/);
  assert.match(html, /Coming soon/);
  assert.match(html, /This year/);
  assert.equal(html.includes('Group by'), false);
  assert.equal(html.includes('data-crumb'), false);
  assert.equal(html.includes('data-source='), false);
  const yearView = portal.renderDashboard(model, null, { range: 'year' });
  assert.match(yearView, /data-event="2026-12-09\|Happy Hour"/);
  assert.match(yearView, /1 of 2/);
  const happy = portal.renderDashboard(model, null, { range: 'year', category: 'Happy Hour' });
  assert.match(happy, /Example Volunteer B/);
  assert.equal(happy.includes('Door Greeter'), false);
  const person = portal.renderDashboard(model, null, { range: 'last12', category: '', detail: { kind: 'person', id: 'p1' } });
  assert.match(person, />Back</);
  assert.match(person, /Example Volunteer A/);
  assert.match(person, /Door Greeter/);
  assert.match(person, /Nov 19/);
  const eventDetail = portal.renderDashboard(model, null, { range: 'year', category: '', detail: { kind: 'event', id: '2026-12-09|Happy Hour' } });
  assert.match(eventDetail, />Back</);
  assert.match(eventDetail, /Set-Up/);
  assert.match(eventDetail, /1 open/);
  const failed = portal.renderDashboard(null, { error: 'The dashboard could not be loaded.' });
  assert.match(failed, /Try again/);
  assert.match(failed, /could not be loaded/);
  const hash = portal.dashboardHash({ range: 'custom', from: '2026-10-31', to: '2026-10-01', category: 'Happy Hour', detail: { kind: 'person', id: 'p1' } });
  const back = portal.dashboardStateFromHash(hash);
  assert.equal(back.range, 'custom');
  assert.equal(back.from, '2026-10-01');
  assert.equal(back.to, '2026-10-31');
  assert.equal(back.category, 'Happy Hour');
  assert.equal(back.detail.kind, 'person');
  assert.equal(back.detail.id, 'p1');
  assert.equal(portal.dashboardStateFromHash('').range, 'last12');
  assert.equal(portal.dashboardStateFromHash('period=quarter').range, 'quarter');
  assert.equal(hash.includes('password'), false);
  assert.equal((html + happy + person + eventDetail).includes('@'), false);
  assert.match(page, /aba-board-portal-view/);
  assert.match(page, /data-retry/);
  assert.equal(/\brose in November\b|\bhalf of all shifts\b|\blands?\b|\blanded\b|\blanding\b/.test(html + person), false);
});
