const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadAba, memoryDeps } = require('./load-aba');

const aba = loadAba();

function adminDeps(state, store) {
  const deps = memoryDeps(aba, state);
  deps.adminStore = store;
  deps.calendarGuest = function (changes) {
    deps.calendarChanges = changes;
    return true;
  };
  return deps;
}

function memoryStore(password) {
  const box = {
    cache: {},
    now: Date.now(),
    ADMIN_SALT: 'salt-1',
    ADMIN_PASSWORD_HASH: aba.sha256Hex_('salt-1\n' + password)
  };
  return {
    box: box,
    now: function () { return box.now; },
    getSecret: function (key) { return box[key] || ''; },
    putSecret: function (key, value) { box[key] = value; },
    getCache: function (key) {
      const item = box.cache[key];
      if (!item || item.exp <= box.now) return null;
      return item.value;
    },
    putCache: function (key, value, seconds) {
      box.cache[key] = { value: value, exp: box.now + seconds * 1000 };
    },
    removeCache: function (key) { delete box.cache[key]; }
  };
}

function sheet() {
  const state = {
    slots: aba.abaCatalogSlots_(),
    signups: []
  };
  return state;
}

test('setAdminPassword stores a hash and does not keep a password in the file', () => {
  const source = fs.readFileSync(path.join(__dirname, '../apps-script/Admin.gs'), 'utf8');
  const fn = source.slice(source.indexOf('function setAdminPassword'), source.indexOf('function readLoginGuard_'));
  assert.match(fn, /ADMIN_SALT/);
  assert.match(fn, /ADMIN_PASSWORD_HASH/);
  assert.match(fn, /Logger\.log\('Admin password/);
  assert.equal(fn.includes('password = \''), false);
  assert.equal(source.includes('?admin='), false);
});

test('admin login locks after five failures and a session can see the roster', () => {
  const state = sheet();
  const store = memoryStore('correct-horse');
  const deps = adminDeps(state, store);
  let locked = null;
  for (let i = 0; i < 5; i++) locked = aba.adminLogin_({ password: 'nope' }, deps);
  assert.equal(locked.error, 'Too many tries. Try again in 15 minutes.');
  assert.equal(aba.adminLogin_({ password: 'correct-horse' }, deps).error, 'Too many tries. Try again in 15 minutes.');
  store.box.now += 15 * 60 * 1000 + 1;
  const good = aba.adminLogin_({ password: 'correct-horse' }, deps);
  assert.equal(good.ok, true);
  assert.match(good.session, /^[A-Za-z0-9]{32,80}$/);
  state.signups.push({
    signupId: 'id-1',
    slotId: '2026-12-09|Happy Hour|Set-Up',
    name: 'Ada Volunteer',
    email: 'secret@example.com',
    status: 'active',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Set-Up'
  });
  const roster = aba.adminRoster_({ session: good.session }, deps);
  assert.equal(roster.ok, true);
  assert.equal(roster.people[0].signupId, 'id-1');
  assert.equal(JSON.stringify(roster).includes('secret@example.com'), false);
  assert.equal(aba.adminRoster_({ session: 'bad' }, deps).ok, false);
  assert.equal(aba.adminLogout_({ session: good.session }, deps).ok, true);
  assert.equal(aba.adminRoster_({ session: good.session }, deps).ok, false);
});

test('admin can add past capacity and remove without the volunteer email', () => {
  const state = sheet();
  const slot = state.slots.find((item) => item.date === '2026-12-09' && item.task === 'Set-Up');
  for (let i = 0; i < slot.capacity; i++) {
    state.signups.push({
      rowNumber: i + 2,
      signupId: 'full-' + i,
      slotId: slot.slotId,
      name: 'Person ' + i,
      email: 'person' + i + '@example.com',
      status: 'active',
      event: 'Happy Hour',
      date: '2026-12-09',
      task: 'Set-Up',
      token: ('t' + i).padEnd(32, 'a')
    });
  }
  const store = memoryStore('correct-horse');
  const deps = adminDeps(state, store);
  const session = aba.adminLogin_({ password: 'correct-horse' }, deps).session;
  const added = aba.adminAdd_({
    session: session,
    name: 'Extra Person',
    email: 'extra@example.com',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Set-Up',
    sendEmail: false
  }, deps);
  assert.equal(added.ok, true);
  assert.match(added.warning, /already full/);
  const created = state.signups.find((row) => row.email === 'extra@example.com');
  assert.equal(created.source, 'admin');
  assert.equal(created.status, 'active');
  assert.equal(deps.mails.length, 0);
  assert.equal(deps.calendarChanges[0].action, 'add');
  const removed = aba.adminRemove_({
    session: session,
    signupId: created.signupId,
    sendEmail: true
  }, deps);
  assert.equal(removed.ok, true);
  assert.equal(created.status, 'cancelled');
  assert.equal(deps.calendarChanges[0].action, 'remove');
  assert.equal(deps.mails.length, 1);
  assert.match(deps.mails[0].text, /cancelled/i);
  const html = aba.ABACatalog.renderBoard(aba.ABACatalog.toView({
    events: [{
      date: '2026-12-09',
      name: 'Happy Hour',
      time: '4:30 PM',
      location: 'Happy Hour, Ada Hotel',
      tasks: [{ task: 'Set-Up', capacity: 3, names: ['Ada Volunteer'], remaining: 2 }]
    }]
  }, '2026-11-22'), 'live', [{ signupId: 'id-9', name: 'Ada Volunteer', slotId: '2026-12-09|Happy Hour|Set-Up' }]);
  assert.match(html, /class="admin-add"/);
  assert.match(html, /class="admin-remove"/);
  assert.equal(aba.ABACatalog.renderBoard(aba.ABACatalog.toView({
    events: [{ date: '2026-12-09', name: 'Happy Hour', time: '4:30 PM', location: '', tasks: [{ task: 'Set-Up', capacity: 1, names: ['Ada Volunteer'] }] }]
  }, '2026-11-22'), 'live').includes('admin-add'), false);
});
