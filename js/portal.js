/* Board and committee portal helpers. No network calls. */
(function (root) {
  'use strict';

  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function venueOf(event) {
    var name = event && event.name ? String(event.name) : '';
    var text = String(event && event.location || '').trim();
    var prefix = name + ', ';
    if (name && text.indexOf(prefix) === 0) text = text.slice(prefix.length).trim();
    return text;
  }

  function eventsFromCatalog(data) {
    return (data && data.events || []).map(function (event) {
      return {
        date: String(event.date || ''),
        time: String(event.time || '').trim(),
        name: String(event.name || event.event || '').trim(),
        location: String(event.location || '').trim(),
        venue: venueOf(event)
      };
    }).filter(function (event) {
      return /^\d{4}-\d{2}-\d{2}$/.test(event.date) && event.name;
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.name < b.name ? -1 : 1;
    });
  }

  function upcomingEvents(events, today) {
    var day = String(today || '');
    return (events || []).filter(function (event) { return event.date >= day; });
  }

  function monthCells(year, month, events) {
    var first = new Date(Date.UTC(year, month - 1, 1));
    var lead = first.getUTCDay();
    var count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var cells = [];
    var i;
    for (i = 0; i < lead; i++) cells.push(null);
    for (i = 1; i <= count; i++) {
      var iso = year + '-' + pad(month) + '-' + pad(i);
      cells.push({
        iso: iso,
        day: i,
        events: (events || []).filter(function (event) { return event.date === iso; })
      });
    }
    while (cells.length % 7) cells.push(null);
    return cells;
  }

  function monthTitle(year, month) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function formatLong(iso) {
    var parts = String(iso || '').split('-');
    if (parts.length < 3) return String(iso || '');
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))));
  }

  function percentOf(part, whole) {
    if (!whole) return '0%';
    return Math.round((Number(part) / Number(whole)) * 100) + '%';
  }

  function countLine(part, whole) {
    return String(part) + ' of ' + String(whole);
  }

  function externalExample() {
    return [
      { name: 'Lunch & Learn', attended: 24, capacity: 40 },
      { name: 'Ribbon Cutting', attended: 18, capacity: 30 },
      { name: 'Happy Hour', attended: 32, capacity: 50 }
    ];
  }

  function renderPeople(people) {
    if (!people || !people.length) return '<li class="portal-empty">No shifts in this period.</li>';
    return people.map(function (person) {
      var shifts = person.shifts === 1 ? '1 shift' : person.shifts + ' shifts';
      return '<li><span class="portal-person">' + escapeHtml(person.name) + '</span> <span class="portal-shift-count">' + shifts + '</span></li>';
    }).join('');
  }

  function renderDashboard(model, problem) {
    var external = externalExample().map(function (row) {
      return '<li><span class="portal-person">' + escapeHtml(row.name) + '</span> ' +
        '<strong>' + countLine(row.attended, row.capacity) + '</strong> ' +
        '<span class="portal-context">' + percentOf(row.attended, row.capacity) + '</span> ' +
        '<span class="portal-example-tag">Example data</span></li>';
    }).join('');
    var externalCard = '<section class="portal-metric" aria-labelledby="external-title">' +
      '<h3 id="external-title">External participation</h3>' +
      '<p class="portal-soon">Coming soon / example layout</p>' +
      '<p>Attendance by event type is not connected yet. The numbers below are example data.</p>' +
      '<ul class="portal-people">' + external + '</ul></section>';
    if (!model) {
      return '<p class="form-error" role="alert">' + escapeHtml((problem && problem.error) || 'The dashboard could not be loaded.') + '</p>' + externalCard;
    }
    var quarter = model.participation.quarter;
    var year = model.participation.year;
    var capacity = model.capacity;
    var quarterRatio = countLine(quarter.volunteers, year.volunteers);
    var quarterPct = percentOf(quarter.volunteers, year.volunteers);
    var seatRatio = countLine(capacity.filled, capacity.seats);
    var seatPct = percentOf(capacity.filled, capacity.seats);
    var events = (capacity.events || []).map(function (event) {
      var roles = (event.roles || []).map(function (role) {
        var names = (role.names || []).map(escapeHtml).join(', ');
        var flag = role.open ? ' <span class="portal-open">Open</span>' : '';
        return '<li><span class="portal-person">' + escapeHtml(role.task) + '</span> ' +
          '<strong>' + countLine(role.filled, role.capacity) + '</strong>' + flag +
          (names ? '<span class="portal-role-names">' + names + '</span>' : '') + '</li>';
      }).join('');
      return '<li><p class="portal-kicker">' + escapeHtml(event.name) + '</p>' +
        '<p class="portal-when">' + escapeHtml(formatLong(event.date)) + (event.time ? ' · ' + escapeHtml(event.time) : '') + '</p>' +
        '<p class="portal-where">' + escapeHtml(event.venue || 'Venue to be announced') + '</p>' +
        '<ul class="portal-people">' + roles + '</ul></li>';
    }).join('');
    if (!events) events = '<li class="portal-empty">No upcoming events.</li>';
    return '<p class="portal-dash-note">' + escapeHtml(model.note || '') + '</p>' +
      '<section class="portal-metric" aria-labelledby="participation-title">' +
      '<h3 id="participation-title">Internal participation</h3>' +
      '<p class="portal-metric-label">' + escapeHtml(quarter.label) + ' volunteers, of year-to-date volunteers</p>' +
      '<p class="portal-metric-main">' + quarterRatio + ' <span class="portal-context">' + quarterPct + '</span></p>' +
      '<p class="portal-metric-sub">' + quarter.shifts + ' shifts this quarter · ' + year.shifts + ' shifts in ' + escapeHtml(year.label) + ' · ' + year.volunteers + ' volunteers in ' + escapeHtml(year.label) + '</p>' +
      '<h4>Shifts per volunteer this quarter</h4>' +
      '<ul class="portal-people">' + renderPeople(quarter.people) + '</ul></section>' +
      '<section class="portal-metric" aria-labelledby="capacity-title">' +
      '<h3 id="capacity-title">Internal capacity</h3>' +
      '<p class="portal-metric-label">Upcoming seats filled</p>' +
      '<p class="portal-metric-main">' + seatRatio + ' <span class="portal-context">' + seatPct + '</span></p>' +
      '<p class="portal-metric-sub">' + capacity.openRoles + (capacity.openRoles === 1 ? ' role still open' : ' roles still open') + '</p>' +
      '<ul class="portal-event-roles">' + events + '</ul></section>' +
      externalCard;
  }

  root.ABAPortal = {
    WEEKDAYS: WEEKDAYS,
    venueOf: venueOf,
    eventsFromCatalog: eventsFromCatalog,
    upcomingEvents: upcomingEvents,
    monthCells: monthCells,
    monthTitle: monthTitle,
    percentOf: percentOf,
    countLine: countLine,
    renderDashboard: renderDashboard,
    externalExample: externalExample
  };
})(typeof window !== 'undefined' ? window : globalThis);
