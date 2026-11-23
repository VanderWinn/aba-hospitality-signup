/**
 * Confirmation mail, calendar files, reminders, and the v2 sheet migration.
 * No SpreadsheetApp calls at load time. Code.gs calls these helpers.
 *
 * Calendar rule: a clock time such as "4:30 PM" becomes a 2-hour event in
 * America/New_York (the sheet has no end time). If the time is missing or
 * not h:mm AM/PM, the file is an all-day event for that date.
 *
 * Reminder rule: the daily trigger runs around 9:00 AM America/New_York.
 * It emails an active sign-up that has an email address when the event date
 * is exactly two Eastern calendar days away and reminderSent is blank.
 * The mark is written first and cleared if sending throws, so a later run
 * the same day retries a failure and a second success does not send again.
 */

var ABA_MAIL_NAME = 'Ada Business Association';
var ABA_MAIL_REPLY_TO = 'donny@vanderwinn.com';
var ABA_SITE_URL = 'https://vanderwinn.github.io/aba-hospitality-signup/';
var ABA_CALENDAR_TZ = 'America/New_York';
var ABA_EVENT_MINUTES = 120;

function parseSlotId_(slotId) {
  var parts = String(slotId || '').split('|');
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return { date: parts[0], event: parts[1], task: parts.slice(2).join('|') };
}

function addDays_(iso, days) {
  var parts = String(iso || '').split('-').map(function (n) { return Number(n); });
  var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  dt.setUTCDate(dt.getUTCDate() + days);
  var month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  var day = String(dt.getUTCDate()).padStart(2, '0');
  return dt.getUTCFullYear() + '-' + month + '-' + day;
}

function pad2_(n) {
  return String(n).padStart(2, '0');
}

