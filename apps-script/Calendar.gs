/**
 * One shared calendar, "ABA Hospitality", owned by the account that deploys
 * the script. Each sign-up is its own event, with that volunteer as the only
 * guest. Cancelling deletes that event. A calendar failure must not block the
 * sheet or the confirmation email.
 */

var ABA_CALENDAR_NAME = 'ABA Hospitality';
var ABA_CALENDAR_ID_KEY = 'ABA_HOSPITALITY_CALENDAR_ID';
var ABA_CALENDAR_EVENTS_KEY = 'ABA_HOSPITALITY_EVENTS';

function wallDate_(iso, hour, minute) {
  var parts = String(iso || '').split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), hour || 0, minute || 0, 0);
}

function planCalendarEvent_(slot, signup) {
  var task = slot && slot.task ? String(slot.task) : 'Hospitality';
  var eventName = slot && slot.event ? String(slot.event) : 'Event';
  var place = signupPlace_(slot || {});
  var venue = place.venue || '';
  var address = place.address || '';
  var location = fullPlace_(venue, address) || (slot && slot.location) || '';
  var cancel = signup && signup.token ? cancelUrl_(signup.token) : '';
  var description = task + ' for ' + eventName + '.\n\n' +
    'Venue: ' + venue + '\n' +
    'Address: ' + address + '\n\n' +
    'Sign-up sheet: ' + ABA_SITE_URL +
    (cancel ? '\n\nCancel this sign-up: ' + cancel : '');
  var plan = {
    slotId: slot && slot.slotId ? String(slot.slotId) : '',
    signupId: signup && signup.signupId ? String(signup.signupId) : '',
    title: 'ABA Hospitality: ' + task + ' - ' + eventName,
    location: location,
    venue: venue,
    address: address,
    description: description,
    allDay: false
  };
  var startText = (slot && (slot.roleStart || slot.startTime)) || '';
  var endText = (slot && (slot.roleEnd || slot.endTime)) || '';
  var roleStart = startText ? parseClock_(startText) : null;
  var roleEnd = endText ? parseClock_(endText) : null;
  var dateKey = (slot && (slot.roleDate || slot.date)) || '';
  if (roleStart && roleEnd && dateKey) {
    var endDate = dateKey;
    if (roleEnd.hour * 60 + roleEnd.minute <= roleStart.hour * 60 + roleStart.minute) endDate = addDays_(dateKey, 1);
    plan.start = wallDate_(dateKey, roleStart.hour, roleStart.minute);
    plan.end = wallDate_(endDate, roleEnd.hour, roleEnd.minute);
    return plan;
  }
  var when = slot && slot.time ? parseClock_(slot.time) : null;
  if (when && slot.date) {
    var plus = addMinutes_(slot.date, when.hour, when.minute, ABA_EVENT_MINUTES);
    plan.start = wallDate_(slot.date, when.hour, when.minute);
    plan.end = wallDate_(plus.date, plus.hour, plus.minute);
    return plan;
  }
  plan.allDay = true;
  plan.start = wallDate_(slot && slot.date, 0, 0);
  plan.end = wallDate_(slot && slot.date ? addDays_(slot.date, 1) : slot && slot.date, 0, 0);
  return plan;
}

