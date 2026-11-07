// Check the packaged site under a GitHub Pages-style subdirectory, or a live URL.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const serveSite = require('./site-server.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function files(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? files(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
}

(async () => {
  const root = path.resolve(__dirname, '../_site');
  let server, browser;
  try {
    let base = process.env.SITE_URL;
    if (!base) {
      server = await serveSite(root);
      base = server.url;
    }
    if (!base.endsWith('/')) base += '/';
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], missing = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) missing.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => { if (r.url().startsWith(base) && r.failure()?.errorText !== 'net::ERR_ABORTED') missing.push(r.url()); });
    await page.goto(base + '?check=' + Date.now());
    await page.waitForFunction(() => typeof ACTIONS !== 'undefined' && document.querySelector('#menu [data-act=newGameAsk]'));
    const info = await (await page.request.get(base + 'build-info.json?check=' + Date.now())).json();
    if (process.env.EXPECTED_REVISION) assert.equal(info.revision, process.env.EXPECTED_REVISION);

    // Decode every shipped image, including arenas/expressions not visible at startup.
    const assets = (await files(path.join(root, 'assets'))).map(f => path.relative(root, f).split(path.sep).join('/'));
    await page.evaluate(async assets => {
      for (const src of assets) { const img = new Image(); img.src = src; await img.decode(); }
    }, assets);
    console.log(`PASS ${assets.length} packaged images load and decode`);
    await page.locator('#menu [data-act=newGameAsk]').click();
    const banners = await page.evaluate(() => BANNERS.map(({ id, description }) => ({ id, description })));
    for (const { id, description } of banners) {
      await page.locator(`#menu .bp[data-k="${id}"]`).click();
      assert.equal(await page.locator('#banner-description').innerText(), description);
      assert.ok(description.length > 40);
    }
    await page.locator('#menu-ludus-name').fill('Проверка публикации');
    await page.locator('#menu-tutorial').uncheck();
    await page.locator('#menu [data-act=menuStart]').click();
    for (let i = 0; i < 10 && await page.locator('[data-act=sceneSkip]').isVisible(); i++) await page.locator('[data-act=sceneSkip]').click();
    assert.equal(await page.evaluate(() => STATE.ludusName), 'Проверка публикации');
    for (const tab of ['ludus', 'arena', 'contracts', 'smith', 'bazaar', 'market', 'armory', 'glory', 'necro', 'rules']) {
      await page.evaluate(tab => { UI.tab = tab; render(); }, tab);
      assert.ok((await page.locator('main.content').innerText()).trim().length > 0, tab);
    }
    await page.evaluate(() => { UI.tab = 'rules'; UI.guide = 'combat'; render(); });
    await page.locator('.manual-content h3').first().hover();
    await page.mouse.wheel(0, 450);
    await page.waitForFunction(() => document.querySelector('main.content').scrollTop > 0 || document.querySelector('.manual-content').scrollTop > 0);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { UI.tab = 'arena'; UI.arenaTab = 'bets'; STATE.gold = 1000; render(); });
      assert.equal(await page.locator('[data-act=betPlace]').first().innerText(), 'Сделать ставку');
      assert.ok(await page.locator('.betpanel').evaluate(e => e.scrollWidth <= e.clientWidth + 1));
    }
    await page.locator('[data-act=betPlace]').first().click();
    await page.locator('[data-act=betCancel]').click();
    await page.evaluate(() => save());
    await page.reload();
    assert.equal(await page.evaluate(() => STATE.ludusName), 'Проверка публикации');
    assert.deepEqual(errors, [], 'Browser errors');
    assert.deepEqual(missing, [], 'Missing deployed resources');
    console.log(`PASS menu, banners, new campaign, 10 tabs, guide scroll, bets, save/reload; revision ${info.revision}`);
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