function parseClock_(text) {
  var match = String(text || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (!match) return null;
  var hour = Number(match[1]);
  var minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  var ap = match[3].toUpperCase();
  if (ap === 'AM') hour = hour === 12 ? 0 : hour;
  else hour = hour === 12 ? 12 : hour + 12;
  return { hour: hour, minute: minute };
}

function addMinutes_(dateKey, hour, minute, delta) {
  var total = hour * 60 + minute + delta;
  var shift = Math.floor(total / 1440);
  total = total % 1440;
  if (total < 0) {
    total += 1440;
    shift -= 1;
  }
  return {
    date: addDays_(dateKey, shift),
    hour: Math.floor(total / 60),
    minute: total % 60
  };
}

function zonedWallToUtc_(dateKey, hour, minute, timeZone) {
  var parts = dateKey.split('-').map(function (n) { return Number(n); });
  var wanted = Date.UTC(parts[0], parts[1] - 1, parts[2], hour, minute);
  var utc = wanted;
  var formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  for (var i = 0; i < 4; i++) {
    var shown = formatter.formatToParts(new Date(utc));
    var get = function (type) {
      for (var p = 0; p < shown.length; p++) if (shown[p].type === type) return Number(shown[p].value);
      return 0;
    };
    var shownUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    var diff = wanted - shownUtc;
    if (diff === 0) return new Date(utc);
    utc += diff;
  }
  return new Date(utc);
}

function formatUtcBasic_(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function formatUtcIso_(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function escapeHtmlMail_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}

function escapeIcs_(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcs_(text) {
  var lines = String(text).split('\r\n');
  var out = [];
  lines.forEach(function (line) {
    var rest = line;
    while (rest.length > 75) {
      out.push(rest.slice(0, 75));
      rest = ' ' + rest.slice(75);
    }
    out.push(rest);
  });
  return out.join('\r\n');
}

function longDate_(iso) {
  var parts = String(iso || '').split('-').map(function (n) { return Number(n); });
  var dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(dt);
}

function mailWhere_(slot) {
  var composed = fullPlace_(slot && slot.venue, slot && slot.address);
  if (composed) return composed;
  return venueLine_(slot && slot.location, slot && slot.event);
}

function venueLine_(location, eventName) {
  var text = String(location || '');
  var prefix = String(eventName || '') + ', ';
  return text.indexOf(prefix) === 0 ? text.slice(prefix.length) : text;
}

function manageUrl_(token) {
  if (!token) return '';
  return ABA_SITE_URL + '?manage=' + encodeURIComponent(token);
}

function calendarPieces_(signup, slot) {
  var when = parseClock_(slot.time);
  var summary = slot.event + ': ' + slot.task;
  var where = mailWhere_(slot);
  var manage = manageUrl_(signup.token);
  var details = 'Task: ' + slot.task + '\nEvent: ' + slot.event + '\nWhen: ' + longDate_(slot.date) +
    (when ? ', ' + String(slot.time).trim() + ' Eastern' : ', all day');
  if (manage) details += '\n\nChange or cancel: ' + manage;
  var uid = String(signup.signupId || 'signup') + '@aba-hospitality.ada';
  var sequence = Math.floor(Number(signup.sequence || 0)) || 0;
  var stamp = formatUtcBasic_(signup._now ? new Date(signup._now) : new Date());
  var lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ada Business Association//Hospitality Sign-up//EN',
    'CALSCALE:GREGORIAN'
  ];
  var googleDates = '';
  var outlookStart = '';
  var outlookEnd = '';
  var startText = slot.roleStart || slot.startTime || '';
  var endText = slot.roleEnd || slot.endTime || '';
  var roleStart = startText ? parseClock_(startText) : null;
  var roleEnd = endText ? parseClock_(endText) : null;
  if (roleStart && roleEnd) {
    var roleDate = slot.roleDate || slot.date;
    var endDate = roleDate;
    if (roleEnd.hour * 60 + roleEnd.minute <= roleStart.hour * 60 + roleStart.minute) endDate = addDays_(roleDate, 1);
    var startUtc = zonedWallToUtc_(roleDate, roleStart.hour, roleStart.minute, ABA_CALENDAR_TZ);
    var endUtc = zonedWallToUtc_(endDate, roleEnd.hour, roleEnd.minute, ABA_CALENDAR_TZ);
    googleDates = formatUtcBasic_(startUtc) + '/' + formatUtcBasic_(endUtc);
    outlookStart = formatUtcIso_(startUtc);
    outlookEnd = formatUtcIso_(endUtc);
    lines.push('BEGIN:VTIMEZONE');
    lines.push('TZID:' + ABA_CALENDAR_TZ);
    lines.push('X-LIC-LOCATION:' + ABA_CALENDAR_TZ);
    lines.push('BEGIN:DAYLIGHT');
    lines.push('TZOFFSETFROM:-0500');
    lines.push('TZOFFSETTO:-0400');
    lines.push('TZNAME:EDT');
    lines.push('DTSTART:19700308T020000');
    lines.push('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU');
    lines.push('END:DAYLIGHT');
    lines.push('BEGIN:STANDARD');
    lines.push('TZOFFSETFROM:-0400');
    lines.push('TZOFFSETTO:-0500');
    lines.push('TZNAME:EST');
    lines.push('DTSTART:19701101T020000');
    lines.push('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU');
    lines.push('END:STANDARD');
    lines.push('END:VTIMEZONE');
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + escapeIcs_(uid));
    lines.push('DTSTAMP:' + stamp);
    lines.push('SEQUENCE:' + sequence);
    lines.push('SUMMARY:' + escapeIcs_(summary));
    lines.push('DTSTART;TZID=' + ABA_CALENDAR_TZ + ':' + roleDate.replace(/-/g, '') + 'T' + pad2_(roleStart.hour) + pad2_(roleStart.minute) + '00');
    lines.push('DTEND;TZID=' + ABA_CALENDAR_TZ + ':' + endDate.replace(/-/g, '') + 'T' + pad2_(roleEnd.hour) + pad2_(roleEnd.minute) + '00');
    when = roleStart;
  } else if (!when) {
    var endDay = addDays_(slot.date, 1);
    googleDates = slot.date.replace(/-/g, '') + '/' + endDay.replace(/-/g, '');
    outlookStart = slot.date;
    outlookEnd = endDay;
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + escapeIcs_(uid));
    lines.push('DTSTAMP:' + stamp);
    lines.push('SEQUENCE:' + sequence);
    lines.push('SUMMARY:' + escapeIcs_(summary));
    lines.push('DTSTART;VALUE=DATE:' + slot.date.replace(/-/g, ''));
    lines.push('DTEND;VALUE=DATE:' + endDay.replace(/-/g, ''));
  } else {
    var startUtc = zonedWallToUtc_(slot.date, when.hour, when.minute, ABA_CALENDAR_TZ);
    var end = addMinutes_(slot.date, when.hour, when.minute, ABA_EVENT_MINUTES);
    var endUtc = zonedWallToUtc_(end.date, end.hour, end.minute, ABA_CALENDAR_TZ);
    googleDates = formatUtcBasic_(startUtc) + '/' + formatUtcBasic_(endUtc);
    outlookStart = formatUtcIso_(startUtc);
    outlookEnd = formatUtcIso_(endUtc);
    lines.push('BEGIN:VTIMEZONE');
    lines.push('TZID:' + ABA_CALENDAR_TZ);
    lines.push('X-LIC-LOCATION:' + ABA_CALENDAR_TZ);
    lines.push('BEGIN:DAYLIGHT');
    lines.push('TZOFFSETFROM:-0500');
    lines.push('TZOFFSETTO:-0400');
    lines.push('TZNAME:EDT');
    lines.push('DTSTART:19700308T020000');
    lines.push('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU');
    lines.push('END:DAYLIGHT');
    lines.push('BEGIN:STANDARD');
    lines.push('TZOFFSETFROM:-0400');
    lines.push('TZOFFSETTO:-0500');
    lines.push('TZNAME:EST');
    lines.push('DTSTART:19701101T020000');
    lines.push('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU');
    lines.push('END:STANDARD');
    lines.push('END:VTIMEZONE');
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + escapeIcs_(uid));
    lines.push('DTSTAMP:' + stamp);
    lines.push('SEQUENCE:' + sequence);
    lines.push('SUMMARY:' + escapeIcs_(summary));
    lines.push('DTSTART;TZID=' + ABA_CALENDAR_TZ + ':' + slot.date.replace(/-/g, '') + 'T' + pad2_(when.hour) + pad2_(when.minute) + '00');
    lines.push('DTEND;TZID=' + ABA_CALENDAR_TZ + ':' + end.date.replace(/-/g, '') + 'T' + pad2_(end.hour) + pad2_(end.minute) + '00');
  }
  if (where) lines.push('LOCATION:' + escapeIcs_(where));
  lines.push('DESCRIPTION:' + escapeIcs_(details));
  if (manage) lines.push('URL:' + escapeIcs_(manage));
  var google = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(summary) +
    '&dates=' + encodeURIComponent(googleDates) +
    '&details=' + encodeURIComponent(details) +
    '&location=' + encodeURIComponent(where);
  var outlook = 'https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent' +
    '&subject=' + encodeURIComponent(summary) +
    '&startdt=' + encodeURIComponent(outlookStart) +
    '&enddt=' + encodeURIComponent(outlookEnd) +
    '&body=' + encodeURIComponent(details) +
    '&location=' + encodeURIComponent(where);
  return { lines: lines, google: google, outlook: outlook, where: where, summary: summary, manage: manage, timed: !!when };
}

