/* Standalone membership dashboard. Opens only with the portal session. */
(function () {
  'use strict';

  var SESSION_KEY = 'aba-board-portal-password';
  var LOGIN = 'index.html?next=dashboard';
  var dash = window.ABADashboard;
  var dataApi = window.ABADashboardData;
  var viewApi = window.ABADashboardView;
  var state = null;
  var source = null;
  var documents = { extras: [] };
  var mobileQuery = window.matchMedia('(max-width: 800px)');

  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('click', function (event) {
    if (!event.target.closest('.info') && !event.target.closest('.pseg button')) closeTips();
    if (!event.target.closest('[data-more]') && !event.target.closest('.more-pop')) closeMenus();
  });

  function boot() {
    var password = readPassword();
    if (!password) {
      window.location.replace(LOGIN);
      return;
    }
    sha256(password).then(function (digest) {
      return fetch('portal.json', { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('portal');
        return response.json().then(function (config) {
          return String(config.passwordSha256 || '').toLowerCase() === digest;
        });
      });
    }).then(function (ok) {
      if (!ok) {
        window.location.replace(LOGIN);
        return;
      }
      return Promise.all([dataApi.loadExecutiveSource(), loadDocs()]).then(function (parts) {
        source = parts[0];
        if (!source.asOf) source.asOf = todayInDetroit();
        documents = parts[1];
        state = dash.stateFromHash(window.location.hash, source);
        var root = document.getElementById('dash');
        root.hidden = false;
        root.addEventListener('click', onClick);
        root.addEventListener('change', onChange);
        document.getElementById('gate-status').hidden = true;
        if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', paint);
        else if (mobileQuery.addListener) mobileQuery.addListener(paint);
        paint();
      });
    }).catch(function () {
      window.location.replace(LOGIN);
    });
  }

  function todayInDetroit() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Detroit',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  function readPassword() {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (err) { return ''; }
  }

  function sha256(text) {
    var data = new TextEncoder().encode(String(text));
    return crypto.subtle.digest('SHA-256', data).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (byte) {
        return byte.toString(16).padStart(2, '0');
      }).join('');
    });
  }

  function loadDocs() {
    return fetch('docs.json', { cache: 'no-store' }).then(function (response) {
      if (!response.ok) return { extras: [] };
      return response.json();
    }).then(function (payload) {
      var extras = (payload && payload.documents || []).filter(function (item) {
        return item && item.title && item.url;
      });
      var procedure = '';
      extras.forEach(function (item) {
        if (!procedure && /procedure|handbook/i.test(item.title)) procedure = item.url;
      });
      return { procedure: procedure, extras: extras };
    }).catch(function () {
      return { extras: [] };
    });
  }

  function paint() {
    var view = dash.compute(source, state);
    view.mobile = mobileQuery.matches;
    view.documents = documents;
    document.getElementById('dash').innerHTML = viewApi.render(view);
    var hash = dash.stateHash(state);
    if (hash.indexOf('password') !== -1) return;
    try {
      if (String(window.location.hash || '').replace(/^#/, '') !== hash) {
        history.replaceState(null, '', '#' + hash);
      }
    } catch (err) {}
  }

  function update(action) {
    state = dash.applyAction(source, state, action);
    paint();
  }

  function closeTips() {
    document.querySelectorAll('.info.is-open, .pseg button.is-open').forEach(function (node) {
      node.classList.remove('is-open');
    });
  }

  function closeMenus() {
    document.querySelectorAll('.more-pop').forEach(function (node) {
      node.hidden = true;
    });
  }

  function onClick(event) {
    var info = event.target.closest('.info');
    if (event.target.closest('[data-open-placeholder]') && !info) {
      event.preventDefault();
      return;
    }
    if (info) {
      event.preventDefault();
      event.stopPropagation();
      var open = info.classList.contains('is-open');
      closeTips();
      if (!open) info.classList.add('is-open');
      return;
    }
    if (event.target.closest('[data-reset]')) {
      update({ type: 'reset' });
      return;
    }
    var period = event.target.closest('[data-period]');
    if (period) {
      update({ type: 'period', period: period.getAttribute('data-period') });
      return;
    }
    var step = event.target.closest('[data-year-step]');
    if (step && state.period !== 'last12' && !(state.from && state.to)) {
      var view = dash.compute(source, state);
      var index = view.years.indexOf(view.year);
      var nextYear = view.years[index + Number(step.getAttribute('data-year-step'))];
      if (nextYear) update({ type: 'year', year: nextYear });
      return;
    }
    var type = event.target.closest('[data-type]');
    if (type) {
      update({ type: 'eventType', eventType: type.getAttribute('data-type') });
      return;
    }
    var audience = event.target.closest('[data-audience]');
    if (audience) {
      update({ type: 'audience', audience: audience.getAttribute('data-audience') });
      return;
    }
    var bucket = event.target.closest('[data-bucket]');
    if (bucket) {
      update({ type: 'bucket', bucket: bucket.getAttribute('data-bucket') });
      return;
    }
    var more = event.target.closest('[data-more]');
    if (more) {
      event.preventDefault();
      var docs = more.closest('.docs');
      var menu = docs ? docs.querySelector('.more-pop') : null;
      if (!menu) return;
      var show = menu.hidden;
      closeMenus();
      menu.hidden = !show;
    }
  }

  function onChange(event) {
    var target = event.target;
    if (target && target.hasAttribute('data-year-select')) {
      update({ type: 'year', year: Number(target.value) });
      return;
    }
    if (target && target.hasAttribute('data-date')) {
      var row = target.closest('.daterow');
      if (!row) return;
      var from = row.querySelector('[data-date="from"]');
      var to = row.querySelector('[data-date="to"]');
      if (!from || !to || !from.value || !to.value) return;
      update({ type: 'dates', from: from.value, to: to.value });
    }
  }
})();
