const assert = require('node:assert/strict');
const test = require('node:test');
const { loadAba, stateFromSeed, memoryDeps } = require('./load-aba');

const aba = loadAba();
const TODAY = '2026-11-20';

function claim(extra) {
  return Object.assign({
    name: 'Ada Volunteer',
    email: 'ada.volunteer@example.com',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Mixer Host',
    company: ''
  }, extra || {});
}

test('a timed event is two hours in Eastern time and escapes calendar text', () => {
  const signup = {
    name: 'Ada Volunteer',
    email: 'ada@example.com',
    signupId: 'id-1',
    token: 'a'.repeat(32),
    sequence: 0
  };
  const slot = {
    event: 'Happy Hour',
    date: '2026-12-09',
    time: '4:30 PM',
    task: 'Mixer Host',
    location: 'Happy Hour, Ada Hotel, 7415 River St SE, Ada'
  };
  const message = aba.buildMessage_(signup, slot, 'confirm');
  assert.equal(message.name, 'Ada Business Association');
  assert.equal(message.replyTo, 'donny@vanderwinn.com');
  assert.equal(message.to, 'ada@example.com');
  assert.equal(Object.prototype.hasOwnProperty.call(message, 'bcc'), false);
  assert.match(message.subject, /Mixer Host/);
  assert.match(message.text, /4:30 PM Eastern/);
  assert.match(message.text, /Ada Hotel, 7415 River St SE, Ada/);
  assert.match(message.text, /calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  assert.match(message.text, /20261209T213000Z%2F20261209T233000Z|dates=20261209T213000Z\/20261209T233000Z/);
  assert.match(message.html, /#407589/);
  assert.match(message.html, /assets\/aba-logo\.png/);
  assert.match(message.ics, /TZID:America\/New_York/);
  assert.match(message.ics, /DTSTART;TZID=America\/New_York:20261209T163000/);
  assert.match(message.ics, /DTEND;TZID=America\/New_York:20261209T183000/);
  assert.match(message.ics, /METHOD:REQUEST/);
  assert.match(message.ics, /LOCATION:Ada Hotel\\, 7415 River St SE\\, Ada/);
  assert.match(message.ics, /UID:id-1@aba-hospitality\.ada/);
  assert.equal(message.filename, 'invite.ics');
  assert.match(message.ics, /ORGANIZER;CN=Ada Business Association:mailto:donny@vanderwinn.com/);
  assert.match(message.text, /invite\.ics/);
  assert.match(message.text, /Add to Apple Calendar \(iPhone\)/);
  assert.match(message.html, /Add to Apple Calendar \(iPhone\)/);
  assert.match(message.html, /Add to Google Calendar/);
  assert.match(message.html, /Add to Outlook/);
  const appleLine = message.text.split('Add to Apple Calendar (iPhone):')[1].split('\n')[1];
  assert.match(appleLine, /apple=1/);
  assert.match(appleLine, /date=2026-12-09/);
  assert.match(appleLine, /start=4%3A30%20PM/);
  assert.match(appleLine, /end=6%3A30%20PM/);
  assert.equal(appleLine.includes('ada@example.com'), false);
  assert.equal(appleLine.includes('manage='), false);
  assert.equal(appleLine.includes(signup.token), false);
  assert.match(message.text, /\?manage=a{32}/);
  const roleFile = aba.buildMessage_(signup, {
    event: 'Lunch & Learn',
    date: '2027-01-21',
    time: '11:30 AM',
    startTime: '11:00 AM',
    endTime: '11:25 AM',
    task: 'Set-Up',
    venue: 'Amway WHQ',
    address: '7575 Fulton St E, Ada'
  }, 'confirm');
  assert.match(roleFile.ics, /DTSTART;TZID=America\/New_York:20270121T110000/);
  assert.match(roleFile.ics, /DTEND;TZID=America\/New_York:20270121T112500/);
  assert.match(roleFile.ics, /LOCATION:Amway WHQ\\, 7575 Fulton St E\\, Ada/);
  assert.match(roleFile.text, /start=11%3A00%20AM/);
  assert.match(roleFile.text, /end=11%3A25%20AM/);
  assert.equal(roleFile.text.includes('ada@example.com'), false);
  assert.equal(message.ics.includes('\n') && !message.ics.includes('\r\n') ? false : true, true);
});

test('cancelByEmail cancels only when the email matches and hides that address', () => {
  const state = {
    slots: aba.abaCatalogSlots_(),
    signups: [{
      rowNumber: 2,
      signupId: 'id-1',
      slotId: '2026-12-09|Happy Hour|Networking Ambassador',
      name: 'Donny Nguyen',
      email: 'donny@vanderwinn.com',
      event: 'Happy Hour',
      date: '2026-12-09',
      task: 'Networking Ambassador',
      startTime: '4:30 PM',
      time: '4:30–6:30 PM',
      status: 'active',
      token: 't'.repeat(32),
      sequence: 0
    }]
  };
  const deps = memoryDeps(aba, state);
  const wrong = aba.cancelByEmail_({
    name: 'Donny Nguyen',
    email: 'other@example.com',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Networking Ambassador',
    startTime: '4:30 PM'
  }, deps);
  assert.equal(wrong.ok, false);
  assert.equal(wrong.error, 'That email does not match this sign-up.');
  assert.equal(JSON.stringify(wrong).includes('donny@'), false);
  assert.equal(state.signups[0].status, 'active');
  const before = aba.ABACatalog.renderBoard(aba.ABACatalog.toView(aba.ABA_RULES.publicCatalog(state.slots, state.signups, TODAY), TODAY), 'live');
  assert.match(before, /title="Cancel this sign-up"/);
  assert.equal(before.toLowerCase().includes('donny@'), false);
  const right = aba.cancelByEmail_({
    name: 'donny nguyen',
    email: 'Donny@VanderWinn.com',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Networking Ambassador',
    startTime: '4:30 pm'
  }, deps);
  assert.equal(right.ok, true);
  assert.equal(state.signups[0].status, 'cancelled');
  assert.equal(deps.mails.length, 1);
  assert.match(deps.mails[0].ics, /METHOD:CANCEL/);
  const catalog = aba.ABA_RULES.publicCatalog(state.slots, state.signups, TODAY);
  const task = catalog.events.find((event) => event.date === '2026-12-09').tasks.find((item) => item.task === 'Networking Ambassador');
  assert.equal(task.names.includes('Donny Nguyen'), false);
  assert.equal(task.roleStart, '4:30 PM');
  assert.equal(JSON.stringify(catalog).toLowerCase().includes('donny@'), false);
});

test('a summer clock time converts through daylight saving, and a blank time is all day', () => {
  const start = aba.zonedWallToUtc_('2026-07-09', 16, 30, 'America/New_York');
  assert.equal(start.toISOString(), '2026-07-09T20:30:00.000Z');
  const message = aba.buildMessage_({
    name: 'Ada',
    email: 'ada@example.com',
    signupId: 'id-2',
    token: '',
    sequence: 1
  }, {
    event: 'Happy Hour',
    date: '2026-12-09',
    time: '',
    task: 'Mixer Host',
    location: 'Somewhere; with a semicolon'
  }, 'cancel');
  assert.match(message.ics, /METHOD:CANCEL/);
  assert.match(message.ics, /STATUS:CANCELLED/);
  assert.match(message.ics, /DTSTART;VALUE=DATE:20261209/);
  assert.match(message.ics, /DTEND;VALUE=DATE:20261210/);
  assert.match(message.ics, /Somewhere\\; with a semicolon/);
  assert.equal(message.text.includes('?manage='), false);
});

test('confirmation mail is sent without putting the token in the response, and a mail failure still keeps the row', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  const before = state.signups.length;
  const saved = aba.processPost_(claim(), deps);
  assert.equal(saved.ok, true);
  assert.equal(saved.message, 'You are signed up for Mixer Host.');
  assert.equal(JSON.stringify(saved).includes('token'), false);
  assert.equal(deps.mails.length, 1);
  assert.match(deps.mails[0].ics, /METHOD:REQUEST/);
  const broken = memoryDeps(aba, state, { throwMail: true });
  const still = aba.processPost_(claim({ email: 'other.person@example.com', name: 'Other Person', task: 'Ambassadors Clean up' }), broken);
  assert.equal(still.ok, true);
  assert.match(still.message, /could not send the confirmation email/);
  assert.equal(state.signups.length, before + 2);
});

test('cancelled rows free the spot and stay out of the public catalog', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  const saved = aba.processPost_(claim(), deps);
  assert.equal(saved.ok, true);
  const row = state.signups[state.signups.length - 1];
  const token = row.token;
  assert.equal(aba.lookupSignup_({ token: token }, deps).signup.email, 'ada.volunteer@example.com');
  assert.equal(JSON.stringify(aba.handleGet_(deps)).includes(token), false);
  assert.equal(JSON.stringify(aba.handleGet_(deps)).includes('ada.volunteer@example.com'), false);
  const cancelled = aba.cancelSignup_({ token: token }, deps);
  assert.equal(cancelled.ok, true);
  assert.equal(row.status, 'cancelled');
  assert.match(deps.mails[deps.mails.length - 1].ics, /METHOD:CANCEL/);
  const again = aba.processPost_(claim({ email: 'second.person@example.com', name: 'Second Person' }), deps);
  assert.equal(again.ok, true);
  const catalog = aba.handleGet_(deps);
  const mixer = catalog.events.find((event) => event.date === '2026-12-09').tasks.find((task) => task.task === 'Mixer Host');
  assert.deepEqual(JSON.parse(JSON.stringify(mixer.names)), ['Second Person']);
});

