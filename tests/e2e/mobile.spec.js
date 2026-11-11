const { test, expect, readTable, canvasPointFor } = require('./fixtures');

test.beforeEach(async ({ page }) => {
    await page.goto('./');
});

test('ketuk kanvas menambah titik', async ({ page }) => {
    await page.locator('#transformCanvas').scrollIntoViewIfNeeded();
    const target = await canvasPointFor(page, 1, 1);
    await page.touchscreen.tap(target.x, target.y);
    expect(await readTable(page)).toEqual([['P1', '(1, 1)', '-']]);
});

test('tata letak mobile: tidak ada scroll horizontal dan teks petunjuk mobile tampil', async ({ page }) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByText('Ketuk: tambah titik | Seret: geser | Pinch: zoom')).toBeVisible();
});
