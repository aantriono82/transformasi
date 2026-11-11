/* Service worker: aplikasi tetap bisa dipakai tanpa koneksi internet.
 * VERSION dan PRECACHE ditulis otomatis oleh `npm run build:sw`. */
const VERSION = '274ceac32659';
const PRECACHE = [
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
    'assets/webfonts/fa-brands-400.woff2',
    'assets/webfonts/fa-regular-400.woff2',
    'assets/webfonts/fa-solid-900.woff2',
    'assets/webfonts/fa-v4compatibility.woff2'
];
const CACHE_NAME = `transformasi-${VERSION}`;

self.addEventListener('install', (event) => {
    // addAll bersifat atomik: semua aset versi ini tersimpan, atau tidak sama sekali.
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(key => key.startsWith('transformasi-') && key !== CACHE_NAME)
            .map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

// Halaman meminta versi baru diaktifkan setelah pengguna setuju memuat ulang.
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        if (request.mode === 'navigate') {
            // Halaman selalu dari cache versi ini agar HTML cocok dengan skripnya.
            return (await cache.match('index.html')) || fetch(request);
        }
        const cached = await cache.match(request, { ignoreSearch: true });
        return cached || fetch(request);
    })());
});
