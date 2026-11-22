const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { loadAba, root } = require('./load-aba');

const aba = loadAba();
const TODAY = '2026-11-22';

function currentRows() {
  const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
  const rows = [];
  let n = 2;
  seed.events.forEach((event) => {
    event.tasks.forEach((task) => {
      task.names.forEach((name) => {
        const mapped = aba.mapLegacyTask_(task.task);
        rows.push({
          rowNumber: n,
          name,
          email: '',
          event: event.name,
          date: event.date,
          time: event.time,
          task: mapped && mapped.task ? mapped.task : task.task,
          slotId: event.date + '|' + event.name + '|' + (mapped && mapped.task ? mapped.task : task.task),
          status: mapped && mapped.review ? 'needs-review' : 'active',
          oldTask: task.task,
          location: event.location
        });
        n += 1;
      });
    });
  });
  rows.push({
    rowNumber: n,
    name: 'Donny Nguyen',
    email: '',
    event: 'Happy Hour',
    date: '2026-12-09',
    time: '4:30 PM',
    task: 'Networking Host',
    slotId: '2026-12-09|Happy Hour|Networking Host',
    status: 'active',
    oldTask: 'Mixer Host',
    location: 'Happy Hour, Ada Hotel, 7415 River St SE, Ada'
  });
  return rows;
}

function apply(rows, plan) {
  const next = rows.map((row) => Object.assign({}, row));
  plan.updates.forEach((change) => {
    Object.assign(next.find((row) => row.rowNumber === change.rowNumber), change.fields);
  });
  plan.drinkUpdates.forEach((change) => {
    Object.assign(next.find((row) => row.rowNumber === change.rowNumber), change.fields);
  });
  plan.creates.forEach((row, index) => {
    next.push(Object.assign({ rowNumber: 1000 + index }, row));
  });
  return next;
}

test('future full-lunch rows become three roles and a second run changes nothing', () => {
  const slots = aba.abaCatalogSlots_();
  const rows = currentRows();
  const plan = aba.planFullLunchResolution_(rows, slots, TODAY, {
    newId: () => 'new-id',
    newToken: () => 'd'.repeat(32),
    stamp: () => '2026-11-22 18:00:00'
  });
  assert.equal(aba.fullLunchSummary_(plan),
    'Resolved 5 Ambassadors - Full lunch rows. Created 15 sign-ups. Skipped 0 roles already held. Over capacity: none. Left 4 past rows unchanged. Updated 1 Drink Delivery time to 2:00–3:00 PM the day before.');
  const created = plan.creates.map((row) => row.date + ' ' + row.task);
  ['2027-01-21', '2027-02-18', '2027-03-18', '2027-04-15', '2027-05-20'].forEach((date) => {
    assert.equal(created.filter((item) => item.startsWith(date)).join(', '),
      date + ' Set-Up, ' + date + ' Food Table Host, ' + date + ' Clean-Up');
  });
  assert.equal(plan.creates.every((row) => row.source === 'migration' && row.oldTask === 'Ambassadors - Full lunch' && row.status === 'active' && row.token.length === 32), true);
  const past = rows.filter((row) => row.date === '2026-11-19' && row.task === 'Ambassadors - Full lunch');
  assert.equal(past.length, 4);
  assert.equal(plan.updates.some((change) => past.some((row) => row.rowNumber === change.rowNumber)), false);
  const drink = plan.drinkUpdates[0];
  assert.equal(drink.fields.time, 'Nov 18, 2:00–3:00 PM');
  const second = aba.planFullLunchResolution_(apply(rows, plan), slots, TODAY, {
    newId: () => { throw new Error('no id'); },
    newToken: () => { throw new Error('no token'); },
    stamp: () => ''
  });
  assert.equal(aba.fullLunchSummary_(second),
    'Resolved 0 Ambassadors - Full lunch rows. Created 0 sign-ups. Skipped 0 roles already held. Over capacity: none. Left 4 past rows unchanged. Updated 0 Drink Delivery times to 2:00–3:00 PM the day before.');
  assert.equal(fs.readFileSync(path.join(root, 'apps-script/FixFullLunch.gs'), 'utf8').includes('MailApp'), false);
  assert.equal(fs.readFileSync(path.join(root, 'apps-script/FixFullLunch.gs'), 'utf8').includes('sendMail'), false);
});

test('a role the person already holds is skipped, and a full role is still added', () => {
  const slots = aba.abaCatalogSlots_();
  const rows = currentRows();
  rows.push({
    rowNumber: 80,
    name: 'Kevin Snyder',
    email: '',
    event: 'Lunch & Learn',
    date: '2027-01-21',
    task: 'Set-Up',
    slotId: '2027-01-21|Lunch & Learn|Set-Up',
    status: 'active',
    oldTask: 'Ambassadors - Set up'
  });
  rows.push({
    rowNumber: 81,
    name: 'Alex Host',
    email: 'alex@example.com',
    event: 'Lunch & Learn',
    date: '2027-01-21',
    task: 'Food Table Host',
    slotId: '2027-01-21|Lunch & Learn|Food Table Host',
    status: 'active',
    oldTask: ''
  });
  const plan = aba.planFullLunchResolution_(rows, slots, TODAY, {
    newId: () => 'id',
    newToken: () => 'e'.repeat(32),
    stamp: () => 't'
  });
  const jan = plan.creates.filter((row) => row.date === '2027-01-21').map((row) => row.task);
  assert.equal(jan.join(', '), 'Food Table Host, Clean-Up');
  assert.equal(plan.skipped.some((row) => row.date === '2027-01-21' && row.task === 'Set-Up'), true);
  assert.equal(plan.overCapacity.some((row) => row.date === '2027-01-21' && row.task === 'Food Table Host' && row.capacity === 1), true);
  const catalog = aba.ABA_RULES.publicCatalog(slots, apply(rows, plan).map((row) => row), '2026-11-22');
  const lunch = catalog.events.find((event) => event.date === '2026-11-19');
  assert.equal(JSON.stringify(lunch).includes('Christian Viel'), false);
});
