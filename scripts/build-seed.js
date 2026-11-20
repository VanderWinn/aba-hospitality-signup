#!/usr/bin/env node
/**
 * Rebuild data/seed.json and apps-script/Seed.gs from the SignUpGenius export.
 * Usage: node scripts/build-seed.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'source', 'signupgenius-2026-11-17.json');
const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const events = [];
const index = new Map();

for (const row of raw.rows) {
  const key = row.date + '|' + row.event;
  if (!index.has(key)) {
    const event = {
      date: row.date,
      time: row.time,
      name: row.event,
      location: row.location,
      tasks: [],
    };
    index.set(key, event);
    events.push(event);
  }
  const names = [];
  for (const person of row.people) {
    const qty = person.qty || 1;
    for (let i = 0; i < qty; i += 1) names.push(person.name);
  }
  index.get(key).tasks.push({
    task: row.task,
    capacity: row.needed,
    names,
  });
}

const seed = {
  org: raw.org,
  title: raw.title,
  pulled: raw.pulled,
  pulledAt: '2026-11-17T16:04:00-05:00',
  events,
};

let tasks = 0;
let capacity = 0;
let signups = 0;
for (const event of events) {
  for (const task of event.tasks) {
    tasks += 1;
    capacity += task.capacity;
    signups += task.names.length;
  }
}

if (events.length !== 11 || tasks !== 59 || capacity !== 300 || signups !== 24) {
  console.error('Seed integrity check failed', { events: events.length, tasks, capacity, signups });
  process.exit(1);
}

fs.writeFileSync(path.join(root, 'data', 'seed.json'), JSON.stringify(seed, null, 2) + '\n');

const header = `/**
 * Seed data for setup(). Generated from source/signupgenius-2026-11-17.json.
 * 11 events, 59 tasks, 300 spots, 24 existing sign-ups.
 * Re-run: node scripts/build-seed.js
 */
function abaSeedData() {
  return `;

fs.writeFileSync(
  path.join(root, 'apps-script', 'Seed.gs'),
  header + JSON.stringify(seed, null, 2) + ';\n}\n'
);

console.log('Wrote data/seed.json and apps-script/Seed.gs');
console.log(events.length + ' events, ' + tasks + ' tasks, ' + capacity + ' spots, ' + signups + ' sign-ups');
