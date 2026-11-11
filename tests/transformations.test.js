const test = require('node:test');
const assert = require('node:assert/strict');
const { reflect, rotate, dilate, translate } = require('../transformations.js');

const point = [{ x: 2, y: 3 }];

test('refleksi terhadap sumbu X', () => {
    assert.deepEqual(reflect(point, 'x'), [{ x: 2, y: -3 }]);
});

test('refleksi terhadap garis y = x', () => {
    assert.deepEqual(reflect(point, 'y=x'), [{ x: 3, y: 2 }]);
});

test('rotasi 90 derajat terhadap titik pusat', () => {
    const result = rotate(point, 90);
    assert.ok(Math.abs(result[0].x + 3) < 1e-10);
    assert.ok(Math.abs(result[0].y - 2) < 1e-10);
});

test('dilatasi dengan pusat dan faktor', () => {
    assert.deepEqual(dilate(point, 2, 1, 1), [{ x: 3, y: 5 }]);
});

test('translasi dengan vektor', () => {
    assert.deepEqual(translate(point, -2, 4), [{ x: 0, y: 7 }]);
});

test('refleksi terhadap garis kustom y = mx + c', () => {
    // Cermin y = x + 1: (2, 3) terletak tepat di garis sehingga tetap.
    assert.deepEqual(reflect(point, 'custom', { m: 1, c: 1 }), [{ x: 2, y: 3 }]);
    // Cermin y = 2x: (5, 0) -> (-3, 4)
    const [image] = reflect([{ x: 5, y: 0 }], 'custom', { m: 2, c: 0 });
    assert.ok(Math.abs(image.x + 3) < 1e-10 && Math.abs(image.y - 4) < 1e-10);
});

test('refleksi terhadap garis x = h dan y = k', () => {
    assert.deepEqual(reflect(point, 'x=h', { k: 1 }), [{ x: 0, y: 3 }]);
    assert.deepEqual(reflect(point, 'y=k', { k: -1 }), [{ x: 2, y: -5 }]);
});

test('refleksi terhadap garis y = -x', () => {
    assert.deepEqual(reflect(point, 'y=-x'), [{ x: -3, y: -2 }]);
});

test('rotasi negatif searah jarum jam terhadap pusat bukan asal', () => {
    const [image] = rotate([{ x: 3, y: 1 }], -90, 1, 1);
    assert.ok(Math.abs(image.x - 1) < 1e-10 && Math.abs(image.y + 1) < 1e-10);
});

test('dilatasi dengan faktor negatif', () => {
    assert.deepEqual(dilate(point, -1, 0, 0), [{ x: -2, y: -3 }]);
    assert.deepEqual(dilate([{ x: 3, y: 1 }], -2, 1, 1), [{ x: -3, y: 1 }]);
});

test('apply memilih transformasi sesuai jenis dan parameter', () => {
    const { apply } = require('../transformations.js');
    assert.deepEqual(apply(point, 'translation', { tx: 1, ty: -2 }), [{ x: 3, y: 1 }]);
    assert.deepEqual(apply(point, 'reflection', { axis: 'y' }), [{ x: -2, y: 3 }]);
    assert.deepEqual(apply(point, 'dilation', { factor: 2, centerX: 0, centerY: 0 }), [{ x: 4, y: 6 }]);
    assert.deepEqual(apply(point, 'unknown', {}), []);
});

test('interpolate: t=0 bentuk asli, t=1 sama dengan hasil akhir', () => {
    const { apply, interpolate } = require('../transformations.js');
    const shape = [{ x: 2, y: 3 }, { x: -1, y: 4 }];
    const cases = [
        ['reflection', { axis: 'custom', m: 2, c: 1 }],
        ['rotation', { angle: 135, centerX: 1, centerY: -1 }],
        ['dilation', { factor: -1.5, centerX: 2, centerY: 0 }],
        ['translation', { tx: 4, ty: -3 }]
    ];
    for (const [type, params] of cases) {
        const start = interpolate(shape, type, params, 0);
        const end = interpolate(shape, type, params, 1);
        const expected = apply(shape, type, params);
        shape.forEach((p, i) => {
            assert.ok(Math.abs(start[i].x - p.x) < 1e-9 && Math.abs(start[i].y - p.y) < 1e-9, `${type} t=0`);
            assert.ok(Math.abs(end[i].x - expected[i].x) < 1e-9 && Math.abs(end[i].y - expected[i].y) < 1e-9, `${type} t=1`);
        });
    }
});

test('interpolate rotasi menjaga jarak ke pusat di tengah animasi', () => {
    const { interpolate } = require('../transformations.js');
    const [mid] = interpolate([{ x: 3, y: 0 }], 'rotation', { angle: 90, centerX: 0, centerY: 0 }, 0.5);
    assert.ok(Math.abs(Math.hypot(mid.x, mid.y) - 3) < 1e-9);
});
