/* Logika murni (tanpa DOM) untuk input, format, tampilan, dan label transformasi. */
(function (global) {
    const NUMBER_PATTERN = /^[-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;

    function toNumber(text) {
        const value = text.trim();
        if (!NUMBER_PATTERN.test(value)) return null;
        const number = Number(value.replace(',', '.'));
        return Number.isFinite(number) ? number : null;
    }

    function toPair(a, b) {
        const x = toNumber(a);
        const y = toNumber(b);
        return x === null || y === null ? null : { x, y };
    }

    /**
     * Mengurai teks koordinat. Format yang diterima:
     * (3, 5) | 3, 5 | A(1, 2) | x=3 y=5 | 3 5 | 3; 5
     * Desimal koma didukung bila tidak ambigu: (1,5; 2) atau (1,5, 2,5).
     */
    function parsePointInput(input) {
        let text = String(input ?? '').trim();
        if (!text) return null;

        const named = text.match(/^x\s*=\s*(\S+?)[,;\s]+y\s*=\s*(\S+)$/i);
        if (named) return toPair(named[1], named[2]);

        text = text.replace(/^[A-Za-z][A-Za-z0-9]*'*\s*(?=\()/, '');
        const inParens = text.match(/^\((.*)\)$/);
        if (inParens) text = inParens[1].trim();

        let parts;
        if (text.includes(';')) {
            parts = text.split(';');
        } else if ((text.match(/,/g) || []).length === 1) {
            parts = text.split(',');
        } else if (/,\s+/.test(text)) {
            parts = text.split(/,\s+/);
        } else {
            parts = text.split(/\s+/);
        }
        return parts.length === 2 ? toPair(parts[0], parts[1]) : null;
    }

    function formatCoordinate(value) {
        const rounded = Math.round(value * 100) / 100;
        if (Object.is(rounded, -0)) return '0';
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    }

    /** Langkah grid "rapi" (1, 2, 5, 10, ...) agar jarak antar garis minimal `minPixels`. */
    function niceStep(scale, minPixels) {
        const raw = minPixels / scale;
        const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
        for (const multiplier of [1, 2, 5, 10]) {
            const step = multiplier * magnitude;
            if (step >= raw) return Math.max(1, step);
        }
        return Math.max(1, 10 * magnitude);
    }

    /** Faktor zoom halus untuk wheel mouse maupun trackpad. */
    function wheelZoomFactor(deltaY, deltaMode = 0) {
        const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
        return Math.min(2, Math.max(0.5, Math.exp(-pixels * 0.0015)));
    }

    /**
     * Hitung tampilan agar semua titik terlihat. Mengembalikan null bila semua
     * titik sudah terlihat pada tampilan sekarang (tidak perlu diubah).
     */
    function fitView(pointList, view, options = {}) {
        const { width, height, scale, offsetX, offsetY } = view;
        const { padding = 40, minScale = 2, maxScale = 50 } = options;
        if (!pointList.length || width <= 0 || height <= 0) return null;

        const halfW = (width / 2 - padding) / scale;
        const halfH = (height / 2 - padding) / scale;
        const allVisible = pointList.every(({ x, y }) =>
            Math.abs(x - offsetX) <= halfW && Math.abs(y - offsetY) <= halfH);
        if (allVisible) return null;

        const xs = pointList.map(p => p.x).concat(0);
        const ys = pointList.map(p => p.y).concat(0);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const spanX = Math.max(maxX - minX, 1e-6);
        const spanY = Math.max(maxY - minY, 1e-6);
        const fitScale = Math.min((width - 2 * padding) / spanX, (height - 2 * padding) / spanY);
        return {
            scale: Math.max(minScale, Math.min(maxScale, scale, fitScale)),
            offsetX: (minX + maxX) / 2,
            offsetY: (minY + maxY) / 2
        };
    }

    function formatSigned(value) {
        const text = formatCoordinate(Math.abs(value));
        return value < 0 ? `- ${text}` : `+ ${text}`;
    }

    function describeLine(m, c) {
        const slope = m === 1 ? 'x' : m === -1 ? '-x' : m === 0 ? '' : `${formatCoordinate(m)}x`;
        if (!slope) return `y = ${formatCoordinate(c)}`;
        return c === 0 ? `y = ${slope}` : `y = ${slope} ${formatSigned(c)}`;
    }

    /** Label status yang selalu sesuai dengan parameter yang sedang dipakai. */
    function describeTransform(type, params = {}) {
        const point = (x, y) => `(${formatCoordinate(x)}, ${formatCoordinate(y)})`;
        switch (type) {
            case 'reflection': {
                const { axis = 'x', m = 1, c = 0, k = 0 } = params;
                if (axis === 'x') return 'Refleksi terhadap sumbu X';
                if (axis === 'y') return 'Refleksi terhadap sumbu Y';
                if (axis === 'y=x') return 'Refleksi terhadap garis y = x';
                if (axis === 'y=-x') return 'Refleksi terhadap garis y = -x';
                if (axis === 'x=h') return `Refleksi terhadap garis x = ${formatCoordinate(k)}`;
                if (axis === 'y=k') return `Refleksi terhadap garis y = ${formatCoordinate(k)}`;
                return `Refleksi terhadap garis ${describeLine(m, c)}`;
            }
            case 'rotation': {
                const { angle = 0, centerX = 0, centerY = 0 } = params;
                const direction = angle < 0 ? ' (searah jarum jam)' : '';
                return `Rotasi ${formatCoordinate(angle)}°${direction} dengan pusat ${point(centerX, centerY)}`;
            }
            case 'dilation': {
                const { factor = 1, centerX = 0, centerY = 0 } = params;
                return `Dilatasi faktor ${formatCoordinate(factor)} dengan pusat ${point(centerX, centerY)}`;
            }
            case 'translation': {
                const { tx = 0, ty = 0 } = params;
                return `Translasi dengan vektor ${point(tx, ty)}`;
            }
            default:
                return 'Transformasi aktif';
        }
    }

    const api = { parsePointInput, formatCoordinate, niceStep, wheelZoomFactor, fitView, describeTransform, describeLine };
    global.AppUtils = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
