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
  assert.equal(plan.added, 4);
  const books = plan.addedEvents.find((event) => event.date === '2026-12-15');
  assert.equal(books.type, 'Ribbon Cutting');
  assert.equal(books.location, 'Ribbon Cutting, Ada Books');
  assert.equal(books.start, '4:00 PM');
  assert.equal(plan.unchanged >= 1, true);
  assert.equal(plan.changed, 0);
  assert.equal(plan.removed, 0);
  assert.equal(plan.past > 0, true);
  assert.equal(plan.skipped.out >= 2, true);
  assert.equal(plan.skipped.ambiguous >= 2, true);
  assert.equal(plan.skipped.collision, 1);
  assert.equal(plan.warnings.some((line) => /Lunch & Learn/.test(line)), true);
  const summary = aba.eventSyncSummary_(plan, true);
  assert.match(summary, /syncEventsFromDoc dry run: added 4, changed 0, removed 0, unchanged \d+, past \d+, skipped \d+ \(out of scope: \d+, ambiguous: \d+, collision: 1\)/);
  const onlyKnown = [
    '2026 ABA Event Listing',
    'November',
    '24 - Lunch and Learn (test) - Test Location, 1PM - 5PM.',
    'December',
    '9 - ABA Happy Hour - Ada Hotel, 4:30-6:30pm'
  ].join('\n');
  const today = aba.planEventSync_(onlyKnown, existing, TODAY);
  assert.equal(today.added, 1);
  assert.equal(today.addedEvents[0].type, 'Lunch & Learn');
  assert.equal(today.addedEvents[0].date, '2026-11-24');
  assert.equal(today.addedEvents[0].start, '1:00 PM');
  assert.equal(today.addedEvents[0].end, '5:00 PM');
  assert.equal(today.addedEvents[0].location, 'Lunch & Learn, Test Location');
  assert.match(aba.eventSyncSummary_(today, true), /added 1, changed 0, removed 0/);
  assert.equal(today.unchanged >= 1, true);
  const slots = aba.expandEventSlots_(today.addedEvents[0]);
  function role(name) { return slots.find((item) => item.task === name); }
  assert.equal(role('Drink Delivery').roleDate, '2026-11-23');
  assert.equal(role('Drink Delivery').roleStart, '2:00 PM');
  assert.equal(role('Drink Delivery').roleEnd, '3:00 PM');
  assert.equal(role('Set-Up').roleStart, '12:30 PM');
  assert.equal(role('Set-Up').roleEnd, '12:55 PM');
  assert.equal(role('Door Greeter').roleStart, '12:45 PM');
  assert.equal(role('Sign-In Table').roleStart, '12:30 PM');
  assert.equal(role('Food Table Host').roleEnd, '2:45 PM');
  assert.equal(role('Clean-Up').roleStart, '5:00 PM');
  assert.equal(role('Clean-Up').roleEnd, '5:20 PM');
  const usual = aba.expandEventSlots_(existing.find((event) => event.date === '2026-12-09' && event.type === 'Happy Hour'));
  assert.equal(usual.find((item) => item.task === 'Networking Ambassador').roleStart, '4:30 PM');
  assert.equal(usual.find((item) => item.task === 'Clean-Up').roleStart, '6:30 PM');
  assert.equal(usual.find((item) => item.task === 'Set-Up').roleStart, '4:00 PM');
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
  assert.match(source, /setContentType\('application\/zip'\)/);
  assert.match(source, /sendUpdates: 'all'/);
  assert.match(source, /cancelled-by-event-removal/);
  assert.match(source, /function approvePendingEventChanges\(\)/);
  assert.match(source, /function rejectPendingEventChanges\(\)/);
  assert.match(source, /function setEventSyncModeAuto\(\)/);
  assert.match(source, /function setEventSyncModeApprove\(\)/);
  assert.equal(source.includes('deleteSignupById_'), false);
  assert.equal(source.includes("getHandlerFunction() !== 'sendReminders'"), false);
});

test('the word file is unzipped as a zip', () => {
  const types = [];
  const blob = {
    copyBlob() { return this; },
    setContentType(type) { types.push(type); return this; }
  };
  aba.docxBlobForUnzip_(blob);
  assert.deepEqual(types, ['application/zip']);
});

