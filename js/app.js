/* Page behavior: preview from seed data, or live reads and sign-ups through Apps Script. */
(function () {
  'use strict';

  var catalog = window.ABACatalog;
  var state = {
    mode: 'preview',
    view: null,
    seed: null,
    message: '',
    adminSession: '',
    adminPeople: null
  };
  var active = null;
  var lastFocus = null;
  var submitting = false;
  var scrolledToHash = false;
  var toastTimer = null;
  var manageToken = '';
  var manageRecord = null;
  var filterType = '';

  document.addEventListener('DOMContentLoaded', function () {
    showAppleCalendar();
    runQuickCancel();
    init();
  });

  function quickCancelToken() {
    var token = new URLSearchParams(window.location.search).get('cancel') || '';
    if (!/^[A-Za-z0-9]{32,80}$/.test(token)) return '';
    return token;
  }

  function quickCancelSentence(data) {
    if (data && data.already) return 'This sign-up is already cancelled.';
    var signup = data && data.signup ? data.signup : {};
    var task = signup.task || 'this role';
    var date = signup.date ? catalog.formatLong(signup.date) : '';
    return 'Your sign-up for ' + task + (date ? ' on ' + date : '') + ' has been cancelled.';
  }

  async function runQuickCancel() {
    var token = quickCancelToken();
    var host = document.getElementById('quick-cancel');
    if (!token || !host) return;
    host.innerHTML = '<div class="wrap"><p class="banner" id="quick-cancel-status">Cancelling your sign-up…</p></div>';
    var status = document.getElementById('quick-cancel-status');
    if (!backendUrl()) {
      status.textContent = 'Cancel will be available after the sign-up service is connected.';
      return;
    }
    try {
      var data = await postSignup({ action: 'cancel', token: token });
      if (!data || data.ok !== true) {
        status.textContent = data && data.error === 'That link is not valid.'
          ? 'That cancel link is not valid.'
          : ((data && data.error) || 'That cancel link is not valid.');
        return;
      }
      status.textContent = quickCancelSentence(data);
      try { await loadLive(); } catch (err) {}
      paint();
    } catch (err) {
      status.textContent = 'The sign-up could not be cancelled. Open the link again in a moment.';
    }
  }

  function showAppleCalendar() {
    var event = catalog.eventFromAppleQuery(window.location.search);
    var host = document.getElementById('apple-cal');
    if (!event || !host) return;
    var offer = catalog.calendarLinks(event);
    host.innerHTML = '<div class="wrap"><p class="banner">' +
      'Add <strong>' + catalog.escapeHtml(event.name) + '</strong> to your calendar. ' +
      '<button type="button" class="btn" id="apple-add">Add to Apple Calendar (iPhone)</button>' +
      '</p></div>';
    document.getElementById('apple-add').addEventListener('click', function () {
      catalog.deliverIcs(offer.ics, 'invite.ics');
    });
    catalog.deliverIcs(offer.ics, 'invite.ics');
  }

  function backendUrl() {
    var config = window.ABA_CONFIG || {};
    var value = typeof config.backendUrl === 'string' ? config.backendUrl.trim() : '';
    if (!/^https?:\/\/.+/i.test(value)) return '';
    return value;
  }

  function board() {
    return document.getElementById('board');
  }

  function banner() {
    return document.getElementById('banner');
  }

  function toast() {
    return document.getElementById('toast');
  }

  function paint() {
    banner().innerHTML = catalog.renderBanner(state.mode, state.message);
    if (!state.view) {
      board().innerHTML = '<p class="loading">The sign-up sheet could not be loaded.</p>';
      return;
    }
    board().innerHTML = catalog.renderBoard(state.view, state.mode, state.adminPeople);
    applyFilter();
    var hash = window.location.hash;
    if (!scrolledToHash && /^#event-[a-z0-9-]+$/.test(hash)) {
      var target = document.getElementById(hash.slice(1));
      var details = target && target.closest('details');
      if (details) details.open = true;
      if (target && target.scrollIntoView) target.scrollIntoView();
      scrolledToHash = true;
    }
  }

  function setToast(text) {
    var node = toast();
    node.textContent = text || '';
    node.hidden = !text;
    clearTimeout(toastTimer);
    if (text) {
      toastTimer = setTimeout(function () {
        node.hidden = true;
        node.textContent = '';
      }, 8000);
    }
  }

  async function fetchJson(url) {
    var response = await fetch(url, { cache: 'no-store', redirect: 'follow' });
    if (!response.ok) throw new Error('The sign-up sheet could not be loaded.');
    return response.json();
  }

  async function loadLive() {
    var url = backendUrl();
    var join = url.indexOf('?') >= 0 ? '&' : '?';
    var data = await fetchJson(url + join + 't=' + Date.now());
    if (!data || data.ok !== true || !Array.isArray(data.events)) {
      throw new Error((data && data.error) || 'The sign-up sheet could not be loaded.');
    }
    state.view = catalog.toView(data, catalog.todayInDetroit());
    state.mode = 'live';
    state.message = '';
    return true;
  }

  async function init() {
    var today = catalog.todayInDetroit();
    try {
      state.seed = await fetchJson('data/seed.json');
      state.view = catalog.toView(state.seed, today);
    } catch (err) {
      state.view = null;
    }

    state.adminSession = window.localStorage ? (localStorage.getItem('aba-admin-session') || '') : '';
    updateAdminChrome();
    var url = backendUrl();
    if (!url) {
      state.mode = 'preview';
      paint();
      bind();
      if (manageToken) {
        document.getElementById('manage').innerHTML = '<p class="banner warn" role="alert">Changing or cancelling a sign-up will be available after the sign-up service is connected.</p>';
      }
      return;
    }

    try {
      await loadLive();
    } catch (err) {
      state.mode = state.view ? 'stale' : 'preview';
      state.message = err.message || 'The live sheet could not be loaded.';
      if (!state.view) state.mode = 'stale';
    }
    if (state.adminSession) await refreshAdmin();
    updateAdminChrome();
    paint();
    bind();
    if (manageToken) loadManage();
  }

  function bind() {
    var params = new URLSearchParams(window.location.search);
    var token = params.get('manage') || '';
    if (/^[A-Za-z0-9]{32,80}$/.test(token)) manageToken = token;
    document.getElementById('manage').addEventListener('click', onManageClick);
    board().addEventListener('click', onBoardClick);
    var form = document.getElementById('signup-form');
    form.addEventListener('submit', onSubmit);
    document.getElementById('dialog-cancel').addEventListener('click', closeDialog);
    document.getElementById('cancel-form').addEventListener('submit', onCancelSubmit);
    document.getElementById('cancel-keep').addEventListener('click', closeCancel);
    document.getElementById('cancel-close').addEventListener('click', closeCancel);
    document.getElementById('dialog-close').addEventListener('click', closeDialog);
    document.getElementById('admin-open').addEventListener('click', openAdminLogin);
    document.getElementById('admin-logout').addEventListener('click', logOutAdmin);
    document.getElementById('admin-change').addEventListener('click', openAdminPassword);
    document.getElementById('admin-password-form').addEventListener('submit', onAdminPassword);
    document.getElementById('admin-password-close').addEventListener('click', function () {
      document.getElementById('admin-password-dialog').close();
    });
    document.getElementById('admin-login-form').addEventListener('submit', onAdminLogin);
    document.getElementById('admin-login-close').addEventListener('click', function () {
      document.getElementById('admin-login').close();
    });
    document.getElementById('admin-login-cancel').addEventListener('click', function () {
      document.getElementById('admin-login').close();
    });
    document.getElementById('admin-password-cancel').addEventListener('click', function () {
      document.getElementById('admin-password-dialog').close();
    });
    document.getElementById('admin-add-form').addEventListener('submit', onAdminAdd);
    document.getElementById('admin-add-close').addEventListener('click', function () { document.getElementById('admin-add-dialog').close(); });
    document.getElementById('admin-add-keep').addEventListener('click', function () { document.getElementById('admin-add-dialog').close(); });
    document.getElementById('admin-remove-form').addEventListener('submit', onAdminRemove);
    document.getElementById('admin-remove-close').addEventListener('click', function () { document.getElementById('admin-remove-dialog').close(); });
    document.getElementById('admin-remove-keep').addEventListener('click', function () { document.getElementById('admin-remove-dialog').close(); });
    document.addEventListener('click', function (event) {
      if (event.target.closest('.event-cal-toggle') || event.target.closest('.cal-menu')) return;
      closeCalendars(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var open = board() && board().querySelector('.event-cal-toggle[aria-expanded="true"]');
      if (!open) return;
      event.preventDefault();
      closeCalendars(true);
    });
    var dialog = document.getElementById('signup-dialog');
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('close', function () {
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    });
  }

  function applyFilter() {
    var root = board();
    root.querySelectorAll('.type-filter').forEach(function (button) {
      var on = (button.getAttribute('data-type') || '') === filterType;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      button.classList.toggle('is-selected', on);
    });
    root.querySelectorAll('.event').forEach(function (card) {
      card.hidden = !!(filterType && card.getAttribute('data-type') !== filterType);
    });
    var upcoming = root.querySelector('.event-list');
    var upcomingVisible = upcoming ? upcoming.querySelectorAll('.event:not([hidden])').length : 0;
    var empty = root.querySelector('.filter-empty');
    if (empty) {
      empty.hidden = upcomingVisible > 0;
      empty.textContent = filterType ? 'No upcoming events of this type.' : 'No upcoming events are on the sheet.';
    }
    var past = root.querySelector('.past-block');
    if (past) {
      var visiblePast = past.querySelectorAll('.event:not([hidden])').length;
      past.hidden = visiblePast === 0;
      var summary = past.querySelector('summary');
      if (summary) summary.textContent = 'Past events (' + visiblePast + ')';
      if (filterType && upcomingVisible === 0 && visiblePast > 0) past.open = true;
    }
  }

  function closeCalendars(restoreFocus) {
    var root = board();
    if (!root) return;
    root.querySelectorAll('.cal-menu').forEach(function (menu) {
      if (menu.hidden) return;
      menu.hidden = true;
      var toggle = root.querySelector('[aria-controls="' + menu.id + '"]');
      if (!toggle) return;
      toggle.setAttribute('aria-expanded', 'false');
      if (restoreFocus) toggle.focus();
    });
  }

  function onBoardClick(event) {
    var filter = event.target.closest('.type-filter');
    if (filter) {
      filterType = filter.getAttribute('data-type') || '';
      applyFilter();
      closeCalendars(false);
      return;
    }
    var toggle = event.target.closest('.event-cal-toggle');
    if (toggle) {
      var menu = document.getElementById(toggle.getAttribute('aria-controls'));
      var wasOpen = toggle.getAttribute('aria-expanded') === 'true';
      closeCalendars(false);
      if (!wasOpen && menu) {
        menu.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        var first = menu.querySelector('a');
        if (first) first.focus();
      }
      return;
    }
    var adminAdd = event.target.closest('.admin-add');
    if (adminAdd) {
      openAdminAdd(adminAdd);
      return;
    }
    var adminRemove = event.target.closest('.admin-remove');
    if (adminRemove) {
      openAdminRemove(adminRemove);
      return;
    }
    var person = event.target.closest('.who-name');
    if (person) {
      if (state.mode !== 'live') return;
      openCancel(person);
      return;
    }
    var fileButton = event.target.closest('.cal-file');
    if (fileButton) {
      event.preventDefault();
      var menu = fileButton.closest('.cal-menu');
      if (!menu) return;
      var offer = catalog.calendarLinks({
        date: menu.getAttribute('data-date'),
        time: menu.getAttribute('data-time'),
        name: menu.getAttribute('data-name'),
        location: menu.getAttribute('data-location')
      });
      catalog.deliverIcs(offer.ics, offer.filename);
      return;
    }
    if (event.target.closest('.cal-menu')) return;
    closeCalendars(false);
    var button = event.target.closest('.claim');
    if (!button || state.mode === 'preview') return;
    openDialog(button.getAttribute('data-date'), button.getAttribute('data-event'), button.getAttribute('data-task'), button.getAttribute('data-when'), button.getAttribute('data-description'));
  }

  function openDialog(date, eventName, task, when, description) {
    active = { date: date, event: eventName, task: task };
    document.getElementById('dialog-title').textContent = 'Sign up for ' + task;
    document.getElementById('dialog-copy').textContent = eventName + ' · ' + catalog.formatLong(date) + (when ? ' · ' + when : '');
    var desc = document.getElementById('dialog-desc');
    if (desc) {
      desc.textContent = description || '';
      desc.hidden = !description;
    }
    document.getElementById('signup-form').reset();
    var error = document.getElementById('form-error');
    error.hidden = true;
    error.textContent = '';
    lastFocus = document.activeElement;
    document.getElementById('signup-dialog').showModal();
    document.getElementById('signup-name').focus();
  }

  var cancelTarget = null;

  function openCancel(button) {
    cancelTarget = {
      name: button.getAttribute('data-name'),
      date: button.getAttribute('data-date'),
      event: button.getAttribute('data-event'),
      task: button.getAttribute('data-task'),
      startTime: button.getAttribute('data-start')
    };
    document.getElementById('cancel-copy').textContent = 'Cancel your sign-up for ' + cancelTarget.task +
      ' — ' + cancelTarget.event + ' ' + catalog.formatLong(cancelTarget.date) + '?';
    document.getElementById('cancel-form').reset();
    var error = document.getElementById('cancel-error');
    error.hidden = true;
    error.textContent = '';
    lastFocus = document.activeElement;
    document.getElementById('cancel-dialog').showModal();
    document.getElementById('cancel-email').focus();
  }

  function closeCancel() {
    var dialog = document.getElementById('cancel-dialog');
    if (dialog.open) dialog.close();
    cancelTarget = null;
  }

  function showCancelError(text) {
    var error = document.getElementById('cancel-error');
    error.textContent = text;
    error.hidden = false;
  }

  async function onCancelSubmit(event) {
    event.preventDefault();
    if (submitting || !cancelTarget || state.mode !== 'live') return;
    var email = document.getElementById('cancel-email').value;
    if (!String(email).trim()) {
      showCancelError('Enter the email you signed up with.');
      return;
    }
    submitting = true;
    var submitButton = document.getElementById('cancel-submit');
    submitButton.disabled = true;
    try {
      var data = await postSignup({
        action: 'cancelByEmail',
        name: cancelTarget.name,
        email: email,
        event: cancelTarget.event,
        date: cancelTarget.date,
        task: cancelTarget.task,
        startTime: cancelTarget.startTime
      });
      if (!data || data.ok !== true) {
        showCancelError((data && data.error) || 'Could not cancel the sign-up.');
        return;
      }
      closeCancel();
      setToast(data.message || 'Your sign-up is cancelled.');
      try { await loadLive(); } catch (err) {}
      paint();
    } catch (err) {
      showCancelError('Could not reach the sign-up sheet. Check your connection and try again.');
    } finally {
      submitting = false;
      submitButton.disabled = false;
    }
  }

  function closeDialog() {
    var dialog = document.getElementById('signup-dialog');
    if (dialog.open) dialog.close();
  }

  function showError(text) {
    var error = document.getElementById('form-error');
    error.textContent = text;
    error.hidden = false;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting || !active || state.mode === 'preview') return;
    var name = document.getElementById('signup-name').value;
    var email = document.getElementById('signup-email').value;
    var company = document.getElementById('company').value;
    if (!String(name).trim()) {
      showError('Enter your name.');
      return;
    }
    if (!String(email).trim()) {
      showError('Enter your email.');
      return;
    }

    submitting = true;
    var submitButton = document.getElementById('dialog-submit');
    submitButton.disabled = true;
    try {
      var data = await postSignup({
        name: name,
        email: email,
        event: active.event,
        date: active.date,
        task: active.task,
        company: company
      });
      if (!data || data.ok !== true) {
        showError((data && data.error) || 'Could not submit the form.');
        try {
          await loadLive();
          paint();
        } catch (err) {
          /* Keep the form error. The grid stays as it was if the refresh fails. */
        }
        return;
      }
      var signed = { date: active.date, event: active.event, task: active.task, name: name };
      closeDialog();
      setToast((data.message || 'You are signed up.') + ' A confirmation email is on its way. Your email is not shown on this page.');
      var refreshed = false;
      try {
        await loadLive();
        refreshed = true;
      } catch (err) {
        remember(signed);
      }
      paint();
      if (!refreshed) setToast((data.message || 'You are signed up.') + ' A confirmation email is on its way. Your email is not shown on this page.');
    } catch (err) {
      showError('Could not reach the sign-up sheet. Check your connection and try again.');
    } finally {
      submitting = false;
      submitButton.disabled = false;
    }
  }

  function remember(signed) {
    if (!state.view) return;
    var found = catalog.findTask(state.view, signed.date, signed.event, signed.task);
    if (!found) return;
    var clean = String(signed.name || '').replace(/\s+/g, ' ').trim();
    found.task.names.push(clean);
    found.task.filled = found.task.names.length;
    found.task.remaining = Math.max(0, found.task.capacity - found.task.filled);
  }

  function manageNote(data) {
    var err = data && data.error ? data.error : '';
    if (!err || err === 'Enter your name.' || err === 'Choose an event and task.' || err === 'Invalid request.') {
      return 'Changing or cancelling a sign-up will be available after the sign-up service is updated. The sheet below still works.';
    }
    return err;
  }

  function paintManage() {
    var node = document.getElementById('manage');
    if (!manageToken) {
      node.innerHTML = '';
      return;
    }
    if (!manageRecord) return;
    node.innerHTML = catalog.renderManage(manageRecord, state.view);
  }

  async function loadManage() {
    try {
      var data = await postSignup({ action: 'lookup', token: manageToken });
      if (!data || data.ok !== true || !data.signup) {
        document.getElementById('manage').innerHTML = '<p class="banner warn" role="alert">' + catalog.escapeHtml(manageNote(data)) + '</p>';
        return;
      }
      manageRecord = data.signup;
      paintManage();
    } catch (err) {
      document.getElementById('manage').innerHTML = '<p class="banner warn" role="alert">The sign-up link could not be opened. The sheet below still works.</p>';
    }
  }

  function showManageError(text) {
    var node = document.getElementById('manage-error');
    if (!node) return;
    node.textContent = text;
    node.hidden = false;
  }

  async function onManageClick(event) {
    var cancel = event.target.closest('#manage-cancel');
    var move = event.target.closest('#manage-move');
    if (!cancel && !move) return;
    if (cancel && !window.confirm('Cancel this sign-up?')) return;
    var payload = { action: cancel ? 'cancel' : 'move', token: manageToken };
    if (move) {
      var select = document.getElementById('manage-target');
      var option = select && select.options[select.selectedIndex];
      if (!option || !option.getAttribute('data-date')) {
        showManageError('Choose an open spot.');
        return;
      }
      payload.date = option.getAttribute('data-date');
      payload.event = option.getAttribute('data-event');
      payload.task = option.getAttribute('data-task');
    }
    try {
      var data = await postSignup(payload);
      if (!data || data.ok !== true) {
        showManageError((data && data.error) || 'Could not update the sign-up.');
        return;
      }
      setToast(data.message || 'Updated.');
      try { await loadLive(); } catch (err) {}
      paint();
      await loadManage();
    } catch (err) {
      showManageError('Could not reach the sign-up sheet. Check your connection and try again.');
    }
  }

  var adminTarget = null;

  function updateAdminChrome() {
    var loggedIn = !!state.adminSession;
    var logout = document.getElementById('admin-logout');
    var change = document.getElementById('admin-change');
    if (logout) logout.hidden = !loggedIn;
    if (change) change.hidden = !loggedIn;
  }

  function saveAdminSession(session) {
    state.adminSession = session || '';
    if (window.localStorage) {
      if (state.adminSession) localStorage.setItem('aba-admin-session', state.adminSession);
      else localStorage.removeItem('aba-admin-session');
    }
    updateAdminChrome();
  }

  async function refreshAdmin() {
    if (!state.adminSession || !backendUrl()) {
      state.adminPeople = null;
      return;
    }
    var data = await postSignup({ action: 'adminRoster', session: state.adminSession });
    if (!data || data.ok !== true) {
      saveAdminSession('');
      state.adminPeople = null;
      return;
    }
    state.adminPeople = data.people || [];
  }

  function openAdminLogin() {
    var error = document.getElementById('admin-login-error');
    error.hidden = true;
    error.textContent = '';
    document.getElementById('admin-login-form').reset();
    document.getElementById('admin-login').showModal();
    document.getElementById('admin-password').focus();
  }

  async function onAdminLogin(event) {
    event.preventDefault();
    var error = document.getElementById('admin-login-error');
    error.hidden = true;
    try {
      var data = await postSignup({
        action: 'adminLogin',
        password: document.getElementById('admin-password').value
      });
      if (!data || data.ok !== true || !data.session) {
        error.textContent = (data && data.error) || 'That password is not correct.';
        error.hidden = false;
        return;
      }
      saveAdminSession(data.session);
      document.getElementById('admin-login').close();
      await refreshAdmin();
      paint();
    } catch (err) {
      error.textContent = 'Could not reach the sign-up sheet.';
      error.hidden = false;
    }
  }

  function openAdminPassword() {
    var error = document.getElementById('admin-password-error');
    error.hidden = true;
    error.textContent = '';
    document.getElementById('admin-password-form').reset();
    document.getElementById('admin-password-dialog').showModal();
    document.getElementById('admin-current-password').focus();
  }

  async function onAdminPassword(event) {
    event.preventDefault();
    var error = document.getElementById('admin-password-error');
    var next = document.getElementById('admin-new-password').value;
    var confirm = document.getElementById('admin-confirm-password').value;
    if (next !== confirm) {
      error.textContent = 'New passwords do not match.';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    try {
      var data = await postSignup({
        action: 'adminChangePassword',
        session: state.adminSession,
        current: document.getElementById('admin-current-password').value,
        next: next,
        confirm: confirm
      });
      if (!data || data.ok !== true || !data.session) {
        error.textContent = (data && data.error) || 'Could not change the password.';
        error.hidden = false;
        if (data && data.error === 'Admin login expired.') logOutAdmin();
        return;
      }
      saveAdminSession(data.session);
      document.getElementById('admin-password-dialog').close();
      setToast(data.message || 'Password changed.');
    } catch (err) {
      error.textContent = 'Could not reach the sign-up sheet.';
      error.hidden = false;
    }
  }

  async function logOutAdmin() {
    var session = state.adminSession;
    saveAdminSession('');
    state.adminPeople = null;
    paint();
    if (session && backendUrl()) {
      try { await postSignup({ action: 'adminLogout', session: session }); } catch (err) {}
    }
  }

  function openAdminAdd(button) {
    adminTarget = {
      date: button.getAttribute('data-date'),
      event: button.getAttribute('data-event'),
      task: button.getAttribute('data-task'),
      startTime: button.getAttribute('data-start') || ''
    };
    document.getElementById('admin-add-copy').textContent = 'Add someone to ' + adminTarget.task + ' · ' + adminTarget.event + ' · ' + catalog.formatLong(adminTarget.date) + '.';
    document.getElementById('admin-add-warn').hidden = button.getAttribute('data-full') !== '1';
    document.getElementById('admin-add-form').reset();
    document.getElementById('admin-send-confirm').checked = true;
    document.getElementById('admin-add-error').hidden = true;
    document.getElementById('admin-add-dialog').showModal();
    document.getElementById('admin-name').focus();
  }

  async function onAdminAdd(event) {
    event.preventDefault();
    if (!adminTarget || !state.adminSession) return;
    var error = document.getElementById('admin-add-error');
    error.hidden = true;
    try {
      var data = await postSignup({
        action: 'adminAdd',
        session: state.adminSession,
        name: document.getElementById('admin-name').value,
        email: document.getElementById('admin-email').value,
        event: adminTarget.event,
        date: adminTarget.date,
        task: adminTarget.task,
        startTime: adminTarget.startTime,
        sendEmail: document.getElementById('admin-send-confirm').checked
      });
      if (!data || data.ok !== true) {
        error.textContent = (data && data.error) || 'Could not add the person.';
        error.hidden = false;
        if (data && data.error === 'Admin login expired.') logOutAdmin();
        return;
      }
      document.getElementById('admin-add-dialog').close();
      setToast((data.message || 'Added.') + (data.warning ? ' ' + data.warning : ''));
      await refreshAdmin();
      try { await loadLive(); } catch (err) {}
      paint();
    } catch (err) {
      error.textContent = 'Could not reach the sign-up sheet.';
      error.hidden = false;
    }
  }

  function openAdminRemove(button) {
    adminTarget = {
      signupId: button.getAttribute('data-signup'),
      name: button.getAttribute('data-name'),
      task: button.getAttribute('data-task')
    };
    document.getElementById('admin-remove-copy').textContent = 'Remove ' + adminTarget.name + ' from ' + adminTarget.task + '?';
    document.getElementById('admin-send-cancel').checked = true;
    document.getElementById('admin-remove-error').hidden = true;
    document.getElementById('admin-remove-dialog').showModal();
  }

  async function onAdminRemove(event) {
    event.preventDefault();
    if (!adminTarget || !state.adminSession) return;
    var error = document.getElementById('admin-remove-error');
    error.hidden = true;
    try {
      var data = await postSignup({
        action: 'adminRemove',
        session: state.adminSession,
        signupId: adminTarget.signupId,
        sendEmail: document.getElementById('admin-send-cancel').checked
      });
      if (!data || data.ok !== true) {
        error.textContent = (data && data.error) || 'Could not remove the person.';
        error.hidden = false;
        if (data && data.error === 'Admin login expired.') logOutAdmin();
        return;
      }
      document.getElementById('admin-remove-dialog').close();
      setToast(data.message || 'Removed.');
      await refreshAdmin();
      try { await loadLive(); } catch (err) {}
      paint();
    } catch (err) {
      error.textContent = 'Could not reach the sign-up sheet.';
      error.hidden = false;
    }
  }

  async function postSignup(payload) {
    // text/plain skips the CORS preflight. Apps Script answers with a redirect, which fetch follows.
    var response = await fetch(backendUrl(), {
      method: 'POST',
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    var text = await response.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error('Unexpected response from the sign-up service.');
    }
  }
})();
