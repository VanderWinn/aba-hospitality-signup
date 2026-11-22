const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { root, loadAba, stateFromSeed, memoryDeps } = require('./load-aba');
const { start } = require('./mock-server');

const aba = loadAba();
const TODAY = '2026-11-20';

function claim(extra) {
  return Object.assign({
    name: 'Ada Volunteer',
    email: 'ada.volunteer@example.com',
    event: 'Happy Hour',
    date: '2026-12-09',
    task: 'Mixer Host',
    company: ''
  }, extra || {});
}

test('seed matches the SignUpGenius export: 11 events, 59 tasks, 300 spots, 24 names', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'source/signupgenius-2026-11-17.json'), 'utf8'));
  const seed = JSON.parse(fs.readFileSync(path.join(root, 'data/seed.json'), 'utf8'));
  assert.equal(seed.org, 'Ada Business Association');
  assert.equal(seed.title, 'Hospitality Jobs for ABA Board and Ambassadors');
  assert.equal(seed.events.length, 11);
  assert.deepEqual(seed.events.map((event) => event.date + '|' + event.name), [
    '2026-11-17|Ribbon Cutting',
    '2026-11-19|Lunch & Learn',
    '2026-12-09|Happy Hour',
    '2027-01-13|Happy Hour',
    '2027-01-21|Lunch & Learn',
    '2027-02-10|Happy Hour',
    '2027-02-18|Lunch & Learn',
    '2027-03-10|Happy Hour',
    '2027-03-18|Lunch & Learn',
    '2027-04-15|Lunch & Learn',
    '2027-05-20|Lunch & Learn'
  ]);

  let tasks = 0;
  let capacity = 0;
  let names = 0;
  const seen = new Set();
  raw.rows.forEach((row, index) => {
    const event = seed.events.find((item) => item.date === row.date && item.name === row.event);
    assert.ok(event, 'missing event ' + row.date);
    assert.equal(event.tasks[0] ? event.time : '', row.time);
    const task = event.tasks.find((item) => item.task === row.task);
    assert.ok(task, row.task);
    assert.equal(task.capacity, row.needed);
    const expectedNames = [];
    row.people.forEach((person) => {
      for (let i = 0; i < person.qty; i += 1) expectedNames.push(person.name);
    });
    assert.deepEqual(task.names, expectedNames);
    assert.equal(task.names.length, row.filled);
    tasks += 1;
    capacity += task.capacity;
    names += task.names.length;
    const id = row.date + '|' + row.event + '|' + row.task;
    assert.equal(seen.has(id), false);
    seen.add(id);
    assert.equal(index >= 0, true);
  });
  assert.equal(tasks, 59);
  assert.equal(capacity, 300);
  assert.equal(names, 24);
  assert.deepEqual(JSON.parse(JSON.stringify(aba.abaSeedData())), seed);
  assert.doesNotThrow(() => aba.assertSeed_(seed));
});

test('setup rows carry the 24 names and no email addresses', () => {
  const built = aba.buildSeedRows_(aba.abaSeedData());
  assert.equal(built.slotRows.length, 59);
  assert.equal(built.signupRows.length, 24);
  const col = (row, name) => row[aba.SIGNUP_HEADERS.indexOf(name)];
  const emails = built.signupRows.map((row) => col(row, 'email'));
  assert.equal(emails.length, 24);
  assert.equal(emails.every((email) => email === ''), true);
  assert.ok(built.signupRows.some((row) => col(row, 'name') === 'Stacey Thurston' && col(row, 'source') === 'seed' && col(row, 'capacity') === 1));
  const ids = built.slotRows.map((row) => row[0]);
  assert.equal(new Set(ids).size, 59);
});

test('preview board shows seeded names, closes past events, and has no sign-up buttons', () => {
  const seed = aba.abaSeedData();
  const view = aba.ABACatalog.toView(seed, TODAY);
  const summary = aba.ABACatalog.summarize(view);
  assert.equal(summary.events, 11);
  assert.equal(summary.upcoming, 9);
  assert.equal(summary.filled, 24);
  assert.equal(summary.capacity, 300);
  assert.equal(summary.open, 251);
  assert.equal(view.events[0].past, true);
  assert.equal(view.events[2].past, false);
  assert.equal(aba.ABACatalog.venue(view.events[0].location, view.events[0].name),
    'Riverside Links Indoor Golf & Lounge - 396 Pettis Ave SE, Ada, MI 49301-8713');

  const html = aba.ABACatalog.renderBoard(view, 'preview');
  assert.match(html, /Stacey Thurston/);
  assert.match(html, /Claire Larson/);
  assert.match(html, /Closed/);
  assert.doesNotMatch(html, /class="claim"/);
  assert.match(html, /Past events \(2\)/);
  assert.match(html, />251</);
  assert.match(aba.ABACatalog.renderBanner('preview', ''), /Preview only/);
  assert.match(aba.ABACatalog.renderBanner('stale', 'Sheet missing.'), /Sheet missing\./);
});

