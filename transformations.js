/* Pure geometry operations kept separate from DOM and canvas rendering. */
(function (global) {
    function reflect(points, axis, m = 1, c = 0) {
        return points.map(({ x, y }) => {
            if (axis === 'x') return { x, y: -y };
            if (axis === 'y') return { x: -x, y };
            if (axis === 'y=x') return { x: y, y: x };
            if (axis === 'y=-x') return { x: -y, y: -x };
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

    const api = { reflect, rotate, dilate, translate };
    global.GeometryTransformations = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