test('a venue name match keeps the stored street address', () => {
  const existing = [{
    type: 'Happy Hour',
    date: '2026-12-09',
    start: '4:30 PM',
    end: '6:30 PM',
    location: 'Happy Hour, Ada Hotel, 7415 River St SE, Ada',
    rowNumber: 4
  }, {
    type: 'Happy Hour',
    date: '2027-01-13',
    start: '4:30 PM',
    end: '6:30 PM',
    location: 'Happy Hour, The Wellness Club',
    rowNumber: 5
  }, {
    type: 'Happy Hour',
    date: '2026-12-01',
    start: '4:30 PM',
    end: '6:30 PM',
    location: 'Happy Hour, Schnitz',
    rowNumber: 6
  }, {
    type: 'Ribbon Cutting',
    date: '2026-11-17',
    start: '4:30 PM',
    location: 'Ribbon Cutting, Riverside Links',
    rowNumber: 2
  }];
  const text = [
    '2026 ABA Event Listing',
    'December',
    '9 - ABA Happy Hour - Ada Hotel, 4:30-6:30pm'
  ].join('\n');
  const plan = aba.planEventSync_(text, existing, TODAY);
  assert.equal(plan.unchanged, 1);
  assert.equal(plan.removed, 1);
  assert.equal(plan.removedEvents[0].date, '2026-12-01');
  assert.equal(plan.changed, 0);
  assert.equal(plan.added, 0);
  assert.equal(plan.removedEvents.some((event) => event.date.startsWith('2027')), false);
});

test('a time or venue change is a change and a missing future event is a removal', () => {
  const existing = [{
    rowNumber: 8,
    type: 'Lunch & Learn',
    date: '2026-12-20',
    start: '11:30 AM',
    end: '1:00 PM',
    location: 'Lunch & Learn, Old Hall, 1 Main St'
  }];
  const text = [
    '2026',
    'December',
    '20 – ABA Member Lunch & Learn – Amway, 12:00pm – 2pm'
  ].join('\n');
  const plan = aba.planEventSync_(text, existing, TODAY);
  assert.equal(plan.changed, 1);
  assert.equal(plan.changedEvents[0].after.location, 'Lunch & Learn, Amway');
  assert.equal(plan.changedEvents[0].after.start, '12:00 PM');
  assert.equal(plan.removed, 0);
});

test('an empty listing changes nothing', () => {
  const writes = [];
  const mail = [];
  const summary = aba.syncEventsFromDoc(false, {
    text: '2026\nJanuary\nno events here',
    today: TODAY,
    existing: [{ type: 'Happy Hour', date: '2026-12-09', start: '4:30 PM', end: '6:30 PM', location: 'Happy Hour, Ada Hotel' }],
    log() {},
    write(event) { writes.push(event); },
    mail(body) { mail.push(body); },
    savePending() { throw new Error('should not store a plan'); }
  });
  assert.match(summary, /Nothing was changed/);
  assert.equal(writes.length, 0);
  assert.equal(mail.length, 1);
  const dry = [];
  aba.syncEventsFromDoc(true, {
    text: '',
    today: TODAY,
    existing: [],
    log() {},
    mail(body) { dry.push(body); }
  });
  assert.equal(dry.length, 0);
});

function reviewDeps(extra) {
  const box = { value: null };
  const writes = [];
  const updates = [];
  const removes = [];
  const changes = [];
  const removals = [];
  const mail = [];
  const reviews = [];
  const deps = Object.assign({
    text: '',
    today: TODAY,
    existing: [],
    signups: [],
    docHash: 'hash-1',
    modifiedTime: '2026-11-24T12:00:00.000Z',
    webAppUrl: 'https://script.google.com/macros/s/abc/exec',
    mode: 'approve',
    log() {},
    write(event) { writes.push(event); },
    update(before, event) { updates.push({ before, event }); },
    remove(event) { removes.push(event); },
    notifyChange(person) { changes.push(person); },
    notifyRemoval(person) { removals.push(person); },
    mail(body) { mail.push(body); },
    mailReview(message) { reviews.push(message); },
    savePending(plan) { box.value = JSON.parse(JSON.stringify(plan)); },
    loadPending() { return box.value ? JSON.parse(JSON.stringify(box.value)) : null; },
    clearPending() { box.value = null; },
    newToken() { return 'a'.repeat(48); },
    newId() { return 'plan1'; }
  }, extra || {});
  return { deps, box, writes, updates, removes, changes, removals, mail, reviews };
}

