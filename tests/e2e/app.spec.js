const fs = require('node:fs');
const { test, expect, readTable, canvasPointFor, allPointsVisible, setRange } = require('./fixtures');

const status = (page) => page.locator('.canvas-status');
const toast = (page) => page.locator('.temp-message');

test.beforeEach(async ({ page }) => {
    await page.goto('./');
});

test('halaman awal: kanvas kosong dan petunjuk tabel tampil', async ({ page }) => {
    await expect(page).toHaveTitle('Aplikasi Geometri Transformasi');
    await expect(status(page)).toHaveText('Refleksi terhadap sumbu X');
    expect(await readTable(page)).toEqual([['Belum ada titik. Klik kanvas atau gunakan input manual di atas.']]);
    await expect(page.locator('#undoAction')).toBeDisabled();
});

test('klik kanvas menambah titik di koordinat bulat; seret hanya menggeser', async ({ page }) => {
    const target = await canvasPointFor(page, 2.2, 3.8);
    await page.mouse.click(target.x, target.y);
    expect(await readTable(page)).toEqual([['P1', '(2, 4)', '-']]);

    const before = await page.evaluate(() => viewOffsetX);
    const start = await canvasPointFor(page, -2, -2);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 60, start.y, { steps: 5 });
    await page.mouse.up();
    expect(await page.evaluate(() => viewOffsetX)).toBeLessThan(before);
    expect(await readTable(page)).toHaveLength(1);
});

test('input manual menerima desimal koma dan menolak format salah', async ({ page }) => {
    const input = page.locator('#manualPointInput');
    await input.fill('(1,5; -2)');
    await input.press('Enter');
    expect(await readTable(page)).toEqual([['P1', '(1.5, -2)', '-']]);
    await expect(input).toHaveValue('');

    await input.fill('1,5,2');
    await page.locator('#addManualPoint').click();
    await expect(toast(page)).toContainText('Format koordinat tidak valid');
    await expect(input).toHaveValue('1,5,2');
});

test('translasi default menghasilkan bayangan yang terlihat di kanvas', async ({ page }) => {
    await page.locator('#tab-translation').click();
    await expect(status(page)).toHaveText('Translasi dengan vektor (4, 3)');
    await page.locator('#sampleShape').click();
    await page.locator('#applyTransform').click();
    const rows = await readTable(page);
    expect(rows[0]).toEqual(['P1', '(-3, 2)', '(1, 5)']);
    expect(await allPointsVisible(page)).toBe(true);
});

test('translasi jauh: tampilan otomatis diperkecil agar semua titik terlihat', async ({ page }) => {
    await page.goto('./#translasi');
    await page.locator('#translationX').fill('40');
    await page.locator('#translationY').fill('-25');
    await expect(status(page)).toHaveText('Translasi dengan vektor (40, -25)');
    await page.locator('#sampleShape').click();
    await page.locator('#applyTransform').click();
    expect(await allPointsVisible(page)).toBe(true);
});

test('label status mengikuti parameter rotasi, dilatasi, dan refleksi', async ({ page }) => {
    await page.locator('#tab-rotation').click();
    await setRange(page, '#rotationAngle', -90);
    await page.locator('#rotationCenterX').fill('1');
    await expect(status(page)).toHaveText('Rotasi -90° (searah jarum jam) dengan pusat (1, 0)');

    await page.locator('#tab-dilation').click();
    await setRange(page, '#scaleFactor', -1.5);
    await expect(page.locator('#scaleFactorValue')).toHaveText('-1.5');
    await expect(status(page)).toHaveText('Dilatasi faktor -1.5 dengan pusat (0, 0)');

    await page.locator('#tab-reflection').click();
    await page.locator('#reflectionAxis').selectOption('y=k');
    await expect(page.locator('#reflectionKLabel')).toHaveText('Nilai k:');
    await page.locator('#reflectionK').fill('-1');
    await expect(status(page)).toHaveText('Refleksi terhadap garis y = -1');
    await page.locator('#reflectionAxis').selectOption('custom');
    await expect(page.locator('#customReflectionParams')).toBeVisible();
    await expect(page.locator('#lineConstantParams')).toBeHidden();
});

test('dilatasi negatif dihitung benar dan faktor 0 ditolak', async ({ page }) => {
    await page.locator('#tab-dilation').click();
    await page.locator('#manualPointInput').fill('(2, 3)');
    await page.locator('#addManualPoint').click();

    await setRange(page, '#scaleFactor', -2);
    await page.locator('#applyTransform').click();
    expect(await readTable(page)).toEqual([['P1', '(2, 3)', '(-4, -6)']]);

    await setRange(page, '#scaleFactor', 0);
    await page.locator('#applyTransform').click();
    await expect(toast(page)).toHaveText('Faktor dilatasi tidak boleh 0');
    expect(await readTable(page)).toEqual([['P1', '(2, 3)', '(-4, -6)']]);
});

test('refleksi terhadap garis x = h', async ({ page }) => {
    await page.locator('#reflectionAxis').selectOption('x=h');
    await page.locator('#reflectionK').fill('1');
    await page.locator('#manualPointInput').fill('(3, 2)');
    await page.locator('#addManualPoint').click();
    await page.locator('#applyTransform').click();
    expect(await readTable(page)).toEqual([['P1', '(3, 2)', '(-1, 2)']]);
});