function readCalendarEventMap_(props) {
  try {
    var raw = props.getProperty(ABA_CALENDAR_EVENTS_KEY);
    var parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

function calendarClient_() {
  return {
    getCalendarId: function () {
      var props = PropertiesService.getScriptProperties();
      var id = props.getProperty(ABA_CALENDAR_ID_KEY);
      if (id) {
        var saved = CalendarApp.getCalendarById(id);
        if (saved) return id;
      }
      var named = CalendarApp.getCalendarsByName(ABA_CALENDAR_NAME);
      var calendar = named && named.length ? named[0] : CalendarApp.createCalendar(ABA_CALENDAR_NAME);
      id = calendar.getId();
      props.setProperty(ABA_CALENDAR_ID_KEY, id);
      return id;
    },
    eventId: function (signupId) {
      if (!signupId) return '';
      return PropertiesService.getScriptProperties().getProperty(calendarSignupKey_(signupId)) || '';
    },
    saveEventId: function (signupId, eventId) {
      if (!signupId) return;
      PropertiesService.getScriptProperties().setProperty(calendarSignupKey_(signupId), eventId);
    },
    clearEventId: function (signupId) {
      if (!signupId) return;
      PropertiesService.getScriptProperties().deleteProperty(calendarSignupKey_(signupId));
    },
    sharedEventMap: function () {
      return readCalendarEventMap_(PropertiesService.getScriptProperties());
    },
    clearSharedEvent: function (slotId) {
      var props = PropertiesService.getScriptProperties();
      var map = readCalendarEventMap_(props);
      delete map[slotId];
      props.setProperty(ABA_CALENDAR_EVENTS_KEY, JSON.stringify(map));
    },
    eventExists: function (calendarId, eventId) {
      try {
        Calendar.Events.get(calendarId, eventId);
        return true;
      } catch (err) {
        return false;
      }
    },
    createEvent: function (calendarId, plan) {
      var calendar = CalendarApp.getCalendarById(calendarId);
      var created = plan.allDay
        ? calendar.createAllDayEvent(plan.title, plan.start, plan.end, { location: plan.location, description: plan.description })
        : calendar.createEvent(plan.title, plan.start, plan.end, { location: plan.location, description: plan.description });
      return created.getId();
    },
    listGuests: function (calendarId, eventId) {
      var event = Calendar.Events.get(calendarId, eventId);
      return event.attendees || [];
    },
    setGuests: function (calendarId, eventId, attendees) {
      Calendar.Events.patch({ attendees: attendees }, calendarId, eventId, { sendUpdates: 'all' });
    },
    setGuestsQuiet: function (calendarId, eventId, attendees) {
      Calendar.Events.patch({ attendees: attendees }, calendarId, eventId, { sendUpdates: 'none' });
    },
    deleteEvent: function (calendarId, eventId) {
      Calendar.Events.remove(calendarId, eventId, { sendUpdates: 'all' });
    },
    deleteEventQuiet: function (calendarId, eventId) {
      Calendar.Events.remove(calendarId, eventId, { sendUpdates: 'none' });
    },
    updateDescription: function (calendarId, eventId, description) {
      Calendar.Events.patch({ description: description }, calendarId, eventId, { sendUpdates: 'none' });
    }
  };
}

function calendarSignupKey_(signupId) {
  return 'ABA_CAL_SIGNUP_' + String(signupId || '');
}

function guestAddress_(guest) {
  return String(guest && guest.email || '').trim().toLowerCase();
}

function syncCalendarGuests_(changes, client) {
  var api = client || calendarClient_();
  var calendarId = api.getCalendarId();
  var allOk = true;
  (changes || []).forEach(function (change) {
    try {
      if (!applyPersonCalendar_(api, calendarId, change)) allOk = false;
    } catch (err) {
      allOk = false;
      try { Logger.log('Calendar guest update failed: ' + err); } catch (ignore) {}
    }
  });
  return allOk;
}

function applyPersonCalendar_(api, calendarId, change) {
  var email = String(change && change.email || '').trim().toLowerCase();
  var signupId = String(change && (change.signupId || (change.slot && change.slot.signupId)) || '').trim();
  if (change && change.action === 'remove') {
    if (!signupId) return false;
    return deletePersonEvent_(api, calendarId, signupId);
  }
  if (!email || !signupId) return false;
  var plan = planCalendarEvent_(change.slot, {
    signupId: signupId,
    token: change.token || ''
  });
  var eventId = api.eventId(signupId);
  var exists = eventId && api.eventExists(calendarId, eventId);
  if (!exists) {
    eventId = api.createEvent(calendarId, plan);
    api.saveEventId(signupId, eventId);
    api.setGuests(calendarId, eventId, [{ email: email }]);
    return true;
  }
  var guests = api.listGuests(calendarId, eventId) || [];
  var found = false;
  guests.forEach(function (guest) {
    if (guest && (guest.organizer || guest.self)) return;
    if (guestAddress_(guest) === email) found = true;
  });
  if (!found) api.setGuests(calendarId, eventId, [{ email: email }]);
  try {
    if (api.updateDescription) api.updateDescription(calendarId, eventId, plan.description);
  } catch (describeErr) {
    try { Logger.log('Calendar description update failed: ' + describeErr); } catch (ignoreDescribe) {}
  }
  return true;
}

function deletePersonEvent_(api, calendarId, signupId) {
  var eventId = api.eventId(signupId);
  if (!eventId) return true;
  if (api.eventExists(calendarId, eventId)) api.deleteEvent(calendarId, eventId);
  if (api.clearEventId) api.clearEventId(signupId);
  return true;
}

function personChange_(row, slot, action) {
  return {
    action: action,
    email: row.email,
    signupId: row.signupId,
    token: row.token,
    slot: slot
  };
}

/**
 * Gives each active sign-up its own calendar event. Does not run on its own.
 * Safe to run again: an event that already has this guest is not invited twice.
 * Does not remove anyone from the older shared events. Use
 * migrateSharedEventsToPerPerson for that.
 */
function backfillCalendarInvites() {
  var state = readState_();
  var changes = [];
  (state.signups || []).forEach(function (row) {
    if (!ABA_RULES.isActive(row) || !row.email || !row.signupId) return;
    var slot = findSlotLocal_(state.slots, row.slotId) || slotForRow_(state, row);
    changes.push(personChange_(row, slot, 'add'));
  });
  var ok = false;
  try {
    ok = syncCalendarGuests_(changes);
  } catch (err) {
    try { Logger.log('backfillCalendarInvites failed: ' + err); } catch (ignore) {}
  }
  var summary = 'backfillCalendarInvites processed ' + changes.length +
    ' active sign-ups with an email. ' +
    (ok ? 'Calendar updates finished.' : 'Some calendar updates failed. Check the log.');
  Logger.log(summary);
  return summary;
}

/**
 * Moves guests off the shared per-slot events created before each sign-up
 * had its own event. Sends the new invite. Removes them from the shared
 * event without a cancellation notice, then deletes a shared event that has
 * no guests left. Does not run on its own. Safe to run again.
 */
function migrateSharedEventsToPerPerson(client, state) {
  var api = client || calendarClient_();
  var snapshot = state || readState_();
  var calendarId = api.getCalendarId();
  var shared = api.sharedEventMap ? api.sharedEventMap() : {};
  var ensured = 0;
  var removed = 0;
  var deleted = 0;
  var failed = 0;
  (snapshot.signups || []).forEach(function (row) {
    if (!ABA_RULES.isActive(row) || !row.email || !row.signupId) return;
    var slot = findSlotLocal_(snapshot.slots, row.slotId) || slotForRow_(snapshot, row);
    var sharedId = shared[row.slotId] || shared[slot && slot.slotId] || '';
    if (!sharedId || !api.eventExists(calendarId, sharedId)) return;
    var guests = api.listGuests(calendarId, sharedId) || [];
    var isGuest = guests.some(function (guest) {
      return guestAddress_(guest) === String(row.email).trim().toLowerCase();
    });
    if (!isGuest) return;
    try {
      var added = applyPersonCalendar_(api, calendarId, personChange_(row, slot, 'add'));
      if (!added) {
        failed += 1;
        return;
      }
      ensured += 1;
      var remaining = [];
      (api.listGuests(calendarId, sharedId) || []).forEach(function (guest) {
        if (guestAddress_(guest) === String(row.email).trim().toLowerCase()) return;
        if (guest && guest.email) remaining.push({ email: guest.email });
      });
      api.setGuestsQuiet(calendarId, sharedId, remaining);
      removed += 1;
    } catch (err) {
      failed += 1;
      try { Logger.log('migrateSharedEventsToPerPerson failed for ' + row.signupId + ': ' + err); } catch (ignore) {}
    }
  });
  Object.keys(shared).forEach(function (slotId) {
    var eventId = shared[slotId];
    try {
      if (!eventId || !api.eventExists(calendarId, eventId)) {
        if (api.clearSharedEvent) api.clearSharedEvent(slotId);
        return;
      }
      var left = (api.listGuests(calendarId, eventId) || []).filter(function (guest) {
        return guest && guest.email && !guest.organizer && !guest.self;
      });
      if (!left.length) {
        api.deleteEventQuiet(calendarId, eventId);
        if (api.clearSharedEvent) api.clearSharedEvent(slotId);
        deleted += 1;
      }
    } catch (err) {
      failed += 1;
      try { Logger.log('Could not delete shared event ' + eventId + ': ' + err); } catch (ignoreDelete) {}
    }
  });
  var summary = 'migrateSharedEventsToPerPerson ensured ' + ensured +
    ' personal events, removed ' + removed + ' guests from shared events, and deleted ' +
    deleted + ' empty shared events. Failures: ' + failed + '.';
  try { Logger.log(summary); } catch (ignoreLog) {}
  return summary;
}

/**
 * Run once from the editor to approve Calendar access.
 * Gets or creates the ABA Hospitality calendar and reads it.
 * Does not invite anyone or change any event.
 */
function authorizeCalendar() {
  var id = calendarClient_().getCalendarId();
  var calendar = Calendar.Calendars.get(id);
  var calendarId = calendar && calendar.id ? calendar.id : id;
  Logger.log('ABA Hospitality calendar ID: ' + calendarId);
  return calendarId;
}
