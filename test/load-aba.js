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
    parseFloat
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Seed.gs'), 'utf8'), context, { filename: 'Seed.gs' });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/catalog.js'), 'utf8'), context, { filename: 'catalog.js' });
  return context;
}

function stateFromSeed(aba, seed) {
  const built = aba.buildSeedRows_(seed || aba.abaSeedData());
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
    signups: built.signupRows.map((row) => ({
      signupId: row[0],
      slotId: row[1],
      name: row[2],
      email: row[3] ? String(row[3]) : '',
      createdAt: row[4],
      source: row[5]
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
      state.signups.push(row);
    },
    newId() { return 'id-' + (state.signups.length + 1); }
  };
  return deps;
}

module.exports = { root, loadAba, stateFromSeed, memoryDeps };
