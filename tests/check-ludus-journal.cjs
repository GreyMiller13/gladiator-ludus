// Focused journal regression check, without screenshots or a full UI run.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const serveSite = require('./site-server.cjs');

(async () => {
  let server, browser;
  try {
    const base = process.env.SITE_URL || (server = await serveSite(path.resolve(__dirname, '..'))).url;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
    await page.goto(base);
    await page.evaluate(() => {
      newGame('Проверка хроники'); hideMenu();
      STATE.journal = [];
      for (let day = 1; day <= 100; day++) {
        STATE.day = day;
        journal(`Событие ${day}`);
      }
      UI.tab = 'ludus'; render(); save();
    });
    assert.equal(await page.locator('.journal-scroll .journal-row').count(), 5);
    assert.match(await page.locator('.journal-scroll').innerText(), /Событие 96/);
    assert.doesNotMatch(await page.locator('.journal-scroll').innerText(), /Событие 95/);
    await page.locator('.journal-scroll').hover();
    const before = await page.evaluate(() => document.scrollingElement.scrollTop);
    assert.ok(before > 0);
    await page.mouse.wheel(0, -250);
    await page.waitForFunction(y => document.scrollingElement.scrollTop < y, before);

    await page.locator('[data-act=shellJournal]').click();
    assert.equal(await page.locator('.shell-journal p').count(), 100);
    const scrolling = await page.locator('.journal-dialog').evaluate(dialog =>
      [dialog.parentElement, dialog, ...dialog.querySelectorAll('*')].filter(el =>
        /^(auto|scroll)$/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight
      ).map(el => el.className));
    assert.deepEqual(scrolling, ['shell-journal']);
    await page.locator('.shell-journal').hover();
    await page.mouse.wheel(0, 300);
    await page.waitForFunction(() => document.querySelector('.shell-journal').scrollTop > 0);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => ({
      // Loading a campaign can append story events; all seeded events must remain.
      count: STATE.journal.filter(entry => /^Событие \d+$/.test(entry.text)).length,
      oldest: STATE.journal.at(-1).text,
    })), { count: 100, oldest: 'Событие 1' });
    console.log('PASS five latest events, page wheel over journal, one dialog scrollbar, 100 events survive save/reload');
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
