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
    for (const [, assetPath] of html.matchAll(/(?:href|content)="((?:assets|images)\/[^"]+)"/g)) {
        assert.ok(fs.existsSync(assetPath), 'aset metadata tidak ditemukan: ' + assetPath);
    }
});

test('hasil build CSS dan font lokal tersedia', () => {
    assert.ok(fs.existsSync('assets/app.css'));
    assert.ok(fs.existsSync('assets/fontawesome.min.css'));
    assert.ok(fs.existsSync('assets/webfonts/fa-solid-900.woff2'));
});
