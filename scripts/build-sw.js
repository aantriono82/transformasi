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

// Aset yang ditautkan index.html dengan penanda versi (?v=hash isi file), agar
// browser tidak memakai salinan lama dari cache HTTP setelah rilis baru.
const VERSIONED_ASSETS = ['assets/fontawesome.min.css', 'assets/app.css', 'transformations.js', 'utils.js', 'script.js'];

function assetHash(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 10);
}

function stampIndex(html) {
    return VERSIONED_ASSETS.reduce((result, file) => {
        const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`(href|src)="${escaped}(?:\\?v=[^"]*)?"`, 'g');
        return result.replace(pattern, `$1="${file}?v=${assetHash(file)}"`);
    }, html);
}

function render(swSource, files, version) {
    return swSource
        .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
        .replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = ${JSON.stringify(files, null, 4).replace(/"/g, "'")};`);
}

module.exports = { listPrecache, computeVersion, render, stampIndex, assetHash, VERSIONED_ASSETS };

if (require.main === module) {
    // index.html diberi penanda versi dulu, karena isinya ikut menentukan VERSION.
    const indexPath = path.join(root, 'index.html');
    fs.writeFileSync(indexPath, stampIndex(fs.readFileSync(indexPath, 'utf8')));

    const swPath = path.join(root, 'sw.js');
    const files = listPrecache();
    const version = computeVersion(files);
    fs.writeFileSync(swPath, render(fs.readFileSync(swPath, 'utf8'), files, version));
    console.log(`sw.js diperbarui: versi ${version}, ${files.length} file`);
}
