// Render ikon PNG PWA dari assets/icons/icon.svg memakai Chrome (Playwright).
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const iconsDir = path.resolve(__dirname, '..', 'assets', 'icons');
const svg = fs.readFileSync(path.join(iconsDir, 'icon.svg'), 'utf8');
const outputs = [
    { file: 'icon-192.png', size: 192 },
    { file: 'icon-512.png', size: 512 },
    { file: 'apple-touch-icon.png', size: 180 }
];

(async () => {
    const browser = await chromium.launch({ channel: 'chrome' });
    const page = await browser.newPage();
    for (const { file, size } of outputs) {
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(`<style>html,body{margin:0;background:#1e3a8a}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
        await page.screenshot({ path: path.join(iconsDir, file), omitBackground: false });
    }
    await browser.close();
})();