test('live board locks a full upcoming task and escapes names', () => {
  const view = aba.ABACatalog.toView(aba.abaSeedData(), TODAY);
  const html = aba.ABACatalog.renderBoard(view, 'live');
  assert.match(html, /data-task="Mixer Host"/);
  assert.match(html, /data-event="Lunch &amp; Learn"/);
  const full = html.split('id="task-2026-12-09-happy-hour-door-sign-in-table"')[1].split('</article>')[0];
  assert.match(full, /Rebecca Vandenbroek/);
  assert.match(full, /Full/);
  assert.doesNotMatch(full, /class="claim"/);

  const hostile = aba.ABACatalog.toView({
    events: [{
      date: '2026-12-09',
      time: '4:30 PM',
      name: 'Happy Hour',
      location: 'Happy Hour, Ada Hotel',
      tasks: [{ task: 'Mixer Host', capacity: 1, names: ['<img src=x onerror=alert(1)>'] }]
    }]
  }, TODAY);
  const unsafe = aba.ABACatalog.renderBoard(hostile, 'live');
  assert.doesNotMatch(unsafe, /<img/);
  assert.match(unsafe, /&lt;img/);
});

test('Detroit date rolls at local midnight', () => {
  const { todayInDetroit } = aba.ABACatalog;
  assert.equal(todayInDetroit(new Date('2026-11-20T04:30:00Z')), '2026-11-19');
  assert.equal(todayInDetroit(new Date('2026-11-20T05:30:00Z')), '2026-11-20');
});

test('sheet dates, formula text, and emails are normalized on read', () => {
  const state = aba.rowsToState_(
    [['slotId', 'date', 'time', 'event', 'location', 'task', 'capacity'],
      ['2026-12-09|Happy Hour|Mixer Host', 46023, '4:30 PM', 'Happy Hour', 'Ada Hotel', 'Mixer Host', '1'],
      ['2026-11-17|Ribbon Cutting|Photographer', new Date('2026-11-17T05:00:00Z'), '4:30 PM', 'Ribbon Cutting', 'Riverside', 'Photographer', 1]],
    [['signupId', 'slotId', 'name', 'email', 'createdAt', 'source'],
      ['s1', '2026-12-09|Happy Hour|Mixer Host', "'=Jane", 'Ada@Example.com', '', 'web']]
  );
  assert.equal(state.slots[0].date, '2026-01-01');
  assert.equal(state.slots[1].date, '2026-11-17');
  assert.equal(state.signups[0].name, '=Jane');
  assert.equal(state.signups[0].email, 'ada@example.com');
  const catalog = aba.ABA_RULES.publicCatalog(state.slots, state.signups, TODAY);
  assert.equal(JSON.stringify(catalog).includes('ada@example.com'), false);
  assert.equal(JSON.stringify(catalog).includes('=Jane'), true);
  walk(catalog);
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    Object.keys(value).forEach((key) => {
      assert.notEqual(key.toLowerCase(), 'email');
      walk(value[key]);
    });
  }
});

test('validation rejects bad fields, honeypot, unknown tasks, and past events', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  const cases = [
    [{}, 'Enter your name.'],
    [claim({ name: 'A' }), 'Name must be between 2 and 80 characters.'],
    [claim({ name: '<script>' }), 'Name can only include letters'],
    [claim({ email: '' }), 'Enter your email.'],
    [claim({ email: 'not-an-email' }), 'Enter a valid email address.'],
    [claim({ email: 'a@b.c' }), 'Enter a valid email address.'],
    [claim({ task: '' }), 'Choose an event and task.'],
    [claim({ task: 'Not a real task' }), 'That event or task is not on the sheet.'],
    [claim({ company: 'https://spam.example' }), 'Could not submit the form.'],
    [claim({ date: '2026-11-17', event: 'Ribbon Cutting', task: 'Ribbon Holders', email: 'new@example.com' }), 'This event is closed.']
  ];
  cases.forEach(([body, snippet]) => {
    const result = aba.processPost_(body, deps);
    assert.equal(result.ok, false, JSON.stringify(body));
    assert.equal(result.error.includes(snippet), true, result.error + ' / ' + snippet);
  });
  assert.equal(state.signups.length, 24);
});

