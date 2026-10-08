import { createWillowCurtainGeometry } from '../src/art/WillowCurtainGeometry.js';
import { createLeafCanopyGeometry } from '../src/art/ProceduralLeafCanopy.js';
import { getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';

test.each(['high', 'low'])('%s willow leaves have deterministic curved shoots within the old crown budget', quality => {
    const first = createWillowCurtainGeometry(quality), repeat = createWillowCurtainGeometry(quality);
    const old = createLeafCanopyGeometry(quality);
    try {
        expect(first.attributes.position.array).toEqual(repeat.attributes.position.array);
        expect(first.attributes.position.count).toBe(old.attributes.position.count);
        expect(first.attributes.position.array).not.toEqual(old.attributes.position.array);
        expect(first.userData.woodlandCrown).toBe('willow');
        for (const name of ['position', 'normal', 'color', 'uv']) {
            expect(first.attributes[name].count).toBe(first.attributes.position.count);
            expect(first.attributes[name].array.every(Number.isFinite)).toBe(true);
        }
        expect(first.attributes.uv.array.every(value => value >= 0 && value <= 1)).toBe(true);
        for (const axis of ['x', 'y', 'z']) {
            expect(first.boundingBox.min[axis]).toBeGreaterThan(-1.55);
            expect(first.boundingBox.max[axis]).toBeLessThan(1.55);
        }
        const verticesPerLeaf = quality === 'low' ? 6 : 12;
        for (let shoot = 0; shoot < 16; shoot++) {
            const p = first.attributes.position;
            const top = shoot * 16 * verticesPerLeaf;
            const bottom = top + 15 * verticesPerLeaf;
            // Every actual hanging strand spans >1.4m, with a narrow blade
            // rather than just changing the crown's bounding box metadata.
            expect(p.getY(top) - p.getY(bottom)).toBeGreaterThan(1.4);
            const tip = [p.getX(top), p.getY(top), p.getZ(top)];
            const foot = top + (quality === 'low' ? 2 : 5);
            const base = [p.getX(foot), p.getY(foot), p.getZ(foot)];
            expect(Math.hypot(...tip.map((value, axis) => value - base[axis]))).toBeGreaterThan(.25);
        }
    } finally { first.dispose(); repeat.dispose(); old.dispose(); }
});

test('Low keeps the tips and shoulders of all256 High leaves, simplifying only their outlines', () => {
    const high = createWillowCurtainGeometry(), low = createWillowCurtainGeometry('low');
    try {
        const hp = high.attributes.position.array, lp = low.attributes.position.array;
        for (let leaf = 0; leaf < 256; leaf++) {
            for (const [l, h] of [[0, 0], [1, 1], [2, 5], [3, 0], [4, 5], [5, 11]]) {
                expect(Array.from(lp.slice((leaf * 6 + l) * 3, (leaf * 6 + l + 1) * 3)))
                    .toEqual(Array.from(hp.slice((leaf * 12 + h) * 3, (leaf * 12 + h + 1) * 3)));
            }
        }
    } finally { high.dispose(); low.dispose(); }
});

test('willow curtains share one cached material and geometry; birch canopy remains separate', () => {
    const source = getProceduralFoliageArchetype('mourning_willow');
    const curtains = source.filter(part => part.name.endsWith('leaf curtain'));
    expect(curtains).toHaveLength(3);
    expect(new Set(curtains.map(part => part.geometry)).size).toBe(1);
    expect(new Set(curtains.map(part => part.material)).size).toBe(1);
    for (const part of curtains) {
        expect(part.geometry.userData.woodlandCrown).toBe('willow');
        expect(part.material.transparent).toBe(false);
        expect(part.material.userData.woodlandLeafDetail).toBe(true);
        expect(part.castShadow).toBe(true);
    }
    expect(source.find(part => part.name === 'mourning crown').geometry.userData.woodlandCrown).toBe('leaf');
});