function buildMessage_(signup, slot, kind) {
  var pieces = calendarPieces_(signup, slot);
  var lines = pieces.lines.slice();
  var method = kind === 'cancel' ? 'CANCEL' : 'REQUEST';
  lines.splice(4, 0, 'METHOD:' + method);
  lines.push('STATUS:' + (kind === 'cancel' ? 'CANCELLED' : 'CONFIRMED'));
  lines.push('ORGANIZER;CN=Ada Business Association:mailto:' + ABA_MAIL_REPLY_TO);
  if (signup.email) {
    lines.push('ATTENDEE;CN=' + escapeIcs_(signup.name) + ';ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:' + String(signup.email).trim());
  }
  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');
  var ics = foldIcs_(lines.join('\r\n')) + '\r\n';
  var whenText = slot.timeLabel
    ? ((slot.roleDate && slot.roleDate !== slot.date ? longDate_(slot.roleDate) : longDate_(slot.date)) + ', ' + slot.timeLabel + ' Eastern')
    : (longDate_(slot.date) + (pieces.timed ? ', ' + String(slot.time).trim() + ' Eastern' : ', all day'));
  var intro = 'You are signed up.';
  var subject = 'You\'re signed up: ' + slot.task + ' — ' + slot.event;
  if (kind === 'reminder') {
    intro = 'This is a reminder that your event is in 2 days.';
    subject = 'Reminder: ' + slot.task + ' — ' + slot.event + ' is in 2 days';
  } else if (kind === 'move') {
    intro = 'Your sign-up was moved.';
    subject = 'Updated sign-up: ' + slot.task + ' — ' + slot.event;
  } else if (kind === 'cancel') {
    intro = 'Your sign-up is cancelled and the spot is open again.';
    subject = 'Cancelled: ' + slot.task + ' — ' + slot.event;
  }
  var where = pieces.where || mailWhere_(slot);
  var text = [
    'Hello ' + signup.name + ',',
    '',
    intro,
    '',
    'Event: ' + slot.event,
    'Date: ' + longDate_(slot.date),
    'Time: ' + (slot.timeLabel ? ((slot.roleDate && slot.roleDate !== slot.date ? longDate_(slot.roleDate) + ', ' : '') + slot.timeLabel + ' Eastern') : (pieces.timed ? String(slot.time).trim() + ' Eastern' : 'All day')),
    'Task: ' + slot.task,
    slot.description ? 'Details: ' + slot.description : '',
    'Where: ' + where,
    '',
    'Add to Google Calendar:',
    pieces.google,
    '',
    'Add to Outlook:',
    pieces.outlook,
    '',
    'An invite.ics calendar file is attached. On an iPhone, open it to add the event to Apple Calendar.'
  ];
  if (kind !== 'cancel' && pieces.manage) {
    text.push('', 'Change or cancel:', pieces.manage);
  }
  text.push('', 'Ada Business Association', ABA_SITE_URL.replace(/\/$/, ''));
  var row = function (label, value) {
    return '<tr><td style="padding:6px 12px 6px 0;color:#5c5c5c;font-weight:600;">' + label +
      '</td><td style="padding:6px 0;color:#39393a;">' + escapeHtmlMail_(value) + '</td></tr>';
  };
  var button = function (href, label) {
    return '<a href="' + escapeHtmlMail_(href) + '" style="display:inline-block;margin:0 8px 8px 0;padding:10px 14px;background:#407589;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:700;">' +
      escapeHtmlMail_(label) + '</a>';
  };
  var html = [
    '<div style="font-family:Montserrat,Raleway,Segoe UI,sans-serif;color:#39393a;background:#f2f2f2;padding:24px;">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6e6e6;border-top:6px solid #407589;padding:24px;">',
    '<img src="' + ABA_SITE_URL + 'assets/aba-logo.png" alt="Ada Business Association" width="180" style="display:block;width:180px;height:auto;margin:0 0 16px;">',
    '<p style="margin:0 0 8px;font-size:18px;">Hello ' + escapeHtmlMail_(signup.name) + ',</p>',
    '<p style="margin:0 0 16px;">' + escapeHtmlMail_(intro) + '</p>',
    '<table style="border-collapse:collapse;margin:0 0 16px;">',
    row('Event', slot.event),
    row('Date', longDate_(slot.date)),
    row('Time', slot.timeLabel ? ((slot.roleDate && slot.roleDate !== slot.date ? longDate_(slot.roleDate) + ', ' : '') + slot.timeLabel + ' Eastern') : (pieces.timed ? String(slot.time).trim() + ' Eastern' : 'All day')),
    row('Task', slot.task),
    slot.description ? row('Details', slot.description) : '',
    row('Where', where),
    '</table>',
    '<p style="margin:0 0 8px;">' + button(pieces.google, 'Add to Google Calendar') + button(pieces.outlook, 'Add to Outlook') + '</p>',
    '<p style="margin:0 0 8px;color:#5c5c5c;">An invite.ics calendar file is attached. On an iPhone, open it to add the event to Apple Calendar. ' + escapeHtmlMail_(whenText) + '.</p>'
  ];
  if (kind !== 'cancel' && pieces.manage) {
    html.push('<p style="margin:16px 0 0;">' + button(pieces.manage, 'Change or cancel') + '</p>');
  }
  html.push('<p style="margin:24px 0 0;color:#5c5c5c;">Ada Business Association</p>', '</div></div>');
  return {
    to: signup.email,
    subject: subject,
    text: text.join('\n'),
    html: html.join(''),
    ics: ics,
    filename: 'invite.ics',
    name: ABA_MAIL_NAME,
    replyTo: ABA_MAIL_REPLY_TO
  };
}