test('a claim writes one row, repeats are rejected, and the last spot cannot be overbooked', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  const first = aba.processPost_(claim(), deps);
  assert.equal(first.ok, true);
  assert.equal(first.message, 'You are signed up for Mixer Host.');
  assert.equal(deps.readInsideLock, true);
  assert.equal(deps.appendInsideLock, true);
  assert.equal(state.signups.filter((row) => row.task === 'Mixer Host' && row.slotId.endsWith('|Mixer Host') && row.source === 'web').length, 1);

  const duplicate = aba.processPost_(claim({ email: 'Ada.Volunteer@Example.com', name: 'Ada V.' }), deps);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error, 'You are already signed up for this task.');

  const otherTask = aba.processPost_(claim({ task: 'Ambassadors Clean up', email: 'Ada.Volunteer@Example.com' }), deps);
  assert.equal(otherTask.ok, true);

  const setup = claim({ task: 'Ambassadors Set up' });
  const successes = [];
  for (let i = 0; i < 8; i += 1) {
    successes.push(aba.processPost_(claim({ task: 'Ambassadors Set up', email: 'person' + i + '@example.com', name: 'Person ' + i }), deps));
  }
  assert.equal(successes.filter((result) => result.ok).length, 8);
  const overflow = aba.processPost_(claim({ task: 'Ambassadors Set up', email: 'overflow@example.com', name: 'Overflow' }), deps);
  assert.equal(overflow.error, 'That task is full.');
  const webOnSetup = state.signups.filter((row) => row.slotId.endsWith('|Ambassadors Set up') && row.source === 'web');
  assert.equal(webOnSetup.length, 8);
  assert.equal(setup.task, 'Ambassadors Set up');

  const catalog = aba.ABA_RULES.publicCatalog(state.slots, state.signups, TODAY);
  const happy = catalog.events.find((event) => event.date === '2026-12-09');
  const mixer = happy.tasks.find((task) => task.task === 'Mixer Host');
  assert.equal(mixer.names.length, 1);
  assert.equal(mixer.names[0], 'Ada Volunteer');
  assert.equal(JSON.stringify(catalog).includes('ada.volunteer@example.com'), false);
});

test('two readers of a stale sheet can both look eligible, and the locked write admits only one', () => {
  const state = stateFromSeed(aba);
  const snapshot = JSON.parse(JSON.stringify(state));
  const first = aba.ABA_RULES.decide(aba.ABA_RULES.parseSignup(claim({ email: 'a@example.com' })).value, snapshot, TODAY);
  const second = aba.ABA_RULES.decide(aba.ABA_RULES.parseSignup(claim({ email: 'b@example.com' })).value, snapshot, TODAY);
  assert.equal(first.ok && second.ok, true);

  const live = stateFromSeed(aba);
  const deps = memoryDeps(aba, live);
  assert.equal(aba.processPost_(claim({ email: 'a@example.com', name: 'A Person' }), deps).ok, true);
  const rejected = aba.processPost_(claim({ email: 'b@example.com', name: 'B Person' }), deps);
  assert.equal(rejected.error, 'That task is full.');
  assert.equal(live.signups.filter((row) => row.slotId.endsWith('|Mixer Host')).length, 1);
});

test('rate limiting, a busy lock, and a failed write do not give away a spot', () => {
  const state = stateFromSeed(aba);
  let now = Date.UTC(2026, 10, 20, 15, 0, 0);
  const deps = memoryDeps(aba, state, { now: () => now });
  const body = claim({ task: 'Ambassadors Clean up', email: 'repeat@example.com' });
  const results = [];
  for (let i = 0; i < 6; i += 1) results.push(aba.processPost_(body, deps));
  assert.equal(results[0].ok, true);
  assert.equal(results[4].error, 'You are already signed up for this task.');
  assert.equal(results[5].error, 'Too many sign-up attempts. Please wait a few minutes and try again.');
  now += aba.ABA_RULES.RATE_WINDOW_MS + 1;
  assert.equal(aba.processPost_(body, deps).error, 'You are already signed up for this task.');

  const before = state.signups.length;
  const busy = memoryDeps(aba, state, { failLock: true });
  assert.equal(aba.processPost_(claim({ email: 'busy@example.com' }), busy).error, 'The sheet is busy. Please try again in a moment.');
  const broken = memoryDeps(aba, state, { throwAppend: true });
  assert.equal(aba.processPost_(claim({ email: 'broken@example.com' }), broken).error, 'Could not submit the form.');
  assert.equal(state.signups.length, before);
});

