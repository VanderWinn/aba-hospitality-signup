const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');

function loadPortal() {
  const context = { Intl, Date, JSON, Math, Number, String, Object, Array };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/portal.js'), 'utf8'), context, { filename: 'portal.js' });
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
  const config = JSON.parse(fs.readFileSync(path.join(root, 'home/portal.json'), 'utf8'));
  assert.equal(config.passwordSha256, '7b85d87fd6d1af2728dee2eafc499539311143474fe851018ebe0e2fca999df6');
  const signup = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(signup.includes('Board & Committee'), false);
  assert.equal(signup.includes('home/'), false);
  assert.equal(signup.includes('noindex'), false);
  const home = fs.readFileSync(path.join(root, 'home/index.html'), 'utf8');
  assert.match(home, /noindex, nofollow/);
  assert.match(home, /ABA Board &amp; Committee Portal/);
  assert.match(home, /href="\.\.\/"/);
  const docs = JSON.parse(fs.readFileSync(path.join(root, 'home/docs.json'), 'utf8'));
  assert.equal(docs.documents[0].url, 'https://drive.google.com/drive/folders/1exeZ76nncawAQ15Jk9NjEa7jyDqro7mG');
  assert.match(docs.documents[1].url, /docs\.google\.com\/document\/d\/1QFfdzr5dWCLLq0zIy-Kj3Yc7ifw8T_-xWA6tH0ho5ec/);
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /home\/index\.html/);
  assert.match(workflow, /home\/docs\.json/);
  const page = fs.readFileSync(path.join(root, 'js/portal-page.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/portal.css'), 'utf8');
  const bundle = home + page + css;
  assert.equal(/\blands?\b|\blanded\b|\blanding\b/i.test(bundle), false);
});
