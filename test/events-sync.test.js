const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadAba } = require('./load-aba');

const aba = loadAba();
const TODAY = '2026-11-24';

const SAMPLE = [
  '2026 ABA Event Listing',
  'January',
  '14 - ABA Happy Hour - Schnitz, 4:30 - 6:30pm',
  '15 – ABA Member Lunch & Learn – Amway, 11:30am – 1pm',
  '21 – Harmonic Egg & Wellness Ribbon Cutting, 4:00pm',
  'February',
  '10– ABA Happy Hour',
  '16 - Love’s Grand Opening',
  'September',
  '1 - Multi-Chamber Happy Hour, BattleGR, 5-7pm',
  '6 - Simply the Best Open House/Ribbon Cutting, 5:30pm',
  '29 - Grown Hydroponics Farm Ribbon Cutting, 11am',
  '29 - Mitten Pediatrics Ribbon Cutting, 5pm',
  'November',
  '17 - Riverside Links Ribbon Cutting, 4:30pm',
  '24 - Lunch and Learn (test) - Test Location, 1PM - 5PM.',
  'December',
  '9 - ABA Happy Hour - Ada Hotel, 4:30-6:30pm',
  '15 - Ada Books Ribbon Cutting, 4:00pm',
  '16 - First Shop Ribbon Cutting, 4:00pm',
  '16 - Second Shop Ribbon Cutting, 5:00pm',
  '20 – ABA Member Lunch & Learn – Amway, 11:30am – 1pm'
].join('\n');

test('the sheet is optional and the original eleven events stay the fallback', () => {
  assert.equal(aba.abaEvents_().length, 11);
  assert.equal(aba.abaEvents_()[2].date, '2026-12-09');
  assert.equal(aba.abaEvents_()[2].type, 'Happy Hour');
});

test('the listing adds only a new future event and leaves Dec 9 alone', () => {
  const existing = aba.abaFallbackEvents_();
  const plan = aba.planEventSync_(SAMPLE, existing, TODAY);
  assert.equal(plan.added, 3);
  const books = plan.addedEvents.find((event) => event.date === '2026-12-15');
  assert.equal(books.type, 'Ribbon Cutting');
  assert.equal(books.location, 'Ribbon Cutting, Ada Books');
  assert.equal(books.start, '4:00 PM');
  assert.equal(plan.existing >= 1, true);
  assert.equal(plan.past > 0, true);
  assert.equal(plan.skipped.out >= 2, true);
  assert.equal(plan.skipped.ambiguous >= 2, true);
  assert.equal(plan.skipped.collision, 1);
  assert.equal(plan.warnings.some((line) => /Lunch & Learn/.test(line)), true);
  const summary = aba.eventSyncSummary_(plan, true);
  assert.match(summary, /syncEventsFromDoc dry run: added 3, existing \d+, past \d+, skipped \d+ \(out of scope: \d+, ambiguous: \d+, collision: 1\)/);
  const onlyKnown = [
    '2026 ABA Event Listing',
    'November',
    '24 - Lunch and Learn (test) - Test Location, 1PM - 5PM.',
    'December',
    '9 - ABA Happy Hour - Ada Hotel, 4:30-6:30pm'
  ].join('\n');
  const today = aba.planEventSync_(onlyKnown, existing, TODAY);
  assert.equal(today.added, 0);
  assert.match(aba.eventSyncSummary_(today, true), /added 0/);
});

test('a dry run does not write events or send mail', () => {
  const writes = [];
  const mail = [];
  const summary = aba.syncEventsFromDoc(true, {
    text: SAMPLE,
    today: TODAY,
    existing: aba.abaFallbackEvents_(),
    log: function () {},
    write: function (event) { writes.push(event); },
    mail: function (body) { mail.push(body); }
  });
  assert.match(summary, /Nothing was written/);
  assert.equal(writes.length, 0);
  assert.equal(mail.length, 0);
  const source = fs.readFileSync(path.join(__dirname, '../apps-script/Events.gs'), 'utf8');
  assert.match(source, /function syncEventsFromDocDryRun\(\)/);
  assert.match(source, /function seedEventsTab\(\)/);
  assert.match(source, /atHour\(0\)/);
  assert.match(source, /syncEventsFromDoc/);
  assert.equal(source.includes("getHandlerFunction() !== 'sendReminders'"), false);
});
