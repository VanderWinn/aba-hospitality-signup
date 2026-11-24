/* Shared by the page and the local tests. No network calls. */
(function (root) {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function todayInDetroit(now) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Detroit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now || new Date());
  }

  function dateUtc(iso) {
    var parts = String(iso || '').split('-');
    return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  }

  function formatLong(iso) {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(dateUtc(iso));
  }

  function formatNav(iso) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(dateUtc(iso));
  }

  function venue(location, eventName) {
    var prefix = eventName + ', ';
    var text = String(location || '');
    return text.indexOf(prefix) === 0 ? text.slice(prefix.length) : text;
  }

  function placeParts(location, eventName) {
    var text = venue(location, eventName).trim();
    var dash = text.match(/^(.*?)\s+-\s*(.+)$/) || text.match(/^(.*?)\s*-\s*(\d.*)$/);
    if (dash && dash[1] && /\d/.test(dash[2])) {
      return { name: dash[1].trim(), street: dash[2].trim() };
    }
    var comma = text.indexOf(',');
    if (comma > 0 && /^\d/.test(text.slice(comma + 1).trim())) {
      return { name: text.slice(0, comma).trim(), street: text.slice(comma + 1).trim() };
    }
    return { name: text, street: '' };
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function eventDomId(event) {
    return 'event-' + event.date + '-' + slug(event.name);
  }

  function taskDomId(event, task) {
    return 'task-' + event.date + '-' + slug(event.name) + '-' + slug(task.task);
  }

  function toView(data, today) {
    var events = (data.events || []).map(function (event) {
      var name = event.name || event.event || '';
      var tasks = (event.tasks || []).map(function (task) {
        var names = (task.names || []).map(function (person) {
          return typeof person === 'string' ? person : person && person.name;
        }).filter(Boolean);
        var capacity = Math.floor(Number(task.capacity));
        if (!isFinite(capacity) || capacity < 0) capacity = 0;
        return {
          task: task.task,
          capacity: capacity,
          names: names,
          filled: names.length,
          remaining: Math.max(0, capacity - names.length),
          timeLabel: task.timeLabel || '',
          description: task.description || '',
          roleDate: task.roleDate || '',
          roleStart: task.roleStart || ''
        };
      });
      return {
        id: event.date + '|' + name,
        date: event.date,
        time: event.time,
        name: name,
        location: event.location || '',
        past: String(event.date) < String(today),
        tasks: tasks
      };
    });
    return {
      org: data.org || '',
      title: data.title || '',
      pulled: data.pulled || '',
      asOf: today,
      events: events
    };
  }

  function summarize(view) {
    var summary = { events: view.events.length, upcoming: 0, open: 0, filled: 0, capacity: 0 };
    view.events.forEach(function (event) {
      if (!event.past) summary.upcoming += 1;
      event.tasks.forEach(function (task) {
        summary.capacity += task.capacity;
        summary.filled += task.filled;
        if (!event.past) summary.open += task.remaining;
      });
    });
    return summary;
  }

  function findTask(view, date, eventName, taskName) {
    for (var i = 0; i < view.events.length; i++) {
      var event = view.events[i];
      if (event.date !== date || event.name !== eventName) continue;
      for (var t = 0; t < event.tasks.length; t++) {
        if (event.tasks[t].task === taskName) return { event: event, task: event.tasks[t] };
      }
    }
    return null;
  }

  function renderBanner(mode, message) {
    if (mode === 'preview') {
      return '<p class="banner preview">Preview only. Sign-up is not open yet. Tasks and names are from the Nov 17, 2026 SignUpGenius export, so you can review the sheet before the form is connected.</p>';
    }
    if (mode === 'stale') {
      var stale = message || 'The live sheet could not be loaded. Showing the Nov 17, 2026 saved copy, so the counts may be out of date. You can still try to sign up.';
      return '<p class="banner warn" role="alert">' + escapeHtml(stale) + '</p>';
    }
    if (message) return '<p class="banner warn" role="alert">' + escapeHtml(message) + '</p>';
    return '';
  }

  function roleStartText(task, event) {
    if (task.roleStart) return task.roleStart;
    var label = String(task.timeLabel || event.time || '').replace(/^[A-Za-z]{3,9}\s+\d{1,2},\s*/, '');
    var range = parseEventRange(label);
    if (!range) return '';
    var hour = range.start.hour;
    var ap = hour >= 12 ? 'PM' : 'AM';
    var shown = hour % 12;
    if (shown === 0) shown = 12;
    return shown + ':' + pad2(range.start.minute) + ' ' + ap;
  }

  function renderTask(event, task, mode, roster) {
    var canClaim = mode !== 'preview' && !event.past && task.remaining > 0;
    var canCancel = mode === 'live';
    var start = roleStartText(task, event);
    var pool = (roster || []).slice();
    var spots = task.names.map(function (name) {
      var person = null;
      if (pool.length) {
        for (var i = 0; i < pool.length; i++) {
          if (pool[i].name === name) {
            person = pool.splice(i, 1)[0];
            break;
          }
        }
      }
      var remove = person
        ? '<button type="button" class="admin-remove" data-signup="' + escapeHtml(person.signupId) +
          '" data-name="' + escapeHtml(name) + '" data-task="' + escapeHtml(task.task) + '">Remove</button>'
        : '';
      if (!canCancel) return '<li>' + escapeHtml(name) + remove + '</li>';
      return '<li><button type="button" class="who-name" title="Cancel this sign-up" data-name="' + escapeHtml(name) +
        '" data-date="' + escapeHtml(event.date) + '" data-event="' + escapeHtml(event.name) +
        '" data-task="' + escapeHtml(task.task) + '" data-start="' + escapeHtml(start) +
        '" aria-label="' + escapeHtml('Cancel this sign-up for ' + name) + '">' + escapeHtml(name) + '</button>' +
        remove + '</li>';
    });
    var openSpots = task.remaining;
    for (var s = 0; s < openSpots; s++) {
      spots.push('<li class="open-spot">Open</li>');
    }
    var names = spots.length ? '<ul class="who">' + spots.join('') + '</ul>' : '';
    var when = task.timeLabel || event.time || '';
    var action;
    if (canClaim) {
      var label = 'Sign up for ' + task.task + ', ' + event.name + ', ' + formatLong(event.date) + (when ? ', ' + when : '');
      action = '<button type="button" class="claim" data-date="' + escapeHtml(event.date) +
        '" data-event="' + escapeHtml(event.name) + '" data-task="' + escapeHtml(task.task) +
        '" data-when="' + escapeHtml(when) + '" data-description="' + escapeHtml(task.description || '') +
        '" aria-label="' + escapeHtml(label) + '">Sign up</button>';
    } else if (event.past) {
      action = '<span class="pill closed">Closed</span>';
    } else if (task.remaining === 0) {
      action = '<span class="full-label">Full</span>';
    } else {
      action = '<span class="pill open">Open</span>';
    }
    if (roster && !event.past) {
      action += '<button type="button" class="admin-add" data-date="' + escapeHtml(event.date) +
        '" data-event="' + escapeHtml(event.name) + '" data-task="' + escapeHtml(task.task) +
        '" data-start="' + escapeHtml(start) + '" data-full="' + (task.remaining === 0 ? '1' : '0') +
        '">Add person</button>';
    }
    return '<article class="task" id="' + taskDomId(event, task) + '">' +
      '<div class="task-main">' +
        '<h3><span class="role-name">' + escapeHtml(task.task) + '</span>' +
        (when ? '<span class="role-when">· ' + escapeHtml(when) + '</span>' : '') +
        '</h3>' +
        (task.description ? '<p class="task-desc">' + escapeHtml(task.description) + '</p>' : '') +
      '</div>' +
      names +
      '<div class="task-action">' + action + '</div>' +
    '</article>';
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function clock24(hourText, minuteText, ap) {
    var hour = Number(hourText);
    var minute = Number(minuteText);
    var marker = String(ap || '').toUpperCase();
    if (marker === 'PM' && hour < 12) hour += 12;
    if (marker === 'AM' && hour === 12) hour = 0;
    return { hour: hour, minute: minute };
  }

  function parseEventRange(time) {
    var text = String(time || '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim();
    var both = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (both) {
      var end = clock24(both[4], both[5], both[6]);
      return { start: clock24(both[1], both[2], both[3] || both[6]), end: end };
    }
    var one = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!one) return null;
    var start = clock24(one[1], one[2], one[3]);
    var total = start.hour * 60 + start.minute + 120;
    return { start: start, end: { hour: Math.floor(total / 60) % 24, minute: total % 60 }, nextDay: total >= 24 * 60 };
  }

  function addIsoDay(iso) {
    var parts = String(iso).split('-');
    var date = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + 1));
    return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
  }

  function zonedToUtc(iso, hour, minute) {
    var bits = String(iso).split('-');
    var utc = new Date(Date.UTC(Number(bits[0]), Number(bits[1]) - 1, Number(bits[2]), hour, minute, 0));
    var map = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).formatToParts(utc).forEach(function (part) { map[part.type] = part.value; });
    var asUtc = Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day), Number(map.hour), Number(map.minute), Number(map.second));
    return new Date(utc.getTime() - (asUtc - utc.getTime()));
  }

  function utcBasic(date) {
    return date.getUTCFullYear() + pad2(date.getUTCMonth() + 1) + pad2(date.getUTCDate()) +
      'T' + pad2(date.getUTCHours()) + pad2(date.getUTCMinutes()) + '00Z';
  }

  function escapeIcs(value) {
    return String(value == null ? '' : value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  }

  function eventWhereText(event) {
    var place = placeParts(event.location, event.name);
    if (!place.name) return String(event.location || '');
    return place.street ? place.name + ', ' + place.street : place.name;
  }

  function calendarLinks(event) {
    var title = event.name || 'ABA hospitality event';
    var where = eventWhereText(event);
    var details = 'Ada Business Association hospitality event';
    var range = parseEventRange(event.time);
    var stamp = utcBasic(new Date());
    var uid = 'event-' + event.date + '-' + slug(event.name) + '@aba-hospitality.ada';
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ada Business Association//Hospitality Sign-up//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];
    if (range) {
      lines.push('BEGIN:VTIMEZONE');
      lines.push('TZID:America/New_York');
      lines.push('X-LIC-LOCATION:America/New_York');
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
    }
    lines.push('BEGIN:VEVENT');
    lines.push('UID:' + uid);
    lines.push('DTSTAMP:' + stamp);
    lines.push('SUMMARY:' + escapeIcs(title));
    var googleDates = '';
    var outlookStart = '';
    var outlookEnd = '';
    if (!range) {
      var endDay = addIsoDay(event.date);
      googleDates = event.date.replace(/-/g, '') + '/' + endDay.replace(/-/g, '');
      outlookStart = event.date;
      outlookEnd = endDay;
      lines.push('DTSTART;VALUE=DATE:' + event.date.replace(/-/g, ''));
      lines.push('DTEND;VALUE=DATE:' + endDay.replace(/-/g, ''));
    } else {
      var endDate = range.nextDay ? addIsoDay(event.date) : event.date;
      var startUtc = zonedToUtc(event.date, range.start.hour, range.start.minute);
      var endUtc = zonedToUtc(endDate, range.end.hour, range.end.minute);
      googleDates = utcBasic(startUtc) + '/' + utcBasic(endUtc);
      outlookStart = startUtc.toISOString().replace(/\.\d{3}Z$/, 'Z');
      outlookEnd = endUtc.toISOString().replace(/\.\d{3}Z$/, 'Z');
      lines.push('DTSTART;TZID=America/New_York:' + event.date.replace(/-/g, '') + 'T' + pad2(range.start.hour) + pad2(range.start.minute) + '00');
      lines.push('DTEND;TZID=America/New_York:' + endDate.replace(/-/g, '') + 'T' + pad2(range.end.hour) + pad2(range.end.minute) + '00');
    }
    if (where) lines.push('LOCATION:' + escapeIcs(where));
    lines.push('DESCRIPTION:' + escapeIcs(details));
    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');
    var ics = lines.join('\r\n') + '\r\n';
    return {
      google: 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
        '&text=' + encodeURIComponent(title) +
        '&dates=' + encodeURIComponent(googleDates) +
        '&details=' + encodeURIComponent(details) +
        '&location=' + encodeURIComponent(where),
      outlook: 'https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent' +
        '&subject=' + encodeURIComponent(title) +
        '&startdt=' + encodeURIComponent(outlookStart) +
        '&enddt=' + encodeURIComponent(outlookEnd) +
        '&body=' + encodeURIComponent(details) +
        '&location=' + encodeURIComponent(where),
      ics: ics,
      filename: slug(title) + '-' + event.date + '.ics',
      where: where
    };
  }

  function isAppleMobile() {
    var nav = typeof navigator === 'undefined' ? null : navigator;
    if (!nav) return false;
    var ua = String(nav.userAgent || '');
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return nav.platform === 'MacIntel' && Number(nav.maxTouchPoints) > 1;
  }

  function eventFromAppleQuery(search) {
    var text = String(search || '');
    if (text.charAt(0) === '?') text = text.slice(1);
    var params = new URLSearchParams(text);
    if (params.get('apple') !== '1') return null;
    var date = params.get('date') || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    var start = params.get('start') || '';
    var end = params.get('end') || '';
    var time = start && end ? start + '–' + end : start;
    return {
      name: (params.get('title') || 'ABA hospitality event').slice(0, 180),
      date: date,
      time: time,
      location: (params.get('where') || '').slice(0, 300)
    };
  }

  function deliverIcs(ics, filename) {
    var name = filename || 'invite.ics';
    if (isAppleMobile()) {
      window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      return;
    }
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function renderEvent(event, mode, roster) {
    var place = placeParts(event.location, event.name);
    var where = '<span class="event-where">' +
      '<span class="sep" aria-hidden="true">·</span>' +
      '<span class="event-clock">' + escapeHtml(event.time) + '</span>' +
      (place.name ? '<span class="sep" aria-hidden="true">·</span><span class="event-place"><span class="venue-name">' + escapeHtml(place.name) + '</span>' +
        (place.street ? '<span class="venue-street">, ' + escapeHtml(place.street) + '</span>' : '') + '</span>' : '') +
    '</span>';
    var offer = calendarLinks(event);
    var calId = eventDomId(event) + '-calendar';
    var calLabel = 'Add ' + event.name + ' on ' + formatLong(event.date) + ' to your calendar';
    return '<section class="event' + (event.past ? ' is-past' : '') + '" data-type="' + escapeHtml(event.name) + '" id="' + eventDomId(event) + '" aria-labelledby="' + eventDomId(event) + '-title">' +
      '<header class="event-head">' +
        '<h2 class="event-line" id="' + eventDomId(event) + '-title">' +
          '<button type="button" class="event-cal-toggle" aria-expanded="false" aria-controls="' + calId + '" aria-label="' + escapeHtml(calLabel) + '">' +
            '<svg class="cal-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '<span class="event-line-text">' +
              '<span class="kicker">' + escapeHtml(event.name) + '</span>' +
              '<span class="sep" aria-hidden="true">·</span>' +
              '<span class="event-date">' + escapeHtml(formatLong(event.date)) + '</span>' +
              where +
            '</span>' +
          '</button>' +
        '</h2>' +
        '<div class="cal-menu" id="' + calId + '" hidden data-date="' + escapeHtml(event.date) + '" data-time="' + escapeHtml(event.time || '') + '" data-name="' + escapeHtml(event.name || '') + '" data-location="' + escapeHtml(event.location || '') + '">' +
          '<p class="cal-menu-label">Add to calendar</p>' +
          '<a href="' + escapeHtml(offer.google) + '" target="_blank" rel="noopener noreferrer">Google Calendar</a>' +
          '<a href="' + escapeHtml(offer.outlook) + '" target="_blank" rel="noopener noreferrer">Outlook</a>' +
          '<button type="button" class="cal-file">Apple Calendar (iPhone)</button>' +
          '<button type="button" class="cal-file">Download .ics</button>' +
        '</div>' +
      '</header>' +
      '<div class="tasks">' + event.tasks.map(function (task) {
        var mine = (roster || []).filter(function (person) {
          return person.slotId === event.date + '|' + event.name + '|' + task.task;
        });
        return renderTask(event, task, mode, roster ? mine : null);
      }).join('') + '</div>' +
    '</section>';
  }

  function typeTotals(view, type) {
    var dates = 0;
    view.events.forEach(function (event) {
      if (event.past) return;
      if (type && event.name !== type) return;
      dates += 1;
    });
    return { dates: dates };
  }

  function filterTile(type, label, totals, pressed) {
    var count = totals.dates + (totals.dates === 1 ? ' date' : ' dates');
    return '<button type="button" class="type-filter' + (pressed ? ' is-selected' : '') + '" data-type="' + escapeHtml(type) + '" aria-pressed="' + (pressed ? 'true' : 'false') + '">' +
      '<span class="type-filter-name">' + escapeHtml(label) + '</span>' +
      '<span class="type-filter-count">' + count + '</span></button>';
  }

  function renderFilters(view) {
    var types = ['Happy Hour', 'Lunch & Learn', 'Ribbon Cutting'];
    return '<div class="type-filters" role="group" aria-label="Filter by event type">' +
      filterTile('', 'All Events', typeTotals(view, ''), true) +
      types.map(function (type) { return filterTile(type, type, typeTotals(view, type), false); }).join('') +
      '</div>';
  }

  function renderBoard(view, mode, roster) {
    var upcoming = view.events.filter(function (event) { return !event.past; });
    var past = view.events.filter(function (event) { return event.past; });
    var jump = renderFilters(view);
    var upcomingHtml = '<div class="event-list">' + upcoming.map(function (event) { return renderEvent(event, mode, roster); }).join('') + '</div>' +
      '<p class="filter-empty" hidden>No upcoming events of this type.</p>';
    var pastHtml = past.length
      ? '<details class="past-block"><summary>Past events (' + past.length + ')</summary><div class="event-list">' +
        past.map(function (event) { return renderEvent(event, mode, roster); }).join('') + '</div></details>'
      : '';
    return jump + upcomingHtml + pastHtml;
  }

  function renderManage(record, view) {
    if (!record) return '';
    if (record.status === 'cancelled' || record.status === 'superseded') {
      var heading = record.status === 'superseded' ? 'Sign-up replaced' : 'Sign-up cancelled';
      var detail = record.status === 'superseded'
        ? ' was replaced by separate roles and is no longer on the grid.'
        : ' is no longer signed up for ' + (record.task || 'this task') + '.';
      return '<section class="manage" aria-labelledby="manage-title"><h2 id="manage-title">' + heading + '</h2><p>' +
        escapeHtml(record.name) + escapeHtml(detail) + '</p></section>';
    }
    var options = '';
    var count = 0;
    (view && view.events || []).forEach(function (event) {
      if (event.past) return;
      event.tasks.forEach(function (task) {
        var same = event.date === record.date && event.name === record.event && task.task === record.task;
        if (same || task.remaining < 1) return;
        count += 1;
        options += '<option data-date="' + escapeHtml(event.date) + '" data-event="' + escapeHtml(event.name) +
          '" data-task="' + escapeHtml(task.task) + '">' +
          escapeHtml(formatNav(event.date) + ' · ' + event.name + ' · ' + task.task + ' (' + task.remaining + ' open)') +
          '</option>';
      });
    });
    var move = count
      ? '<p class="task-desc">Choose a new role to change this sign-up. The current role is removed. This does not create another sign-up.</p>' +
        '<label for="manage-target">New role</label><select id="manage-target"><option value="">Choose a spot</option>' +
        options + '</select><button type="button" class="btn" id="manage-move">Change</button>'
      : '<p>Every other spot is full or closed.</p>';
    return '<section class="manage" aria-labelledby="manage-title">' +
      '<h2 id="manage-title">Change this sign-up</h2>' +
      '<p>' + escapeHtml(record.name) + (record.email ? ' · ' + escapeHtml(record.email) : '') + '</p>' +
      '<p><strong>' + escapeHtml(record.task) + '</strong><br>' + escapeHtml(record.event || '') + ' · ' +
      escapeHtml(formatLong(record.date)) + ((record.timeLabel || record.time) ? ' · ' + escapeHtml(record.timeLabel || record.time) : '') + '</p>' +
      (record.description ? '<p class="task-desc">' + escapeHtml(record.description) + '</p>' : '') +
      (record.status === 'needs-review' ? '<p>This task is not on the current list. You can cancel it or move to an open role.</p>' : '') +
      '<p>' + escapeHtml(record.location || '') + '</p>' +
      '<div class="manage-actions"><button type="button" class="btn danger" id="manage-cancel">Cancel this sign-up</button></div>' +
      '<div class="manage-move">' + move + '</div>' +
      '<p id="manage-error" class="form-error" role="alert" hidden></p></section>';
  }

  root.ABACatalog = {
    escapeHtml: escapeHtml,
    todayInDetroit: todayInDetroit,
    formatLong: formatLong,
    venue: venue,
    toView: toView,
    summarize: summarize,
    findTask: findTask,
    renderBanner: renderBanner,
    renderBoard: renderBoard,
    calendarLinks: calendarLinks,
    deliverIcs: deliverIcs,
    eventFromAppleQuery: eventFromAppleQuery,
    renderManage: renderManage,
    eventDomId: eventDomId
  };
})(typeof window !== 'undefined' ? window : globalThis);
