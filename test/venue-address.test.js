const assert = require('node:assert/strict');
const test = require('node:test');
const { loadAba } = require('./load-aba');

const aba = loadAba();

function headerIndex(name) {
  return aba.SIGNUP_HEADERS.indexOf(name);
}

test('migrateV4 splits location, keeps every row and status, and a second run changes nothing', () => {
  const values = [[
    'name', 'email', 'event', 'date', 'time', 'task', 'location', 'capacity', 'createdAt',
    'signupId', 'slotId', 'source', 'token', 'status', 'reminderSent', 'updatedAt', 'previousSlotId', 'sequence', 'oldTask'
  ], [
    'Kevin Snyder', 'kevin@example.com', 'Happy Hour', '2026-12-09', '4:30 PM', 'Set-Up',
    'Happy Hour, Ada Hotel, 7415 River St SE, Ada', 3, 't', 'id-1', '2026-12-09|Happy Hour|Set-Up',
    'web', 'a'.repeat(32), 'active', '', '', '', 0, ''
  ], [
    'Guest', '', 'Pop-up', '2099-01-01', '1:00 PM', 'Host',
    'Hall, 9 Oak Ave', 1, 't', 'id-2', '2099-01-01|Pop-up|Host',
    'web', 'b'.repeat(32), 'needs-review', '', '', '', 1, 'Host'
  ]];
  const first = aba.planSignupV4_(values, aba.abaEvents_());
  assert.equal(first.kept, 2);
  assert.equal(first.already, false);
  assert.equal(JSON.stringify(first.headers.slice(0, 12)), JSON.stringify([
    'name', 'email', 'event', 'date', 'startTime', 'endTime', 'task', 'venue', 'address', 'capacity', 'status', 'createdAt'
  ]));
  assert.equal(first.rows[0][headerIndex('venue')], 'Ada Hotel');
  assert.equal(first.rows[0][headerIndex('address')], '7415 River St SE, Ada');
  assert.equal(first.rows[0][headerIndex('status')], 'active');
  assert.equal(first.rows[0][headerIndex('token')], 'a'.repeat(32));
  assert.equal(first.rows[0][headerIndex('signupId')], 'id-1');
  assert.equal(first.rows[0][headerIndex('slotId')], '2026-12-09|Happy Hour|Set-Up');
  assert.equal(first.rows[0][headerIndex('email')], 'kevin@example.com');
  assert.equal(first.rows[1][headerIndex('venue')], 'Hall');
  assert.equal(first.rows[1][headerIndex('address')], '9 Oak Ave');
  assert.equal(first.rows[1][headerIndex('status')], 'needs-review');
  assert.equal(first.rows[1][headerIndex('oldTask')], 'Host');
  const again = aba.planSignupV4_([first.headers].concat(first.rows), aba.abaEvents_());
  assert.equal(again.already, true);
  assert.equal(again.kept, 2);
  assert.equal(JSON.stringify(again.rows), JSON.stringify(first.rows));
  assert.equal(JSON.stringify(aba.SIGNUP_HIDDEN), JSON.stringify([
    'signupId', 'slotId', 'source', 'token', 'oldTask', 'previousSlotId', 'sequence', 'reminderSent', 'updatedAt'
  ]));
});

test('new sign-ups store venue and address, and mail still shows the full place', () => {
  const slots = aba.abaCatalogSlots_();
  const slot = slots.find((item) => item.date === '2026-12-09' && item.task === 'Set-Up');
  const record = aba.signupRecord_({
    signup: { name: 'Ada Volunteer', email: 'ada@example.com' },
    slot: slot
  }, { stamp: () => 't', newId: () => 'id', newToken: () => 'c'.repeat(32), now: () => 0 });
  assert.equal(record.venue, 'Ada Hotel');
  assert.equal(record.address, '7415 River St SE, Ada');
  const message = aba.buildMessage_(record, { venue: record.venue, address: record.address, event: 'Happy Hour', date: '2026-12-09', time: '4:30 PM', task: 'Set-Up', location: '' }, 'confirm');
  assert.match(message.text, /Ada Hotel, 7415 River St SE, Ada/);
  assert.match(message.ics, /LOCATION:Ada Hotel\\, 7415 River St SE\\, Ada/);
});

test('the public catalog does not include emails or tokens', () => {
  const slots = aba.abaCatalogSlots_().filter((slot) => slot.date === '2026-12-09');
  const catalog = aba.ABA_RULES.publicCatalog(slots, [{
    slotId: slots[0].slotId,
    name: 'Ada Volunteer',
    email: 'secret@example.com',
    token: 'd'.repeat(32),
    status: 'active'
  }], '2026-11-22');
  const text = JSON.stringify(catalog);
  assert.equal(text.includes('secret@example.com'), false);
  assert.equal(text.includes('d'.repeat(32)), false);
  assert.match(text, /Ada Volunteer/);
});
