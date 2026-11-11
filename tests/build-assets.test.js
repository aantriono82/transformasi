const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('index memakai aset lokal untuk stylesheet runtime', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert.match(html, /assets\/app\.css/);
    assert.match(html, /assets\/fontawesome\.min\.css/);
    assert.doesNotMatch(html, /cdn\.tailwindcss\.com|fonts\.googleapis\.com|cdnjs\.cloudflare\.com/);
    assert.match(fs.readFileSync('assets/fontawesome.min.css', 'utf8'), /url\(webfonts\/fa-solid-900\.woff2\)/);
    assert.doesNotMatch(fs.readFileSync('assets/fontawesome.min.css', 'utf8'), /url\(\.\.\/webfonts\//);
    assert.doesNotMatch(html, /https:\/\/aantriono\.github\.io\/geometri-transformasi\/(share-image|favicon)/);
});

test('metadata tidak menunjuk aset lokal yang tidak tersedia', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    for (const [, assetPath] of html.matchAll(/(?:href|content)="((?:assets|images)\/[^"?]+)(?:\?[^"]*)?"/g)) {
        assert.ok(fs.existsSync(assetPath), 'aset metadata tidak ditemukan: ' + assetPath);
    }
});

test('hasil build CSS dan font lokal tersedia', () => {
    assert.ok(fs.existsSync('assets/app.css'));
    assert.ok(fs.existsSync('assets/fontawesome.min.css'));
    assert.ok(fs.existsSync('assets/webfonts/fa-solid-900.woff2'));
});

test('index memuat semua skrip aplikasi sesuai urutan dependensi', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const order = ['transformations.js', 'utils.js', 'script.js'].map(src => html.search(new RegExp(`<script src="${src.replace('.', '\\.')}(\\?v=[^"]*)?"`)));
    assert.ok(order.every(index => index >= 0), 'semua skrip harus dimuat');
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'script.js harus dimuat terakhir');
});

test('default parameter tetap dalam jangkauan bidang koordinat', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const value = (id) => Number(html.match(new RegExp(`id="${id}"[^>]*value="([^"]+)"`))[1]);
    assert.ok(Math.abs(value('translationX')) <= 10 && Math.abs(value('translationY')) <= 10);
    assert.match(html, /id="scaleFactor" min="-5"/);
    assert.match(html, /id="rotationAngle" min="-360"/);
});