test('pindah tab membersihkan hasil; undo/redo mengembalikan hasil beserta tabnya', async ({ page }) => {
    await page.locator('#sampleShape').click();
    await page.locator('#applyTransform').click();
    expect((await readTable(page))[0][2]).toBe('(-3, -2)');

    await page.locator('#tab-rotation').click();
    await expect(page).toHaveURL(/#rotasi$/);
    expect((await readTable(page))[0][2]).toBe('-');

    await page.locator('#undoAction').click();
    await expect(page.locator('#tab-reflection')).toHaveAttribute('aria-selected', 'true');
    await expect(page).toHaveURL(/#refleksi$/);
    expect((await readTable(page))[0][2]).toBe('(-3, -2)');

    await page.locator('#redoAction').click();
    await expect(page.locator('#tab-rotation')).toHaveAttribute('aria-selected', 'true');
    expect((await readTable(page))[0][2]).toBe('-');
    await expect(page.locator('#redoAction')).toBeDisabled();
});

test('hash URL membuka tab yang sesuai', async ({ page }) => {
    await page.goto('./#dilatasi');
    await expect(page.locator('#tab-dilation')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#dilation-params')).toBeVisible();
    await expect(page.locator('#reflection-params')).toBeHidden();
});

test('navigasi tab dengan keyboard', async ({ page }) => {
    await page.locator('#tab-reflection').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-rotation')).toBeFocused();
    await expect(page.locator('#tab-rotation')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.locator('#tab-translation')).toBeFocused();
});

test('kanvas dapat dikendalikan dengan keyboard', async ({ page }) => {
    await page.locator('#transformCanvas').focus();
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => viewOffsetX)).toBeGreaterThan(0);
    const scale = await page.evaluate(() => viewScale);
    await page.keyboard.press('+');
    expect(await page.evaluate(() => viewScale)).toBeGreaterThan(scale);
    await page.keyboard.press('0');
    expect(await page.evaluate(() => [viewOffsetX, viewOffsetY, viewScale])).toEqual([0, 0, 30]);
});

test('zoom dengan wheel tetap dalam batas', async ({ page }) => {
    const box = await page.locator('#transformCanvas').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 30; i++) await page.mouse.wheel(0, -500);
    await expect.poll(() => page.evaluate(() => viewScale)).toBe(80);
    for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => viewScale)).toBe(2);
});

test('modal petunjuk: fokus terkunci, Escape menutup, fokus kembali', async ({ page }) => {
    const helpButton = page.locator('#helpBtn');
    await helpButton.click();
    const modal = page.locator('#helpModal');
    await expect(modal).toBeVisible();
    await expect(page.locator('.close-modal')).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Shift+Tab');
    await expect(page.locator('.btn-close-modal')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.close-modal')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(helpButton).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('pesan diumumkan ke pembaca layar', async ({ page }) => {
    await page.locator('#sampleShape').click();
    await expect(page.locator('#srAnnouncer')).toHaveText('Contoh bentuk segilima telah dibuat');
    await expect(toast(page)).toHaveAttribute('aria-hidden', 'true');
});

test('ekspor menghasilkan PNG berlatar putih', async ({ page }) => {
    await page.locator('#sampleShape').click();
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#exportCanvas').click()
    ]);
    expect(download.suggestedFilename()).toBe('geometri-transformasi.png');
    const data = fs.readFileSync(await download.path());
    expect(data.subarray(1, 4).toString()).toBe('PNG');

    // Pojok kiri atas (area grid kosong) harus putih tidak transparan.
    const corner = await page.evaluate(async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const c = document.createElement('canvas');
        c.width = image.width;
        c.height = image.height;
        const context = c.getContext('2d');
        context.drawImage(image, 0, 0);
        return Array.from(context.getImageData(1, 1, 1, 1).data);
    }, data.toString('base64'));
    expect(corner[3]).toBe(255);
    expect(Math.min(...corner.slice(0, 3))).toBeGreaterThan(200);
});

test('label titik yang berdekatan tidak bertumpuk', async ({ page }) => {
    await page.locator('#sampleShape').click();
    await page.locator('#reflectionAxis').selectOption('custom');
    await setRange(page, '#reflectionM', 0.5);
    await setRange(page, '#reflectionC', 1);
    await page.locator('#applyTransform').click();

    // Rekam posisi label yang benar-benar digambar ke kanvas.
    const boxes = await page.evaluate(() => new Promise(resolve => {
        const recorded = [];
        const originalFillText = ctx.fillText;
        ctx.fillText = function (text, x, y, ...rest) {
            if (/^P'?\d+\(/.test(text)) {
                recorded.push({ text, x, y, width: ctx.measureText(text).width, height: 13 });
            }
            return originalFillText.call(this, text, x, y, ...rest);
        };
        drawNow();
        ctx.fillText = originalFillText;
        resolve(recorded);
    }));
    expect(boxes).toHaveLength(10);
    const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            expect(overlap(boxes[i], boxes[j]), `${boxes[i].text} vs ${boxes[j].text}`).toBe(false);
        }
    }
});
