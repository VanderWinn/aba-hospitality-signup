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
  const store = { events: {}, guests: {}, created: 0, patches: [], plans: [] };
  return {
    store,
    getCalendarId() { return 'cal-aba'; },
    eventId(slotId) { return store.events[slotId] || ''; },
    saveEventId(slotId, id) { store.events[slotId] = id; },
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
  const plan = aba.planCalendarEvent_(slot);
  assert.equal(plan.title, 'ABA Hospitality: Set-Up – Happy Hour');
  assert.equal(plan.location, 'Ada Hotel, 7415 River St SE, Ada');
  assert.match(plan.description, /vanderwinn\.github\.io\/aba-hospitality-signup/);
  assert.equal(plan.description.includes('@'), false);
  assert.equal(plan.start.getHours(), 16);
  assert.equal(plan.end.getHours(), 16);
  assert.equal(plan.end.getMinutes(), 30);
  const client = fakeCalendar();
  const email = 'ada.volunteer@example.com';
  assert.equal(aba.syncCalendarGuests_([{ action: 'add', email: email, slot: slot }], client), true);
  assert.equal(client.store.created, 1);
  assert.equal(client.store.patches.length, 1);
  assert.equal(JSON.stringify(client.store.patches[0].attendees), JSON.stringify([{ email: email }]));
  assert.equal(aba.syncCalendarGuests_([{ action: 'add', email: 'Ada.Volunteer@Example.com', slot: slot }], client), true);
  assert.equal(client.store.created, 1);
  assert.equal(client.store.patches.length, 1);
  assert.equal(aba.syncCalendarGuests_([{ action: 'remove', email: email, slot: slot }], client), true);
  assert.equal(JSON.stringify(client.store.patches[1].attendees), '[]');
  assert.equal(client.store.events[slot.slotId], 'evt-1');
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