test('approve mode stores a review and does not write or notify', () => {
  const text = ['2026', 'December', '15 - Ada Books Ribbon Cutting, 4:00pm'].join('\n');
  const harness = reviewDeps({
    text,
    signups: [{
      name: 'Ada Volunteer',
      email: 'ada@example.com',
      date: '2026-12-01',
      event: 'Happy Hour',
      task: 'Door Greeter',
      status: 'active',
      token: 'b'.repeat(40),
      signupId: 's1',
      rowNumber: 3
    }],
    existing: [{
      rowNumber: 3,
      type: 'Happy Hour',
      date: '2026-12-01',
      start: '4:30 PM',
      end: '6:30 PM',
      location: 'Happy Hour, Schnitz'
    }]
  });
  const summary = aba.syncEventsFromDoc(false, harness.deps);
  assert.match(summary, /Stored for review/);
  assert.match(summary, /Nothing was written/);
  assert.equal(harness.writes.length, 0);
  assert.equal(harness.updates.length, 0);
  assert.equal(harness.removes.length, 0);
  assert.equal(harness.changes.length, 0);
  assert.equal(harness.removals.length, 0);
  assert.equal(harness.mail.length, 0);
  assert.equal(harness.reviews.length, 1);
  assert.equal(harness.reviews[0].to, 'donny@vanderwinn.com');
  assert.match(harness.reviews[0].html, /Approve all changes/);
  assert.match(harness.reviews[0].html, /Reject/);
  assert.match(harness.reviews[0].html, /eventSync=approve/);
  assert.match(harness.reviews[0].html, /eventSync=reject/);
  assert.match(harness.reviews[0].text, /Ada Volunteer/);
  assert.equal(harness.box.value.id, 'plan1');
  assert.equal(harness.box.value.hash, 'hash-1');
  const page = aba.eventSyncGet_({ eventSync: 'approve', token: 'a'.repeat(48) }, harness.box.value);
  assert.match(page, /id="event-sync-go"/);
  assert.match(page, /action="https:\/\/script\.google\.com\/macros\/s\/abc\/exec"/);
  assert.match(page, /Opening this page does not apply them/);
  assert.equal(/<script/i.test(page), false);
  assert.equal(page.includes('finishEventSyncReview_'), false);
  const expired = aba.eventSyncGet_({ eventSync: 'approve', token: 'c'.repeat(48) }, harness.box.value);
  assert.match(expired, /no longer valid/);
});

test('approving applies the stored plan and a changed document is refused', () => {
  const text = ['2026', 'December', '20 – ABA Member Lunch & Learn – Amway, 12:00pm – 2pm'].join('\n');
  const person = {
    name: 'Bea Volunteer',
    email: 'bea@example.com',
    date: '2026-12-20',
    event: 'Lunch & Learn',
    task: 'Door Greeter',
    status: 'active',
    token: 'd'.repeat(40),
    signupId: 's2',
    rowNumber: 6
  };
  const harness = reviewDeps({
    text,
    signups: [
      person,
      Object.assign({}, person, { name: 'Cara', email: 'cara@example.com', signupId: 's3', task: 'Door Greeter' }),
      { name: 'Old', email: 'old@example.com', date: '2026-12-20', event: 'Lunch & Learn', task: 'Mixer Host', status: 'active', token: 'e'.repeat(40), signupId: 's4', rowNumber: 7 },
      { name: 'Already', email: 'gone@example.com', date: '2026-12-20', event: 'Lunch & Learn', task: 'Set-Up', status: 'cancelled-by-event-removal', token: 'f'.repeat(40), signupId: 's5', rowNumber: 8 }
    ],
    existing: [{
      rowNumber: 9,
      type: 'Lunch & Learn',
      date: '2026-12-20',
      start: '11:30 AM',
      end: '1:00 PM',
      location: 'Lunch & Learn, Old Hall'
    }]
  });
  aba.syncEventsFromDoc(false, harness.deps);
  assert.equal(harness.changes.length, 0);
  const stale = aba.finishEventSyncReview_('approve', 'a'.repeat(48), {
    deps: Object.assign({}, harness.deps, { docHash: 'hash-2' })
  });
  assert.match(stale.message, /listing changed since this review/);
  assert.equal(harness.updates.length, 0);
  assert.equal(harness.box.value.id, 'plan1');
  const applied = aba.finishEventSyncReview_('approve', 'a'.repeat(48), { deps: harness.deps });
  assert.equal(applied.ok, true);
  assert.equal(harness.updates.length, 1);
  assert.equal(harness.updates[0].event.location, 'Lunch & Learn, Amway');
  assert.equal(harness.changes.length, 3);
  assert.equal(harness.removals.length, 0);
  assert.equal(harness.box.value, null);
  assert.equal(harness.mail.length, 1);
  assert.match(harness.mail[0], /flag:/);
  assert.match(harness.mail[0], /Mixer Host/);
  assert.match(harness.mail[0], /room for 1/);
  const notice = aba.buildScheduleNotice_(person, {
    kind: 'changed',
    eventName: 'Lunch & Learn',
    oldWhen: 'Sunday, December 20, 2026, 11:30 AM at Lunch & Learn, Old Hall',
    newWhen: 'Sunday, December 20, 2026, 12:00 PM–2:00 PM at Lunch & Learn, Amway',
    roleTime: '12:15–12:35 PM Eastern'
  });
  assert.match(notice.subject, /Event changed/);
  assert.match(notice.html, /Keep my spot/);
  assert.match(notice.html, /Change my spot/);
  assert.match(notice.html, /Cancel my sign-up/);
  assert.match(notice.html, /manage=/);
  assert.match(notice.html, /cancel=/);
  assert.match(notice.html, /padding:0 0 12px 0/);
  assert.equal(notice.html.includes('Donny'), false);
  assert.match(notice.text, /Ada Business Association/);
  const removed = aba.buildScheduleNotice_(person, { kind: 'removed', eventName: 'Happy Hour', oldWhen: 'December 1' });
  assert.match(removed.html, /cancelled\/removed from the schedule/);
  assert.match(removed.html, /Choose another event/);
  assert.match(removed.html, /aba-hospitality-signup/);
});

