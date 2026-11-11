// Tulis daftar precache dan versi (hash isi file) ke sw.js.
// Versi berubah setiap kali salah satu aset berubah, sehingga cache lama diganti.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');

function listPrecache() {
    const fonts = fs.readdirSync(path.join(root, 'assets', 'webfonts'))
        .filter(file => file.endsWith('.woff2'))
        .map(file => `assets/webfonts/${file}`);
    return [
        './',
        'index.html',
        'manifest.webmanifest',
        'assets/app.css',
        'assets/fontawesome.min.css',
        'transformations.js',
        'utils.js',
        'script.js',
        'assets/icons/icon.svg',
        'assets/icons/icon-192.png',
        'assets/icons/icon-512.png',
        'assets/icons/apple-touch-icon.png',
        ...fonts.sort()
    ];
}

function computeVersion(files) {
    const hash = crypto.createHash('sha256');
    for (const file of files) {
        if (file === './') continue;
        hash.update(file);
        hash.update(fs.readFileSync(path.join(root, file)));
    }
    return hash.digest('hex').slice(0, 12);
}

function render(swSource, files, version) {
    return swSource
        .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
        .replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(files, null, 4).replace(/"/g, "'")};`);
}

module.exports = { listPrecache, computeVersion, render };

if (require.main === module) {
    const swPath = path.join(root, 'sw.js');
    const files = listPrecache();
    const version = computeVersion(files);
    fs.writeFileSync(swPath, render(fs.readFileSync(swPath, 'utf8'), files, version));
    console.log(`sw.js diperbarui: versi ${version}, ${files.length} file`);
}
