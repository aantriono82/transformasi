/* Pure geometry operations kept separate from DOM and canvas rendering. */
(function (global) {
    /**
     * Refleksi terhadap: 'x', 'y', 'y=x', 'y=-x', 'x=h' / 'y=k' (konstanta k),
     * atau garis kustom y = mx + c (axis lain, mis. 'custom').
     */
    function reflect(points, axis, { m = 1, c = 0, k = 0 } = {}) {
        return points.map(({ x, y }) => {
            if (axis === 'x') return { x, y: -y };
            if (axis === 'y') return { x: -x, y };
            if (axis === 'y=x') return { x: y, y: x };
            if (axis === 'y=-x') return { x: -y, y: -x };
            if (axis === 'x=h') return { x: 2 * k - x, y };
            if (axis === 'y=k') return { x, y: 2 * k - y };
            const d = (x + (y - c) * m) / (1 + m * m);
            return { x: 2 * d - x, y: 2 * d * m - y + 2 * c };
        });
    }

    function rotate(points, angle, centerX = 0, centerY = 0) {
        const rad = angle * Math.PI / 180;
        return points.map(({ x, y }) => {
            const dx = x - centerX;
            const dy = y - centerY;
            return {
                x: centerX + dx * Math.cos(rad) - dy * Math.sin(rad),
                y: centerY + dx * Math.sin(rad) + dy * Math.cos(rad)
            };
        });
    }

    function dilate(points, factor, centerX = 0, centerY = 0) {
        return points.map(({ x, y }) => ({
            x: centerX + (x - centerX) * factor,
            y: centerY + (y - centerY) * factor
        }));
    }

    function translate(points, tx, ty) {
        return points.map(({ x, y }) => ({ x: x + tx, y: y + ty }));
    }

    /** Terapkan transformasi berdasarkan jenis dan parameter dari panel kontrol. */
    function apply(points, type, params = {}) {
        switch (type) {
            case 'reflection': return reflect(points, params.axis, params);
            case 'rotation': return rotate(points, params.angle, params.centerX, params.centerY);
            case 'dilation': return dilate(points, params.factor, params.centerX, params.centerY);
            case 'translation': return translate(points, params.tx, params.ty);
            default: return [];
        }
    }

    /**
     * Posisi antara untuk animasi, t dari 0 (bentuk asli) sampai 1 (bayangan).
     * Rotasi berputar mengelilingi pusat, dilatasi mengubah faktor dari 1 ke k,
     * translasi bergeser sepanjang vektor, dan refleksi "melipat" setiap titik
     * tegak lurus melewati garis cermin.
     */
    function interpolate(points, type, params = {}, t = 1) {
        switch (type) {
            case 'rotation': return rotate(points, params.angle * t, params.centerX, params.centerY);
            case 'dilation': return dilate(points, 1 + (params.factor - 1) * t, params.centerX, params.centerY);
            case 'translation': return translate(points, params.tx * t, params.ty * t);
            case 'reflection': {
                const images = reflect(points, params.axis, params);
                return points.map((p, i) => ({
                    x: p.x + (images[i].x - p.x) * t,
                    y: p.y + (images[i].y - p.y) * t
                }));
            }
            default: return [];
        }
    }

    const api = { reflect, rotate, dilate, translate, apply, interpolate };
    global.GeometryTransformations = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