test('reject and a newer scan retire the previous token', () => {
  const harness = reviewDeps({
    text: ['2026', 'December', '15 - Ada Books Ribbon Cutting, 4:00pm'].join('\n')
  });
  aba.syncEventsFromDoc(false, harness.deps);
  const first = harness.box.value.token;
  harness.deps.newToken = function () { return 'b'.repeat(48); };
  harness.deps.newId = function () { return 'plan2'; };
  aba.syncEventsFromDoc(false, harness.deps);
  const old = aba.finishEventSyncReview_('approve', first, { deps: harness.deps });
  assert.equal(old.ok, false);
  assert.equal(harness.writes.length, 0);
  const rejected = aba.finishEventSyncReview_('reject', 'b'.repeat(48), { deps: harness.deps });
  assert.equal(rejected.ok, true);
  assert.equal(harness.box.value, null);
  assert.equal(harness.writes.length, 0);
});

test('auto mode applies the mirror and a removed sign-up stays on the sheet', () => {
  const harness = reviewDeps({
    mode: 'auto',
    text: ['2026', 'December', '9 - ABA Happy Hour - Ada Hotel, 5:00-7:00pm'].join('\n'),
    existing: [{
      rowNumber: 4,
      type: 'Happy Hour',
      date: '2026-12-09',
      start: '4:30 PM',
      end: '6:30 PM',
      location: 'Happy Hour, Ada Hotel, 7415 River St SE, Ada'
    }, {
      rowNumber: 6,
      type: 'Happy Hour',
      date: '2026-12-01',
      start: '4:30 PM',
      end: '6:30 PM',
      location: 'Happy Hour, Schnitz'
    }],
    signups: [{
      name: 'Dee',
      email: 'dee@example.com',
      date: '2026-12-01',
      event: 'Happy Hour',
      task: 'Set-Up',
      status: 'active',
      token: 'g'.repeat(40),
      signupId: 's9',
      rowNumber: 12
    }]
  });
  harness.box.value = { id: 'old', token: 'z'.repeat(48) };
  const summary = aba.syncEventsFromDoc(false, harness.deps);
  assert.equal(harness.box.value, null);
  assert.match(summary, /changed 1/);
  assert.match(summary, /removed 1/);
  assert.equal(harness.reviews.length, 0);
  assert.equal(harness.updates.length, 1);
  assert.equal(harness.removes.length, 1);
  assert.equal(harness.removes[0].rowNumber, 6);
  assert.equal(harness.removals.length, 1);
  assert.equal(harness.removals[0].email, 'dee@example.com');
  assert.equal(aba.ABA_RULES.isActive({ status: 'cancelled-by-event-removal' }), false);
  assert.equal(aba.ABA_RULES.isActive({ status: '' }), true);
});
