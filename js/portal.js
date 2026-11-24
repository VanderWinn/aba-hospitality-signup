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

  function eventKey(event) {
    return event.date + '|' + event.name;
  }

  function halfCoverage(people) {
    var total = 0;
    (people || []).forEach(function (person) { total += person.total || 0; });
    var covered = 0;
    var count = 0;
    var shifts = 0;
    for (var i = 0; i < (people || []).length; i++) {
      covered += people[i].total;
      shifts += people[i].total;
      count += 1;
      if (covered * 2 >= total) break;
    }
    return { total: total, people: count, shifts: shifts };
  }

  function dashboardStory(model) {
    var chart = model && model.chart || { months: [], people: [] };
    var months = chart.months || [];
    var people = chart.people || [];
    var half = halfCoverage(people);
    var accent = months.length ? months[months.length - 1] : null;
    var previous = months.length > 1 ? months[months.length - 2] : null;
    var movement = 'held steady in';
    if (accent && previous) {
      if (accent.shifts > previous.shifts) movement = 'rose in';
      else if (accent.shifts < previous.shifts) movement = 'fell in';
    }
    var peopleWord = half.people === 1 ? 'person covered' : 'people covered';
    var headline = 'No hospitality shifts are recorded for this year yet.';
    if (half.total && accent && previous) {
      headline = 'Hospitality volunteering ' + movement + ' ' + accent.label + '; ' + half.people + ' ' + peopleWord + ' half of all shifts.';
    } else if (half.total && accent) {
      headline = half.people + ' ' + peopleWord + ' half of the ' + half.total + ' hospitality shifts in ' + accent.label + '.';
    }
    return {
      headline: headline,
      chartTitle: half.total
        ? half.people + ' of ' + people.length + ' volunteers covered ' + half.shifts + ' of ' + half.total + ' shifts'
        : 'No shifts to chart yet',
      halfCount: half.people,
      accentMonth: accent ? accent.key : ''
    };
  }

  function crumb(viewLabel) {
    return '<nav class="portal-crumbs" aria-label="Dashboard"><button type="button" data-dash="overview">Overview</button><span>' + escapeHtml(viewLabel) + '</span></nav>';
  }

  function ring(part, whole, label) {
    var ratio = whole ? Math.max(0, Math.min(1, Number(part) / Number(whole))) : 0;
    var radius = 42;
    var length = 2 * Math.PI * radius;
    var drawn = (ratio * length).toFixed(1);
    var rest = (length - ratio * length).toFixed(1);
    return '<div class="ring-tile"><svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="42" fill="none" stroke="#e6e6e6" stroke-width="10"></circle>' +
      '<circle cx="60" cy="60" r="42" fill="none" stroke="#407589" stroke-width="10" stroke-dasharray="' + drawn + ' ' + rest + '" transform="rotate(-90 60 60)"></circle>' +
      '<text x="60" y="56" text-anchor="middle" font-size="28" font-weight="700" fill="#39393a" font-family="Montserrat, Segoe UI, sans-serif">' + part + '</text>' +
      '<text x="60" y="74" text-anchor="middle" font-size="11" fill="#757575" font-family="Montserrat, Segoe UI, sans-serif">of ' + whole + '</text>' +
      '</svg><p class="ring-label">' + countLine(part, whole) + ' ' + escapeHtml(label) + ' <span>' + percentOf(part, whole) + '</span></p></div>';
  }

  function sparkline(values) {
    var width = 128;
    var height = 36;
    var max = 1;
    values.forEach(function (value) { if (value > max) max = value; });
    var points = values.map(function (value, index) {
      var x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - 4) + 2;
      var y = height - 4 - ((value / max) * (height - 10));
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var last = points.length ? points[points.length - 1].split(',') : ['2', '18'];
    return '<svg class="spark" viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">' +
      '<polyline points="' + points.join(' ') + '" fill="none" stroke="#c8c8c8" stroke-width="2"></polyline>' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" fill="#407589"></circle></svg>';
  }

  function verticalChart(items) {
    var max = 1;
    var total = 0;
    items.forEach(function (item) {
      if (item.value > max) max = item.value;
      if (!item.totalBar) total += item.value;
    });
    var bars = items.map(function (item) {
      var height = Math.max(item.value ? 8 : 0, Math.round((item.value / max) * 100));
      var focus = item.accent ? ' is-focus' : '';
      var column = item.attrs
        ? '<button type="button" class="vbar-col' + focus + '" style="height:' + height + '%" ' + item.attrs + '></button>'
        : '<span class="vbar-col' + focus + '" style="height:' + height + '%"></span>';
      return '<div class="vbar"><span class="vbar-value">' + item.value + '</span>' + column +
        '<span class="vbar-label">' + escapeHtml(item.label) + '</span></div>';
    }).join('');
    var chips = items.filter(function (item) { return !item.totalBar; }).map(function (item) {
      return '<button type="button" class="share-chip' + (item.accent ? ' is-focus' : '') + '" ' + (item.attrs || '') + '>' +
        '<span>' + escapeHtml(item.label) + '</span> <strong>' + item.value + '</strong> <span>' + percentOf(item.value, total) + '</span></button>';
    }).join('');
    return '<div class="vchart"><div class="vbars" aria-hidden="false">' + bars + '</div><div class="share-chips">' + chips + '</div></div>';
  }

  function progressTable(rows) {
    if (!rows.length) return '<p class="portal-empty">Nothing to show yet.</p>';
    return '<div class="progress-table">' + rows.map(function (row) {
      var width = Math.max(0, Math.min(100, row.pct));
      var inside = width >= 28 ? row.pctLabel : '';
      var outside = width < 28 ? '<span class="progress-pct">' + row.pctLabel + '</span>' : '';
      return '<button type="button" class="progress-row" ' + (row.attrs || '') + '>' +
        '<span class="progress-copy"><span class="progress-title">' + escapeHtml(row.title) + '</span>' +
        '<span class="progress-sub">' + escapeHtml(row.sub || '') + '</span></span>' +
        '<span class="progress-count">' + escapeHtml(row.count) + '</span>' +
        '<span class="progress-track"><span class="progress-fill' + (row.accent ? ' is-focus' : '') + '" style="width:' + width + '%">' + inside + '</span></span>' +
        outside + '</button>';
    }).join('') + '</div>';
  }

  function panel(title, body) {
    return '<section class="panel"><p class="panel-kicker">' + escapeHtml(title) + '</p>' + body + '</section>';
  }

  function externalCard() {
    var rows = externalExample().map(function (row) {
      var pct = row.capacity ? Math.round((row.attended / row.capacity) * 100) : 0;
      return { title: row.name, sub: 'Example data', count: countLine(row.attended, row.capacity), pct: pct, pctLabel: pct + '%', accent: false };
    });
    return '<section class="panel" aria-labelledby="external-title">' +
      '<p class="panel-kicker" id="external-title">External participation</p>' +
      '<h3 class="action-title">External attendance is not connected yet</h3>' +
      '<p class="portal-soon">Coming soon / example layout</p>' +
      '<p class="portal-dash-note">The numbers below are example data, not attendance from an event.</p>' +
      progressTable(rows) + '</section>';
  }

  function monthItems(model, story, accentOnly) {
    var months = (model.chart && model.chart.months) || [];
    var items = months.map(function (month) {
      return {
        label: month.short,
        value: month.shifts,
        accent: !accentOnly && month.key === story.accentMonth,
        attrs: 'data-month="' + escapeHtml(month.key) + '"'
      };
    });
    var total = 0;
    months.forEach(function (month) { total += month.shifts; });
    items.push({ label: 'Total', value: total, accent: false, totalBar: true });
    return items;
  }

  function overview(model) {
    var story = dashboardStory(model);
    var quarter = model.participation.quarter;
    var year = model.participation.year;
    var capacity = model.capacity;
    var people = (model.chart && model.chart.people) || [];
    var months = (model.chart && model.chart.months) || [];
    var series = months.map(function (month) { return month.shifts; });
    var latest = months.length ? months[months.length - 1] : null;
    var top = people.slice(0, 4).map(function (person, index) {
      return '<li><button type="button" data-person="' + escapeHtml(person.id) + '"><span>' + escapeHtml(person.name) +
        '</span><strong>' + person.total + '</strong></button></li>';
    }).join('');
    var personRows = people.map(function (person, index) {
      var pct = story && people.length ? Math.round((person.total / ((model.chart.months || []).reduce(function (sum, month) { return sum + month.shifts; }, 0) || 1)) * 100) : 0;
      return {
        title: person.name,
        sub: person.total === 1 ? '1 shift' : person.total + ' shifts',
        count: String(person.total),
        pct: pct,
        pctLabel: pct + '%',
        accent: index < story.halfCount,
        attrs: 'data-person="' + escapeHtml(person.id) + '"'
      };
    });
    var yearShifts = (model.chart && model.chart.months || []).reduce(function (sum, month) { return sum + month.shifts; }, 0) || year.shifts;
    personRows.forEach(function (row, index) {
      var pct = yearShifts ? Math.round((people[index].total / yearShifts) * 100) : 0;
      row.pct = pct;
      row.pctLabel = pct + '%';
    });
    var eventRows = (capacity.events || []).map(function (event) {
      var filled = 0;
      var seats = 0;
      (event.roles || []).forEach(function (role) {
        filled += Math.min(role.filled, role.capacity);
        seats += Number(role.capacity) || 0;
      });
      var pct = seats ? Math.round((filled / seats) * 100) : 0;
      var open = (event.roles || []).filter(function (role) { return role.open; }).length;
      return {
        title: event.name,
        sub: formatLong(event.date) + (event.venue ? ' · ' + event.venue : '') + (open ? ' · ' + open + ' open' : ''),
        count: countLine(filled, seats),
        pct: pct,
        pctLabel: pct + '%',
        accent: open > 0,
        attrs: 'data-event="' + escapeHtml(eventKey(event)) + '"'
      };
    });
    return '<div class="exec-band"><div class="exec-bar"><span>Hospitality dashboard</span><span>' + escapeHtml(model.asOf || '') + '</span></div>' +
      '<p class="portal-headline">' + escapeHtml(story.headline) + '</p>' +
      '<p class="portal-dash-note">' + escapeHtml(model.note || '') + '</p>' +
      '<div class="exec-top">' +
      '<div class="ring-row">' +
      ring(quarter.shifts, year.shifts, quarter.label + ' shifts') +
      ring(quarter.volunteers, year.volunteers, quarter.label + ' volunteers') +
      ring(capacity.filled, capacity.seats, 'Seats filled') +
      '</div>' +
      '<div class="top-card"><p class="panel-kicker">Top by shifts</p><ol class="top-list">' + (top || '<li>No volunteers yet.</li>') + '</ol></div>' +
      '<div class="spark-card"><p class="panel-kicker">Month trend</p><p class="spark-value">' + (latest ? latest.shifts : 0) + '</p>' +
      '<p class="spark-label">' + escapeHtml(latest ? latest.label : 'No months') + '</p>' + sparkline(series) + '</div>' +
      '</div></div>' +
      panel('Shifts by month', '<h3 class="action-title">' + escapeHtml(story.chartTitle) + '</h3>' + verticalChart(monthItems(model, story)) +
        '<p class="portal-chart-note">Gray bars are context. Pine marks ' + escapeHtml((months[months.length - 1] || {}).label || 'the latest month') + '.</p>') +
      panel('Participation by volunteer', '<h3 class="action-title">' + escapeHtml(story.chartTitle) + '</h3>' + progressTable(personRows)) +
      panel('Capacity by event', '<h3 class="action-title">' + (capacity.openRoles || 0) + ' upcoming ' + ((capacity.openRoles === 1) ? 'role is' : 'roles are') + ' still open</h3>' +
        '<p class="portal-dash-note">' + countLine(capacity.filled, capacity.seats) + ' seats filled <span class="portal-context">' + percentOf(capacity.filled, capacity.seats) + '</span></p>' +
        progressTable(eventRows)) +
      externalCard();
  }

  function personView(model, id) {
    var person = ((model.chart && model.chart.people) || []).filter(function (item) { return item.id === id; })[0];
    if (!person) return overview(model);
    var story = dashboardStory(model);
    var total = 0;
    ((model.chart && model.chart.people) || []).forEach(function (item) { total += item.total || 0; });
    var months = (model.chart.months || []).map(function (month) {
      return { label: month.short, value: person.counts[month.key] || 0, accent: month.key === story.accentMonth };
    });
    var peak = 0;
    months.forEach(function (month) { if (month.value > peak) peak = month.value; });
    var rows = (person.events || []).map(function (event) {
      return '<tr><td>' + escapeHtml(formatLong(event.date)) + '</td><td>' + escapeHtml(event.name) + '</td><td>' +
        escapeHtml(event.task) + '</td><td>' + escapeHtml(event.venue || '') + '</td></tr>';
    }).join('');
    if (!rows) rows = '<tr><td colspan="4">No shifts in this list.</td></tr>';
    return '<div class="panel">' + crumb(person.name) +
      '<p class="panel-kicker">Volunteer</p>' +
      '<p class="portal-headline">' + escapeHtml(person.name) + ' covered ' + person.total + ' of ' + total + ' shifts.</p>' +
      '<div class="exec-top exec-top-drill"><div class="ring-row">' + ring(person.total, total, 'Shifts') + '</div>' +
      sparkline(months.map(function (month) { return month.value; })) + '</div>' +
      verticalChart(months.map(function (month) {
        return { label: month.label, value: month.value, accent: month.value === peak && peak > 0, attrs: '' };
      })) +
      '<table class="portal-table"><thead><tr><th>Date</th><th>Event</th><th>Role</th><th>Venue</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function monthView(model, key) {
    var month = ((model.chart && model.chart.months) || []).filter(function (item) { return item.key === key; })[0];
    if (!month) return overview(model);
    var people = ((model.chart && model.chart.people) || []).map(function (person) {
      return {
        name: person.name,
        shifts: person.counts[key] || 0,
        events: (person.events || []).filter(function (event) { return event.month === key; })
      };
    }).filter(function (person) { return person.shifts > 0; });
    people.sort(function (a, b) { return b.shifts - a.shifts || (a.name < b.name ? -1 : 1); });
    var rows = [];
    people.forEach(function (person) {
      person.events.forEach(function (event) {
        rows.push('<tr><td>' + escapeHtml(person.name) + '</td><td>' + escapeHtml(event.name) + '</td><td>' +
          escapeHtml(event.task) + '</td><td>' + escapeHtml(formatLong(event.date)) + '</td></tr>');
      });
    });
    var yearShifts = 0;
    ((model.chart && model.chart.months) || []).forEach(function (item) { yearShifts += item.shifts; });
    return '<div class="panel">' + crumb(month.label) +
      '<p class="panel-kicker">Month</p>' +
      '<p class="portal-headline">' + escapeHtml(month.label) + ' had ' + month.shifts + ' shifts from ' + people.length + ' volunteers.</p>' +
      '<div class="ring-row">' + ring(month.shifts, yearShifts || month.shifts, 'Shifts this month') + '</div>' +
      verticalChart(people.map(function (person, index) {
        return { label: person.name, value: person.shifts, accent: index === 0 };
      }).concat([{ label: 'Total', value: month.shifts, totalBar: true }])) +
      '<table class="portal-table"><thead><tr><th>Volunteer</th><th>Event</th><th>Role</th><th>Date</th></tr></thead><tbody>' +
      (rows.join('') || '<tr><td colspan="4">No shifts this month.</td></tr>') + '</tbody></table></div>';
  }

  function eventView(model, key) {
    var event = ((model.capacity && model.capacity.events) || []).filter(function (item) { return eventKey(item) === key; })[0];
    if (!event) return overview(model);
    var filled = 0;
    var seats = 0;
    (event.roles || []).forEach(function (role) {
      filled += Math.min(role.filled, role.capacity);
      seats += role.capacity;
    });
    var roleRows = (event.roles || []).map(function (role) {
      var pct = role.capacity ? Math.round((Math.min(role.filled, role.capacity) / role.capacity) * 100) : 0;
      return {
        title: role.task,
        sub: (role.names || []).join(', '),
        count: countLine(role.filled, role.capacity),
        pct: pct,
        pctLabel: role.open ? 'Open' : pct + '%',
        accent: role.open
      };
    });
    var rows = (event.roles || []).map(function (role) {
      var names = (role.names || []).map(escapeHtml).join(', ');
      return '<tr><td>' + escapeHtml(role.task) + '</td><td><strong>' + countLine(role.filled, role.capacity) + '</strong></td><td>' +
        (role.open ? '<span class="portal-open">Open</span>' : 'Filled') + '</td><td>' + (names || '') + '</td></tr>';
    }).join('');
    return '<div class="panel">' + crumb(event.name) +
      '<p class="panel-kicker">Capacity</p>' +
      '<p class="portal-headline">' + escapeHtml(event.name) + ' on ' + escapeHtml(formatLong(event.date)) + ' has ' + countLine(filled, seats) + ' seats filled.</p>' +
      '<p class="portal-where">' + escapeHtml(event.venue || '') + (event.time ? ' · ' + escapeHtml(event.time) : '') + '</p>' +
      '<div class="ring-row">' + ring(filled, seats, 'Seats filled') + '</div>' +
      progressTable(roleRows) +
      '<table class="portal-table"><thead><tr><th>Role</th><th>Filled</th><th>Status</th><th>Names</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function renderDashboard(model, problem, view) {
    if (!model) {
      return '<p class="form-error" role="alert">' + escapeHtml((problem && problem.error) || 'The dashboard could not be loaded.') + '</p>' + externalCard();
    }
    var level = view && view.level;
    if (level === 'person') return personView(model, view.id);
    if (level === 'month') return monthView(model, view.key);
    if (level === 'event') return eventView(model, view.key);
    return overview(model);
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
    dashboardStory: dashboardStory,
    renderDashboard: renderDashboard,
    externalExample: externalExample
  };
})(typeof window !== 'undefined' ? window : globalThis);
