const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { loadAba, root } = require('./load-aba');

const aba = loadAba();

test('sheet dates and time-only values become Eastern text', () => {
  assert.equal(aba.ABA_RULES.formatSheetDate(new Date('2027-01-21T05:00:00Z')), '2027-01-21');
  assert.equal(aba.ABA_RULES.formatSheetDate('2027-01-21'), '2027-01-21');
  assert.equal(aba.ABA_RULES.formatSheetTime(new Date('1899-12-30T16:30:00Z')), '11:30 AM');
  assert.equal(aba.ABA_RULES.formatSheetTime(11.5 / 24), '11:30 AM');
  assert.equal(aba.ABA_RULES.formatSheetTime('11:30 AM'), '11:30 AM');
  assert.equal(aba.ABA_RULES.formatSheetTime('Nov 18, 2:00–3:00 PM'), 'Nov 18, 2:00–3:00 PM');
  const state = aba.rowsToState_([[]], [[
    'signupId', 'slotId', 'name', 'date', 'time', 'status'
  ], [
    'id-1', '2027-01-21|Lunch & Learn|Set-Up', 'Kevin Snyder',
    new Date('2027-01-21T05:00:00Z'), new Date('1899-12-30T16:30:00Z'), 'active'
  ]]);
  assert.equal(state.signups[0].date, '2027-01-21');
  assert.equal(state.signups[0].time, '11:30 AM');
  assert.equal(state.signups[0].status, 'active');
});

test('normalizeDatesV5 rewrites only typed date and time cells and is idempotent', () => {
  const headers = ['name', 'date', 'time', 'status', 'token'];
  const rows = [[
    'Kevin Snyder', new Date('2027-01-21T05:00:00Z'), new Date('1899-12-30T16:30:00Z'), 'active', 'a'.repeat(32)
  ], [
    'Ada Volunteer', '2026-12-09', '4:30–6:30 PM', 'active', 'b'.repeat(32)
  ]];
  const first = aba.planDateText_(headers, rows);
  assert.equal(first.length, 2);
  assert.equal(first[0].value, '2027-01-21');
  assert.equal(first[1].value, '11:30 AM');
  assert.equal(first.every((change) => change.field === 'date' || change.field === 'time'), true);
  const rewritten = rows.map((row) => row.slice());
  first.forEach((change) => { rewritten[change.rowNumber - 2][change.column - 1] = change.value; });
  assert.equal(rewritten[0][3], 'active');
  assert.equal(rewritten[0][4], 'a'.repeat(32));
  assert.equal(aba.planDateText_(headers, rewritten).length, 0);
  const source = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');
  const fn = source.slice(source.indexOf('function normalizeDatesV5'));
  assert.equal(fn.includes('getUi'), false);
});
