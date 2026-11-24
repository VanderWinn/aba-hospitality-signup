const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadAba, stateFromSeed, memoryDeps } = require('./load-aba');

const aba = loadAba();

function claim(extra) {
  return Object.assign({
    name: 'Ada Volunteer',
    email: 'ada.volunteer@example.com',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Set-Up',
    company: ''
  }, extra || {});
}

function fakeCalendar() {
  const store = { events: {}, guests: {}, created: 0, patches: [], quiet: [], deleted: [], plans: [], shared: {} };
  return {
    store,
    getCalendarId() { return 'cal-aba'; },
    eventId(signupId) { return store.events[signupId] || ''; },
    saveEventId(signupId, id) { store.events[signupId] = id; },
    clearEventId(signupId) { delete store.events[signupId]; },
    sharedEventMap() { return store.shared; },
    clearSharedEvent(slotId) { delete store.shared[slotId]; },
    eventExists(calendarId, eventId) { return Object.prototype.hasOwnProperty.call(store.guests, eventId); },
    createEvent(calendarId, plan) {
      store.created += 1;
      store.plans.push(plan);
      const id = 'evt-' + store.created;
      store.guests[id] = [];
      return id;
    },
    listGuests(calendarId, eventId) {
      return (store.guests[eventId] || []).map((email) => ({ email: email }));
    },
    setGuests(calendarId, eventId, attendees) {
      store.patches.push({ eventId: eventId, attendees: attendees });
      store.guests[eventId] = attendees.map((guest) => guest.email);
    },
    setGuestsQuiet(calendarId, eventId, attendees) {
      store.quiet.push({ eventId: eventId, attendees: attendees });
      store.guests[eventId] = attendees.map((guest) => guest.email);
    },
    deleteEvent(calendarId, eventId) {
      store.deleted.push({ eventId: eventId, notify: true });
      delete store.guests[eventId];
    },
    deleteEventQuiet(calendarId, eventId) {
      store.deleted.push({ eventId: eventId, notify: false });
      delete store.guests[eventId];
    }
  };
}

test('authorizeCalendar only gets or creates the calendar and reads it', () => {
  const source = fs.readFileSync(path.join(__dirname, '../apps-script/Calendar.gs'), 'utf8');
  const fn = source.slice(source.indexOf('function authorizeCalendar'));
  assert.match(fn, /getCalendarId\(\)/);
  assert.match(fn, /Calendar\.Calendars\.get\(id\)/);
  assert.equal(fn.includes('setGuests'), false);
  assert.equal(fn.includes('addGuest'), false);
  assert.equal(fn.includes('createEvent'), false);
  assert.equal(fn.includes('syncCalendarGuests_'), false);
  assert.equal(fn.includes('backfillCalendarInvites'), false);
});

