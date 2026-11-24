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

  function rankedRows(rows) {
    var max = 1;
    rows.forEach(function (row) { if (row.value > max) max = row.value; });
    return rows.map(function (row, index) {
      var width = Math.round((row.value / max) * 100);
      return {
        title: row.title,
        sub: (row.sub || '') + (index === 0 ? '' : ''),
        count: String(row.value),
        pct: width,
        pctLabel: '',
        accent: index === 0,
        attrs: row.attrs || '',
        rank: index + 1
      };
    });
  }

  function rateRows(rows) {
    return rows.map(function (row, index) {
      var pct = row.whole ? Math.round((row.value / row.whole) * 100) : 0;
      return {
        title: row.title,
        sub: row.sub || '',
        count: countLine(row.value, row.whole),
        pct: pct,
        pctLabel: pct + '%',
        accent: index === 0,
        attrs: row.attrs || '',
        rank: index + 1
      };
    });
  }

  function rankTable(rows) {
    return '<div class="progress-table">' + rows.map(function (row) {
      var width = Math.max(0, Math.min(100, row.pct));
      var inside = width >= 18 && row.pctLabel ? row.pctLabel : '';
      var outside = row.pctLabel && width < 18 ? '<span class="progress-pct">' + row.pctLabel + '</span>' : '';
      return '<button type="button" class="progress-row rank-row" ' + row.attrs + '>' +
        '<span class="rank-num">' + row.rank + '</span>' +
        '<span class="progress-copy"><span class="progress-title">' + escapeHtml(row.title) + '</span>' +
        (row.sub ? '<span class="progress-sub">' + escapeHtml(row.sub) + '</span>' : '') + '</span>' +
        '<span class="progress-count">' + escapeHtml(row.count) + '</span>' +
        '<span class="progress-track"><span class="progress-fill' + (row.accent ? ' is-focus' : '') + '" style="width:' + width + '%">' + inside + '</span></span>' +
        outside + '</button>';
    }).join('') + '</div>';
  }

  function exampleGuests() {
    return [
      { name: 'Example Guest A', attended: 6, offered: 12 },
      { name: 'Example Guest B', attended: 4, offered: 12 },
      { name: 'Example Guest C', attended: 2, offered: 12 }
    ];
  }

  function lensTabs(lens) {
    return '<div class="lens-tabs" role="tablist" aria-label="Lens">' +
      '<button type="button" role="tab" data-lens="person" class="' + (lens === 'person' ? 'is-on' : '') + '" aria-selected="' + (lens === 'person') + '">By person</button>' +
      '<button type="button" role="tab" data-lens="event" class="' + (lens === 'event' ? 'is-on' : '') + '" aria-selected="' + (lens === 'event') + '">By event</button>' +
      '</div>';
  }

  function sourceTabs(source) {
    var external = source === 'external';
    return '<div class="lens-tabs source-tabs" role="tablist" aria-label="Source">' +
      '<button type="button" role="tab" data-source="internal" class="' + (external ? '' : 'is-on') + '" aria-selected="' + (!external) + '">Internal</button>' +
      '<button type="button" role="tab" data-source="external" class="' + (external ? 'is-on' : '') + '" aria-selected="' + external + '">External</button>' +
      '</div>';
  }

  function personLens(model, source) {
    var people = (model.chart && model.chart.people) || [];
    var opportunities = (model.chart && model.chart.opportunities) || 0;
    var companyReady = model.chart && model.chart.companyAvailable;
    var absolute = rankedRows(people.map(function (person) {
      return {
        title: person.name,
        sub: person.company || 'Person',
        value: person.total,
        attrs: 'data-person="' + escapeHtml(person.id) + '"'
      };
    }));
    absolute.forEach(function (row, index) { row.rank = index + 1; });
    var rates = rateRows(people.map(function (person) {
      return {
        title: person.name,
        sub: person.company || 'Person',
        value: person.total,
        whole: opportunities,
        attrs: 'data-person="' + escapeHtml(person.id) + '"'
      };
    }));
    var guests = exampleGuests();
    var guestAbsolute = rankedRows(guests.map(function (guest) {
      return { title: guest.name, sub: 'Example data', value: guest.attended, attrs: '' };
    }));
    guestAbsolute.forEach(function (row, index) { row.rank = index + 1; row.accent = false; });
    var guestRates = rateRows(guests.map(function (guest) {
      return { title: guest.name, sub: 'Example data', value: guest.attended, whole: guest.offered, attrs: '' };
    }));
    guestRates.forEach(function (row) { row.accent = false; });
    var note = companyReady
      ? 'Grouped by company when a company is on the sign-up.'
      : 'Company is not on the sign-up sheet yet. People are listed until a company field is added.';
    if (source === 'external') {
      return '<section class="panel"><p class="portal-soon">Coming soon / example layout</p>' +
        '<h3 class="action-title">Attendance by Person</h3>' + rankTable(guestAbsolute) +
        '<h3 class="action-title">Attendance by Opportunity</h3><p class="portal-dash-note">Example data. Events attended, of events offered.</p>' + rankTable(guestRates) +
        '</section>';
    }
    return '<p class="portal-dash-note">' + note + '</p><section class="panel">' +
      '<h3 class="action-title">Shifts by Person</h3>' + rankTable(absolute) +
      '<h3 class="action-title">Opportunity by Person</h3><p class="portal-dash-note">Shifts filled, of role seats offered this year.</p>' + rankTable(rates) +
      '<h3 class="action-title">Shifts by Month</h3>' + verticalChart(monthItems(model, dashboardStory(model))) + '</section>';
  }

  function eventLens(model, source) {
    var capacity = model.capacity || { events: [] };
    var internal = (capacity.events || []).map(function (event) {
      var filled = 0;
      var seats = 0;
      (event.roles || []).forEach(function (role) {
        filled += Math.min(role.filled, role.capacity);
        seats += Number(role.capacity) || 0;
      });
      var open = (event.roles || []).some(function (role) { return role.open; });
      var pct = seats ? Math.round((filled / seats) * 100) : 0;
      return {
        title: event.name,
        sub: formatLong(event.date) + (event.venue ? ' · ' + event.venue : ''),
        count: countLine(filled, seats),
        pct: pct,
        pctLabel: pct + '%',
        accent: open,
        rank: 0,
        attrs: 'data-event="' + escapeHtml(eventKey(event)) + '"'
      };
    });
    var external = externalExample().map(function (row) {
      var pct = row.capacity ? Math.round((row.attended / row.capacity) * 100) : 0;
      return {
        title: row.name,
        sub: 'Example data',
        count: countLine(row.attended, row.capacity),
        pct: pct,
        pctLabel: pct + '%',
        accent: false,
        rank: 0,
        attrs: ''
      };
    });
    if (source === 'external') {
      return '<section class="panel"><p class="portal-soon">Coming soon / example layout</p>' +
        '<h3 class="action-title">Attendance by Event</h3>' +
        '<p class="portal-dash-note">Example data, until an attendance source is connected.</p>' +
        progressTable(external) + '</section>';
    }
    return '<section class="panel"><h3 class="action-title">Opportunity by Event</h3>' +
      '<p class="portal-dash-note">Roles filled, of roles open. ' + countLine(capacity.filled, capacity.seats) + ' <span class="portal-context">' + percentOf(capacity.filled, capacity.seats) + '</span></p>' +
      progressTable(internal) + '</section>';
  }

  function overview(model, lens, source) {
    var mode = lens === 'event' ? 'event' : 'person';
    var side = source === 'external' ? 'external' : 'internal';
    var body = mode === 'event' ? eventLens(model, side) : personLens(model, side);
    return '<div class="dash-toggles">' + sourceTabs(side) + lensTabs(mode) + '</div>' + body;
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
      '<p class="panel-kicker">Shifts by Month</p>' +
      '<h3 class="action-title">' + escapeHtml(person.name) + '</h3>' +
      '<p class="portal-metric-main">' + person.total + ' <span class="portal-context">of ' + total + ' · ' + percentOf(person.total, total) + '</span></p>' +
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
      '<p class="panel-kicker">Shifts by Person</p>' +
      '<h3 class="action-title">' + escapeHtml(month.label) + '</h3>' +
      '<p class="portal-metric-main">' + month.shifts + ' <span class="portal-context">shifts · ' + people.length + ' volunteers</span></p>' +
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
      '<p class="panel-kicker">Opportunity by Event</p>' +
      '<h3 class="action-title">' + escapeHtml(event.name) + '</h3>' +
      '<p class="portal-metric-main">' + countLine(filled, seats) + ' <span class="portal-context">' + percentOf(filled, seats) + '</span></p>' +
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
    return overview(model, view && view.lens, view && view.source);
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
