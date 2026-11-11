const base = require('@playwright/test');

// Setiap tes gagal bila ada error JavaScript atau console.error di halaman.
const test = base.test.extend({
    page: async ({ page }, use) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(message.text());
        });
        await use(page);
        base.expect(errors, 'error di halaman').toEqual([]);
    }
});

/** Ambil isi tabel koordinat sebagai array [titik, asli, hasil]. */
async function readTable(page) {
    return page.locator('#coordinateTableBody tr').evaluateAll(rows =>
        rows.map(row => Array.from(row.cells, cell => cell.textContent.trim())));
}

/** Klik di koordinat dunia (x, y) pada kanvas. */
async function canvasPointFor(page, x, y) {
    const box = await page.locator('#transformCanvas').boundingBox();
    const screen = await page.evaluate(([wx, wy]) => worldToScreen(wx, wy), [x, y]);
    return { x: box.x + screen.x, y: box.y + screen.y };
}

/** Semua titik asli dan hasil berada di dalam kanvas. */
async function allPointsVisible(page) {
    return page.evaluate(() => points.concat(transformedPoints).every(p => {
        const s = worldToScreen(p.x, p.y);
        return s.x >= 0 && s.x <= canvasWidth && s.y >= 0 && s.y <= canvasHeight;
    }));
}

async function setRange(page, selector, value) {
    await page.locator(selector).evaluate((input, v) => {
        input.value = v;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
}

module.exports = { test, expect: base.expect, readTable, canvasPointFor, allPointsVisible, setRange };
