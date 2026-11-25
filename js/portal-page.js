/* Board and committee portal page. The sign-up page does not load this file. */
(function () {
  'use strict';

  var portal = window.ABAPortal;
  var PASSWORD_KEY = 'aba-board-portal-password';
  var VIEW_KEY = 'aba-board-portal-view';
  var state = {
    hash: '',
    events: [],
    year: 0,
    month: 0,
    today: '',
    notice: '',
    dashboard: null,
    view: readView()
  };

  document.addEventListener('DOMContentLoaded', start);

  function todayInDetroit() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Detroit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  function sha256(text) {
    var data = new TextEncoder().encode(String(text));
    return crypto.subtle.digest('SHA-256', data).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function show(id, visible) {
    var node = document.getElementById(id);
    if (node) node.hidden = !visible;
  }

  function setError(message) {
    var node = document.getElementById('portal-error');
    if (!node) return;
    node.textContent = message || '';
    node.hidden = !message;
  }

  async function start() {
    var config;
    try {
      config = await fetch('portal.json', { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('The portal settings could not be loaded.');
        return response.json();
      });
    } catch (err) {
      setError(err.message || 'The portal settings could not be loaded.');
      return;
    }
    state.hash = String(config.passwordSha256 || '').toLowerCase();
    document.getElementById('portal-form').addEventListener('submit', onUnlock);
    document.getElementById('portal-lock').addEventListener('click', lock);
    document.getElementById('portal-prev').addEventListener('click', function () { shiftMonth(-1); });
    document.getElementById('portal-next').addEventListener('click', function () { shiftMonth(1); });
    document.getElementById('portal-dashboard-body').addEventListener('click', onDashClick);
    document.getElementById('portal-dashboard-body').addEventListener('change', onDashChange);
    window.addEventListener('hashchange', function () {
      state.view = portal.dashboardStateFromHash(location.hash);
      if (state.dashboard) paintDash();
    });
    var saved = readPassword();
    if (saved) {
      sha256(saved).then(function (digest) {
        if (digest === state.hash) openPortal();
      });
    }
  }

  function readView() {
    var hash = '';
    try { hash = String(location.hash || '').replace(/^#/, ''); } catch (err) {}
    if (!hash) {
      try { hash = sessionStorage.getItem(VIEW_KEY) || ''; } catch (err) {}
    }
    if (portal && portal.dashboardStateFromHash) return portal.dashboardStateFromHash(hash);
    return {
      order: ['person', 'role', 'event', 'date'],
      path: [],
      extPath: [],
      filters: { person: [], role: [], event: [], category: [], from: '', to: '' },
      drawer: false
    };
  }

  function saveView() {
    var hash = portal.dashboardHash(state.view);
    try { sessionStorage.setItem(VIEW_KEY, hash); } catch (err) {}
    try {
      if (String(location.hash || '').replace(/^#/, '') !== hash) {
        history.replaceState(null, '', '#' + hash);
      }
    } catch (err) {}
  }

  function readPassword() {
    try { return sessionStorage.getItem(PASSWORD_KEY) || ''; } catch (err) { return ''; }
  }

  function savePassword(password) {
    try { sessionStorage.setItem(PASSWORD_KEY, password); } catch (err) {}
  }

  function clearPassword() {
    try { sessionStorage.removeItem(PASSWORD_KEY); } catch (err) {}
  }

  async function onUnlock(event) {
    event.preventDefault();
    var input = document.getElementById('portal-password');
    var password = input ? input.value : '';
    if (!password) {
      setError('Enter the portal password.');
      return;
    }
    var digest = await sha256(password);
    if (digest !== state.hash) {
      setError('That password is not correct.');
      return;
    }
    savePassword(password);
    setError('');
    if (input) input.value = '';
    openPortal();
  }

  function lock() {
    clearPassword();
    show('portal-gate', true);
    show('portal-app', false);
    var input = document.getElementById('portal-password');
    if (input) input.focus();
  }

  function openPortal() {
    show('portal-gate', false);
    show('portal-app', true);
    var parts = todayInDetroit().split('-');
    state.today = parts.join('-');
    state.year = Number(parts[0]);
    state.month = Number(parts[1]);
    loadDocuments();
    loadCalendar();
    loadDashboard();
  }

  async function loadDashboard() {
    var root = document.getElementById('portal-dashboard-body');
    if (!root) return;
    var password = readPassword();
    if (!password) {
      root.innerHTML = portal.renderDashboard(null, { error: 'Enter the portal password again to load the dashboard.' });
      return;
    }
    try {
      var data = await postDashboard(password);
      if (!data || data.ok !== true) {
        if (data && data.status === 401 && /not correct/i.test(data.error || '')) clearPassword();
        root.innerHTML = portal.renderDashboard(null, { error: (data && data.error) || 'The dashboard could not be loaded.' });
        return;
      }
      state.dashboard = data.dashboard;
      paintDash();
    } catch (err) {
      root.innerHTML = portal.renderDashboard(null, { error: err.message || 'The dashboard could not be loaded.' });
    }
  }

  function paintDash() {
    var root = document.getElementById('portal-dashboard-body');
    if (root) root.innerHTML = portal.renderDashboard(state.dashboard, null, state.view);
    saveView();
  }

  function emptyFilters() {
    return { person: [], role: [], event: [], category: [], from: '', to: '' };
  }

  function monthBounds(key) {
    var parts = String(key || '').split('-');
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    var day = last < 10 ? '0' + last : String(last);
    return { from: key + '-01', to: key + '-' + day };
  }

  function onDashClick(event) {
    var node = event.target.closest('[data-step], [data-crumb], [data-clear], [data-clear-filter], [data-month-filter], [data-filter-toggle]');
    if (!node || !state.dashboard) return;
    if (node.hasAttribute('data-filter-toggle')) {
      state.view.drawer = !state.view.drawer;
      paintDash();
      return;
    }
    var external = node.getAttribute('data-section') === 'external';
    if (node.hasAttribute('data-crumb')) {
      var keep = Number(node.getAttribute('data-crumb')) || 0;
      if (external) state.view.extPath = (state.view.extPath || []).slice(0, keep);
      else state.view.path = (state.view.path || []).slice(0, keep);
    } else if (node.hasAttribute('data-step')) {
      var order = external ? ['person', 'event', 'date'] : state.view.order;
      var path = external ? state.view.extPath : state.view.path;
      if (path.length >= order.length) return;
      path.push({
        dim: order[path.length],
        key: node.getAttribute('data-step'),
        label: node.getAttribute('data-label') || node.getAttribute('data-step')
      });
    } else if (node.getAttribute('data-clear') === 'all') {
      state.view.filters = emptyFilters();
    } else if (node.hasAttribute('data-clear-filter')) {
      var kind = node.getAttribute('data-clear-filter');
      if (kind === 'from' || kind === 'to') state.view.filters[kind] = '';
      else {
        var value = node.getAttribute('data-clear-value');
        state.view.filters[kind] = (state.view.filters[kind] || []).filter(function (item) { return item !== value; });
      }
    } else if (node.hasAttribute('data-month-filter')) {
      var bounds = monthBounds(node.getAttribute('data-month-filter'));
      state.view.filters.from = bounds.from;
      state.view.filters.to = bounds.to;
    } else return;
    paintDash();
  }

  function onDashChange(event) {
    var node = event.target;
    if (!state.dashboard || !node) return;
    if (node.hasAttribute('data-order-index')) {
      var keepDrawer = !!state.view.drawer;
      state.view.order = portal.reorderDrill(state.view.order, Number(node.getAttribute('data-order-index')), node.value);
      state.view.path = [];
      state.view.drawer = keepDrawer;
      paintDash();
      return;
    }
    if (node.hasAttribute('data-filter')) {
      var name = node.getAttribute('data-filter');
      var values = [];
      document.querySelectorAll('#portal-dashboard-body input[data-filter="' + name + '"]').forEach(function (box) {
        if (box.checked) values.push(box.value);
      });
      state.view.filters[name] = values;
      state.view.drawer = true;
      paintDash();
      return;
    }
    if (node.hasAttribute('data-filter-date')) {
      state.view.filters[node.getAttribute('data-filter-date')] = node.value;
      state.view.drawer = true;
      paintDash();
    }
  }

  async function postDashboard(password) {
    var url = backendUrl();
    if (!url) throw new Error('The dashboard service is not connected.');
    var response = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'dashboard', password: password })
    });
    var text = await response.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error('Unexpected response from the dashboard service.');
    }
  }

  async function loadDocuments() {
    var list = document.getElementById('portal-docs');
    try {
      var data = await fetch('docs.json', { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('Documents could not be loaded.');
        return response.json();
      });
      var items = data && data.documents || [];
      if (!items.length) {
        list.innerHTML = '<li>No documents are listed yet.</li>';
        return;
      }
      list.innerHTML = items.map(function (item) {
        return '<li><a href="' + escapeAttr(item.url) + '" rel="noopener noreferrer">' + escapeHtml(item.title) + '</a>' +
          (item.note ? '<span class="portal-doc-note">' + escapeHtml(item.note) + '</span>' : '') + '</li>';
      }).join('');
    } catch (err) {
      list.innerHTML = '<li>' + escapeHtml(err.message || 'Documents could not be loaded.') + '</li>';
    }
  }

  async function loadCalendar() {
    var notice = document.getElementById('portal-calendar-note');
    state.notice = '';
    try {
      var live = await fetchCatalog(backendUrl());
      state.events = portal.eventsFromCatalog(live);
    } catch (err) {
      try {
        var saved = await fetch('../data/seed.json', { cache: 'no-store' }).then(function (response) {
          if (!response.ok) throw err;
          return response.json();
        });
        state.events = portal.eventsFromCatalog(saved);
        state.notice = 'The live calendar could not be loaded. This list is the saved copy.';
      } catch (fallbackErr) {
        state.events = [];
        state.notice = err.message || 'The calendar could not be loaded.';
      }
    }
    if (notice) {
      notice.textContent = state.notice;
      notice.hidden = !state.notice;
    }
    paintCalendar();
  }

  function backendUrl() {
    var config = window.ABA_CONFIG || {};
    return typeof config.backendUrl === 'string' ? config.backendUrl.trim() : '';
  }

  async function fetchCatalog(url) {
    if (!url) throw new Error('The calendar service is not connected.');
    var join = url.indexOf('?') >= 0 ? '&' : '?';
    var response = await fetch(url + join + 't=' + Date.now(), { cache: 'no-store', redirect: 'follow' });
    if (!response.ok) throw new Error('The calendar could not be loaded.');
    var data = await response.json();
    if (!data || data.ok !== true || !Array.isArray(data.events)) {
      throw new Error((data && data.error) || 'The calendar could not be loaded.');
    }
    return data;
  }

  function shiftMonth(delta) {
    var month = state.month + delta;
    var year = state.year;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    state.year = year;
    state.month = month;
    paintCalendar();
  }

  function paintCalendar() {
    var title = document.getElementById('portal-month');
    title.textContent = portal.monthTitle(state.year, state.month);
    var cells = portal.monthCells(state.year, state.month, state.events);
    var grid = document.getElementById('portal-grid');
    grid.innerHTML = portal.WEEKDAYS.map(function (day) {
      return '<div class="portal-dow" role="columnheader">' + day + '</div>';
    }).join('') + cells.map(function (cell) {
      if (!cell) return '<div class="portal-day is-empty" aria-hidden="true"></div>';
      var chips = cell.events.map(function (event) {
        return '<span class="portal-chip">' + escapeHtml(event.name) + '</span>';
      }).join('');
      var today = cell.iso === state.today ? ' is-today' : '';
      var busy = cell.events.length ? ' has-events' : '';
      var label = cell.day + (cell.events.length ? ', ' + cell.events.map(function (event) { return event.name; }).join(', ') : '');
      return '<div class="portal-day' + today + busy + '" role="gridcell" aria-label="' + escapeAttr(label) + '">' +
        '<span class="portal-day-num">' + cell.day + '</span>' + chips + '</div>';
    }).join('');
    paintList('portal-month-list', eventsInMonth(state.year, state.month), 'No events this month.');
    paintList('portal-upcoming', portal.upcomingEvents(state.events, state.today), 'No upcoming events.');
  }

  function eventsInMonth(year, month) {
    var prefix = year + '-' + (month < 10 ? '0' : '') + month;
    return state.events.filter(function (event) { return event.date.indexOf(prefix) === 0; });
  }

  function paintList(id, events, empty) {
    var node = document.getElementById(id);
    if (!events.length) {
      node.innerHTML = '<li class="portal-empty">' + escapeHtml(empty) + '</li>';
      return;
    }
    node.innerHTML = events.map(function (event) {
      return '<li><p class="portal-kicker">' + escapeHtml(event.name) + '</p>' +
        '<p class="portal-when">' + escapeHtml(formatLong(event.date)) +
        (event.time ? ' · ' + escapeHtml(event.time) : '') + '</p>' +
        '<p class="portal-where">' + escapeHtml(event.venue || 'Venue to be announced') + '</p></li>';
    }).join('');
  }

  function formatLong(iso) {
    var parts = String(iso).split('-');
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }
})();
