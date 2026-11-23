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
          roleDate: task.roleDate || ''
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

  function countLabel(event, task) {
    var ratio = task.filled + ' of ' + task.capacity;
    if (event.past) return ratio + ' · Closed';
    if (task.remaining === 0) return ratio + ' · Full';
    return ratio;
  }

  function renderTask(event, task, mode) {
    var canClaim = mode !== 'preview' && !event.past && task.remaining > 0;
    var names = task.names.length
      ? '<ul class="who">' + task.names.map(function (name) {
        return '<li>' + escapeHtml(name) + '</li>';
      }).join('') + '</ul>'
      : '<p class="who empty">No one yet</p>';
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
      action = '<span class="pill full">Full</span>';
    } else {
      action = '<span class="pill open">Open</span>';
    }
    return '<article class="task" id="' + taskDomId(event, task) + '">' +
      '<div class="task-main">' +
        '<h3><span class="role-name">' + escapeHtml(task.task) + '</span>' +
        (when ? '<span class="role-when">· ' + escapeHtml(when) + '</span>' : '') +
        '<span class="role-count">· ' + escapeHtml(countLabel(event, task)) + '</span></h3>' +
        (task.description ? '<p class="task-desc">' + escapeHtml(task.description) + '</p>' : '') +
      '</div>' +
      '<div class="task-signup">' +
        names +
        '<div class="task-action">' + action + '</div>' +
      '</div>' +
    '</article>';
  }

  function renderEvent(event, mode) {
    var open = 0;
    event.tasks.forEach(function (task) { open += task.remaining; });
    var meta = event.past
      ? 'Past'
      : (open === 0 ? 'Full' : open + ' open');
    var filled = 0;
    var cap = 0;
    event.tasks.forEach(function (task) {
      filled += task.filled;
      cap += task.capacity;
    });
    var pct = cap > 0 ? Math.round((filled / cap) * 100) : 0;
    var place = placeParts(event.location, event.name);
    var where = '<span class="event-where">' +
      '<span class="sep" aria-hidden="true">·</span>' +
      '<span class="event-clock">' + escapeHtml(event.time) + '</span>' +
      (place.name ? '<span class="sep" aria-hidden="true">·</span><span class="event-place"><span class="venue-name">' + escapeHtml(place.name) + '</span>' +
        (place.street ? '<span class="venue-street">, ' + escapeHtml(place.street) + '</span>' : '') + '</span>' : '') +
      '<span class="sep" aria-hidden="true">·</span>' +
      '<span class="event-status">' + escapeHtml(meta) + '</span>' +
    '</span>';
    return '<section class="event' + (event.past ? ' is-past' : '') + '" data-type="' + escapeHtml(event.name) + '" id="' + eventDomId(event) + '" aria-labelledby="' + eventDomId(event) + '-title">' +
      '<header class="event-head">' +
        '<h2 class="event-line" id="' + eventDomId(event) + '-title">' +
          '<span class="kicker">' + escapeHtml(event.name) + '</span>' +
          '<span class="sep" aria-hidden="true">·</span>' +
          '<span class="event-date">' + escapeHtml(formatLong(event.date)) + '</span>' +
          where +
        '</h2>' +
        '<div class="event-progress" role="img" aria-label="' + filled + ' of ' + cap + ' spots filled"><span style="width:' + Math.min(100, pct) + '%"></span></div>' +
      '</header>' +
      '<div class="tasks">' + event.tasks.map(function (task) { return renderTask(event, task, mode); }).join('') + '</div>' +
    '</section>';
  }

  function typeTotals(view, type) {
    var dates = 0;
    var open = 0;
    view.events.forEach(function (event) {
      if (event.past) return;
      if (type && event.name !== type) return;
      dates += 1;
      event.tasks.forEach(function (task) { open += task.remaining; });
    });
    return { dates: dates, open: open };
  }

  function filterTile(type, label, totals, pressed) {
    var count = totals.dates + (totals.dates === 1 ? ' date' : ' dates') + ' · ' + totals.open + ' open';
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

  function renderBoard(view, mode) {
    var summary = summarize(view);
    var upcoming = view.events.filter(function (event) { return !event.past; });
    var past = view.events.filter(function (event) { return event.past; });
    var stats = '<section class="stats" aria-label="Sheet summary">' +
      '<p><strong>' + summary.upcoming + '</strong><span>Upcoming events</span></p>' +
      '<p><strong>' + summary.open + '</strong><span>Spots open</span></p>' +
      '<p><strong>' + summary.filled + '</strong><span>Spots filled</span></p>' +
    '</section>';
    var jump = renderFilters(view);
    var upcomingHtml = '<div class="event-list">' + upcoming.map(function (event) { return renderEvent(event, mode); }).join('') + '</div>' +
      '<p class="filter-empty" hidden>No upcoming events of this type.</p>';
    var pastHtml = past.length
      ? '<details class="past-block"><summary>Past events (' + past.length + ')</summary><div class="event-list">' +
        past.map(function (event) { return renderEvent(event, mode); }).join('') + '</div></details>'
      : '';
    return stats + jump + upcomingHtml + pastHtml;
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
      ? '<label for="manage-target">Move to another open spot</label><select id="manage-target"><option value="">Choose a spot</option>' +
        options + '</select><button type="button" class="btn" id="manage-move">Move</button>'
      : '<p>Every other spot is full or closed.</p>';
    return '<section class="manage" aria-labelledby="manage-title">' +
      '<h2 id="manage-title">Your sign-up</h2>' +
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
    renderManage: renderManage,
    eventDomId: eventDomId
  };
})(typeof window !== 'undefined' ? window : globalThis);
