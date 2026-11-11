const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePointInput, formatCoordinate, niceStep, wheelZoomFactor, fitView, describeTransform } = require('../utils.js');

test('parsePointInput menerima semua format yang didokumentasikan', () => {
    const cases = {
        '(3, 5)': { x: 3, y: 5 },
        '2, -4': { x: 2, y: -4 },
        'A(1,2)': { x: 1, y: 2 },
        "B'(-1, 0.5)": { x: -1, y: 0.5 },
        'x=3 y=5': { x: 3, y: 5 },
        'X = -2, Y = 7': { x: -2, y: 7 },
        '2 -4': { x: 2, y: -4 },
        '5; -2': { x: 5, y: -2 },
        '.5, -.25': { x: 0.5, y: -0.25 }
    };
    for (const [input, expected] of Object.entries(cases)) {
        assert.deepEqual(parsePointInput(input), expected, input);
    }
});

test('parsePointInput mendukung desimal koma bila tidak ambigu', () => {
    assert.deepEqual(parsePointInput('(1,5; -2)'), { x: 1.5, y: -2 });
    assert.deepEqual(parsePointInput('1,5; 2,25'), { x: 1.5, y: 2.25 });
    assert.deepEqual(parsePointInput('(1,5, 2,5)'), { x: 1.5, y: 2.5 });
    assert.deepEqual(parsePointInput('x=1,5 y=2'), { x: 1.5, y: 2 });
});

test('parsePointInput menolak input tidak valid', () => {
    for (const input of ['', '   ', 'abc', '(1, 2, 3)', '1,5,2', '1', '(1; 2; 3)', '1e3, 2', '--1, 2']) {
        assert.equal(parsePointInput(input), null, input);
    }
});

test('formatCoordinate membulatkan ke 2 desimal tanpa nol berlebih', () => {
    assert.equal(formatCoordinate(2), '2');
    assert.equal(formatCoordinate(1.5), '1.5');
    assert.equal(formatCoordinate(1.23456), '1.23');
    assert.equal(formatCoordinate(-0.0000001), '0');
    assert.equal(formatCoordinate(6.123233995736766e-17), '0');
});

test('niceStep memberi jarak grid yang terbaca', () => {
    assert.equal(niceStep(30, 12), 1);
    assert.equal(niceStep(2, 12), 10);
    assert.equal(niceStep(5, 12), 5);
    assert.equal(niceStep(30, 28), 1);
    assert.equal(niceStep(2, 28), 20);
});

test('wheelZoomFactor halus dan dibatasi', () => {
    assert.ok(wheelZoomFactor(-100) > 1);
    assert.ok(wheelZoomFactor(100) < 1);
    assert.ok(wheelZoomFactor(2) > 0.99, 'delta kecil trackpad hanya zoom sedikit');
    assert.equal(wheelZoomFactor(100000), 0.5);
    assert.equal(wheelZoomFactor(-100000), 2);
    assert.ok(Math.abs(wheelZoomFactor(3, 1) - wheelZoomFactor(48)) < 1e-12, 'mode baris dikonversi ke piksel');
});

test('fitView tidak mengubah tampilan bila semua titik terlihat', () => {
    const view = { width: 600, height: 400, scale: 30, offsetX: 0, offsetY: 0 };
    assert.equal(fitView([{ x: 3, y: 4 }], view), null);
});

test('fitView memperkecil tampilan agar titik jauh terlihat', () => {
    const view = { width: 600, height: 400, scale: 30, offsetX: 0, offsetY: 0 };
    const next = fitView([{ x: 0, y: 0 }, { x: 54, y: 35 }], view);
    assert.ok(next);
    const halfW = (600 / 2 - 40) / next.scale;
    const halfH = (400 / 2 - 40) / next.scale;
    for (const p of [{ x: 0, y: 0 }, { x: 54, y: 35 }]) {
        assert.ok(Math.abs(p.x - next.offsetX) <= halfW + 1e-9);
        assert.ok(Math.abs(p.y - next.offsetY) <= halfH + 1e-9);
    }
});

