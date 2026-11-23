/**
 * One shared calendar, "ABA Hospitality", owned by the account that deploys
 * the script. Each role slot is one event. Signing up adds the volunteer as a
 * guest and sends the calendar invite. Cancelling removes that guest.
 * A calendar failure must not block the sheet or the confirmation email.
 */

var ABA_CALENDAR_NAME = 'ABA Hospitality';
var ABA_CALENDAR_ID_KEY = 'ABA_HOSPITALITY_CALENDAR_ID';
var ABA_CALENDAR_EVENTS_KEY = 'ABA_HOSPITALITY_EVENTS';

function wallDate_(iso, hour, minute) {
  var parts = String(iso || '').split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), hour || 0, minute || 0, 0);
}

function planCalendarEvent_(slot) {
  var task = slot && slot.task ? String(slot.task) : 'Hospitality';
  var eventName = slot && slot.event ? String(slot.event) : 'Event';
  var place = signupPlace_(slot || {});
  var location = fullPlace_(place.venue, place.address) || (slot && slot.location) || '';
  var description = task + ' for ' + eventName + '.\n\nSign-up sheet: ' + ABA_SITE_URL;
  var plan = {
    slotId: slot && slot.slotId ? String(slot.slotId) : '',
    title: 'ABA Hospitality: ' + task + ' – ' + eventName,
    location: location,
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
    eventId: function (slotId) {
      return readCalendarEventMap_(PropertiesService.getScriptProperties())[slotId] || '';
    },
    saveEventId: function (slotId, eventId) {
      var props = PropertiesService.getScriptProperties();
      var map = readCalendarEventMap_(props);
      map[slotId] = eventId;
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
    }
  };
}

function syncCalendarGuests_(changes, client) {
  var api = client || calendarClient_();
  var calendarId = api.getCalendarId();
  var allOk = true;
  (changes || []).forEach(function (change) {
    try {
      var email = String(change && change.email || '').trim().toLowerCase();
      var plan = planCalendarEvent_(change && change.slot);
      if (!email || !plan.slotId) {
        allOk = false;
        return;
      }
      var eventId = api.eventId(plan.slotId);
      if (!eventId || !api.eventExists(calendarId, eventId)) {
        eventId = api.createEvent(calendarId, plan);
        api.saveEventId(plan.slotId, eventId);
      }
      var guests = api.listGuests(calendarId, eventId) || [];
      var next = [];
      var found = false;
      guests.forEach(function (guest) {
        var addr = String(guest && guest.email || '').trim().toLowerCase();
        if (!addr) return;
        if (addr === email) {
          found = true;
          if (change.action === 'remove') return;
        }
        next.push({ email: guest.email });
      });
      if (change.action === 'add') {
        if (found) return;
        next.push({ email: email });
      } else if (!found) {
        return;
      }
      api.setGuests(calendarId, eventId, next);
    } catch (err) {
      allOk = false;
      try { Logger.log('Calendar guest update failed: ' + err); } catch (ignore) {}
    }
  });
  return allOk;
}

/**
 * Invites people who are already signed up. Does not run on its own.
 * Safe to run again: someone already on the event is not invited twice.
 */
function backfillCalendarInvites() {
  var state = readState_();
  var changes = [];
  (state.signups || []).forEach(function (row) {
    if (!ABA_RULES.isActive(row) || !row.email) return;
    var slot = findSlotLocal_(state.slots, row.slotId) || slotForRow_(state, row);
    changes.push({ action: 'add', email: row.email, slot: slot });
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
