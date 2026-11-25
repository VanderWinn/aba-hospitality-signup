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

  var DRILL_DIMS = [
    { id: 'person', label: 'Person' },
    { id: 'role', label: 'Role' },
    { id: 'event', label: 'Event' },
    { id: 'date', label: 'Date' }
  ];
  var DEFAULT_ORDER = ['person', 'role', 'event', 'date'];
  var EXTERNAL_ORDER = ['person', 'event', 'date'];
  // Top-level dashboard sections. Add or reorder views here.
  var DASHBOARD_SECTIONS = [
    { id: 'internal', title: 'Internal volunteering' },
    { id: 'external', title: 'External attendance' }
  ];

  function emptyFilters() {
    return { person: [], role: [], event: [], category: [], from: '', to: '' };
  }

  function defaultDashboardState() {
    return { order: DEFAULT_ORDER.slice(), path: [], extPath: [], filters: emptyFilters(), drawer: false };
  }

  function dimLabel(id) {
    for (var i = 0; i < DRILL_DIMS.length; i++) if (DRILL_DIMS[i].id === id) return DRILL_DIMS[i].label;
    return id;
  }

  function shortDate(iso) {
    var parts = String(iso || '').split('-');
    if (parts.length < 3) return String(iso || '');
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))));
  }

  function collectShifts(model) {
    var shifts = [];
    ((model && model.chart && model.chart.people) || []).forEach(function (person) {
      (person.events || []).forEach(function (event) {
        shifts.push({
          personId: person.id,
          person: person.name,
          company: person.company || '',
          role: event.task || '',
          event: event.name || '',
          eventKey: event.date + '|' + (event.name || ''),
          date: event.date,
          month: event.month || String(event.date || '').slice(0, 7),
          venue: event.venue || '',
          capacity: event.capacity || 1,
          slot: event.slot || (event.date + '|' + event.name + '|' + event.task)
        });
      });
    });
    return shifts;
  }

  function exampleShifts() {
    return [
      { personId: 'g1', person: 'Example Guest A', company: 'Example Co', role: 'Attendance', event: 'Lunch & Learn', eventKey: '2026-11-19|Lunch & Learn', date: '2026-11-19', month: '2026-11', venue: 'Amway', capacity: 40, slot: 'ex1' },
      { personId: 'g1', person: 'Example Guest A', company: 'Example Co', role: 'Attendance', event: 'Happy Hour', eventKey: '2026-12-09|Happy Hour', date: '2026-12-09', month: '2026-12', venue: 'Ada Hotel', capacity: 50, slot: 'ex2' },
      { personId: 'g2', person: 'Example Guest B', company: '', role: 'Attendance', event: 'Ribbon Cutting', eventKey: '2026-11-17|Ribbon Cutting', date: '2026-11-17', month: '2026-11', venue: 'Riverside Links', capacity: 30, slot: 'ex3' },
      { personId: 'g3', person: 'Example Guest C', company: '', role: 'Attendance', event: 'Happy Hour', eventKey: '2026-10-14|Happy Hour', date: '2026-10-14', month: '2026-10', venue: 'Schnitz', capacity: 50, slot: 'ex4' }
    ];
  }

  function shiftKey(shift, dim) {
    if (dim === 'person') return shift.personId;
    if (dim === 'role') return shift.role;
    if (dim === 'event') return shift.event;
    if (dim === 'date') return shift.date;
    return '';
  }

  function shiftLabel(shift, dim) {
    if (dim === 'person') return shift.person;
    if (dim === 'role') return shift.role;
    if (dim === 'event') return shift.event;
    if (dim === 'date') return shortDate(shift.date);
    return '';
  }

  function shiftSub(shift, dim) {
    if (dim === 'person') return shift.company || 'Person';
    if (dim === 'date') return shift.venue || '';
    if (dim === 'event') return shift.venue || '';
    return '';
  }

  function applyFilters(shifts, filters) {
    filters = filters || emptyFilters();
    return (shifts || []).filter(function (shift) {
      if (filters.person && filters.person.length && filters.person.indexOf(shift.personId) === -1) return false;
      if (filters.role && filters.role.length && filters.role.indexOf(shift.role) === -1) return false;
      if (filters.event && filters.event.length && filters.event.indexOf(shift.eventKey) === -1) return false;
      if (filters.category && filters.category.length && filters.category.indexOf(shift.event) === -1) return false;
      if (filters.from && shift.date < filters.from) return false;
      if (filters.to && shift.date > filters.to) return false;
      return true;
    });
  }

  function applyPath(shifts, order, path) {
    return (shifts || []).filter(function (shift) {
      for (var i = 0; i < (path || []).length; i++) {
        if (shiftKey(shift, order[i]) !== path[i].key) return false;
      }
      return true;
    });
  }

  function opportunityTotal(shifts) {
    var slots = {};
    (shifts || []).forEach(function (shift) {
      if (shift.slot) slots[shift.slot] = shift.capacity || 1;
    });
    var total = 0;
    Object.keys(slots).forEach(function (slot) { total += slots[slot]; });
    return total;
  }

  function groupShifts(shifts, dim) {
    var map = {};
    var order = [];
    (shifts || []).forEach(function (shift) {
      var key = shiftKey(shift, dim);
      if (!key) return;
      if (!map[key]) {
        map[key] = { key: key, label: shiftLabel(shift, dim), sub: shiftSub(shift, dim), count: 0, slots: {}, shifts: [] };
        order.push(key);
      }
      var item = map[key];
      item.count += 1;
      item.shifts.push(shift);
      if (shift.slot) item.slots[shift.slot] = shift.capacity || 1;
    });
    var items = order.map(function (key) {
      var item = map[key];
      var opp = 0;
      Object.keys(item.slots).forEach(function (slot) { opp += item.slots[slot]; });
      item.opportunities = opp || item.count;
      return item;
    });
    items.sort(function (a, b) { return b.count - a.count || (a.label < b.label ? -1 : 1); });
    return items;
  }

  function dashboardHash(state) {
    state = state || defaultDashboardState();
    var parts = ['order=' + (state.order || DEFAULT_ORDER).join('.')];
    if (state.path && state.path.length) parts.push('path=' + state.path.map(function (step) { return encodeURIComponent(step.key); }).join('/'));
    if (state.extPath && state.extPath.length) parts.push('ext=' + state.extPath.map(function (step) { return encodeURIComponent(step.key); }).join('/'));
    var filters = state.filters || emptyFilters();
    if (filters.person.length) parts.push('person=' + filters.person.map(encodeURIComponent).join(','));
    if (filters.role.length) parts.push('role=' + filters.role.map(encodeURIComponent).join(','));
    if (filters.event.length) parts.push('event=' + filters.event.map(encodeURIComponent).join(','));
    if (filters.category.length) parts.push('category=' + filters.category.map(encodeURIComponent).join(','));
    if (filters.from) parts.push('from=' + filters.from);
    if (filters.to) parts.push('to=' + filters.to);
    return parts.join('&');
  }

  function splitList(value) {
    if (!value) return [];
    return value.split(',').map(function (part) {
      try { return decodeURIComponent(part); } catch (err) { return part; }
    }).filter(Boolean);
  }

  function labelPath(shifts, order, path) {
    return (path || []).map(function (step, index) {
      var dim = order[index];
      var match = null;
      (shifts || []).some(function (shift) {
        if (shiftKey(shift, dim) === step.key) { match = shift; return true; }
        return false;
      });
      return { dim: dim, key: step.key, label: match ? shiftLabel(match, dim) : step.label };
    });
  }

  function dashboardStateFromHash(hash) {
    var state = defaultDashboardState();
    var query = String(hash || '').replace(/^#/, '');
    if (!query) return state;
    var bag = {};
    query.split('&').forEach(function (pair) {
      var bits = pair.split('=');
      bag[decodeURIComponent(bits[0] || '')] = bits.slice(1).join('=');
    });
    if (bag.order) {
      var order = bag.order.split('.').filter(function (id) {
        return DEFAULT_ORDER.indexOf(id) !== -1;
      });
      if (order.length === 4) state.order = order;
    }
    function steps(raw, order) {
      if (!raw) return [];
      return raw.split('/').map(function (key, index) {
        return { dim: order[index], key: decodeURIComponent(key), label: decodeURIComponent(key) };
      }).filter(function (step) { return step.dim && step.key; });
    }
    state.path = steps(bag.path, state.order);
    state.extPath = steps(bag.ext, EXTERNAL_ORDER);
    state.filters.person = splitList(bag.person);
    state.filters.role = splitList(bag.role);
    state.filters.event = splitList(bag.event);
    state.filters.category = splitList(bag.category);
    state.filters.from = bag.from || '';
    state.filters.to = bag.to || '';
    return state;
  }

  function reorderDrill(order, index, nextId) {
    var list = (order || DEFAULT_ORDER).slice();
    var taken = list.indexOf(nextId);
    if (taken === -1) return list;
    var previous = list[index];
    list[index] = nextId;
    list[taken] = previous;
    return list;
  }

  function sourceTabs(source) {
    var external = source === 'external';
    return '<div class="lens-tabs source-tabs" role="tablist" aria-label="Source">' +
      '<button type="button" role="tab" data-source="internal" class="' + (external ? '' : 'is-on') + '" aria-selected="' + (!external) + '">Internal</button>' +
      '<button type="button" role="tab" data-source="external" class="' + (external ? 'is-on' : '') + '" aria-selected="' + external + '">External</button>' +
      '</div>';
  }

  function filterChoices(shifts) {
    var people = [];
    var roles = [];
    var events = [];
    var categories = ['Lunch & Learn', 'Ribbon Cutting', 'Happy Hour'];
    var seen = { person: {}, role: {}, event: {}, category: {} };
    categories.forEach(function (name) { seen.category[name] = true; });
    (shifts || []).forEach(function (shift) {
      if (shift.personId && !seen.person[shift.personId]) {
        seen.person[shift.personId] = true;
        people.push({ value: shift.personId, label: shift.person });
      }
      if (shift.role && !seen.role[shift.role]) {
        seen.role[shift.role] = true;
        roles.push({ value: shift.role, label: shift.role });
      }
      if (shift.eventKey && !seen.event[shift.eventKey]) {
        seen.event[shift.eventKey] = true;
        events.push({ value: shift.eventKey, label: shortDate(shift.date) + ' · ' + shift.event });
      }
      if (shift.event && !seen.category[shift.event]) {
        seen.category[shift.event] = true;
        categories.push(shift.event);
      }
    });
    people.sort(function (a, b) { return a.label < b.label ? -1 : 1; });
    roles.sort(function (a, b) { return a.label < b.label ? -1 : 1; });
    events.sort(function (a, b) { return a.label < b.label ? -1 : 1; });
    return { people: people, roles: roles, events: events, categories: categories.map(function (name) { return { value: name, label: name }; }) };
  }

  function choiceMenu(name, label, choices, selected) {
    var boxes = choices.map(function (choice) {
      var on = selected.indexOf(choice.value) !== -1;
      return '<label class="filter-choice"><input type="checkbox" data-filter="' + name + '" value="' + escapeHtml(choice.value) + '"' + (on ? ' checked' : '') + '> ' + escapeHtml(choice.label) + '</label>';
    }).join('');
    var count = selected.length ? ' (' + selected.length + ')' : '';
    return '<details class="filter-menu"><summary>' + label + count + '</summary><div class="filter-menu-list">' + (boxes || '<p class="portal-dash-note">None yet</p>') + '</div></details>';
  }

  function filterBar(shifts, state) {
    var filters = state.filters || emptyFilters();
    var choices = filterChoices(shifts);
    var menus = choiceMenu('person', 'Person', choices.people, filters.person) +
      choiceMenu('role', 'Role', choices.roles, filters.role) +
      choiceMenu('event', 'Event', choices.events, filters.event) +
      choiceMenu('category', 'Event category', choices.categories, filters.category) +
      '<label class="filter-date">From <input type="date" data-filter-date="from" value="' + escapeHtml(filters.from) + '"></label>' +
      '<label class="filter-date">To <input type="date" data-filter-date="to" value="' + escapeHtml(filters.to) + '"></label>';
    var groups = (state.order || DEFAULT_ORDER).map(function (id, index) {
      var options = DRILL_DIMS.map(function (dim) {
        return '<option value="' + dim.id + '"' + (dim.id === id ? ' selected' : '') + '>' + dim.label + '</option>';
      }).join('');
      return '<label class="group-slot">' + (index + 1) + ' <select data-order-index="' + index + '">' + options + '</select></label>';
    }).join('');
    var chips = [];
    function addChips(list, kind, lookup) {
      (list || []).forEach(function (value) {
        var label = value;
        (lookup || []).forEach(function (choice) { if (choice.value === value) label = choice.label; });
        var chipNames = { person: 'Person', role: 'Role', event: 'Event', category: 'Event category' };
        chips.push('<button type="button" class="filter-chip" data-clear-filter="' + kind + '" data-clear-value="' + escapeHtml(value) + '">' + escapeHtml(chipNames[kind] || kind) + ': ' + escapeHtml(label) + ' ×</button>');
      });
    }
    addChips(filters.person, 'person', choices.people);
    addChips(filters.role, 'role', choices.roles);
    addChips(filters.event, 'event', choices.events);
    addChips(filters.category, 'category', choices.categories);
    if (filters.from) chips.push('<button type="button" class="filter-chip" data-clear-filter="from">From ' + escapeHtml(filters.from) + ' ×</button>');
    if (filters.to) chips.push('<button type="button" class="filter-chip" data-clear-filter="to">To ' + escapeHtml(filters.to) + ' ×</button>');
    var chipRow = chips.length ? '<div class="filter-chips">' + chips.join('') + '<button type="button" class="filter-clear" data-clear="all">Clear all</button></div>' : '';
    return '<div class="filter-bar">' +
      '<button type="button" class="filter-open" data-filter-toggle>Filters</button>' +
      '<div class="filter-drawer' + (state.drawer ? ' is-open' : '') + '" id="filter-drawer">' +
      '<div class="filter-menus">' + menus + '</div>' +
      '<div class="group-by"><span>Group by</span>' + groups + '</div>' +
      chipRow +
      '</div></div>';
  }

  function crumbs(path, section) {
    var html = '<nav class="portal-crumbs" aria-label="Drill"><button type="button" data-crumb="0" data-section="' + section + '">Overall</button>';
    (path || []).forEach(function (step, index) {
      html += '<span class="crumb-sep">&gt;</span><button type="button" data-crumb="' + (index + 1) + '" data-section="' + section + '">' + escapeHtml(step.label) + '</button>';
    });
    return html + '</nav>';
  }

  function monthBars(shifts, opportunities) {
    var map = {};
    var order = [];
    (shifts || []).forEach(function (shift) {
      if (!map[shift.month]) {
        map[shift.month] = 0;
        order.push(shift.month);
      }
      map[shift.month] += 1;
    });
    order.sort();
    var total = 0;
    order.forEach(function (key) { total += map[key]; });
    var items = order.map(function (key) {
      var parts = key.split('-');
      var label = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })
        .format(new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, 1)));
      return { label: label, value: map[key], attrs: 'data-month-filter="' + key + '"' };
    });
    if (items.length) items.push({ label: 'Total', value: total, accent: true, totalBar: true });
    return items.length ? '<h3 class="action-title">Shifts by Month</h3>' + verticalChart(items) : '';
  }

  function detailTable(shifts) {
    var rows = (shifts || []).map(function (shift) {
      return '<tr><td>' + escapeHtml(shift.person) + '</td><td>' + escapeHtml(shift.role) + '</td><td>' + escapeHtml(shift.event) + '</td><td>' + escapeHtml(shortDate(shift.date)) + '</td><td>' + escapeHtml(shift.venue) + '</td></tr>';
    }).join('');
    return '<table class="portal-table"><thead><tr><th>Person</th><th>Role</th><th>Event</th><th>Date</th><th>Venue</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5">No shifts match these filters.</td></tr>') + '</tbody></table>';
  }

  function drillBody(shifts, order, path, section, opportunities, options) {
    var narrowed = applyPath(shifts, order, path);
    var html = crumbs(path, section);
    if ((path || []).length >= order.length) {
      var leaf = path.length ? path[path.length - 1].label : 'Shifts';
      return html + '<h3 class="action-title">' + escapeHtml(leaf) + '</h3>' + detailTable(narrowed);
    }
    var dim = order[path.length];
    var items = groupShifts(narrowed, dim);
    var total = 0;
    items.forEach(function (item) { total += item.count; });
    var year = !(options && options.scoped) && !path.length && dim === 'person' && opportunities ? opportunities : 0;
    var share = options && options.share;
    var header = path.length ? path[path.length - 1].label : ((options && options.kicker) || ('Shifts by ' + dimLabel(dim)));
    var kicker = path.length ? dimLabel(dim) : '';
    var rows = items.map(function (item, index) {
      var base = year || (share ? total : (item.opportunities || total || item.count));
      var shown = year ? year : (share ? 0 : (item.opportunities || 0));
      var pct = percentOf(item.count, base);
      return {
        rank: index + 1,
        title: item.label,
        sub: item.sub,
        count: shown ? countLine(item.count, shown) : String(item.count),
        pct: parseInt(pct, 10) || 0,
        pctLabel: pct,
        accent: section !== 'external' && index === 0,
        attrs: 'data-step="' + escapeHtml(item.key) + '" data-label="' + escapeHtml(item.label) + '" data-section="' + section + '"'
      };
    });
    var table = '<table class="portal-table"><thead><tr><th>' + escapeHtml(dimLabel(dim)) + '</th><th>Shifts</th><th>Share</th></tr></thead><tbody>' +
      rows.map(function (row) {
        return '<tr><td>' + escapeHtml(row.title) + '</td><td><strong>' + escapeHtml(row.count) + '</strong></td><td>' + row.pctLabel + '</td></tr>';
      }).join('') + '</tbody></table>';
    if (!rows.length) table = '<p class="portal-dash-note">No shifts match these filters.</p>';
    return html + (kicker ? '<p class="panel-kicker">' + escapeHtml(kicker) + '</p>' : '') +
      '<h3 class="action-title">' + escapeHtml(header) + '</h3>' +
      (rows.length ? rankTable(rows) : '') + table;
  }

  function internalSection(model, shifts, state) {
    var chart = model.chart || {};
    var path = state.path || [];
    var opportunities = chart.opportunities || 0;
    var filters = state.filters || emptyFilters();
    var scoped = !!(path.length || filters.person.length || filters.role.length || filters.event.length || filters.category.length || filters.from || filters.to);
    var html = '<section class="panel section-internal" data-section-panel="internal">';
    if (!path.length) {
      var people = {};
      shifts.forEach(function (shift) { people[shift.personId] = true; });
      var volunteerCount = Object.keys(people).length;
      var shiftCount = shifts.length;
      var offered = scoped ? Math.max(opportunityTotal(shifts), shiftCount) : Math.max(opportunities, shiftCount, 1);
      html += '<div class="ring-row">' +
        '<div class="ring-tile"><p class="kpi-num">' + volunteerCount + '</p><p class="ring-label">Volunteers</p></div>' +
        '<div class="ring-tile"><p class="kpi-num">' + shiftCount + '</p><p class="ring-label">Shifts</p></div>' +
        ring(shiftCount, offered, 'Opportunities') +
        '</div>';
      html += monthBars(shifts, opportunities);
    }
    html += drillBody(shifts, state.order || DEFAULT_ORDER, path, 'internal', opportunities, { scoped: scoped });
    if (!chart.companyAvailable && !path.length) {
      html += '<p class="portal-dash-note">Company grouping is ready. The sign-up sheet has no company field yet, so people are listed by name.</p>';
    }
    return html + '</section>';
  }

  function externalSection(state, filters) {
    var shifts = applyFilters(exampleShifts(), filters);
    return '<section class="panel section-external" data-section-panel="external">' +
      '<p class="panel-kicker">External</p>' +
      '<p class="portal-dash-note">Example data. Coming soon.</p>' +
      drillBody(shifts, EXTERNAL_ORDER, state.extPath || [], 'external', 0, { kicker: 'Attendance by Person', share: true }) +
      '</section>';
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

  function overview(model, state) {
    if (!state || !state.order) state = defaultDashboardState();
    var all = collectShifts(model);
    state = {
      order: state.order,
      path: labelPath(all, state.order, state.path),
      extPath: labelPath(exampleShifts(), EXTERNAL_ORDER, state.extPath),
      filters: state.filters || emptyFilters(),
      drawer: !!state.drawer
    };
    var shifts = applyFilters(all, state.filters);
    var html = filterBar(all, state);
    DASHBOARD_SECTIONS.forEach(function (section) {
      if (section.id === 'internal') html += internalSection(model, shifts, state);
      if (section.id === 'external') html += externalSection(state, state.filters);
    });
    return html;
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
    return overview(model, view && view.order ? view : defaultDashboardState());
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
    externalExample: externalExample,
    dashboardHash: dashboardHash,
    dashboardStateFromHash: dashboardStateFromHash,
    defaultDashboardState: defaultDashboardState,
    reorderDrill: reorderDrill,
    applyFilters: applyFilters,
    collectShifts: collectShifts
  };
})(typeof window !== 'undefined' ? window : globalThis);
