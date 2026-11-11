const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { listPrecache, computeVersion } = require('../scripts/build-sw.js');

test('versi sw.js sesuai isi aset (jalankan npm run build:sw bila gagal)', () => {
    const sw = fs.readFileSync('sw.js', 'utf8');
    const version = sw.match(/const VERSION = '([^']+)';/)[1];
    assert.equal(version, computeVersion(listPrecache()));
    for (const file of listPrecache()) {
        assert.ok(sw.includes(`'${file}'`), `precache tidak memuat ${file}`);
    }
});

test('semua aset precache ada', () => {
    for (const file of listPrecache()) {
        if (file === './') continue;
        assert.ok(fs.existsSync(file), `aset tidak ditemukan: ${file}`);
    }
});

test('manifest valid dan ikon tersedia', () => {
    const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, './');
    const sizes = manifest.icons.map(icon => icon.sizes);
    assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
    for (const icon of manifest.icons) assert.ok(fs.existsSync(icon.src), icon.src);
});

test('index menautkan manifest dan ikon', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
    assert.match(html, /rel="apple-touch-icon" href="assets\/icons\/apple-touch-icon\.png"/);
});
