const assert = require('node:assert/strict');
const test = require('node:test');
const { loadAba } = require('./load-aba');

const aba = loadAba();
const TODAY = '2026-11-24';

function slot(date, task) {
  return aba.abaCatalogSlots_().find((item) => item.date === date && item.task === task);
}

function fakeClient() {
  const store = {
    events: {},
    guests: {},
    bodies: {},
    created: 0,
    patches: [],
    quietPatches: [],
    mails: []
  };
  return {
    store: store,
    getCalendarId: function () { return 'cal-aba'; },
    eventId: function (signupId) { return store.events[signupId] || ''; },
    saveEventId: function (signupId, id) { store.events[signupId] = id; },
    clearEventId: function (signupId) { delete store.events[signupId]; },
    eventExists: function (calendarId, eventId) { return Object.prototype.hasOwnProperty.call(store.guests, eventId); },
    createEvent: function (calendarId, plan) {
      store.created += 1;
      const id = 'evt-' + store.created;
      store.guests[id] = [];
      store.bodies[id] = { summary: plan.title, description: plan.description };
      return id;
    },
    listGuests: function (calendarId, eventId) {
      return (store.guests[eventId] || []).map(function (email) { return { email: email }; });
    },
    setGuests: function (calendarId, eventId, attendees) {
      store.patches.push({ eventId: eventId, attendees: attendees, sendUpdates: 'all' });
      store.guests[eventId] = attendees.map(function (guest) { return guest.email; });
    },
    updateDescription: function () {},
    getEvent: function (calendarId, eventId) { return store.bodies[eventId]; },
    patchQuiet: function (calendarId, eventId, plan) {
      store.quietPatches.push({ eventId: eventId, sendUpdates: 'none', summary: plan.title, description: plan.description });
      store.bodies[eventId] = { summary: plan.title, description: plan.description };
    }
  };
}

function depsFor(signups, client) {
  const logs = [];
  return {
    logs: logs,
    readState: function () { return { slots: aba.abaCatalogSlots_(), signups: signups }; },
    today: function () { return TODAY; },
    client: client,
    getEvent: client.getEvent,
    patchQuiet: client.patchQuiet,
    log: function (message) { logs.push(message); },
    sendMail: function (message) { client.store.mails.push(message); }
  };
}

test('refreshInviteDescriptions rewrites future events quietly and skips the rest', () => {
  const future = slot('2026-12-09', 'Set-Up');
  const past = slot('2026-11-17', 'Photographer');
  const client = fakeClient();
  client.store.events['live'] = 'evt-live@google.com';
  client.store.guests['evt-live'] = ['ada@example.com'];
  client.store.bodies['evt-live'] = { summary: 'Old title', description: 'Cancel this sign-up only' };
  client.store.events['gone'] = 'evt-gone';
  const rows = [
    { signupId: 'live', name: 'Ada Volunteer', email: 'ada@example.com', status: 'active', token: 't'.repeat(32), slotId: future.slotId, date: future.date, event: future.event, task: future.task },
    { signupId: 'none', name: 'No Event', email: 'none@example.com', status: 'active', token: 'n'.repeat(32), slotId: future.slotId, date: future.date, event: future.event, task: future.task },
    { signupId: 'gone', name: 'Missing Event', email: 'gone@example.com', status: 'active', token: 'g'.repeat(32), slotId: future.slotId, date: future.date, event: future.event, task: future.task },
    { signupId: 'old', name: 'Past Person', email: 'past@example.com', status: 'active', token: 'p'.repeat(32), slotId: past.slotId, date: past.date, event: past.event, task: past.task },
    { signupId: 'off', name: 'Cancelled', email: 'off@example.com', status: 'cancelled', token: 'c'.repeat(32), slotId: future.slotId }
  ];
  client.store.events['old'] = 'evt-old';
  client.store.guests['evt-old'] = ['past@example.com'];
  client.store.bodies['evt-old'] = { summary: 'Old', description: 'Old' };
  const deps = depsFor(rows, client);
  const preview = aba.refreshInviteDescriptions(true, deps);
  assert.match(preview, /dry run: would update 1/);
  assert.match(preview, /Nothing was written/);
  assert.equal(client.store.quietPatches.length, 0);
  const done = aba.refreshInviteDescriptions(false, deps);
  assert.match(done, /updated 1/);
  assert.match(done, /Guests were not notified/);
  assert.equal(client.store.quietPatches.length, 1);
  assert.equal(client.store.quietPatches[0].sendUpdates, 'none');
  assert.match(client.store.quietPatches[0].description, /Change my spot/);
  assert.match(client.store.quietPatches[0].description, /Cancel my sign-up/);
  assert.equal(client.store.patches.length, 0);
  assert.match(deps.logs.join('\n'), /missing event for gone/);
  const again = aba.refreshInviteDescriptions(false, deps);
  assert.match(again, /updated 0/);
  assert.match(again, /already current: 1/);
  assert.equal(client.store.quietPatches.length, 1);
});

