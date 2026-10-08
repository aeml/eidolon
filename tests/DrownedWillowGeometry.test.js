import * as THREE from 'three';
import { createDrownedWillowGeometry } from '../src/art/DrownedWillowGeometry.js';
import { getFoliageRenderBatches } from '../src/art/FoliageRenderBatches.js';

test.each(['high', 'low'])('%s drowned willow has finite folded foliage within the reserved sightline apron', quality => {
    const geometry = createDrownedWillowGeometry(quality), repeat = createDrownedWillowGeometry(quality);
    try {
        expect(geometry.attributes.position.array).toEqual(repeat.attributes.position.array);
        expect(geometry.attributes.position.count / 3).toBe(quality === 'low' ? 256 : 512);
        expect(geometry.userData.woodlandCrown).toBe('drowned-willow');
        const p = geometry.attributes.position, n = geometry.attributes.normal;
        expect([...p.array, ...n.array, ...geometry.attributes.uv.array, ...geometry.attributes.color.array].every(Number.isFinite)).toBe(true);
        for (let index = 0; index < p.count; index++) {
            expect(Math.hypot(p.getX(index), p.getZ(index)) * 1.18).toBeLessThan(8);
            expect(Math.hypot(n.getX(index), n.getY(index), n.getZ(index))).toBeCloseTo(1, 5);
        }
        expect(geometry.boundingBox.min.y).toBeGreaterThan(2.3);
        expect(geometry.boundingBox.max.y).toBeGreaterThan(5.8);
    } finally { geometry.dispose(); repeat.dispose(); }
});

test('Low retains every High leaf tip/shoulder/root with registered color and vein coordinates', () => {
    const high = createDrownedWillowGeometry(), low = createDrownedWillowGeometry('low');
    try {
        for (let leaf = 0; leaf < 128; leaf++) for (const [lowVertex, highVertex] of [[0, 0], [1, 1], [2, 5], [3, 0], [4, 5], [5, 11]]) {
            for (const name of ['position', 'color', 'uv']) {
                const a = low.attributes[name], b = high.attributes[name], size = a.itemSize;
                expect(a.array.slice((leaf * 6 + lowVertex) * size, (leaf * 6 + lowVertex + 1) * size))
                    .toEqual(b.array.slice((leaf * 12 + highVertex) * size, (leaf * 12 + highVertex + 1) * size));
            }
        }
    } finally { high.dispose(); low.dispose(); }
});

test('drowned willow retains three material batches and reduces only crown detail on Low', () => {
    const high = getFoliageRenderBatches('drowned_willow'), low = getFoliageRenderBatches('drowned_willow', 'low');
    expect(high).toHaveLength(3); expect(low).toHaveLength(3);
    const crown = high.find(part => part.geometry.userData.woodlandCrown === 'drowned-willow');
    expect(crown.material.vertexColors).toBe(true); expect(crown.material.side).toBe(THREE.DoubleSide);
    expect(crown.material.transparent).toBe(false); expect(crown.material.userData.woodlandLeafDetail).toBe(true);
    expect(high.map(part => part.name)).toEqual(low.map(part => part.name));
    for (let index = 0; index < high.length; index++) {
        expect(low[index].material).toBe(high[index].material);
        expect(low[index].matrix.elements).toEqual(high[index].matrix.elements);
        if (high[index] !== crown) {
            expect(low[index].geometry.attributes.position.array).toEqual(high[index].geometry.attributes.position.array);
            expect(low[index].geometry.attributes.normal.array).toEqual(high[index].geometry.attributes.normal.array);
        }
    }
});