test('posted text is parsed, and formula-looking names are stored as text', () => {
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state);
  assert.equal(aba.interpretPost_('not json', deps).error, 'Invalid request.');
  assert.equal(aba.interpretPost_('{"name":"A"}' + 'x'.repeat(4000), deps).error, 'Invalid request.');
  const cells = aba.signupCells_({
    signupId: '1',
    slotId: 'slot',
    name: '=HYPERLINK("http://evil")',
    email: 'ada@example.com',
    createdAt: 't',
    source: 'web'
  });
  assert.equal(String(cells[aba.SIGNUP_HEADERS.indexOf('name')]).startsWith("'"), true);
  assert.equal(aba.ABA_RULES.sheetSafe('Ada Volunteer'), 'Ada Volunteer');
});

test('the published config points at the Apps Script web app and posts text/plain through redirects', () => {
  const config = fs.readFileSync(path.join(root, 'js/config.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const code = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');
  assert.match(config, /backendUrl:\s*"https:\/\/script\.google\.com\/macros\/s\/AKfycbxr1tnAxRP2Jm5FEbHiKjWDWtdkSrNUoM53CvAqMAUYN2XYKbAzDKgAMxQmOce_4_Cl\/exec"/);
  assert.match(app, /text\/plain;charset=utf-8/);
  assert.match(app, /redirect:\s*'follow'/);
  assert.match(code, /LockService\.getScriptLock\(\)/);
  assert.match(code, /1wVRyW_PRfB-rgPB716lWkqQraBBnw1lXuPH5o2-4u74/);
  assert.match(fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8'), /actions\/deploy-pages/);
});

test('the mock web app follows redirects, hides emails, and refuses a second claim on the last spot', async () => {
  const server = await start({ today: () => TODAY });
  try {
    const listed = await fetch(server.exec + '?t=1', { redirect: 'follow' });
    const catalog = await listed.json();
    assert.equal(catalog.ok, true);
    assert.equal(catalog.events.length, 11);
    assert.equal(JSON.stringify(catalog).includes('@'), false);
    assert.equal(JSON.stringify(catalog).includes('Stacey Thurston'), true);

    const page = await fetch(server.url);
    const html = await page.text();
    assert.match(html, /Hospitality Jobs for ABA Board and Ambassadors/);
    assert.match(html, /js\/config\.js/);

    async function post(body) {
      const response = await fetch(server.exec, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });
      return response.json();
    }

    const saved = await post(claim({ email: 'mock.one@example.com', name: 'Mock One' }));
    assert.equal(saved.ok, true);
    const again = await fetch(server.exec, { redirect: 'follow' });
    const after = await again.json();
    const mixer = after.events.find((event) => event.date === '2026-12-09').tasks.find((task) => task.task === 'Mixer Host');
    assert.deepEqual(mixer.names, ['Mock One']);
    assert.equal(JSON.stringify(after).includes('mock.one@example.com'), false);

    const duplicate = await post(claim({ email: 'mock.one@example.com', name: 'Mock One' }));
    assert.equal(duplicate.error, 'You are already signed up for this task.');

    const server2 = await start({ today: () => TODAY });
    try {
      const [left, right] = await Promise.all([
        fetch(server2.exec, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(claim({ email: 'left@example.com', name: 'Left Person' }))
        }).then((response) => response.json()),
        fetch(server2.exec, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(claim({ email: 'right@example.com', name: 'Right Person' }))
        }).then((response) => response.json())
      ]);
      const oks = [left, right].filter((result) => result.ok);
      assert.equal(oks.length, 1);
      const finalCatalog = await (await fetch(server2.exec, { redirect: 'follow' })).json();
      const finalMixer = finalCatalog.events.find((event) => event.date === '2026-12-09').tasks.find((task) => task.task === 'Mixer Host');
      assert.equal(finalMixer.names.length, 1);
    } finally {
      await server2.close();
    }
  } finally {
    await server.close();
  }
});
