const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, locale: 'ru-RU' });
    const errors = [];
    const counts = new Map();
    let failYandex = false;
    let slow = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', async route => {
      const url = new URL(route.request().url());
      counts.set(url.hostname, (counts.get(url.hostname) || 0) + 1);
      if (failYandex && url.hostname === 'yandex.ru') return route.abort('failed');
      if (url.searchParams.has('bytes') || url.searchParams.has('ckSize')) {
        await new Promise(resolve => setTimeout(resolve, slow ? 700 : 140));
        try {
          const size = url.searchParams.has('ckSize') ? Number(url.searchParams.get('ckSize')) * 1048576 : Number(url.searchParams.get('bytes'));
          await route.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream', 'content-length': String(size), 'access-control-allow-origin': '*' }, body: Buffer.alloc(size, 0x5a) });
        } catch { /* A cancellation may close this intercepted request. */ }
      } else {
        await route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="green"/></svg>' });
      }
    });
    const preview = path.resolve('artifacts', require('../package.json').version, 'preview');
    fs.mkdirSync(preview, { recursive: true });
    await page.goto(pathToFileURL(path.resolve('app/index.html')).href);
    assert.equal(await page.title(), 'inet-speed-old-tizen');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#value-language').textContent(), 'English  ›');
    assert.equal(await page.locator('#start-all').textContent(), 'Run full test →');
    assert.equal(/[А-Яа-яЁё]/.test(await page.locator('body').innerText()), false);
    await page.screenshot({ path: path.join(preview, 'overview.png') });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'start-all');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-page')), 'overview');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#page-sites').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#page-overview').isVisible(), true);

    await page.locator('[data-page="settings"]').click();
    await page.locator('#setting-duration').click();
    await page.locator('#setting-duration').click();
    await page.locator('#setting-budget').click();
    await page.locator('#setting-budget').click();
    assert.match(await page.locator('#value-duration').textContent(), /^6 /);
    assert.match(await page.locator('#value-budget').textContent(), /^8 /);
    await page.locator('[data-page="overview"]').click();
    await page.locator('#start-all').click();
    const overlap = await page.evaluate(() => {
      const result = document.getElementById('compact-wikipedia').getBoundingClientRect();
      const bar = document.getElementById('run-bar').getBoundingClientRect();
      return result.left < bar.right && result.right > bar.left && result.top < bar.bottom && result.bottom > bar.top;
    });
    assert.equal(overlap, false, 'The active run bar must not cover site results');
    await page.screenshot({ path: path.join(preview, 'running-demo.png') });
    await page.locator('[data-page="sites"]').click();
    assert.equal(await page.evaluate(() => {
      const detail = document.getElementById('site-detail').getBoundingClientRect();
      const bar = document.getElementById('run-bar').getBoundingClientRect();
      return detail.left < bar.right && detail.right > bar.left && detail.top < bar.bottom && detail.bottom > bar.top;
    }), false, 'The active run bar must not cover site details');
    await page.locator('[data-page="overview"]').click();
    await page.waitForFunction(() => document.getElementById('footer-status').textContent === 'Test complete', null, { timeout: 30000 });
    assert.match(await page.locator('#summary-sites').textContent(), /^10/);
    assert.match(await page.locator('#speed-cloudflare').textContent(), /^\d/);
    assert.match(await page.locator('#speed-fastly').textContent(), /^\d/);
    assert.match(await page.locator('#speed-hostkey').textContent(), /^\d/);
    assert.match(await page.locator('#ms-yandex').textContent(), / ms$/);
    await page.screenshot({ path: path.join(preview, 'results-demo.png') });
    await page.locator('[data-page="speed"]').click();
    assert.equal(await page.locator('#speed-chart').evaluate(node => node.width === node.clientWidth), true, 'A completed chart must fit when its page is opened');
    await page.screenshot({ path: path.join(preview, 'speed-demo.png') });

    await page.locator('[data-page="settings"]').click();
    await page.locator('#setting-language').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    assert.equal(await page.locator('#page-title').textContent(), 'Настройки');
    assert.match(await page.locator('#ms-yandex').textContent(), / мс$/);
    assert.match(await page.locator('#speed-fastly').textContent(), /Мбит\/с/);
    assert.match(await page.locator('#chart-caption').textContent(), /Мбит\/с/);
    assert.equal(await page.locator('#footer-status').textContent(), 'Проверка завершена');
    const settingsBounds = await page.locator('#page-settings .explanation').evaluate(node => ({
      bottom: node.getBoundingClientRect().bottom, footerTop: document.querySelector('footer').getBoundingClientRect().top
    }));
    assert.ok(settingsBounds.bottom < settingsBounds.footerTop);
    await page.screenshot({ path: path.join(preview, 'settings-ru.png') });
    await page.locator('[data-page="overview"]').click();
    await page.screenshot({ path: path.join(preview, 'results-demo-ru.png') });
    await page.locator('[data-page="sites"]').click();
    await page.locator('#site-yandex').click();
    await page.getByRole('button', { name: 'Добавить в выбранные' }).click();
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('lang'), 'ru');
    assert.equal(await page.locator('#value-language').textContent(), 'Русский  ›');
    await page.locator('[data-page="sites"]').click();
    assert.equal(await page.locator('#selection-yandex').textContent(), '✓');
    failYandex = true;
    await page.locator('#site-yandex').click();
    await page.getByRole('button', { name: 'Проверить только этот сайт' }).click();
    await page.waitForFunction(() => document.getElementById('footer-status').textContent === 'Проверка завершена');
    assert.equal(await page.locator('#ms-yandex').textContent(), 'Нет ответа');
    const yandexCount = counts.get('yandex.ru');
    await page.locator('[data-group="ru"]').click();
    await page.locator('#start-sites').click();
    await page.waitForFunction(() => document.getElementById('footer-status').textContent.includes('пропущено на паузе: 1'));
    assert.equal(counts.get('yandex.ru'), yandexCount);
    await page.screenshot({ path: path.join(preview, 'sites-demo.png') });

    slow = true;
    await page.locator('[data-page="speed"]').click();
    await page.locator('#start-speed').click();
    await page.waitForFunction(() => !document.getElementById('run-bar').classList.contains('hidden'));
    await page.waitForFunction(() => document.getElementById('speed-state-cloudflare').textContent.indexOf('Загрузка') === 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#run-bar').isVisible(), false);
    assert.equal(await page.locator('#footer-status').textContent(), 'Проверка остановлена');
    const requestCount = [...counts.values()].reduce((a, b) => a + b, 0);
    await page.waitForTimeout(900);
    assert.equal([...counts.values()].reduce((a, b) => a + b, 0), requestCount);

    await page.locator('[data-page="settings"]').click();
    await page.locator('#setting-language').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#footer-status').textContent(), 'Test stopped');
    assert.equal(await page.locator('#speed-state-cloudflare').textContent(), 'Stopped');
    assert.match(await page.locator('#state-yandex').textContent(), /Retry in [1-9]\d* s/);
    await page.screenshot({ path: path.join(preview, 'settings.png') });
    // Check visible layout after returning to the overview.
    await page.locator('[data-page="overview"]').click();
    const bounds = await page.locator('#overview-limits').evaluate(node => {
      const note = node.getBoundingClientRect();
      const panel = node.closest('.hero').getBoundingClientRect();
      return { bottom: note.bottom, panelBottom: panel.bottom };
    });
    assert.ok(bounds.bottom < bounds.panelBottom);
    assert.equal(await page.locator('#start-all').isEnabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#modal-title').textContent(), 'Exit inet-speed-old-tizen?');
    assert.equal(await page.getByRole('button', { name: 'Stay', exact: true }).isVisible(), true);
    await page.keyboard.press('Escape');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.locator('[data-page="settings"]').click();
    const englishSettings = await page.locator('#page-settings .explanation').evaluate(node => ({
      bottom: node.getBoundingClientRect().bottom, footerTop: document.querySelector('footer').getBoundingClientRect().top
    }));
    assert.ok(englishSettings.bottom < englishSettings.footerTop);
    assert.deepEqual(errors, []);

    // Controlled completions and a virtual clock exercise UI states without network waits.
    const reviewPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    reviewPage.setDefaultTimeout(5000);
    reviewPage.on('pageerror', error => errors.push(error.message));
    await reviewPage.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await reviewPage.goto(pathToFileURL(path.resolve('app/index.html')).href);
    await reviewPage.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
    async function prepareReviewPage() {
      await reviewPage.evaluate(() => {
        window.reviewJobs = [];
        function job(kind, options, progress, done, url) {
          window.reviewJobs.push({ kind, options, progress, done, url });
          return { cancel: function () { window.reviewJobs = []; } };
        }
        window.NetEngine.probe = function (url, options, progress, done) { return job('site', options, progress, done, url); };
        window.NetEngine.download = function (server, options, progress, done) { return job('speed', options, progress, done); };
      });
    }
    async function resetReviewPage() {
      await reviewPage.evaluate(() => localStorage.clear());
      await reviewPage.reload();
      await prepareReviewPage();
    }
    async function click(selector) {
      await reviewPage.evaluate(selector => document.querySelector(selector).click(), selector);
      await reviewPage.clock.runFor(1);
    }
    async function finish(result) {
      await reviewPage.evaluate(result => window.reviewJobs.shift().done(result), result);
      await reviewPage.clock.runFor(200);
    }
    const siteSuccess = { reason: 'ok', ms: 40, samples: [30, 40, 50], attempts: 3, requested: 3, spread: 10 };
    await prepareReviewPage();
    await click('[data-page="sites"]');
    await click('[data-group="ru"]');
    assert.equal(await reviewPage.locator('.site-card.excluded').count(), 5);
    assert.equal(await reviewPage.locator('#site-google').evaluate(node => node.classList.contains('excluded')), true);
    assert.equal(await reviewPage.locator('#site-ria').evaluate(node => node.classList.contains('excluded')), false);
    await click('[data-group="world"]');
    assert.equal(await reviewPage.locator('#site-ria').evaluate(node => node.classList.contains('excluded')), true);
    assert.equal(await reviewPage.locator('#site-google').evaluate(node => node.classList.contains('excluded')), false);
    await click('#custom-selection');
    assert.equal(await reviewPage.locator('.site-card.excluded').count(), 10);
    await click('[data-group="all"]');
    assert.equal(await reviewPage.locator('.site-card.excluded').count(), 0);

    await click('#open-manual');
    await click('#manual-edit');
    await reviewPage.locator('#manual-address').fill('example.com/path');
    await reviewPage.keyboard.press('Backspace');
    assert.equal(await reviewPage.locator('#manual-address').inputValue(), 'example.com/pat');
    await reviewPage.keyboard.press('ArrowLeft');
    assert.equal(await reviewPage.evaluate(() => document.activeElement.id), 'manual-address');
    await reviewPage.evaluate(() => document.getElementById('manual-address').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, keyCode: 65376 })));
    assert.equal(await reviewPage.evaluate(() => document.activeElement.id), 'start-manual');
    await reviewPage.keyboard.press('Enter');
    await reviewPage.clock.runFor(1);
    assert.equal(await reviewPage.evaluate(() => window.reviewJobs[0].url), 'https://example.com/favicon.ico');
    assert.equal(await reviewPage.locator('#manual-address').isDisabled(), true);
    await finish({ reason: 'timeout', ms: null, samples: [], attempts: 1, requested: 3, spread: null });
    assert.match(await reviewPage.locator('#state-manual').textContent(), /Response timed out.*Retry in/);
    await click('#start-manual');
    assert.equal(await reviewPage.evaluate(() => window.reviewJobs.length), 0, 'The same manual host must respect cooldown');
    await reviewPage.locator('#manual-address').fill('http://another.example/path');
    await click('#start-manual');
    assert.equal(await reviewPage.evaluate(() => window.reviewJobs[0].url), 'http://another.example/favicon.ico');
    await reviewPage.keyboard.press('Escape');
    assert.equal(await reviewPage.locator('#state-manual').textContent(), 'Stopped');
    for (const address of ['', 'javascript:alert(1)', 'https://name:password@example.com', 'not a domain']) {
      await reviewPage.locator('#manual-address').fill(address);
      await click('#start-manual');
      assert.match(await reviewPage.locator('#manual-error').textContent(), /valid HTTP or HTTPS/);
      assert.equal(await reviewPage.evaluate(() => window.reviewJobs.length), 0);
    }
    await reviewPage.locator('#manual-address').fill('example.com');
    await click('#start-manual');
    await reviewPage.clock.runFor(31000);
    await click('#start-manual');
    await finish(siteSuccess);
    await reviewPage.screenshot({ path: path.join(preview, 'manual-demo.png') });
    assert.match(await reviewPage.locator('#ms-manual').textContent(), /40 ms/);
    assert.equal(await reviewPage.evaluate(() => (localStorage.getItem('netscope-settings') || '').includes('example.com')), false);
    await click('[data-page="settings"]');
    await click('#setting-language');
    await click('#open-manual');
    assert.equal(await reviewPage.locator('#page-title').textContent(), 'Сайт вручную');
    assert.match(await reviewPage.locator('#ms-manual').textContent(), /40 мс/);
    await click('#manual-edit');
    await reviewPage.evaluate(() => document.getElementById('manual-address').dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, keyCode: 65385 })));
    assert.equal(await reviewPage.evaluate(() => document.activeElement.id), 'manual-edit');
    await reviewPage.keyboard.press('Escape');
    assert.equal(await reviewPage.locator('#page-sites').isVisible(), true);
    await reviewPage.reload();
    await click('#open-manual');
    assert.equal(await reviewPage.locator('#manual-address').inputValue(), '');
    await resetReviewPage();
    await click('[data-page="sites"]');
    await click('#site-yandex');
    await click('#modal-actions button');
    await finish({ reason: 'resource', ms: null, samples: [], attempts: 1, requested: 3, spread: null });
    const failure = await reviewPage.locator('#ms-yandex').textContent();
    const seconds = async () => Number((await reviewPage.locator('#state-yandex').textContent()).match(/Retry in (\d+) s/)[1]);
    const before = await seconds();
    await reviewPage.clock.runFor(1100);
    assert.ok(await seconds() < before, 'Cooldown must count down without interaction');
    await reviewPage.clock.setSystemTime(new Date('2025-12-31T23:00:00Z'));
    await reviewPage.clock.runFor(1000);
    assert.ok(await seconds() <= before && await seconds() > 0, 'A backward wall-clock jump must not extend cooldown');
    await reviewPage.clock.setSystemTime(new Date('2026-01-01T02:00:00Z'));
    await reviewPage.clock.runFor(1000);
    assert.ok(await seconds() > 0, 'A forward wall-clock jump must not expire cooldown');
    await click('#site-yandex');
    await click('#modal-actions button:nth-child(2)');
    await click('#custom-selection');
    assert.equal(await reviewPage.locator('#start-sites').textContent(), 'Test sites: 1 →');
    await click('#start-sites');
    assert.equal(await reviewPage.locator('#ms-yandex').textContent(), failure);
    assert.match(await reviewPage.locator('#state-yandex').textContent(), /Network \/ HTTPS \/ resource/);
    assert.equal(await reviewPage.evaluate(() => window.reviewJobs.length), 0);
    await click('#site-yandex');
    assert.equal(await reviewPage.locator('#modal-actions button').first().isDisabled(), true);
    await reviewPage.clock.runFor(31000);
    assert.equal(await reviewPage.locator('#modal-actions button').first().isDisabled(), false);
    assert.equal(await reviewPage.locator('#modal-actions button').first().textContent(), 'Test only this site');
    assert.equal(await reviewPage.locator('#ms-yandex').textContent(), failure);
    assert.equal(/Retry in/.test(await reviewPage.locator('#state-yandex').textContent()), false);
    await reviewPage.keyboard.press('Escape');

    await resetReviewPage();
    await click('[data-page="sites"]');
    await click('#site-vk');
    await click('#modal-actions button');
    await click('#site-google');
    await finish(siteSuccess);
    assert.equal(await reviewPage.evaluate(() => document.getElementById('modal').contains(document.activeElement)), true);
    assert.equal(await reviewPage.locator('#modal-actions button').first().isDisabled(), false);
    await reviewPage.evaluate(() => document.querySelector('[data-group="ru"]').focus());
    await reviewPage.keyboard.press('Enter');
    assert.equal(await reviewPage.locator('[data-group="all"]').getAttribute('class'), 'chip selected');
    await reviewPage.keyboard.press('Escape');
    assert.match(await reviewPage.locator('#summary-sites').textContent(), /^1\s*\/\s*1$/);
    await click('[data-page="settings"]');
    await click('#setting-samples');
    await click('#setting-language');
    assert.equal(await reviewPage.locator('#state-vk').textContent(), '3/3 ответов');
    await click('[data-page="sites"]');
    await click('#site-vk');
    await click('#modal-actions button');
    await click('#site-google');
    await reviewPage.evaluate(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      window.dispatchEvent(new Event('offline'));
    });
    assert.equal(await reviewPage.evaluate(() => document.getElementById('modal').contains(document.activeElement)), true);
    assert.equal(await reviewPage.locator('#modal-actions button').first().isDisabled(), false);
    assert.equal(await reviewPage.locator('.sidebar-bottom').evaluate(node => node.classList.contains('offline')), true);

    await resetReviewPage();
    await click('[data-page="speed"]');
    await click('#server-cloudflare');
    await finish({ reason: 'budget', bytes: 8388608, elapsedMs: 100, mbps: 671.088, complete: 10 });
    assert.equal(await reviewPage.locator('#speed-state-cloudflare').textContent(), 'Test was too short');
    assert.equal(await reviewPage.locator('#gauge-caption').textContent(), 'Test was too short');
    assert.match(await reviewPage.locator('#chart-caption').textContent(), /Test was too short/);
    await click('[data-page="settings"]');
    await click('#setting-language');
    assert.match(await reviewPage.locator('#chart-caption').textContent(), /Слишком короткий замер/);

    await resetReviewPage();
    await click('[data-page="speed"]');
    await click('#server-cloudflare');
    await finish({ reason: 'timeout', bytes: 0, elapsedMs: 3000, mbps: 0, complete: 0 });
    await click('#server-cloudflare');
    assert.equal(await reviewPage.evaluate(() => window.reviewJobs.length), 0);
    assert.match(await reviewPage.locator('#speed-state-cloudflare').textContent(), /Response timed out.*Retry in/);
    assert.match(await reviewPage.locator('#chart-caption').textContent(), /Response timed out/);
    await click('[data-page="settings"]');
    await click('#setting-language');
    assert.match(await reviewPage.locator('#chart-caption').textContent(), /Время ожидания истекло/);

    await resetReviewPage();
    await click('[data-page="speed"]');
    await click('#start-speed');
    await reviewPage.evaluate(() => {
      const context = document.getElementById('speed-chart').getContext('2d');
      const lineTo = context.lineTo;
      window.reviewLines = [];
      context.lineTo = function (x, y) { window.reviewLines.push({ x, y }); lineTo.call(this, x, y); };
      window.reviewJobs[0].progress({ reason: 'running', bytes: 262144, elapsedMs: 1000, mbps: 2.097, intervalMbps: 8, fraction: 0.1, budgetFraction: 0.01 });
      window.reviewJobs[0].progress({ reason: 'running', bytes: 262144, elapsedMs: 2000, mbps: 1.048, intervalMbps: 0, fraction: 0.2, budgetFraction: 0.01 });
    });
    const chart = await reviewPage.evaluate(() => ({ width: document.getElementById('speed-chart').width, displayed: document.getElementById('speed-chart').clientWidth, point: window.reviewLines[window.reviewLines.length - 1] }));
    assert.equal(chart.width, chart.displayed);
    assert.equal(chart.point.y, 215, 'A stalled interval must plot zero speed');
    await finish({ reason: 'duration', bytes: 6250000, elapsedMs: 1000, mbps: 50, complete: 8 });
    await reviewPage.evaluate(() => window.reviewJobs.shift().done({ reason: 'duration', bytes: 1250000, elapsedMs: 1000, mbps: 10, complete: 4 }));
    const completedCaption = await reviewPage.locator('#chart-caption').textContent();
    await click('#stop-run');
    assert.equal(await reviewPage.locator('#chart-caption').textContent(), completedCaption, 'Stopping between jobs must preserve the completed caption');
    assert.equal(await reviewPage.locator('#gauge-value').textContent(), '50');
    assert.match(await reviewPage.locator('#summary-speed').textContent(), /^50/);
    assert.equal(await reviewPage.locator('#gauge-caption').textContent(), 'Cloudflare');
    assert.deepEqual(errors, []);
    await reviewPage.close();
    console.log('Checked localization, remote navigation, active layout, cooldown clock/expiry, preserved results, modal focus, probe counts, summaries, short-run captions and interval chart with synthetic data.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