test('a slot becomes one calendar event and a signup adds the guest once', () => {
  const slot = aba.abaCatalogSlots_().find((item) => item.date === '2026-12-09' && item.task === 'Set-Up');
  const plan = aba.planCalendarEvent_(slot, { signupId: 'signup-1', token: 't'.repeat(32) });
  assert.equal(plan.title, 'ABA Hospitality: Set-Up - Happy Hour');
  assert.equal(plan.location, 'Ada Hotel, 7415 River St SE, Ada');
  assert.match(plan.description, /Venue: Ada Hotel/);
  assert.match(plan.description, /Address: 7415 River St SE, Ada/);
  assert.match(plan.description, /Sign-up sheet: https:\/\/vanderwinn\.github\.io\/aba-hospitality-signup\//);
  assert.match(plan.description, /Cancel this sign-up: https:\/\/vanderwinn\.github\.io\/aba-hospitality-signup\/\?cancel=/);
  assert.equal(plan.description.includes('ada.volunteer@example.com'), false);
  assert.equal(plan.start.getHours(), 16);
  assert.equal(plan.end.getHours(), 16);
  assert.equal(plan.end.getMinutes(), 30);
  const client = fakeCalendar();
  const email = 'ada.volunteer@example.com';
  const add = { action: 'add', email: email, signupId: 'signup-1', token: 't'.repeat(32), slot: slot };
  assert.equal(aba.syncCalendarGuests_([add], client), true);
  assert.equal(client.store.created, 1);
  assert.equal(client.store.patches.length, 1);
  assert.equal(JSON.stringify(client.store.patches[0].attendees), JSON.stringify([{ email: email }]));
  assert.equal(aba.syncCalendarGuests_([Object.assign({}, add, { email: 'Ada.Volunteer@Example.com' })], client), true);
  assert.equal(client.store.created, 1);
  assert.equal(client.store.patches.length, 1);
  assert.equal(aba.syncCalendarGuests_([{ action: 'remove', email: email, signupId: 'signup-1', slot: slot }], client), true);
  assert.equal(client.store.deleted.length, 1);
  assert.equal(client.store.deleted[0].notify, true);
  assert.equal(client.store.events['signup-1'], undefined);
});

function freshState() {
  const state = stateFromSeed(aba);
  state.slots = aba.abaCatalogSlots_();
  state.signups = [];
  return state;
}

test('a calendar failure still saves the sign-up and keeps the ics file', () => {
  const state = freshState();
  const deps = memoryDeps(aba, state);
  deps.calendarGuest = function () { throw new Error('calendar down'); };
  const saved = aba.processPost_(claim(), deps);
  assert.equal(saved.ok, true);
  assert.equal(deps.mails.length, 1);
  assert.match(deps.mails[0].ics, /METHOD:REQUEST/);
  assert.match(deps.mails[0].text, /Add to Apple Calendar/);
});

test('a successful calendar invite omits the ics attachment and a move transfers the guest', () => {
  const state = freshState();
  const deps = memoryDeps(aba, state);
  const seen = [];
  deps.calendarGuest = function (changes) {
    seen.push(changes.map((change) => change.action + ' ' + change.slot.task));
    return true;
  };
  const saved = aba.processPost_(claim(), deps);
  assert.equal(saved.ok, true);
  assert.equal(deps.mails[0].ics, '');
  assert.match(deps.mails[0].html, /Add to Google Calendar/);
  assert.equal(JSON.stringify(seen[0]), JSON.stringify(['add Set-Up']));
  const row = state.signups.find((item) => item.email === 'ada.volunteer@example.com');
  const moved = aba.moveSignup_({
    token: row.token,
    signupId: row.signupId,
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Clean-Up'
  }, deps);
  assert.equal(moved.ok, true);
  assert.equal(JSON.stringify(seen[1]), JSON.stringify(['remove Set-Up', 'add Clean-Up']));
  const cancelled = aba.cancelSignup_({ token: row.token }, deps);
  assert.equal(cancelled.ok, true);
  assert.equal(JSON.stringify(seen[2]), JSON.stringify(['remove Clean-Up']));
});

test('migrateSharedEventsToPerPerson gives each guest their own event and drops the empty shared event quietly', () => {
  const slot = aba.abaCatalogSlots_().find((item) => item.date === '2026-12-09' && item.task === 'Set-Up');
  const client = fakeCalendar();
  client.store.shared[slot.slotId] = 'shared-1';
  client.store.guests['shared-1'] = ['ada.volunteer@example.com'];
  const state = {
    slots: aba.abaCatalogSlots_(),
    signups: [{
      signupId: 'signup-1',
      slotId: slot.slotId,
      email: 'ada.volunteer@example.com',
      token: 't'.repeat(32),
      status: 'active',
      task: 'Set-Up',
      event: 'Happy Hour'
    }]
  };
  const summary = aba.migrateSharedEventsToPerPerson(client, state);
  assert.match(summary, /ensured 1/);
  assert.match(summary, /removed 1/);
  assert.match(summary, /deleted 1/);
  assert.equal(client.store.created, 1);
  assert.equal(client.store.patches.length, 1);
  assert.equal(client.store.quiet.length, 1);
  assert.equal(JSON.stringify(client.store.quiet[0].attendees), '[]');
  assert.equal(client.store.deleted.length, 1);
  assert.equal(client.store.deleted[0].notify, false);
  assert.equal(client.store.shared[slot.slotId], undefined);
  const again = aba.migrateSharedEventsToPerPerson(client, state);
  assert.match(again, /ensured 0/);
  assert.equal(client.store.created, 1);
});
