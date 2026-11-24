const assert = require('node:assert/strict');
const test = require('node:test');
const { loadAba, memoryDeps, stateFromSeed } = require('./load-aba');

const aba = loadAba();

function claim(extra) {
  return Object.assign({
    name: 'Grant Volunteer',
    email: 'grant.volunteer@example.com',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Mixer Host',
    company: ''
  }, extra || {});
}

test('one email can hold two roles, and only the same slot is rejected', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  let updates = 0;
  let deletes = 0;
  const updateSignup = deps.updateSignup;
  const deleteSignup = deps.deleteSignup;
  deps.updateSignup = function () {
    updates += 1;
    return updateSignup.apply(null, arguments);
  };
  deps.deleteSignup = function () {
    deletes += 1;
    return deleteSignup.apply(null, arguments);
  };
  const first = aba.processPost_(claim(), deps);
  const second = aba.processPost_(claim({ task: 'Ambassadors Clean up' }), deps);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(updates, 0);
  assert.equal(deletes, 0);
  const mine = state.signups.filter((row) => row.email === 'grant.volunteer@example.com');
  assert.equal(mine.length, 2);
  assert.equal(mine.every((row) => row.status === 'active'), true);
  assert.notEqual(mine[0].signupId, mine[1].signupId);
  assert.notEqual(mine[0].token, mine[1].token);
  assert.notEqual(mine[0].slotId, mine[1].slotId);
  const duplicate = aba.processPost_(claim(), deps);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error, 'You are already signed up for this task.');
  assert.equal(state.signups.filter((row) => row.email === 'grant.volunteer@example.com').length, 2);
});

test('cancelling one role leaves the other, and moving one does not change the other', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  assert.equal(aba.processPost_(claim(), deps).ok, true);
  assert.equal(aba.processPost_(claim({ task: 'Ambassadors Clean up' }), deps).ok, true);
  const mine = state.signups.filter((row) => row.email === 'grant.volunteer@example.com');
  const roleA = mine.find((row) => row.task === 'Mixer Host');
  const roleB = mine.find((row) => row.task === 'Ambassadors Clean up');
  const idB = roleB.signupId;
  const tokenB = roleB.token;
  const cancelled = aba.cancelSignup_({ token: roleA.token }, deps);
  assert.equal(cancelled.ok, true);
  assert.equal(state.signups.some((row) => row.signupId === roleA.signupId), false);
  assert.equal(state.signups.some((row) => row.signupId === idB && row.task === 'Ambassadors Clean up'), true);
  const moved = aba.moveSignup_({
    token: tokenB,
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Mixer Host'
  }, deps);
  assert.equal(moved.ok, true);
  assert.match(moved.message, /did not add a second sign-up/);
  const kept = state.signups.filter((row) => row.email === 'grant.volunteer@example.com');
  assert.equal(kept.length, 1);
  assert.equal(kept[0].signupId, idB);
  assert.equal(kept[0].token, tokenB);
  assert.equal(kept[0].task, 'Mixer Host');
});
