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
