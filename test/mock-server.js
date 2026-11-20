#!/usr/bin/env node
/**
 * Local stand-in for the Apps Script web app.
 * GET and POST /exec redirect to a result URL, the same shape GitHub Pages has to follow.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { root, loadAba, stateFromSeed, memoryDeps } = require('./load-aba');

const aba = loadAba();
const files = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/css/styles.css': 'css/styles.css',
  '/js/app.js': 'js/app.js',
  '/js/catalog.js': 'js/catalog.js',
  '/js/config.js': 'js/config.js',
  '/data/seed.json': 'data/seed.json'
};

function start(options) {
  const opts = options || {};
  const state = stateFromSeed(aba);
  const deps = memoryDeps(aba, state, { today: opts.today });
  const results = new Map();
  let seq = 0;

  function store(payload) {
    seq += 1;
    const id = String(seq);
    results.set(id, payload);
    return id;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/exec-result') {
      const payload = results.get(url.searchParams.get('rid')) || { ok: false, error: 'That response expired.' };
      return sendJson(res, payload);
    }
    if (url.pathname === '/exec') {
      let payload;
      if (req.method === 'POST') {
        const raw = await readBody(req);
        payload = aba.interpretPost_(raw, deps);
      } else {
        payload = aba.handleGet_(deps);
      }
      const id = store(payload);
      res.writeHead(302, {
        Location: '/exec-result?rid=' + id,
        'Cache-Control': 'no-store'
      });
      res.end();
      return;
    }

    const rel = files[url.pathname];
    if (!rel || req.method !== 'GET') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    if (opts.liveConfig && rel === 'js/config.js') {
      const body = 'window.ABA_CONFIG = { backendUrl: "http://127.0.0.1:' + server.address().port + '/exec" };\n';
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(body);
      return;
    }
    const body = fs.readFileSync(path.join(root, rel));
    const type = rel.endsWith('.css') ? 'text/css; charset=utf-8'
      : rel.endsWith('.js') ? 'text/javascript; charset=utf-8'
        : rel.endsWith('.json') ? 'application/json; charset=utf-8'
          : 'text/html; charset=utf-8';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(body);
  });

  return new Promise((resolve) => {
    server.listen(opts.port || 0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        port,
        url: 'http://127.0.0.1:' + port + '/',
        exec: 'http://127.0.0.1:' + port + '/exec',
        state,
        close() {
          return new Promise((done, reject) => server.close((err) => err ? reject(err) : done()));
        }
      });
    });
  });
}

function sendJson(res, payload) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

if (require.main === module) {
  const live = process.argv.includes('--live');
  start({ liveConfig: live }).then((server) => {
    console.log((live ? 'Live' : 'Preview') + ' mock at ' + server.url);
  });
}

module.exports = { start };
