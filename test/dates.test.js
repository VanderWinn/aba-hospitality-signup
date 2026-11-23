const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const { loadAba, root } = require('./load-aba');

const aba = loadAba();

test('dates read as yyyy-MM-dd from Date, ISO text, or M/d/yyyy', () => {
  assert.equal(aba.ABA_RULES.formatSheetDate(new Date('2027-01-21T05:00:00Z')), '2027-01-21');
  assert.equal(aba.ABA_RULES.formatSheetDate('2027-01-21'), '2027-01-21');
  assert.equal(aba.ABA_RULES.formatSheetDate('1/21/2027'), '2027-01-21');
  assert.equal(aba.ABA_RULES.formatSheetTime(new Date('1899-12-30T16:30:00Z')), '11:30 AM');
  assert.equal(aba.ABA_RULES.formatSheetTime('11:30 AM'), '11:30 AM');
  const state = aba.rowsToState_([[]], [[
    'signupId', 'slotId', 'name', 'date', 'time', 'status'
  ], [
    'id-1', '2027-01-21|Lunch & Learn|Set-Up', 'Kevin Snyder',
    '1/21/2027', new Date('1899-12-30T16:30:00Z'), 'active'
  ]]);
  assert.equal(state.signups[0].date, '2027-01-21');
  assert.equal(state.signups[0].startTime, '11:30 AM');
  assert.equal(state.signups[0].status, 'active');
});

test('migrateV5 uses role times, keeps statuses, and a second run changes nothing', () => {
  const slots = aba.abaCatalogSlots_();
  const headers = ['name', 'email', 'event', 'date', 'time', 'task', 'status', 'slotId', 'token'];
  const rows = [[
    'Kevin Snyder', 'kevin@example.com', 'Lunch & Learn', new Date('2027-01-21T05:00:00Z'),
    new Date('1899-12-30T16:30:00Z'), 'Set-Up', 'active', '2027-01-21|Lunch & Learn|Set-Up', 'a'.repeat(32)
  ]];
  const first = aba.planMigrateV5_([headers].concat(rows), slots);
  assert.equal(first.insert, true);
  assert.equal(first.kept, 1);
  assert.equal(first.timeValues.map((item) => item.value).join(' | '), '11:00 AM | 11:25 AM');
  assert.equal(first.dateValues.length, 0);
  const secondHeaders = ['name', 'email', 'event', 'date', 'Start Time', 'End Time', 'task', 'status', 'slotId', 'token'];
  const secondRows = [[
    'Kevin Snyder', 'kevin@example.com', 'Lunch & Learn', new Date('2027-01-21T05:00:00Z'),
    '11:00 AM', '11:25 AM', 'Set-Up', 'active', '2027-01-21|Lunch & Learn|Set-Up', 'a'.repeat(32)
  ]];
  const second = aba.planMigrateV5_([secondHeaders].concat(secondRows), slots);
  assert.equal(second.insert, false);
  assert.equal(second.timeValues.length, 0);
  assert.equal(second.dateValues.length, 0);
  const source = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');
  const fn = source.slice(source.indexOf('function migrateV5'));
  assert.equal(fn.includes('getUi'), false);
  assert.equal(fn.includes('setBackground'), false);
  assert.equal(fn.includes('showColumns'), false);
  assert.equal(fn.includes('writeHeaders_'), false);
});
