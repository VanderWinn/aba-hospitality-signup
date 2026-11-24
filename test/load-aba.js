const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadAba() {
  const context = {
    console,
    Intl,
    Date,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp,
    Error,
    isFinite,
    isNaN,
    parseInt,
    parseFloat,
    encodeURIComponent,
    decodeURIComponent,
    URLSearchParams,
    ABA_SHA256: function (text) {
      return require('crypto').createHash('sha256').update(String(text), 'utf8').digest('hex');
    }
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Calendar.gs'), 'utf8'), context, { filename: 'Calendar.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Admin.gs'), 'utf8'), context, { filename: 'Admin.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Mail.gs'), 'utf8'), context, { filename: 'Mail.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/RefreshInvites.gs'), 'utf8'), context, { filename: 'RefreshInvites.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Templates.gs'), 'utf8'), context, { filename: 'Templates.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Events.gs'), 'utf8'), context, { filename: 'Events.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/FixFullLunch.gs'), 'utf8'), context, { filename: 'FixFullLunch.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Seed.gs'), 'utf8'), context, { filename: 'Seed.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/catalog.js'), 'utf8'), context, { filename: 'catalog.js' });
  return context;
}

function stateFromSeed(aba, seed) {
  const built = aba.buildSeedRows_(seed || aba.abaSeedData());
  const col = (row, name) => row[aba.columnIndex_(aba.SIGNUP_HEADERS, name)];
  return {
    slots: built.slotRows.map((row) => ({
      slotId: row[0],
      date: row[1],
      time: row[2],
      event: row[3],
      location: row[4],
      task: row[5],
      capacity: row[6]
    })),
    signups: built.signupRows.map((row, index) => ({
      rowNumber: index + 2,
      signupId: col(row, 'signupId'),
      slotId: col(row, 'slotId'),
      name: col(row, 'name'),
      email: col(row, 'email') ? String(col(row, 'email')) : '',
      createdAt: col(row, 'createdAt'),
      source: col(row, 'source'),
      event: col(row, 'event'),
      date: col(row, 'date'),
      time: col(row, 'time'),
      task: col(row, 'task'),
      venue: col(row, 'venue') || '',
      address: col(row, 'address') || '',
      location: aba.fullPlace_(col(row, 'venue'), col(row, 'address')) || col(row, 'location') || '',
      capacity: col(row, 'capacity'),
      token: col(row, 'token') || '',
      status: col(row, 'status') || '',
      reminderSent: col(row, 'reminderSent') || '',
      sequence: col(row, 'sequence') || 0
    }))
  };
}

function memoryDeps(aba, state, options) {
  const opts = options || {};
  const hits = {};
  let insideLock = false;
  const deps = {
    hits,
    wasInsideLock() { return insideLock; },
    now() { return opts.now ? opts.now() : Date.UTC(2026, 10, 20, 15, 0, 0); },
    today() { return opts.today ? opts.today() : '2026-11-20'; },
    stamp() { return '2026-11-20 10:00:00'; },
    rateLimit(email, now) { return aba.ABA_RULES.checkRateLimit(hits, email, now); },
    withLock(fn) {
      if (opts.failLock) return false;
      if (opts.throwLock) throw new Error('lock failed');
      insideLock = true;
      try {
        fn();
        return true;
      } finally {
        insideLock = false;
      }
    },
    readState() {
      deps.readInsideLock = insideLock;
      return state;
    },
    appendSignup(row) {
      deps.appendInsideLock = insideLock;
      if (opts.throwAppend) throw new Error('append failed');
      row.rowNumber = state.signups.length + 2;
      state.signups.push(row);
    },
    updateSignup(rowNumber, fields) {
      const found = state.signups.find((item) => item.rowNumber === rowNumber);
      if (!found) throw new Error('missing row ' + rowNumber);
      Object.assign(found, fields);
    },
    deleteSignup(signupId) {
      deps.deleteInsideLock = insideLock;
      const index = state.signups.findIndex((item) => item.signupId === signupId);
      if (index === -1) return false;
      state.signups.splice(index, 1);
      return true;
    },
    newId() { return 'id-' + (state.signups.length + 1); },
    newToken() { return ('token' + state.signups.length).padEnd(32, 'a'); },
    sendMail(message) {
      if (opts.throwMail) throw new Error('mail failed');
      deps.mails.push(message);
    },
    mails: [],
    todayEastern() { return opts.todayEastern ? opts.todayEastern() : '2026-11-20'; }
  };
  return deps;
}

module.exports = { root, loadAba, stateFromSeed, memoryDeps };