test('a move checks capacity and past dates, then updates the same row', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  aba.processPost_(claim(), deps);
  const row = state.signups[state.signups.length - 1];
  const past = aba.moveSignup_({
    token: row.token,
    event: 'Ribbon Cutting',
    date: '2026-11-17',
    task: 'Ribbon Holders'
  }, deps);
  assert.equal(past.error, 'This event is closed.');
  const full = aba.moveSignup_({
    token: row.token,
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Door/Sign in Table'
  }, deps);
  assert.equal(full.error, 'That task is full.');
  const moved = aba.moveSignup_({
    token: row.token,
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Ambassadors Clean up'
  }, deps);
  assert.equal(moved.ok, true);
  assert.equal(row.task, 'Ambassadors Clean up');
  assert.equal(row.previousSlotId.endsWith('|Mixer Host'), true);
  assert.equal(row.reminderSent, '');
  assert.equal(row.sequence, 1);
  assert.match(deps.mails[deps.mails.length - 1].ics, /SEQUENCE:1/);
  assert.equal(aba.moveSignup_({ token: 'short', event: 'Happy Hour', date: '2026-12-09', task: 'Mixer Host' }).error, 'That link is not valid.');
  const bad = aba.lookupSignup_({ token: 'nope' }, deps);
  assert.equal(bad.ok, false);
});

