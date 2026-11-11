const fs = require('node:fs');
const path = require('node:path');
const { test, expect, readTable } = require('./fixtures');

async function waitForController(page) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('aplikasi tetap berjalan tanpa koneksi setelah kunjungan pertama', async ({ page, context }) => {
    await page.goto('./?sw');
    // Pemasangan SW pertama kali tidak boleh memuat ulang halaman.
    await page.locator('#manualPointInput').fill('(1, 1)');
    await page.locator('#addManualPoint').click();
    await waitForController(page);
    expect(await readTable(page)).toEqual([['P1', '(1, 1)', '-']]);

    await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle('Aplikasi Geometri Transformasi');
    await expect(page.locator('.canvas-status')).toHaveText('Refleksi terhadap sumbu X');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('900 16px "Font Awesome 6 Free"'))).toBe(true);

    await page.locator('#sampleShape').click();
    await page.locator('#applyTransform').click();
    expect((await readTable(page))[0]).toEqual(['P1', '(-3, 2)', '(-3, -2)']);
    await context.setOffline(false);
});

test('versi baru: banner muncul dan memuat ulang hanya setelah dikonfirmasi', async ({ page, context }) => {
    // Sajikan sw.js dengan versi lain untuk mensimulasikan deploy baru. (Pemeriksaan
    // update oleh browser bisa melewati route, jadi yang dicek hanya pergantian versi.)
    const swSource = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
    let version = 'v1';
    await context.route('**/sw.js', route => route.fulfill({
        contentType: 'text/javascript',
        body: swSource.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
    }));

    await page.goto('./?sw');
    await waitForController(page);
    const [oldCache] = await page.evaluate(() => caches.keys());
    await page.locator('#sampleShape').click();

    version = 'v2';
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    const banner = page.locator('#updateBanner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Versi baru aplikasi tersedia.');
    expect(await readTable(page)).toHaveLength(5);

    await Promise.all([
        page.waitForEvent('load'),
        banner.getByRole('button', { name: 'Muat ulang' }).click()
    ]);
    await expect(page.locator('#updateBanner')).toHaveCount(0);
    // Cache versi lama dihapus dan diganti versi baru.
    const caches = await page.evaluate(() => caches.keys());
    expect(caches).toHaveLength(1);
    expect(caches[0]).not.toBe(oldCache);
});

test('service worker tidak dipasang di localhost tanpa ?sw', async ({ page }) => {
    await page.goto('./');
    await page.waitForTimeout(500);
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
});
