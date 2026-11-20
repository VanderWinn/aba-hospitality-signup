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
          remaining: Math.max(0, capacity - names.length)
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

  function spotPhrase(event, task) {
    var filled = task.filled + ' of ' + task.capacity + ' filled';
    if (event.past) return 'Closed · ' + filled;
    if (task.remaining === 0) return 'Full · ' + filled;
    var open = task.remaining === 1 ? '1 spot open' : task.remaining + ' spots open';
    return open + ' · ' + filled;
  }

  function renderTask(event, task, mode) {
    var canClaim = mode !== 'preview' && !event.past && task.remaining > 0;
    var names = task.names.length
      ? '<ul class="who">' + task.names.map(function (name) {
        return '<li>' + escapeHtml(name) + '</li>';
      }).join('') + '</ul>'
      : '<p class="who empty">No one yet</p>';
    var width = task.capacity > 0 ? Math.round((task.filled / task.capacity) * 100) : 0;
    var action;
    if (canClaim) {
      var label = 'Sign up for ' + task.task + ', ' + event.name + ', ' + formatLong(event.date);
      action = '<button type="button" class="claim" data-date="' + escapeHtml(event.date) +
        '" data-event="' + escapeHtml(event.name) + '" data-task="' + escapeHtml(task.task) +
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
        '<h3>' + escapeHtml(task.task) + '</h3>' +
        '<p class="spots">' + escapeHtml(spotPhrase(event, task)) + '</p>' +
        '<div class="meter" aria-hidden="true"><span style="width:' + width + '%"></span></div>' +
      '</div>' +
      names +
      '<div class="task-action">' + action + '</div>' +
    '</article>';
  }

  function renderEvent(event, mode) {
    var open = 0;
    event.tasks.forEach(function (task) { open += task.remaining; });
    var meta = event.past
      ? 'Past event'
      : (open === 0 ? 'All spots filled' : open + (open === 1 ? ' spot open' : ' spots open'));
    return '<section class="event' + (event.past ? ' is-past' : '') + '" id="' + eventDomId(event) + '" aria-labelledby="' + eventDomId(event) + '-title">' +
      '<header class="event-head">' +
        '<p class="kicker">' + escapeHtml(event.name) + '</p>' +
        '<h2 id="' + eventDomId(event) + '-title">' + escapeHtml(formatLong(event.date)) + '</h2>' +
        '<p class="when">' + escapeHtml(event.time) + ' · ' + escapeHtml(venue(event.location, event.name)) + '</p>' +
        '<p class="event-status">' + escapeHtml(meta) + '</p>' +
      '</header>' +
      '<div class="tasks">' + event.tasks.map(function (task) { return renderTask(event, task, mode); }).join('') + '</div>' +
    '</section>';
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
    var jump = upcoming.length
      ? '<nav class="jump" aria-label="Upcoming events"><ul>' + upcoming.map(function (event) {
        return '<li><a href="#' + eventDomId(event) + '"><span>' + escapeHtml(formatNav(event.date)) + '</span>' +
          escapeHtml(event.name) + '</a></li>';
      }).join('') + '</ul></nav>'
      : '';
    var upcomingHtml = upcoming.length
      ? '<div class="event-list">' + upcoming.map(function (event) { return renderEvent(event, mode); }).join('') + '</div>'
      : '<p class="empty-events">No upcoming events are on the sheet.</p>';
    var pastHtml = past.length
      ? '<details class="past-block"><summary>Past events (' + past.length + ')</summary><div class="event-list">' +
        past.map(function (event) { return renderEvent(event, mode); }).join('') + '</div></details>'
      : '';
    return stats + jump + upcomingHtml + pastHtml;
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
    eventDomId: eventDomId
  };
})(typeof window !== 'undefined' ? window : globalThis);
