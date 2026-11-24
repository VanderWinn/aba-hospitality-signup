/**
 * Role templates by event type, and the 11 events.
 * Add a future event by appending one object to abaEvents().
 * Ribbon Cutting end is optional. When it is blank, "through end of event"
 * means 60 minutes after the start.
 */

function abaTemplates_() {
  return {
    'Ribbon Cutting': [
      { task: 'Photographer', capacity: 1, relative: true, startOffset: -15, throughEventEnd: true },
      { task: 'Ribbon Holders', capacity: 2, relative: true, startOffset: -15, endOffset: 15 }
    ],
    'Lunch & Learn': [
      { task: 'Drink Delivery', capacity: 1, dayOffset: -1, start: '2:00 PM', end: '3:00 PM', description: 'Pick up the drinks and deliver them to the venue.' },
      { task: 'Set-Up', capacity: 3, start: '11:00 AM', end: '11:25 AM', description: 'Arrange tables, chairs, signage, and the room before guests arrive, place items on the tables, and help the table sponsors get set up.' },
      { task: 'Door Greeter', capacity: 1, start: '11:15 AM', end: '11:35 AM', description: 'Welcome guests at the entrance and direct them to sign-in.' },
      { task: 'Sign-In Table', capacity: 3, start: '11:00 AM', end: '11:35 AM', description: 'Check guests in, hand out name tags, and collect contact details.' },
      { task: 'Food Table Host', capacity: 1, start: '11:00 AM', end: '1:15 PM', description: 'Manage the catered lunch table: set up with the caterer, keep it stocked and tidy, guide guests through the line, and handle trash during the event.' },
      { task: 'Clean-Up', capacity: 2, start: '1:00 PM', end: '1:20 PM', description: 'Clear tables, take out the trash, pack up supplies, and reset the room after the event.' }
    ],
    'Happy Hour': [
      { task: 'Set-Up', capacity: 3, start: '4:00 PM', end: '4:30 PM', description: 'Arrange the room, signage, and tables before guests arrive.' },
      { task: 'Door Greeter', capacity: 1, start: '4:00 PM', end: '4:30 PM', description: 'Welcome guests at the entrance and direct them to sign-in.' },
      { task: 'Sign-In Table', capacity: 1, start: '4:00 PM', end: '6:00 PM', description: 'Check guests in, hand out name tags, and collect contact details.' },
      { task: 'Networking Ambassador', capacity: 3, start: '4:30 PM', end: '6:30 PM', description: 'Mingle with guests, make introductions, and help new attendees feel welcome.' },
      { task: 'Clean-Up', capacity: 2, start: '6:30 PM', end: '7:00 PM', description: 'Clear tables, take out the trash, pack up supplies, and reset the room after the event.' }
    ]
  };
}

function abaEvents_() {
  try {
    if (typeof eventsTabPresent_ === 'function' && eventsTabPresent_()) {
      return (readEventsTab_() || []).filter(function (row) { return !row.removedAt; });
    }
  } catch (err) {}
  return abaFallbackEvents_();
}

function abaFallbackEvents_() {
  return [
    { type: 'Ribbon Cutting', date: '2026-11-17', start: '4:30 PM', location: 'Ribbon Cutting, Riverside Links Indoor Golf & Lounge - 396 Pettis Ave SE, Ada, MI 49301-8713' },
    { type: 'Lunch & Learn', date: '2026-11-19', start: '11:30 AM', location: 'Lunch & Learn, Amway WHQ, 7575 Fulton St E, Ada' },
    { type: 'Happy Hour', date: '2026-12-09', start: '4:30 PM', end: '6:30 PM', location: 'Happy Hour, Ada Hotel, 7415 River St SE, Ada' },
    { type: 'Happy Hour', date: '2027-01-13', start: '4:30 PM', end: '6:30 PM', location: 'Happy Hour, The Wellness Club -7505 River St SE Suite 104 Ada, MI 49301' },
    { type: 'Lunch & Learn', date: '2027-01-21', start: '11:30 AM', location: 'Lunch & Learn, Amway WHQ, 7575 Fulton St E, Ada' },
    { type: 'Happy Hour', date: '2027-02-10', start: '4:30 PM', end: '6:30 PM', location: 'Happy Hour, Riverside Links Indoor Golf & Lounge - 396 Pettis Ave SE, Ada, MI 49301' },
    { type: 'Lunch & Learn', date: '2027-02-18', start: '11:30 AM', location: 'Lunch & Learn, Amway WHQ, 7575 Fulton St E, Ada' },
    { type: 'Happy Hour', date: '2027-03-10', start: '4:30 PM', end: '6:30 PM', location: 'Happy Hour, TBD' },
    { type: 'Lunch & Learn', date: '2027-03-18', start: '11:30 AM', location: 'Lunch & Learn, Amway WHQ, 7575 Fulton St E, Ada' },
    { type: 'Lunch & Learn', date: '2027-04-15', start: '11:30 AM', location: 'Lunch & Learn, Amway WHQ, 7575 Fulton St E, Ada' },
    { type: 'Lunch & Learn', date: '2027-05-20', start: '11:30 AM', location: 'Lunch & Learn, Amway WHQ, 7575 Fulton St E, Ada' }
  ];
}

