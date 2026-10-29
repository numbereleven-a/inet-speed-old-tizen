const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined });
    try {
        const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://**/*', route => route.abort());
        await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
        await page.goto(pathToFileURL(path.resolve('app/index.html')).href);
        await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
        await page.evaluate(() => {
            window.dnsRequests = 0;
            window.NetDoH.probe = function (url, timeout, done) {
                window.dnsRequests++;
                window.lastDNSCallback = done;
                var timer = setTimeout(function () { done({ reason: 'dnsNetwork', ms: 1 }); }, 1);
                return { cancel: function () { clearTimeout(timer); } };
            };
        });
        async function click(selector) {
            await page.evaluate(selector => document.querySelector(selector).click(), selector);
        }
        async function requests() { return page.evaluate(() => window.dnsRequests); }
        await click('[data-page="dns"]');
        assert.equal(await page.locator('#dns-stop').isEnabled(), true);
        await click('#dns-stop');
        assert.equal(await page.locator('#dns-status').textContent(), 'Stopped');
        await click('#dns-all');
        await page.clock.runFor(2000);
        assert.equal(await requests(), 10);
        assert.equal(await page.locator('#dns-status').textContent(), 'Done');
        assert.equal(await page.locator('#dns-stop').isEnabled(), true);
        assert.equal(await page.evaluate(() => document.activeElement.id), 'dns-stop');
        await page.clock.runFor(31000);
        assert.equal(await requests(), 10, 'Cooldown expiry must never restart DNS requests');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#dns-status').textContent(), 'Stopped');
        await page.clock.runFor(65000);
        assert.equal(await requests(), 10, 'Stop between runs must not launch another check');
        await click('#dns-all');
        await page.clock.runFor(10);
        const before = await requests();
        await click('#dns-stop');
        await page.clock.runFor(65000);
        assert.equal(await requests(), before, 'Stop in the gap must cancel the rest of the queue');
        await click('#dns-all');
        await page.clock.runFor(0);
        const active = await requests();
        await click('#dns-stop');
        await page.evaluate(() => window.lastDNSCallback({ reason: 'dnsNetwork', ms: 1 }));
        await page.clock.runFor(65000);
        assert.equal(await requests(), active, 'Stop must ignore late callbacks');
        assert.equal(await page.locator('#dns-status').textContent(), 'Stopped');
        assert.equal(await page.locator('#dns-stop').isEnabled(), true);
        assert.deepEqual(errors, []);
        console.log('Checked always available Stop, one-pass completion, focus, cooldown expiry, queued work and late callback cancellation.');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
