const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { loadAba, root } = require('./load-aba');

const aba = loadAba();

const LIVE_HEADERS = [
  'name', 'email', 'event', 'date', 'Start Time', 'End Time', 'task', 'venue', 'address', 'capacity', 'createdAt',
  'signupId', 'slotId', 'source', 'token', 'oldTask', 'previousSlotId', 'sequence', 'reminderSent', 'updatedAt'
];

function row(fields) {
  const record = Object.assign({
    name: 'Ada Volunteer',
    email: '',
    event: 'Happy Hour',
    date: '12/9/2026',
    task: 'Set-Up'
  }, fields);
  return LIVE_HEADERS.map((name) => {
    if (name === 'name') return record.name;
    if (name === 'email') return record.email;
    if (name === 'event') return record.event;
    if (name === 'date') return record.date;
    if (name === 'task') return record.task;
    if (name === 'oldTask') return record.oldTask || '';
    if (name === 'slotId') return record.slotId || '';
    return '';
  });
}

test('restoreStatusV7 backfills the missing column and leaves an existing column alone', () => {
  const values = [LIVE_HEADERS].concat([
    row({ name: 'Kevin Snyder', event: 'Lunch & Learn', date: '1/21/2027', task: 'Ambassadors - Full lunch' }),
    row({ name: 'Kevin Snyder', event: 'Lunch & Learn', date: '11/19/2026', task: 'Ambassadors - Full lunch' }),
    row({ name: 'Rebecca Vandenbroek', event: 'Lunch & Learn', date: '11/19/2026', task: 'Ambassadors - Full lunch' }),
    row({ name: 'Claire Larson', event: 'Lunch & Learn', date: '11/19/2026', task: 'Ambassadors - Full lunch' }),
    row({ name: 'Christian Viel', event: 'Lunch & Learn', date: '11/19/2026', task: 'Ambassadors - Full lunch' }),
    row({ name: 'Donny Nguyen', email: 'donny@vanderwinn.com', event: 'Happy Hour', date: '12/9/2026', task: 'Networking Ambassador' }),
    row({ name: 'Donny Nguyen', email: 'other@example.com', event: 'Happy Hour', date: '12/9/2026', task: 'Networking Ambassador' }),
    row({ name: 'Kevin Snyder', event: 'Lunch & Learn', date: '1/21/2027', task: 'Set-Up', oldTask: 'Ambassadors - Full lunch' }),
    row({ name: 'Kevin Snyder', event: 'Lunch & Learn', date: new Date('2027-02-18T05:00:00Z'), task: 'Ambassadors - Full lunch' }),
    [],
    row({ name: 'Nick Kacher', event: 'Lunch & Learn', date: '4/15/2027', task: 'Door Greeter' })
  ]);
  const plan = aba.planRestoreStatusV7_(values);
  assert.equal(plan.already, false);
  assert.equal(plan.insertAfter, 11);
  assert.equal(plan.statusColumn, 12);
  const statusOf = (name, date) => plan.assignments.find((item) => item.name === name && item.date === date);
  assert.equal(statusOf('Kevin Snyder', '2027-01-21').status, 'superseded');
  assert.equal(statusOf('Kevin Snyder', '2026-11-19').status, 'needs-review');
  assert.equal(statusOf('Rebecca Vandenbroek', '2026-11-19').status, 'needs-review');
  assert.equal(statusOf('Claire Larson', '2026-11-19').status, 'needs-review');
  assert.equal(statusOf('Christian Viel', '2026-11-19').status, 'needs-review');
  assert.equal(statusOf('Donny Nguyen', '2026-12-09').status, 'cancelled');
  assert.equal(plan.assignments.filter((item) => item.email === 'other@example.com')[0].status, 'active');
  assert.equal(plan.assignments.filter((item) => item.task === 'Set-Up')[0].status, 'active');
  assert.equal(statusOf('Kevin Snyder', '2027-02-18').status, 'superseded');
  assert.equal(plan.assignments.filter((item) => item.task === 'Door Greeter')[0].status, 'active');
  assert.equal(plan.assignments.length, 10);

  const present = LIVE_HEADERS.slice();
  present.splice(11, 0, 'status');
  const again = aba.planRestoreStatusV7_([present].concat(values.slice(1)));
  assert.equal(again.already, true);
  assert.equal(again.assignments.length, 0);
});

test('a missing status column reads as blank and a Status header still loads', () => {
  const missing = aba.rowsToState_([[]], [LIVE_HEADERS, row({
    name: 'Kevin Snyder',
    slotId: '2027-01-21|Lunch & Learn|Ambassadors - Full lunch'
  })]);
  assert.equal(missing.signups[0].status, '');
  assert.equal(aba.ABA_RULES.isActive(missing.signups[0]), true);
  const headers = LIVE_HEADERS.slice();
  headers.splice(11, 0, 'Status');
  const values = [row({ name: 'Ada Volunteer', slotId: '2026-12-09|Happy Hour|Set-Up' })];
  values[0].splice(11, 0, 'needs-review');
  const found = aba.rowsToState_([[]], [headers].concat(values));
  assert.equal(found.signups[0].status, 'needs-review');
  assert.equal(aba.ABA_RULES.isActive(found.signups[0]), false);
});

test('restoreStatusV7 only logs, and sign-up writes recreate a missing status column', () => {
  const source = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');
  const fn = source.slice(source.indexOf('function restoreStatusV7'));
  assert.equal(fn.includes('getUi'), false);
  assert.equal(fn.includes('MailApp'), false);
  assert.equal(fn.includes('sendMail'), false);
  assert.equal(fn.includes('setBackground'), false);
  assert.equal(fn.includes('showColumns'), false);
  assert.equal(fn.includes('writeHeaders_'), false);
  assert.equal(fn.includes('setColumnWidth'), false);
  const update = source.slice(source.indexOf('function updateSignup_'), source.indexOf('function buildSeedRows_'));
  const append = source.slice(source.indexOf('function appendSignup_'), source.indexOf('function updateSignup_'));
  assert.equal(update.includes('ensureStatusColumn_'), true);
  assert.equal(append.includes('ensureStatusColumn_'), true);
});
