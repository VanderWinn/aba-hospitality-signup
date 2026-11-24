const assert = require('node:assert/strict');
const test = require('node:test');
const { loadAba } = require('./load-aba');

const aba = loadAba();
const today = '2026-11-24';
const hash = aba.ABA_SHA256('secret-word');
const slots = [
  { slotId: '2026-11-19|Lunch & Learn|Door Greeter', date: '2026-11-19', event: 'Lunch & Learn', task: 'Door Greeter', capacity: 1, time: '11:15 AM', location: 'Lunch & Learn, Amway' },
  { slotId: '2026-12-09|Happy Hour|Set-Up', date: '2026-12-09', event: 'Happy Hour', task: 'Set-Up', capacity: 2, time: '4:00 PM', location: 'Happy Hour, Ada Hotel, 7415 River St' }
];
const signups = [
  { name: 'Ada Example', email: 'ada@example.com', phone: '555-0100', date: '2026-11-19', event: 'Lunch & Learn', task: 'Door Greeter', slotId: slots[0].slotId, status: '' },
  { name: 'Bea Example', email: 'bea@example.com', date: '2026-12-09', event: 'Happy Hour', task: 'Set-Up', slotId: slots[1].slotId, status: '' },
  { name: 'Bea Example', email: 'bea@example.com', date: '2026-10-14', event: 'Happy Hour', task: 'Set-Up', slotId: '2026-10-14|Happy Hour|Set-Up', status: '' },
  { name: 'Gone Example', email: 'gone@example.com', date: '2026-11-19', event: 'Lunch & Learn', task: 'Door Greeter', slotId: slots[0].slotId, status: 'cancelled' }
];

function ask(password, hashValue) {
  return aba.dashboardAction_({ action: 'dashboard', password: password }, {
    passwordHash: hashValue,
    signups: signups,
    slots: slots,
    today: today
  });
}

test('a wrong portal password is rejected and returns no names', () => {
  const denied = ask('nope', hash);
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 401);
  assert.equal(JSON.stringify(denied).includes('Ada Example'), false);
  const missing = ask('secret-word', '');
  assert.equal(missing.status, 401);
  assert.match(missing.error, /not set up/);
});

test('the dashboard returns names and counts without emails or phones', () => {
  const result = ask('secret-word', hash);
  assert.equal(result.ok, true);
  const body = JSON.stringify(result);
  assert.equal(body.includes('ada@example.com'), false);
  assert.equal(body.includes('555-0100'), false);
  assert.equal(body.includes('Gone Example'), false);
  const dash = result.dashboard;
  assert.equal(dash.participation.quarter.label, 'Q4 2026');
  assert.equal(dash.participation.quarter.volunteers, 2);
  assert.equal(dash.participation.quarter.shifts, 3);
  assert.equal(dash.participation.year.volunteers, 2);
  const bea = dash.participation.quarter.people.find((person) => person.name === 'Bea Example');
  assert.equal(bea.shifts, 2);
  assert.equal(dash.capacity.filled, 1);
  assert.equal(dash.capacity.seats, 2);
  assert.equal(dash.capacity.openRoles, 1);
  assert.equal(dash.capacity.events.length, 1);
  assert.equal(dash.capacity.events[0].roles[0].open, true);
  assert.equal(dash.capacity.events[0].roles[0].names.length, 1);
  assert.equal(dash.capacity.events[0].roles[0].names[0], 'Bea Example');
  assert.match(dash.note, /does not mark board or committee/);
  const routed = aba.interpretPost_(JSON.stringify({ action: 'dashboard', password: 'nope' }), {
    dashboard: function (body) { return ask(body.password, hash); }
  });
  assert.equal(routed.status, 401);
});
