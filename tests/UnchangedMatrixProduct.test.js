import { Matrix4, Group, Object3D, Scene } from 'three';
import { cacheUnchangedMatrixProduct } from '../src/core/UnchangedMatrixProduct.js';

test('unchanged products avoid writes and recompute immediately for either operand or result edits', () => {
    const matrix = new Matrix4(), a = new Matrix4().makeTranslation(3, 7, 11), b = new Matrix4().makeRotationY(.7);
    let writes = 0;
    matrix.elements = new Proxy(matrix.elements, { set(target, key, value) { writes++; target[key] = value; return true; } });
    const restore = cacheUnchangedMatrixProduct(matrix);
    const check = () => expect(matrix.elements).toEqual(new Matrix4().multiplyMatrices(a, b).elements);
    try {
        matrix.multiplyMatrices(a, b); check(); expect(writes).toBe(16);
        writes = 0; matrix.multiplyMatrices(a, b); check(); expect(writes).toBe(0);
        a.elements[12] += 5; matrix.multiplyMatrices(a, b); check(); expect(writes).toBe(16);
        writes = 0; b.elements[10] += .05; matrix.multiplyMatrices(a, b); check(); expect(writes).toBe(16);
        matrix.elements[12] = 900; writes = 0; matrix.multiplyMatrices(a, b); check(); expect(writes).toBe(16);
    } finally { restore(); }
});

test('signed zero, NaN, infinity and aliased multiplication retain exact ordinary results', () => {
    const cached = new Matrix4(), ordinary = new Matrix4(), a = new Matrix4(), b = new Matrix4();
    const restore = cacheUnchangedMatrixProduct(cached);
    const compare = () => ordinary.elements.forEach((value, index) => expect(Object.is(cached.elements[index], value)).toBe(true));
    try {
        for (const value of [0, -0, Infinity, -Infinity, NaN, 1e-290, 1e290]) {
            a.elements[0] = value;
            ordinary.multiplyMatrices(a, b); cached.multiplyMatrices(a, b); compare();
            cached.multiplyMatrices(a, b); compare();
            cached.elements[1] = -0;
            ordinary.multiplyMatrices(a, b); cached.multiplyMatrices(a, b); compare();
        }
        a.identity(); b.makeRotationX(.4); ordinary.identity(); cached.identity();
        ordinary.multiplyMatrices(ordinary, b); cached.multiplyMatrices(cached, b); compare();
        ordinary.multiplyMatrices(a, ordinary); cached.multiplyMatrices(a, cached); compare();
        ordinary.multiplyMatrices(ordinary, ordinary); cached.multiplyMatrices(cached, cached); compare();
    } finally { restore(); }
});

test('stock forced traversal still refreshes manual descendants, reparenting and live automatic transforms', () => {
    const build = cache => {
        const scene = new Scene(), first = new Group(), second = new Group(), child = new Object3D(), grandchild = new Object3D();
        scene.add(first, second); first.add(child); child.add(grandchild);
        child.matrixAutoUpdate = false; grandchild.matrixAutoUpdate = false;
        const restore = cache ? cacheUnchangedMatrixProduct(child.matrixWorld) : () => {};
        return { scene, first, second, child, grandchild, restore };
    };
    const ordinary = build(false), cached = build(true);
    const steps = [() => {},
        f => f.child.matrix.makeTranslation(3, 5, 7),
        f => f.grandchild.matrix.makeTranslation(11, 13, 17),
        f => f.child.matrixWorld.makeTranslation(999, 0, 0),
        f => { f.second.position.x = 23; f.second.add(f.child); },
        f => { f.child.matrixAutoUpdate = true; f.child.position.set(2, 4, 6); },
        f => { f.child.matrixWorldAutoUpdate = false; f.child.matrixWorld.makeTranslation(31, 37, 41); },
        f => { f.child.matrixWorldAutoUpdate = true; },
        f => { f.first.add(f.child); f.first.scale.set(2, 3, 4); f.first.rotation.y = .8; }
    ];
    try {
        for (const mutate of steps) {
            for (const f of [ordinary, cached]) { mutate(f); f.scene.updateMatrixWorld(); }
            for (const key of ['child', 'grandchild']) {
                expect(cached[key].matrixWorld.elements).toEqual(ordinary[key].matrixWorld.elements);
                expect(cached[key].matrixWorldNeedsUpdate).toBe(ordinary[key].matrixWorldNeedsUpdate);
            }
        }
        cached.child.updateWorldMatrix(true, true); ordinary.child.updateWorldMatrix(true, true);
        expect(cached.grandchild.matrixWorld.elements).toEqual(ordinary.grandchild.matrixWorld.elements);
    } finally { cached.restore(); }
});

test('unsupported/custom owners, borrowed calls and later hooks keep ownership', () => {
    expect(cacheUnchangedMatrixProduct({})).toBeNull();
    const custom = new Matrix4(); custom.multiplyMatrices = () => custom;
    expect(cacheUnchangedMatrixProduct(custom)).toBeNull();
    const matrix = new Matrix4(), restore = cacheUnchangedMatrixProduct(matrix), wrapper = matrix.multiplyMatrices;
    const a = new Matrix4().makeTranslation(5, 7, 11), b = new Matrix4().makeRotationZ(.3), other = new Matrix4();
    wrapper.call(other, a, b); expect(other.elements).toEqual(new Matrix4().multiplyMatrices(a, b).elements);
    const later = function(left, right) { return wrapper.call(this, left, right); };
    matrix.multiplyMatrices = later; restore(); restore();
    expect(matrix.multiplyMatrices).toBe(later);
    matrix.multiplyMatrices(a, b); expect(matrix.elements).toEqual(other.elements);
    const fresh = new Matrix4(), dispose = cacheUnchangedMatrixProduct(fresh); dispose();
    expect(Object.hasOwn(fresh, 'multiplyMatrices')).toBe(false);
});