test('reminders go out exactly two days ahead and only once', () => {
  const state = stateFromSeed(aba);
  state.signups.forEach((row) => { row.email = ''; });
  const deps = memoryDeps(aba, state, { todayEastern: () => '2026-12-07' });
  const target = state.signups.find((row) => row.date === '2026-12-09');
  target.email = 'ada@example.com';
  target.token = 'b'.repeat(32);
  const first = aba.runReminders_(deps);
  assert.equal(first.sent, 1);
  assert.equal(target.reminderSent, '2026-12-09');
  assert.match(deps.mails[0].subject, /in 2 days/);
  const second = aba.runReminders_(deps);
  assert.equal(second.sent, 0);
  target.status = 'cancelled';
  target.reminderSent = '';
  assert.equal(aba.runReminders_(deps).sent, 0);
});

test('migration keeps every sign-up, backfills capacity and tokens, and is idempotent', () => {
  const catalog = [
    { slotId: '2026-11-17|Ribbon Cutting|Photographer', time: '4:30 PM', location: 'Riverside', capacity: 1 },
    { slotId: '2026-12-09|Happy Hour|Mixer Host', time: '4:30 PM', location: 'Ada Hotel', capacity: 1 }
  ];
  const values = [
    ['signupId', 'slotId', 'name', 'email', 'createdAt', 'source'],
    ['seed-01', '2026-11-17|Ribbon Cutting|Photographer', 'Stacey Thurston', '', '2026-11-17T16:04:00-05:00', 'seed'],
    ['web-1', '2026-12-09|Happy Hour|Mixer Host', 'Ada Volunteer', 'Ada@Example.com', 't', 'web']
  ];
  let n = 0;
  const first = aba.migrateSignupTable_(values, catalog, aba.SIGNUP_HEADERS, function () {
    n += 1;
    return ('mig' + n).padEnd(32, 'c');
  });
  assert.equal(first.kept, 2);
  assert.equal(first.tokensFilled, 2);
  assert.equal(first.capacitiesFilled, 2);
  const nameAt = aba.columnIndex_(aba.SIGNUP_HEADERS, 'name');
  const emailAt = aba.columnIndex_(aba.SIGNUP_HEADERS, 'email');
  const capAt = aba.columnIndex_(aba.SIGNUP_HEADERS, 'capacity');
  const tokenAt = aba.columnIndex_(aba.SIGNUP_HEADERS, 'token');
  assert.equal(first.values[1][nameAt], 'Stacey Thurston');
  assert.equal(first.values[1][emailAt], '');
  assert.equal(first.values[1][capAt], 1);
  assert.equal(first.values[2][emailAt], 'Ada@Example.com');
  assert.equal(first.values[2][capAt], 1);
  const again = aba.migrateSignupTable_(first.values, catalog, aba.SIGNUP_HEADERS, function () { throw new Error('should not mint'); });
  assert.equal(again.kept, 2);
  assert.equal(again.tokensFilled, 0);
  assert.equal(again.capacitiesFilled, 0);
  assert.equal(again.values[2][tokenAt], first.values[2][tokenAt]);
  assert.equal(aba.planTriggerHandlers_([]).create, true);
  assert.equal(aba.planTriggerHandlers_(['sendReminders', 'sendReminders']).deleteIndexes.length, 1);
  assert.equal(aba.planTriggerHandlers_(['sendReminders', 'sendReminders']).deleteIndexes[0], 1);
  assert.equal(aba.planTriggerHandlers_(['sendReminders']).create, false);
});

test('the manage panel does not print the token and offers another open spot', () => {
  const view = aba.ABACatalog.toView(aba.abaSeedData(), TODAY);
  const html = aba.ABACatalog.renderManage({
    name: 'Ada Volunteer',
    email: 'ada@example.com',
    status: 'active',
    event: 'Happy Hour',
    date: '2026-12-09',
    time: '4:30 PM',
    task: 'Mixer Host',
    location: 'Ada Hotel'
  }, view);
  assert.match(html, /Cancel this sign-up|manage-cancel/);
  assert.match(html, /id="manage-cancel"/);
  assert.match(html, /data-task="Ambassadors Clean up"/);
  assert.equal(html.includes('secret-token'), false);
  const board = aba.ABACatalog.renderBoard(view, 'live');
  assert.match(board, /type-filter/);
  assert.equal(/\d+ open/.test(board), false);
  assert.equal(board.includes('event-progress'), false);
  const cancelled = aba.ABACatalog.renderManage({
    name: 'Ada Volunteer',
    status: 'cancelled',
    task: 'Mixer Host',
    date: '2026-12-09'
  }, view);
  assert.match(cancelled, /Sign-up cancelled/);
  assert.equal(cancelled.includes('manage-move'), false);
});