test('describeTransform mengikuti parameter', () => {
    assert.equal(describeTransform('translation', { tx: 4, ty: -3 }), 'Translasi dengan vektor (4, -3)');
    assert.equal(describeTransform('rotation', { angle: 45, centerX: 1, centerY: 2 }), 'Rotasi 45° dengan pusat (1, 2)');
    assert.equal(describeTransform('rotation', { angle: -90 }), 'Rotasi -90° (searah jarum jam) dengan pusat (0, 0)');
    assert.equal(describeTransform('dilation', { factor: -2, centerX: 0, centerY: 0 }), 'Dilatasi faktor -2 dengan pusat (0, 0)');
    assert.equal(describeTransform('reflection', { axis: 'custom', m: 2, c: -3 }), 'Refleksi terhadap garis y = 2x - 3');
    assert.equal(describeTransform('reflection', { axis: 'custom', m: 0, c: 4 }), 'Refleksi terhadap garis y = 4');
    assert.equal(describeTransform('reflection', { axis: 'custom', m: -1, c: 0 }), 'Refleksi terhadap garis y = -x');
    assert.equal(describeTransform('reflection', { axis: 'x=h', k: 2 }), 'Refleksi terhadap garis x = 2');
});

const { worldToScreen, screenToWorld, createHistory, snapshotTransform, placeLabels, boxesOverlap } = require('../utils.js');

test('worldToScreen dan screenToWorld saling invers', () => {
    const view = { width: 600, height: 400, scale: 25, offsetX: 3, offsetY: -2 };
    assert.deepEqual(worldToScreen(view, 3, -2), { x: 300, y: 200 }, 'pusat tampilan di tengah kanvas');
    const s = worldToScreen(view, 5, 1);
    assert.deepEqual(s, { x: 350, y: 125 }, 'sumbu Y layar terbalik');
    const w = screenToWorld(view, s.x, s.y);
    assert.ok(Math.abs(w.x - 5) < 1e-12 && Math.abs(w.y - 1) < 1e-12);
});

test('riwayat: undo, redo, dan cabang redo dibuang setelah push', () => {
    const h = createHistory();
    assert.equal(h.current(), null);
    h.push('a'); h.push('b'); h.push('c');
    assert.equal(h.canUndo(), true);
    assert.equal(h.canRedo(), false);
    assert.equal(h.undo(), 'b');
    assert.equal(h.undo(), 'a');
    assert.equal(h.undo(), null, 'tidak bisa undo melewati snapshot awal');
    assert.equal(h.current(), 'a');
    assert.equal(h.redo(), 'b');
    h.push('d');
    assert.equal(h.canRedo(), false, 'snapshot c terbuang');
    assert.equal(h.size, 3);
    assert.equal(h.undo(), 'b');
    assert.equal(h.redo(), 'd');
    assert.equal(h.redo(), null);
});

test('riwayat dibatasi jumlahnya', () => {
    const h = createHistory(3);
    [1, 2, 3, 4, 5].forEach(n => h.push(n));
    assert.equal(h.size, 3);
    assert.equal(h.undo(), 4);
    assert.equal(h.undo(), 3);
    assert.equal(h.undo(), null);
});

test('snapshot hasil transformasi dipulihkan ke tab asalnya', () => {
    assert.equal(snapshotTransform({ transform: 'rotation', resultMeta: { transform: 'translation' } }), 'translation');
    assert.equal(snapshotTransform({ transform: 'rotation', resultMeta: null }), 'rotation');
});

test('placeLabels: label titik berdekatan tidak saling tumpuk', () => {
    // Titik asli dan bayangannya berimpit / berdekatan (kasus refleksi).
    const items = [
        { x: 100, y: 100, width: 80, height: 19, prefer: 'above' },
        { x: 100, y: 100, width: 80, height: 19, prefer: 'below' },
        { x: 110, y: 95, width: 80, height: 19, prefer: 'above' },
        { x: 105, y: 108, width: 80, height: 19, prefer: 'below' }
    ];
    const positions = placeLabels(items);
    const boxes = positions.map((p, i) => ({ ...p, width: items[i].width, height: items[i].height }));
    for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
            assert.ok(!boxesOverlap(boxes[i], boxes[j]), `label ${i} dan ${j} bertumpuk`);
        }
    }
});

test('placeLabels memakai posisi pilihan bila tidak ada tabrakan', () => {
    const [above, below] = placeLabels([
        { x: 100, y: 100, width: 50, height: 19, prefer: 'above' },
        { x: 400, y: 300, width: 50, height: 19, prefer: 'below' }
    ]);
    assert.deepEqual(above, { x: 108, y: 73 });
    assert.deepEqual(below, { x: 408, y: 308 });
});

test('placeLabels menghindari keluar kanvas', () => {
    const [pos] = placeLabels([{ x: 590, y: 5, width: 80, height: 19 }], { bounds: { x: 0, y: 0, width: 600, height: 400 } });
    assert.ok(pos.x >= 0 && pos.x + 80 <= 600 && pos.y >= 0, JSON.stringify(pos));
});