function formatClock_(hour, minute) {
  var ap = hour >= 12 ? 'PM' : 'AM';
  var h = hour % 12;
  if (h === 0) h = 12;
  return h + ':' + pad2_(minute) + ' ' + ap;
}

function shiftClock_(dateKey, clock, minutes) {
  var parsed = parseClock_(clock);
  if (!parsed) return null;
  var moved = addMinutes_(dateKey, parsed.hour, parsed.minute, minutes);
  return { date: moved.date, clock: formatClock_(moved.hour, moved.minute) };
}

function compactRange_(start, end) {
  var startClock = parseClock_(start);
  var endClock = parseClock_(end);
  if (!startClock || !endClock) return start + '–' + end;
  function hourMin(clock) {
    var h = clock.hour % 12;
    if (h === 0) h = 12;
    return h + ':' + pad2_(clock.minute);
  }
  var startAp = startClock.hour >= 12 ? 'PM' : 'AM';
  var endAp = endClock.hour >= 12 ? 'PM' : 'AM';
  if (startAp === endAp) return hourMin(startClock) + '–' + hourMin(endClock) + ' ' + endAp;
  return hourMin(startClock) + ' ' + startAp + '–' + hourMin(endClock) + ' ' + endAp;
}

function shortMonthDay_(iso) {
  var parts = String(iso).split('-').map(function (n) { return Number(n); });
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])));
}

function clockMinutes_(clock) {
  var parsed = parseClock_(clock);
  if (!parsed) return null;
  return parsed.hour * 60 + parsed.minute;
}

function shiftClockLabel_(dateKey, clock, delta) {
  var parsed = parseClock_(clock);
  if (!parsed) return '';
  var moved = addMinutes_(dateKey, parsed.hour, parsed.minute, delta);
  return formatClock_(moved.hour, moved.minute);
}

function standardEventWindow_(type) {
  if (type === 'Happy Hour') return { start: '4:30 PM', end: '6:30 PM', cleanup: 30 };
  if (type === 'Lunch & Learn') return { start: '11:30 AM', end: '1:00 PM', cleanup: 20 };
  return null;
}

function expandEventSlots_(event) {
  var roles = abaTemplates_()[event.type];
  if (!roles) throw new Error('Unknown event type: ' + event.type);
  if (typeof normalizeEventClock_ === 'function') {
    event = {
      type: event.type,
      date: event.date,
      start: normalizeEventClock_(event.start),
      end: normalizeEventClock_(event.end),
      location: event.location || ''
    };
  }
  var standard = standardEventWindow_(event.type);
  var delta = 0;
  var eventEnd = event.end || '';
  if (standard && event.start && clockMinutes_(event.start) != null) {
    delta = clockMinutes_(event.start) - clockMinutes_(standard.start);
    if (!eventEnd) eventEnd = shiftClockLabel_(event.date, standard.end, delta);
  }
  var headerTime = event.end ? compactRange_(event.start, event.end) : event.start;
  return roles.map(function (role) {
    var roleDate = event.date;
    var start = role.start;
    var end = role.end;
    if (role.relative) {
      var startShift = shiftClock_(event.date, event.start, role.startOffset);
      if (!startShift) {
        start = '';
        end = '';
      } else {
        var endShift = role.throughEventEnd
          ? (event.end ? { date: event.date, clock: event.end } : shiftClock_(event.date, event.start, 60))
          : shiftClock_(event.date, event.start, role.endOffset);
        if (!endShift || !endShift.clock) endShift = { date: startShift.date, clock: startShift.clock };
        start = startShift.clock;
        end = endShift.clock;
        roleDate = startShift.date;
      }
    } else if (role.dayOffset) {
      roleDate = addDays_(event.date, role.dayOffset);
    } else if (standard && role.task === 'Clean-Up' && eventEnd) {
      var endClock = parseClock_(eventEnd);
      if (endClock) {
        start = formatClock_(endClock.hour, endClock.minute);
        var cleaned = addMinutes_(event.date, endClock.hour, endClock.minute, standard.cleanup);
        end = formatClock_(cleaned.hour, cleaned.minute);
      }
    } else if (standard && role.task === 'Networking Ambassador') {
      start = event.start;
      end = eventEnd;
    } else if (delta) {
      start = shiftClockLabel_(event.date, role.start, delta);
      end = shiftClockLabel_(event.date, role.end, delta);
    }
    var timeLabel = roleDate === event.date ? compactRange_(start, end) : shortMonthDay_(roleDate) + ', ' + compactRange_(start, end);
    var place = splitPlace_(event.location, event.type);
    return {
      slotId: event.date + '|' + event.type + '|' + role.task,
      date: event.date,
      time: headerTime,
      event: event.type,
      location: event.location,
      venue: place.venue,
      address: place.address,
      task: role.task,
      capacity: role.capacity,
      roleDate: roleDate,
      roleStart: start,
      roleEnd: end,
      timeLabel: timeLabel,
      description: role.description || ''
    };
  });
}

