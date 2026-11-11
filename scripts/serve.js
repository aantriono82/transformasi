// Server statis kecil tanpa dependensi untuk pengembangan dan tes E2E.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.argv[2] || 4173);
const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.webmanifest': 'application/manifest+json'
};

http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = path.normalize(path.join(root, urlPath));
    if (!filePath.startsWith(root + path.sep) && filePath !== root) {
        res.writeHead(403).end();
        return;
    }
    if (filePath.endsWith(path.sep) || filePath === root) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (error, data) => {
        if (error) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Tidak ditemukan');
            return;
        }
        res.writeHead(200, {
            'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
            'Cache-Control': 'no-cache'
        }).end(data);
    });
}).listen(port, '127.0.0.1', () => console.log(`Server: http://127.0.0.1:${port}/`));
