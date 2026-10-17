import * as THREE from 'three';
import { createDungeonVigilBase, createDungeonVigilShaft, createDungeonVigilCage,
    createDungeonBevelBlock, createDungeonFontBasin, createDungeonCofferLid,
    createDungeonAmbushPier } from '../src/art/DungeonVigilGeometry.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';

test.each([['foot', createDungeonVigilBase, 300], ['shaft', createDungeonVigilShaft, 400],
    ['cage', createDungeonVigilCage, 200], ['block', createDungeonBevelBlock, 100],
    ['font', createDungeonFontBasin, 300], ['lid', createDungeonCofferLid, 200],
    ['pier', createDungeonAmbushPier, 200]])('%s has finite deterministic bounded surface detail', (name, make, triangles) => {
    const first = make(), second = make();
    expect(first.attributes.position.array).toEqual(second.attributes.position.array);
    for (const key of ['position', 'normal', 'uv']) {
        const attribute = first.attributes[key];
        expect(attribute.count).toBe(first.attributes.position.count);
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
    expect((first.index?.count || first.attributes.position.count) / 3).toBeLessThanOrEqual(triangles);
    expect(first.groups.every(group => group.materialIndex === 0)).toBe(true);
    const bounds = first.boundingBox;
    expect(bounds.min.y).toBeGreaterThanOrEqual(-.55);
    expect(bounds.max.y).toBeLessThanOrEqual(name === 'cage' ? .83 : .51);
    expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThanOrEqual(.56);
    first.dispose(); second.dispose();
});

test.each(['verdant_bastion_catacombs', 'molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus'])('%s ambush piers share physical stone and preserve the old encounter apron', dungeonType => {
    const kit = createProceduralDungeonInteriorKit(dungeonType, { quality: 'low' });
    const room = { x: 30000, z: 20000, width: 120, height: 120, type: 'elite', hook: 'elite_ambush' };
    const first = kit.createRoomDressing(room, 0, { optimized: false });
    const second = kit.createRoomDressing({ ...room, x: 30400 }, 1, { optimized: false });
    first.updateMatrixWorld(true);
    const probe = first.getObjectByName('ambush:watch-pier:0');
    expect(probe.geometry).toBe(second.getObjectByName('ambush:watch-pier:0').geometry);
    expect(probe.geometry.userData.dungeonVigilGeometry).toBe('broken-watch-pier');
    expect(probe.material.userData.dungeonPropSurface).toBe('stone');
    expect(probe.material.normalMap).not.toBeNull();
    const oldGeometry = new THREE.ConeGeometry(.5, 1, 4);
    for (let i = 0; i < 6; i++) {
        const pier = first.getObjectByName(`ambush:watch-pier:${i}`);
        expect(pier.geometry).toBe(probe.geometry);
        expect(pier.material).toBe(probe.material);
        expect(pier.castShadow && pier.receiveShadow).toBe(true);
        const old = oldGeometry.clone().applyMatrix4(pier.matrixWorld);
        old.computeBoundingBox();
        // Compare transformed vertices, not the wider rotated local AABB.
        const current = new THREE.Box3().setFromObject(pier, true);
        for (const axis of ['x', 'y', 'z']) {
            expect(current.min[axis]).toBeGreaterThanOrEqual(old.boundingBox.min[axis] - .003);
            expect(current.max[axis]).toBeLessThanOrEqual(old.boundingBox.max[axis] + .003);
        }
        expect(Math.hypot(pier.position.x, pier.position.z)).toBeCloseTo(24);
        old.dispose();
    }
    oldGeometry.dispose();
    expect(first.userData.visualOnly).toBe(true);
});

test('constructed vigil stays in its former apron and shares kit shapes across rooms', () => {
    const kit = createProceduralDungeonInteriorKit('molten_core', { quality: 'low' });
    const room = { x: 0, z: 0, width: 120, height: 120, type: 'start' };
    const first = kit.createRoomDressing(room, 0, { optimized: false });
    const second = kit.createRoomDressing({ ...room, x: 400 }, 1, { optimized: false });
    const foot = first.getObjectByName('entry:left-vigil:base');
    const shaft = first.getObjectByName('entry:left-vigil:shaft');
    const cage = first.getObjectByName('entry:left-vigil:cage');
    const light = first.getObjectByName('entry:left-vigil:light');
    expect(foot.geometry).toBe(second.getObjectByName('entry:left-vigil:base').geometry);
    expect(shaft.geometry).toBe(second.getObjectByName('entry:left-vigil:shaft').geometry);
    expect(shaft.material).toBe(cage.material);
    for (const part of [foot, shaft, cage, light]) {
        first.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(part);
        expect(bounds.min.x).toBeGreaterThanOrEqual(foot.position.x - 1.21);
        expect(bounds.max.x).toBeLessThanOrEqual(foot.position.x + 1.21);
        expect(bounds.min.z).toBeGreaterThanOrEqual(foot.position.z - 1.21);
        expect(bounds.max.z).toBeLessThanOrEqual(foot.position.z + 1.21);
        expect(bounds.min.y).toBeGreaterThanOrEqual(0);
        expect(bounds.max.y).toBeLessThanOrEqual(7.13);
    }
    expect(cage.position.y + cage.geometry.boundingBox.min.y).toBeLessThan(shaft.position.y + shaft.scale.y * .5);
    expect(first.userData.visualOnly).toBe(true);
    const portal = first.getObjectByName('DungeonExitPortal');
    expect(portal.parent.name).toBe('DungeonEntryWard');
    expect(portal.parent.position.toArray()).toEqual([0, 0, -10.08]);
    expect(portal.position.toArray()).toEqual([0, 0, -.05]);
    expect(portal.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([0, 0, -10.13]);
    const opening = new THREE.Box3().setFromObject(portal);
    // The veil now reaches the shallow Y.03 threshold above server ground,
    // below the ordinary Y.05 marker plane. Preserve the original tall opening.
    expect(opening.min.y).toBeCloseTo(.03, 6);
    expect(opening.min.y).toBeLessThan(.05);
    expect(opening.max.y).toBeGreaterThan(8);
});

test('cache and font retain interaction centers and fit the former visual aprons', () => {
    const kit = createProceduralDungeonInteriorKit('molten_core', { quality: 'low' });
    const cache = kit.createRoomDressing({ x: 0, z: 0, width: 120, height: 120, type: 'normal', hook: 'chest' }, 0, { optimized: false });
    expect(cache.getObjectByName('cache:sealed-coffer').geometry.userData.dungeonVigilGeometry).toBe('bevel-block');
    expect(cache.getObjectByName('cache:coffer-lid').geometry.userData.dungeonVigilGeometry).toBe('vaulted-coffer-lid');
    expect(cache.getObjectByName('cache:iron-strap:-1')).not.toBeNull();
    expect(cache.getObjectByName('cache:warded-lock').position.toArray()).toEqual([0, 1.5, 24 * .2 + 1.62]);
    const shrine = kit.createRoomDressing({ x: 0, z: 0, width: 120, height: 120, type: 'normal', hook: 'shrine' }, 1, { optimized: false });
    const font = shrine.getObjectByName('shrine:basin');
    expect(font.geometry.userData.dungeonVigilGeometry).toBe('hollow-font');
    shrine.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(font);
    expect(bounds.min.y).toBeCloseTo(.2);
    expect(bounds.max.y).toBeCloseTo(1.7);
    expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(6.67);
    expect(shrine.getObjectByName('shrine:spirit-font').position.toArray()).toEqual([0, 2.4, 2.88]);
});