function abaExpandEvents_() {
  var slots = [];
  abaEvents_().forEach(function (event) {
    try {
      expandEventSlots_(event).forEach(function (slot) { slots.push(slot); });
    } catch (err) {
      if (typeof logEventProblem_ === 'function') {
        logEventProblem_('event row', (event && event.date) + ' ' + (event && event.type) + ' ' + (event && event.start), err);
      }
    }
  });
  return slots;
}

function mapLegacyTask_(task) {
  var compact = String(task || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' ');
  if (compact === 'photographer') return { task: 'Photographer' };
  if (compact === 'ribbon holders') return { task: 'Ribbon Holders' };
  if (compact === 'ambassadors set up') return { task: 'Set-Up' };
  if (compact === 'ambassadors clean up') return { task: 'Clean-Up' };
  if (compact === 'ambassadors entire happy hour' || compact === 'mixer host' || compact === 'networking host') return { task: 'Networking Ambassador' };
  if (compact === 'door greeter') return { task: 'Door Greeter' };
  if (compact === 'door/sign in table' || compact === 'door/sign in table host') return { task: 'Sign-In Table' };
  if (/drinks delivery$/.test(compact) || /drink delivery$/.test(compact)) return { task: 'Drink Delivery' };
  if (compact === 'ambassadors full lunch') return { review: true };
  return null;
}

function planRoleMigration_(signups, slots) {
  var byId = {};
  (slots || []).forEach(function (slot) { byId[slot.slotId] = slot; });
  var changes = [];
  var needsReview = [];
  var projected = [];
  (signups || []).forEach(function (row) {
    if (String(row.oldTask || '').trim()) {
      projected.push(row);
      return;
    }
    var parsed = parseSlotId_(row.slotId) || {};
    var eventName = row.event || parsed.event || '';
    var date = row.date || parsed.date || '';
    var decision = mapLegacyTask_(row.task);
    if (decision && decision.review) {
      var reviewStatus = String(row.status || '').toLowerCase() === 'cancelled' ? 'cancelled' : 'needs-review';
      changes.push({ rowNumber: row.rowNumber, fields: { oldTask: row.task, status: reviewStatus } });
      needsReview.push({ name: row.name, date: date, event: eventName, task: row.task });
      projected.push({ name: row.name, date: date, event: eventName, task: row.task, status: reviewStatus, slotId: row.slotId });
      return;
    }
    if (!decision) {
      var currentId = date + '|' + eventName + '|' + row.task;
      if (byId[currentId] || byId[row.slotId]) {
        changes.push({ rowNumber: row.rowNumber, fields: { oldTask: row.task } });
        projected.push({ name: row.name, date: date, event: eventName, task: row.task, status: row.status || 'active', slotId: byId[currentId] ? currentId : row.slotId });
        return;
      }
      var unknownStatus = String(row.status || '').toLowerCase() === 'cancelled' ? 'cancelled' : 'needs-review';
      changes.push({ rowNumber: row.rowNumber, fields: { oldTask: row.task, status: unknownStatus } });
      needsReview.push({ name: row.name, date: date, event: eventName, task: row.task });
      projected.push({ name: row.name, date: date, event: eventName, task: row.task, status: unknownStatus });
      return;
    }
    var newSlotId = date + '|' + eventName + '|' + decision.task;
    var slot = byId[newSlotId];
    var fields = { oldTask: row.task, task: decision.task, slotId: newSlotId, event: eventName, date: date };
    if (slot) {
      fields.capacity = slot.capacity;
      fields.time = slot.roleStart ? slot.roleStart + '–' + (slot.roleEnd || '') : slot.time;
      fields.startTime = slot.roleStart || '';
      fields.endTime = slot.roleEnd || '';
      if (!row.location && !row.venue) {
        fields.location = slot.location;
        fields.venue = slot.venue || '';
        fields.address = slot.address || '';
      }
    }
    changes.push({ rowNumber: row.rowNumber, fields: fields });
    projected.push({ name: row.name, date: date, event: eventName, task: decision.task, status: row.status || 'active', slotId: newSlotId, from: row.task });
  });
  var groups = {};
  projected.forEach(function (row) {
    var status = String(row.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'needs-review') return;
    var key = (row.slotId) || (row.date + '|' + row.event + '|' + row.task);
    if (!groups[key]) groups[key] = [];
    groups[key].push(row.name);
  });
  var overCapacity = [];
  Object.keys(groups).forEach(function (key) {
    var slot = byId[key];
    if (!slot) return;
    if (groups[key].length > slot.capacity) {
      overCapacity.push({ date: slot.date, event: slot.event, task: slot.task, capacity: slot.capacity, names: groups[key] });
    }
  });
  return { changes: changes, needsReview: needsReview, overCapacity: overCapacity };
}
