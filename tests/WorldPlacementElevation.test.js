import * as THREE from 'three';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { EARTH_ELEVATION as field } from '../src/data/worldElevation.js';

test('actual foliage batches and trunk colliders move together without changing horizontal placement', async () => {
    const flat = new WorldGenerator(new THREE.Group(), new CollisionManager());
    const raised = new WorldGenerator(new THREE.Group(), new CollisionManager(), { terrainElevation: field });
    await flat.loadTrees(0, 200); await raised.loadTrees(0, 200);
    expect(raised.scene.children.length).toBe(flat.scene.children.length);
    let lifted = 0;
    for (let g = 0; g < flat.scene.children.length; g++) {
        const a = flat.scene.children[g], b = raised.scene.children[g];
        if (a.userData.earthUnderstory) {
            // Understory owns its geometry per scene; only tree archetypes
            // share geometry across worlds. Still verify every plant transform
            // against the real field, with unchanged horizontal placement.
            expect(b.userData.earthUnderstory).toBe(true);
            expect(b.children.length).toBe(a.children.length);
            const checked = new Set();
            let count = 0, maxError = 0;
            for (let part = 0; part < a.children.length; part++) {
                const source = a.children[part], target = b.children[part];
                expect(target.name).toBe(source.name);
                expect(target.count).toBe(source.count);
                if (!checked.has(source.geometry)) {
                    checked.add(source.geometry);
                    expect(target.geometry).not.toBe(source.geometry);
                    for (const key of Object.keys(source.geometry.attributes)) {
                        expect(target.geometry.attributes[key].array).toEqual(source.geometry.attributes[key].array);
                    }
                }
                for (let i = 0; i < source.count; i++) {
                    const before = new THREE.Matrix4(), after = new THREE.Matrix4();
                    source.getMatrixAt(i, before); target.getMatrixAt(i, after);
                    before.elements[13] = field.sample(before.elements[12], before.elements[14]);
                    before.elements.forEach((v, j) => { maxError = Math.max(maxError, Math.abs(after.elements[j] - v)); });
                    count++;
                }
            }
            expect(count).toBe(a.userData.plantCount);
            expect(count).toBe(b.userData.plantCount);
            expect(maxError).toBeLessThan(.0001);
            continue;
        }
        expect(a.userData.proceduralFoliage).toBe(true);
        expect(b.userData.proceduralFoliage).toBe(true);
        expect(b.userData.placements).toEqual(a.userData.placements);
        for (let part = 0; part < a.children.length; part++) {
            const source = a.children[part], target = b.children[part];
            expect(target.geometry).toBe(source.geometry);
            for (let i = 0; i < source.count; i++) {
                const before = new THREE.Matrix4(), after = new THREE.Matrix4();
                source.getMatrixAt(i, before); target.getMatrixAt(i, after);
                const p = a.userData.placements[source.userData.placementIndices[i]];
                const height = field.sample(p.x, p.z);
                before.elements[13] += height;
                before.elements.forEach((v, j) => expect(after.elements[j]).toBeCloseTo(v, 4));
                if (height > 1) lifted++;
            }
        }
    }
    expect(lifted).toBeGreaterThan(0);
    expect(raised.collisionManager.colliders).toHaveLength(flat.collisionManager.colliders.length);
    flat.collisionManager.colliders.forEach((box, i) => {
        const center = box.getCenter(new THREE.Vector3());
        const expected = box.clone().translate(new THREE.Vector3(0, field.sample(center.x, center.z), 0));
        expect(raised.collisionManager.colliders[i].min.distanceTo(expected.min)).toBeLessThan(1e-8);
        expect(raised.collisionManager.colliders[i].max.distanceTo(expected.max)).toBeLessThan(1e-8);
    });
    for (const instanceId of ['dungeon_test', 'lanternhold-casino']) {
        const instance = new WorldGenerator(new THREE.Group(), new CollisionManager(), { instanceId, terrainElevation: field });
        expect(instance.terrainElevation).toBeNull();
    }
});
