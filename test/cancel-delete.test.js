const assert = require('node:assert/strict');
const test = require('node:test');
const { loadAba, memoryDeps, stateFromSeed } = require('./load-aba');

const aba = loadAba();

test('a cancel deletes the row by sign-up id and a move keeps the row', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  const saved = aba.processPost_({
    name: 'Ada Volunteer',
    email: 'ada.volunteer@example.com',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Mixer Host',
    company: ''
  }, deps);
  assert.equal(saved.ok, true);
  const row = state.signups[state.signups.length - 1];
  const moved = aba.moveSignup_({
    token: row.token,
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Ambassadors Clean up'
  }, deps);
  assert.equal(moved.ok, true);
  assert.equal(state.signups.includes(row), true);
  assert.equal(row.task, 'Ambassadors Clean up');
  assert.equal(deps.deleteInsideLock, undefined);
  const cancelled = aba.cancelSignup_({ token: row.token }, deps);
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.signup.task, 'Ambassadors Clean up');
  assert.equal(deps.deleteInsideLock, true);
  assert.equal(state.signups.includes(row), false);
  assert.equal(deps.mails[deps.mails.length - 1].text.includes('cancelled'), true);
  assert.equal(aba.cancelSignup_({ token: 'short' }, deps).error, 'That link is not valid.');
  assert.equal(
    aba.cancelSignup_({ token: 'a'.repeat(32) }, deps).error,
    'This sign-up has already been cancelled or no longer exists.'
  );
});

test('deleteCancelledRows removes cancelled rows from the bottom and can count without deleting', () => {
  const sheet = [
    { signupId: 'keep', status: 'active' },
    { signupId: 'top', status: 'cancelled' },
    { signupId: 'review', status: 'needs-review' },
    { signupId: 'bottom', status: 'Cancelled' },
    { signupId: '', status: 'cancelled' }
  ];
  const deleted = [];
  const forgotten = [];
  const logs = [];
  function listCancelled() {
    const found = [];
    for (let i = sheet.length - 1; i >= 0; i--) {
      if (String(sheet[i].status).trim().toLowerCase() === 'cancelled') found.push({ signupId: sheet[i].signupId });
    }
    return found;
  }
  const deps = {
    withLock(fn) { fn(); return true; },
    listCancelled,
    deleteSignup(signupId) {
      const index = sheet.findIndex((row) => row.signupId === signupId);
      if (index === -1) return false;
      sheet.splice(index, 1);
      deleted.push(signupId);
      return true;
    },
    forgetCalendar(signupId) { forgotten.push(signupId); },
    log(message) { logs.push(message); }
  };
  const preview = aba.deleteCancelledRows(true, deps);
  assert.match(preview, /3 cancelled rows would be deleted/);
  assert.equal(deleted.length, 0);
  assert.equal(sheet.length, 5);
  const result = aba.deleteCancelledRows(false, deps);
  assert.deepEqual(deleted, ['bottom', 'top']);
  assert.deepEqual(forgotten, ['bottom', 'top']);
  assert.equal(sheet.some((row) => row.signupId === 'keep'), true);
  assert.equal(sheet.some((row) => row.signupId === 'review'), true);
  assert.match(logs.join('\n'), /will delete 3/);
  assert.match(result, /deleted 2/);
  assert.match(result, /1 cancelled row was skipped/);
});