test('sendMissingInvites creates one future invite and leaves existing events alone', () => {
  const future = slot('2026-12-09', 'Set-Up');
  const past = slot('2026-11-17', 'Photographer');
  const client = fakeClient();
  client.store.events['has'] = 'evt-has@google.com';
  client.store.guests['evt-has'] = ['has@example.com'];
  const rows = [
    { signupId: 'new', name: 'New Person', email: 'new@example.com', status: 'active', token: 'n'.repeat(32), slotId: future.slotId, date: future.date, event: future.event, task: future.task },
    { signupId: 'has', name: 'Already', email: 'has@example.com', status: 'active', token: 'h'.repeat(32), slotId: future.slotId, date: future.date, event: future.event, task: future.task },
    { signupId: 'blank', name: 'Kevin Snyder', email: '', status: 'active', token: 'b'.repeat(32), slotId: future.slotId, date: future.date, event: future.event, task: future.task },
    { signupId: 'past', name: 'Past', email: 'past@example.com', status: 'active', token: 'p'.repeat(32), slotId: past.slotId, date: past.date, event: past.event, task: past.task }
  ];
  const deps = depsFor(rows, client);
  const preview = aba.sendMissingInvites(true, false, deps);
  assert.match(preview, /would invite 1/);
  assert.match(preview, /Nothing was created/);
  assert.match(deps.logs.join('\n'), /New Person <new@example.com>/);
  assert.equal(client.store.created, 0);
  const done = aba.sendMissingInvites(false, false, deps);
  assert.match(done, /created 1/);
  assert.match(done, /confirmation emails 0/);
  assert.equal(client.store.created, 1);
  assert.equal(client.store.events['new'], 'evt-1');
  assert.equal(client.store.patches.length, 1);
  assert.equal(client.store.patches[0].sendUpdates, 'all');
  assert.equal(client.store.patches[0].attendees[0].email, 'new@example.com');
  assert.equal(client.store.mails.length, 0);
  assert.equal(client.store.events['has'], 'evt-has@google.com');
  const second = aba.sendMissingInvites(false, false, deps);
  assert.match(second, /created 0/);
  assert.match(second, /already invited: 2/);
  assert.equal(client.store.created, 1);
  const mailed = aba.sendMissingInvites(false, true, deps);
  assert.match(mailed, /created 0/);
  assert.equal(client.store.mails.length, 0);
  const only = fakeClient();
  const letter = depsFor([rows[0]], only);
  const sent = aba.sendMissingInvites(false, true, letter);
  assert.match(sent, /created 1/);
  assert.match(sent, /confirmation emails 1/);
  assert.equal(only.store.mails.length, 1);
  assert.match(only.store.mails[0].html, />Change my spot</);
  assert.match(only.store.mails[0].html, />Cancel my sign-up</);
  assert.match(only.store.mails[0].html, /padding:0 0 12px 0/);
});

test('a CalendarApp id and a signupId property both count as the existing invite', () => {
  const future = slot('2026-12-09', 'Set-Up');
  const client = fakeClient();
  client.store.guests['evt-tagged'] = ['tagged@example.com'];
  client.store.bodies['evt-tagged'] = { summary: 'Old', description: 'Old' };
  client.findBySignupId = function () { return 'evt-tagged@google.com'; };
  const row = {
    signupId: 'tagged',
    name: 'Tagged',
    email: 'tagged@example.com',
    status: 'active',
    token: 't'.repeat(32),
    slotId: future.slotId,
    date: future.date,
    event: future.event,
    task: future.task
  };
  const deps = depsFor([row], client);
  const preview = aba.refreshInviteDescriptions(true, deps);
  assert.match(preview, /would update 1/);
  assert.match(preview, /no event: 0/);
  const invites = aba.sendMissingInvites(true, false, deps);
  assert.match(invites, /would invite 0/);
  assert.match(invites, /already invited: 1/);
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../apps-script/RefreshInvites.gs'), 'utf8');
  assert.match(source, /function refreshInviteDescriptionsDryRun\(\)/);
  assert.match(source, /function sendMissingInvitesDryRun\(\)/);
});