function remindersDue_(state, today) {
  var target = addDays_(today, 2);
  var byId = {};
  (state.slots || []).forEach(function (slot) { byId[slot.slotId] = slot; });
  var due = [];
  (state.signups || []).forEach(function (row) {
    if (!ABA_RULES.isActive(row)) return;
    if (!row.email) return;
    if (String(row.reminderSent || '').trim()) return;
    var slot = byId[row.slotId];
    if (!slot || (slot.roleDate || slot.date) !== target) return;
    due.push({ signup: row, slot: slot });
  });
  return due;
}

function planTriggerHandlers_(handlers) {
  var indexes = [];
  (handlers || []).forEach(function (name, i) {
    if (name === 'sendReminders') indexes.push(i);
  });
  return { deleteIndexes: indexes.slice(1), create: indexes.length === 0 };
}

function migrateSignupTable_(values, catalog, headers, tokenFactory) {
  var sourceHeader = (values[0] || []).map(function (cell) { return String(cell || '').trim(); });
  function cell(row, name) {
    var index = columnIndex_(sourceHeader, name);
    if (index === -1) return '';
    var value = row[index];
    return value == null ? '' : value;
  }
  var byId = {};
  (catalog || []).forEach(function (slot) { byId[slot.slotId] = slot; });
  var out = [headers.slice()];
  var kept = 0;
  var tokensFilled = 0;
  var capacitiesFilled = 0;
  for (var r = 1; r < values.length; r++) {
    var src = values[r] || [];
    var blank = true;
    for (var c = 0; c < src.length; c++) {
      if (src[c] !== '' && src[c] != null) blank = false;
    }
    if (blank) continue;
    var record = {};
    headers.forEach(function (name) {
      var field = headerField_(name) || name;
      record[field] = cell(src, field);
    });
    var parsed = parseSlotId_(record.slotId);
    var known = byId[String(record.slotId || '')] || null;
    if (!record.event && parsed) record.event = parsed.event;
    if (!record.date && parsed) record.date = parsed.date;
    if (!record.task && parsed) record.task = parsed.task;
    if (!record.time && known) record.time = known.time;
    if (!record.location && known) record.location = known.location;
    if (!record.venue && !record.address) {
      var rawPlace = record.location || (known && known.location) || '';
      if (rawPlace) {
        var place = splitPlace_(rawPlace, record.event);
        if (columnIndex_(headers, 'venue') !== -1) record.venue = place.venue;
        if (columnIndex_(headers, 'address') !== -1) record.address = place.address;
      }
    }
    if ((record.capacity === '' || record.capacity == null) && known) {
      record.capacity = known.capacity;
      capacitiesFilled += 1;
    }
    if (!String(record.token || '').trim()) {
      record.token = tokenFactory(record);
      tokensFilled += 1;
    }
    kept += 1;
    out.push(headers.map(function (name) {
      var field = headerField_(name) || name;
      var value = record[field];
      return value == null ? '' : value;
    }));
  }
  return { values: out, kept: kept, tokensFilled: tokensFilled, capacitiesFilled: capacitiesFilled };
}
