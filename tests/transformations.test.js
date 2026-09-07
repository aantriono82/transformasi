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
