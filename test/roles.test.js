const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { loadAba, root } = require('./load-aba');

const aba = loadAba();

function rowsFromSeed() {
  const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
  const rows = [];
  let n = 2;
  seed.events.forEach((event) => {
    event.tasks.forEach((task) => {
      task.names.forEach((name) => {
        rows.push({
          rowNumber: n,
          name,
          email: '',
          event: event.name,
          date: event.date,
          task: task.task,
          slotId: event.date + '|' + event.name + '|' + task.task,
          status: '',
          oldTask: ''
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
    task: 'Mixer Host',
    slotId: '2026-12-09|Happy Hour|Mixer Host',
    status: 'active',
    oldTask: ''
  });
  return rows;
}

test('templates cover the 11 events in role order with absolute and relative times', () => {
  const slots = aba.abaCatalogSlots_();
  const events = [];
  const seen = new Set();
  slots.forEach((slot) => {
    const key = slot.date + '|' + slot.event;
    if (!seen.has(key)) {
      seen.add(key);
      events.push(slot);
    }
  });
  assert.equal(events.length, 11);
  assert.deepEqual(events.map((slot) => slot.date + ' ' + slot.time), [
    '2026-11-17 4:30 PM',
    '2026-11-19 11:30 AM',
    '2026-12-09 4:30–6:30 PM',
    '2027-01-13 4:30–6:30 PM',
    '2027-01-21 11:30 AM',
    '2027-02-10 4:30–6:30 PM',
    '2027-02-18 11:30 AM',
    '2027-03-10 4:30–6:30 PM',
    '2027-03-18 11:30 AM',
    '2027-04-15 11:30 AM',
    '2027-05-20 11:30 AM'
  ]);
  const ribbon = slots.filter((slot) => slot.date === '2026-11-17').map((slot) => slot.task + ' ' + slot.timeLabel);
  assert.equal(JSON.stringify(ribbon), JSON.stringify([
    'Photographer 4:15–5:30 PM',
    'Ribbon Holders 4:15–4:45 PM'
  ]));
  const lunch = slots.filter((slot) => slot.date === '2027-01-21');
  assert.equal(JSON.stringify(lunch.map((slot) => slot.task)), JSON.stringify([
    'Drink Delivery', 'Set-Up', 'Door Greeter', 'Sign-In Table', 'Food Table Host', 'Clean-Up'
  ]));
  const drinks = lunch[0];
  assert.equal(drinks.roleDate, '2027-01-20');
  assert.equal(drinks.timeLabel, 'Jan 20, 2:00–3:00 PM');
  assert.match(drinks.description, /Picks up the drinks/);
  const hour = slots.filter((slot) => slot.date === '2026-12-09').map((slot) => slot.task);
  assert.equal(JSON.stringify(hour), JSON.stringify(['Set-Up', 'Door Greeter', 'Sign-In Table', 'Networking Host', 'Clean-Up']));
  assert.equal(slots.filter((slot) => slot.date === '2026-11-17')[0].description, '');
});

test('role hours are the calendar start and end', () => {
  const slot = aba.abaCatalogSlots_().find((item) => item.date === '2026-12-09' && item.task === 'Set-Up');
  const message = aba.buildMessage_({
    name: 'Ada Volunteer',
    email: 'ada@example.com',
    signupId: 'id-9',
    token: 'c'.repeat(32),
    sequence: 0
  }, slot, 'confirm');
  assert.match(message.ics, /DTSTART;TZID=America\/New_York:20261209T160000/);
  assert.match(message.ics, /DTEND;TZID=America\/New_York:20261209T163000/);
  assert.match(message.text, /4:00–4:30 PM Eastern/);
  assert.match(message.text, /Arranges the room/);
  const drinks = aba.abaCatalogSlots_().find((item) => item.date === '2026-11-19' && item.task === 'Drink Delivery');
  const delivery = aba.buildMessage_({
    name: 'Claire Larson',
    email: 'claire@example.com',
    signupId: 'id-8',
    token: '',
    sequence: 0
  }, drinks, 'confirm');
  assert.match(delivery.ics, /DTSTART;TZID=America\/New_York:20261118T140000/);
  assert.match(delivery.ics, /DTEND;TZID=America\/New_York:20261118T150000/);
});

test('migration remaps the 25 current rows, flags full-lunch rows, and stays idempotent', () => {
  const slots = aba.abaCatalogSlots_();
  const rows = rowsFromSeed();
  assert.equal(rows.length, 25);
  const plan = aba.planRoleMigration_(rows, slots);
  assert.equal(plan.needsReview.length, 9);
  assert.equal(JSON.stringify(plan.needsReview.map((row) => row.date + ' ' + row.name)), JSON.stringify([
    '2026-11-19 Kevin Snyder',
    '2026-11-19 Rebecca Vandenbroek',
    '2026-11-19 Claire Larson',
    '2026-11-19 Christian Viel',
    '2027-01-21 Kevin Snyder',
    '2027-02-18 Kevin Snyder',
    '2027-03-18 Kevin Snyder',
    '2027-04-15 Kevin Snyder',
    '2027-05-20 Kevin Snyder'
  ]));
  assert.equal(plan.overCapacity.length, 0);
  const donny = plan.changes.find((change) => change.fields.task === 'Networking Host' && change.fields.date === '2026-12-09');
  assert.equal(donny.fields.oldTask, 'Mixer Host');
  assert.equal(donny.fields.capacity, 3);
  const applied = rows.map((row) => Object.assign({}, row));
  plan.changes.forEach((change) => {
    const row = applied.find((item) => item.rowNumber === change.rowNumber);
    Object.assign(row, change.fields);
  });
  const second = aba.planRoleMigration_(applied, slots);
  assert.equal(second.changes.length, 0);
  const catalog = aba.ABA_RULES.publicCatalog(slots, applied, '2026-11-22');
  const blob = JSON.stringify(catalog);
  assert.equal(blob.includes('@'), false);
  const nov19 = catalog.events.find((event) => event.date === '2026-11-19');
  assert.equal(JSON.stringify(nov19).includes('Kevin Snyder'), false);
  assert.equal(JSON.stringify(nov19).includes('Christian Viel'), false);
  const networking = catalog.events.find((event) => event.date === '2026-12-09').tasks.find((task) => task.task === 'Networking Host');
  const setup = catalog.events.find((event) => event.date === '2026-12-09').tasks.find((task) => task.task === 'Set-Up');
  assert.deepEqual(JSON.parse(JSON.stringify(networking.names)), ['Donny Nguyen']);
  assert.deepEqual(JSON.parse(JSON.stringify(setup.names)), ['Kevin Snyder']);
});

test('legacy rows may exceed the new capacity and the slot shows full', () => {
  const slots = aba.abaCatalogSlots_();
  const rows = [1, 2].map((n) => ({
    rowNumber: n,
    name: 'Person ' + n,
    event: 'Happy Hour',
    date: '2026-12-09',
    task: n === 1 ? 'Door/Sign in Table' : 'Door/Sign in Table Host',
    slotId: '2026-12-09|Happy Hour|' + (n === 1 ? 'Door/Sign in Table' : 'Door/Sign in Table Host'),
    status: 'active',
    oldTask: ''
  }));
  const plan = aba.planRoleMigration_(rows, slots);
  assert.equal(plan.overCapacity.length, 1);
  assert.equal(plan.overCapacity[0].task, 'Sign-In Table');
  assert.equal(plan.overCapacity[0].capacity, 1);
  assert.equal(plan.overCapacity[0].names.length, 2);
  const applied = rows.map((row) => Object.assign({}, row));
  plan.changes.forEach((change) => Object.assign(applied.find((row) => row.rowNumber === change.rowNumber), change.fields));
  const catalog = aba.ABA_RULES.publicCatalog(slots, applied, '2026-11-22');
  const task = catalog.events.find((event) => event.date === '2026-12-09').tasks.find((item) => item.task === 'Sign-In Table');
  assert.equal(task.names.length, 2);
  const view = aba.ABACatalog.toView(catalog, '2026-11-22');
  const html = aba.ABACatalog.renderBoard(view, 'live');
  assert.equal(html.includes('>Full<'), false);
  assert.equal(html.includes('Sign up for Sign-In Table, Happy Hour, Wednesday, December 9, 2026'), false);
});
