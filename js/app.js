/* Page behavior: preview from seed data, or live reads and sign-ups through Apps Script. */
(function () {
  'use strict';

  var catalog = window.ABACatalog;
  var state = {
    mode: 'preview',
    view: null,
    seed: null,
    message: ''
  };
  var active = null;
  var lastFocus = null;
  var submitting = false;
  var scrolledToHash = false;
  var toastTimer = null;
  var manageToken = '';
  var manageRecord = null;

  document.addEventListener('DOMContentLoaded', init);

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
    board().innerHTML = catalog.renderBoard(state.view, state.mode);
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
    document.getElementById('dialog-close').addEventListener('click', closeDialog);
    var dialog = document.getElementById('signup-dialog');
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('close', function () {
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    });
  }

  function onBoardClick(event) {
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
