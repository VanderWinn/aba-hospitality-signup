/**
 * One-time editor tools for calendar invites. They do not run on their own.
 * Run them from the script editor after this file is saved. A web-app
 * redeploy is not required.
 *
 * refreshInviteDescriptions(dryRun)
 *   Rewrites title, description, location, and time on existing per-person
 *   events so they show separate Change my spot and Cancel my sign-up links.
 *   Guests are not notified. Past rows, rows with no stored event, and
 *   missing events are skipped.
 *
 * sendMissingInvites(dryRun, sendConfirmation)
 *   Creates a personal invite for each active future row that has an email
 *   and does not already have an event. Google sends that invite.
 *   sendConfirmation defaults to false. Leave it false: the calendar invite
 *   is the notice. Pass true only to also send the confirmation email.
 *   This is not backfillCalendarInvites. That older function also rewrites
 *   events that already exist, includes past dates, and does not send the
 *   confirmation email.
 */

function inviteFlag_(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

function inviteToday_() {
  return ABA_RULES.todayKeyIn(new Date(), ABA_CALENDAR_TZ);
}

function inviteSlot_(state, row) {
  return findSlotLocal_(state.slots, row.slotId) || slotForRow_(state, row);
}

function inviteWhen_(slot) {
  return String((slot && (slot.roleDate || slot.date)) || '');
}

function invitePlan_(row, slot) {
  return planCalendarEvent_(slot, { signupId: row.signupId, token: row.token });
}

function locatePersonEvent_(api, calendarId, signupId) {
  var stored = String(api.eventId(signupId) || '');
  var bare = calendarApiEventId_(stored);
  if (bare && api.eventExists(calendarId, bare)) return { id: bare, missing: false };
  if (stored && stored !== bare && api.eventExists(calendarId, stored)) {
    return { id: bare || stored, missing: false };
  }
  if (api.findBySignupId) {
    var found = String(api.findBySignupId(calendarId, signupId) || '');
    var foundId = calendarApiEventId_(found) || found;
    if (foundId && api.eventExists(calendarId, foundId)) return { id: foundId, missing: false };
  }
  return { id: '', missing: !!stored };
}

function quietEventPatch_(calendarId, eventId, plan) {
  var zone = Session.getScriptTimeZone();
  var body = {
    summary: plan.title,
    description: plan.description,
    location: plan.location || ''
  };
  if (plan.allDay) {
    body.start = { date: Utilities.formatDate(plan.start, zone, 'yyyy-MM-dd') };
    body.end = { date: Utilities.formatDate(plan.end, zone, 'yyyy-MM-dd') };
  } else {
    body.start = {
      dateTime: Utilities.formatDate(plan.start, zone, "yyyy-MM-dd'T'HH:mm:ss"),
      timeZone: zone
    };
    body.end = {
      dateTime: Utilities.formatDate(plan.end, zone, "yyyy-MM-dd'T'HH:mm:ss"),
      timeZone: zone
    };
  }
  if (plan.signupId) body.extendedProperties = { private: { signupId: String(plan.signupId) } };
  Calendar.Events.patch(body, calendarId, calendarApiEventId_(eventId), { sendUpdates: 'none' });
}

function refreshInviteDescriptionsDryRun() {
  return refreshInviteDescriptions(true);
}

function sendMissingInvitesDryRun() {
  return sendMissingInvites(true);
}

function refreshInviteDeps_() {
  var api = calendarClient_();
  return {
    readState: readState_,
    today: inviteToday_,
    client: api,
    log: function (message) { Logger.log(message); },
    getEvent: function (calendarId, eventId) {
      var event = Calendar.Events.get(calendarId, calendarApiEventId_(eventId));
      return { summary: event.summary || '', description: event.description || '' };
    },
    patchQuiet: quietEventPatch_
  };
}

function sendMissingDeps_() {
  return {
    readState: readState_,
    today: inviteToday_,
    client: calendarClient_(),
    log: function (message) { Logger.log(message); },
    sendMail: sendMailApp_
  };
}

function refreshInviteDescriptions(dryRun, deps) {
  deps = deps || refreshInviteDeps_();
  var preview = inviteFlag_(dryRun);
  var state = deps.readState();
  var api = deps.client;
  var calendarId = api.getCalendarId();
  var today = deps.today();
  var updated = 0;
  var skipped = { noEvent: 0, missing: 0, past: 0, current: 0, noId: 0 };
  (state.signups || []).forEach(function (row) {
    if (!ABA_RULES.isActive(row)) return;
    if (!row.signupId) {
      skipped.noId += 1;
      return;
    }
    var slot = inviteSlot_(state, row);
    if (inviteWhen_(slot) < today) {
      skipped.past += 1;
      return;
    }
    var located = locatePersonEvent_(api, calendarId, row.signupId);
    var eventId = located.id;
    if (!eventId) {
      if (located.missing) {
        skipped.missing += 1;
        deps.log('refreshInviteDescriptions missing event for ' + row.signupId + ' ' + (row.name || '') + ' ' + inviteWhen_(slot) + ' ' + (slot.task || ''));
      } else {
        skipped.noEvent += 1;
      }
      return;
    }
    var plan = invitePlan_(row, slot);
    var current = deps.getEvent(calendarId, eventId);
    if (current && current.summary === plan.title && current.description === plan.description) {
      skipped.current += 1;
      return;
    }
    var line = (preview ? 'would update ' : 'updated ') + row.signupId + ' ' + (row.name || '') + ' ' + (slot.task || '') + ' ' + inviteWhen_(slot);
    deps.log('refreshInviteDescriptions ' + line);
    if (!preview) deps.patchQuiet(calendarId, eventId, plan);
    updated += 1;
  });
  var skippedTotal = skipped.noEvent + skipped.missing + skipped.past + skipped.current + skipped.noId;
  var summary = 'refreshInviteDescriptions ' + (preview ? 'dry run: would update ' : 'updated ') + updated +
    ', skipped ' + skippedTotal +
    ' (no event: ' + skipped.noEvent +
    ', missing event: ' + skipped.missing +
    ', past: ' + skipped.past +
    ', already current: ' + skipped.current +
    ', no sign-up id: ' + skipped.noId + ').' +
    (preview ? ' Nothing was written.' : ' Guests were not notified.');
  deps.log(summary);
  return summary;
}

function sendMissingInvites(dryRun, sendConfirmation, deps) {
  deps = deps || sendMissingDeps_();
  var preview = inviteFlag_(dryRun);
  var mailThem = inviteFlag_(sendConfirmation);
  var state = deps.readState();
  var api = deps.client;
  var calendarId = api.getCalendarId();
  var today = deps.today();
  var created = 0;
  var emailed = 0;
  var skipped = { noEmail: 0, past: 0, invited: 0, failed: 0 };
  (state.signups || []).forEach(function (row) {
    if (!ABA_RULES.isActive(row)) return;
    var slot = inviteSlot_(state, row);
    var when = inviteWhen_(slot);
    var who = (row.name || '') + ' <' + (row.email || '') + '> ' + (slot.task || '') + ' ' + when;
    if (when < today) {
      skipped.past += 1;
      return;
    }
    if (!row.email) {
      skipped.noEmail += 1;
      return;
    }
    var located = row.signupId ? locatePersonEvent_(api, calendarId, row.signupId) : { id: '', missing: false };
    if (located.id) {
      skipped.invited += 1;
      return;
    }
    deps.log('sendMissingInvites ' + (preview ? 'would invite ' : 'inviting ') + who);
    if (preview) {
      created += 1;
      return;
    }
    var added = false;
    try {
      added = applyPersonCalendar_(api, calendarId, personChange_(row, slot, 'add')) === true;
    } catch (err) {
      added = false;
      deps.log('sendMissingInvites failed for ' + who + ': ' + err);
    }
    if (!added) {
      skipped.failed += 1;
      return;
    }
    created += 1;
    if (!mailThem) return;
    try {
      deps.sendMail(buildMessage_(row, slot, 'confirm'));
      emailed += 1;
    } catch (err) {
      deps.log('sendMissingInvites could not email ' + who + ': ' + err);
    }
  });
  var skippedTotal = skipped.noEmail + skipped.past + skipped.invited + skipped.failed;
  var summary = preview
    ? 'sendMissingInvites dry run: would invite ' + created +
      ', skipped ' + skippedTotal +
      ' (no email: ' + skipped.noEmail + ', past: ' + skipped.past + ', already invited: ' + skipped.invited + '). Nothing was created.'
    : 'sendMissingInvites created ' + created +
      ', confirmation emails ' + emailed +
      ', skipped ' + skippedTotal +
      ' (no email: ' + skipped.noEmail + ', past: ' + skipped.past + ', already invited: ' + skipped.invited + ', failed: ' + skipped.failed + ').';
  deps.log(summary);
  return summary;
}
