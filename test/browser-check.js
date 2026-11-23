#!/usr/bin/env node
const puppeteer = require('puppeteer-core');
const { start } = require('./mock-server');

const chrome = process.env.CHROME || '/usr/bin/google-chrome';

async function launch() {
  return puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function main() {
  const preview = await start();
  const live = await start({ liveConfig: true });
  const browser = await launch();
  const shots = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(preview.url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.event');
    const previewText = await page.evaluate(() => document.body.innerText);
    assert(previewText.includes('Preview only'), 'missing preview banner');
    assert(previewText.includes('Kevin Snyder'), 'missing seeded name');
    assert(!previewText.includes('Spots open'), 'summary cards are still on the page');
    assert(previewText.includes('Ada Hotel'), 'missing venue');
    assert(!previewText.toLowerCase().includes('@'), 'an email is visible in preview');
    const claimCount = await page.$$eval('.claim', (nodes) => nodes.length);
    assert(claimCount === 0, 'preview rendered ' + claimCount + ' sign-up buttons');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 1, 'desktop page overflows by ' + overflow);
    await page.screenshot({ path: '/opt/cursor/artifacts/preview-desktop.png', fullPage: false });
    shots.push('preview-desktop');

    await page.click('summary');
    await page.waitForSelector('#event-2026-11-17-ribbon-cutting');
    const pastText = await page.$eval('#event-2026-11-17-ribbon-cutting', (el) => el.innerText);
    assert(pastText.includes('Closed'), 'past event is not closed');
    assert(pastText.includes('Stacey Thurston'), 'past name missing');

    await page.setViewport({ width: 390, height: 844 });
    await page.goto(preview.url, { waitUntil: 'networkidle0' });
    await page.waitForSelector('.event');
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(mobileOverflow <= 1, 'mobile page overflows by ' + mobileOverflow);
    await page.screenshot({ path: '/opt/cursor/artifacts/preview-mobile.png', fullPage: false });
    shots.push('preview-mobile');

    await page.setViewport({ width: 1280, height: 900 });
    const livePage = await browser.newPage();
    await livePage.setViewport({ width: 1280, height: 900 });
    await livePage.goto(live.url, { waitUntil: 'networkidle0' });
    await livePage.waitForSelector('.claim');
    const liveBanner = await livePage.$eval('#banner', (el) => el.textContent.trim());
    assert(liveBanner === '', 'live mode still shows a banner: ' + liveBanner);
    const fullTask = await livePage.$eval('#task-2026-12-09-happy-hour-door-sign-in-table', (el) => el.innerText);
    assert(!fullTask.includes('>Full<') && !fullTask.includes('Sign up'), 'full task still offers a badge or sign-up');
    assert(fullTask.includes('Rebecca Vandenbroek'), 'filled name missing');
    assert(!fullTask.includes('Sign up'), 'full task still offers sign-up');

    await livePage.evaluate(() => {
      const button = [...document.querySelectorAll('.claim')].find((node) =>
        node.dataset.task === 'Mixer Host' && node.dataset.date === '2026-12-09');
      button.click();
    });
    await livePage.waitForSelector('#signup-dialog[open]');
    await livePage.type('#signup-name', '  Ada   Tester  ');
    await livePage.type('#signup-email', 'Ada.Tester@Example.com');
    await livePage.click('#dialog-submit');
    await livePage.waitForFunction(() => {
      const toast = document.getElementById('toast');
      return toast && !toast.hidden && toast.textContent.includes('Mixer Host');
    });
    await livePage.waitForFunction(() => document.body.innerText.includes('Ada Tester'));
    const after = await livePage.content();
    assert(!after.toLowerCase().includes('ada.tester@example.com'), 'email leaked into the page');
    const dialogOpen = await livePage.$eval('#signup-dialog', (el) => el.open);
    assert(dialogOpen === false, 'dialog stayed open after success');
    await livePage.screenshot({ path: '/opt/cursor/artifacts/signed-up.png', fullPage: false });
    shots.push('signed-up');

    await livePage.evaluate(() => {
      const button = [...document.querySelectorAll('.claim')].find((node) =>
        node.dataset.task === 'Ambassadors Clean up' && node.dataset.date === '2026-12-09');
      button.click();
    });
    await livePage.waitForSelector('#signup-dialog[open]');
    await livePage.type('#signup-name', 'Ada Tester');
    await livePage.type('#signup-email', 'ada.tester@example.com');
    await livePage.$eval('#company', (el) => { el.value = 'Spam Co'; });
    await livePage.click('#dialog-submit');
    await livePage.waitForSelector('#form-error:not([hidden])');
    const honeypotError = await livePage.$eval('#form-error', (el) => el.textContent);
    assert(honeypotError.includes('Could not submit'), honeypotError);
    const stillOpen = await livePage.evaluate(() =>
      [...document.querySelectorAll('.who li')].some((node) => node.textContent === 'Ada Tester' && node.closest('#task-2026-12-09-happy-hour-ambassadors-clean-up')));
    assert(stillOpen === false, 'honeypot submission was saved');

    await livePage.click('#dialog-cancel');
    await livePage.evaluate(() => {
      const button = [...document.querySelectorAll('.claim')].find((node) =>
        node.dataset.task === 'Ambassadors Clean up' && node.dataset.date === '2026-12-09');
      button.click();
    });
    await livePage.waitForSelector('#signup-dialog[open]');
    await livePage.type('#signup-name', 'Ada Tester');
    await livePage.type('#signup-email', 'ada.tester@example.com');
    await livePage.click('#dialog-submit');
    await livePage.waitForFunction(() => document.body.innerText.includes('You are signed up for Ambassadors Clean up') ||
      document.getElementById('toast').textContent.includes('Ambassadors Clean up'));

    await livePage.evaluate(() => {
      const button = [...document.querySelectorAll('.claim')].find((node) =>
        node.dataset.task === 'Ambassadors Clean up' && node.dataset.date === '2026-12-09');
      button.click();
    });
    await livePage.waitForSelector('#signup-dialog[open]');
    await livePage.type('#signup-name', 'Ada Again');
    await livePage.type('#signup-email', 'ADA.TESTER@example.com');
    await livePage.click('#dialog-submit');
    await livePage.waitForSelector('#form-error:not([hidden])');
    const dup = await livePage.$eval('#form-error', (el) => el.textContent);
    assert(dup.includes('already signed up'), dup);

    console.log('Browser checks passed.');
    console.log(shots.join(', '));
  } finally {
    await browser.close();
    await preview.close();
    await live.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
