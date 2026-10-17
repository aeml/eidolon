import * as THREE from 'three';
import { jest } from '@jest/globals';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { createDungeonProcessionalPaving } from '../src/art/DungeonProcessionalPaving.js';
import { createProceduralDungeonInteriorKit, DUNGEON_INTERIOR_IDS } from '../src/art/ProceduralDungeonInteriors.js';

const rooms = [
    ['entry_gate', { type: 'start' }],
    ['treasure_cache', { type: 'normal', hook: 'chest' }],
    ['restorative_shrine', { type: 'normal', hook: 'shrine' }]
];

test.each(rooms)('%s paving is deterministic, shallow and has upward, finite surfaces', identity => {
    const geometry = createDungeonProcessionalPaving(identity);
    const repeat = createDungeonProcessionalPaving(identity);
    expect(geometry.attributes.position.array).toEqual(repeat.attributes.position.array);
    expect(geometry.groups).toHaveLength(0);
    expect(geometry.attributes.position.count / 3).toBeLessThanOrEqual(800);
    expect(geometry.boundingBox.min.y).toBeGreaterThan(0);
    expect(geometry.boundingBox.max.y).toBeLessThan(.05);
    for (const attribute of Object.values(geometry.attributes)) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
        expect(n.getY(i)).toBeGreaterThan(0);
        expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5);
        expect(uv.getX(i)).toBeCloseTo(p.getX(i) / 4, 5);
        expect(uv.getY(i)).toBeCloseTo(p.getZ(i) / 4, 5);
    }
    geometry.dispose(); repeat.dispose();
});

test.each(DUNGEON_INTERIOR_IDS)('%s shares paving shapes/material maps and preserves the true interaction centers', dungeonType => {
    const kit = createProceduralDungeonInteriorKit(dungeonType, { quality: 'low' });
    for (const [identity, type] of rooms) {
        const room = { x: 30000, z: 20000, width: 120, height: 120, ...type };
        const source = kit.createRoomDressing(room, 0, { optimized: false });
        source.updateMatrixWorld(true);
        const next = kit.createRoomDressing({ ...room, x: 31000 }, 1, { optimized: false });
        const paving = source.getObjectByName(`${identity}:processional-paving`);
        expect(paving.geometry).toBe(next.getObjectByName(`${identity}:processional-paving`).geometry);
        const prop = source.getObjectByName(identity === 'entry_gate' ? 'entry:left-vigil:base'
            : identity === 'treasure_cache' ? 'cache:sealed-coffer' : 'shrine:basin');
        expect(paving.material).toBe(next.getObjectByName(`${identity}:processional-paving`).material);
        expect(paving.material.map).toBe(prop.material.map);
        expect(paving.material.normalMap).toBe(prop.material.normalMap);
        expect(paving.material.roughnessMap).toBe(prop.material.roughnessMap);
        expect(paving.material.vertexColors).toBe(true);
        expect(paving.castShadow).toBe(false); expect(paving.receiveShadow).toBe(true);
        expect(source.userData.visualOnly).toBe(true);
        const bounds = new THREE.Box3().setFromObject(paving);
        expect(bounds.min.x).toBeGreaterThan(room.x - 18); expect(bounds.max.x).toBeLessThan(room.x + 18);
        expect(bounds.min.z).toBeGreaterThan(room.z - 14); expect(bounds.max.z).toBeLessThan(room.z + 11);
        const optimized = kit.createRoomDressing(room, 0);
        expect(optimized.userData.drawMeshCount).toBeLessThanOrEqual(8);
        const a = new THREE.Box3().setFromObject(optimized, true), b = new THREE.Box3().setFromObject(source, true);
        expect(a.min.distanceTo(b.min)).toBeLessThan(.01); expect(a.max.distanceTo(b.max)).toBeLessThan(.01);
        const state = optimized.children.find(part => part.userData.proceduralDungeonRoomState);
        expect(state.position.toArray()).toEqual([room.x, 0, room.z]);
    }
});

test.each(rooms)('%s paving fits the narrowest supported room without rising into room-state rings', (identity, type) => {
    const kit = createProceduralDungeonInteriorKit('molten_core', { quality: 'low' });
    const room = kit.createRoomDressing({ x: 0, z: 0, width: 40, height: 40, ...type }, 0, { optimized: false });
    const bounds = new THREE.Box3().setFromObject(room.getObjectByName(`${identity}:processional-paving`));
    expect(bounds.min.x).toBeGreaterThan(-6); expect(bounds.max.x).toBeLessThan(6);
    expect(bounds.max.y).toBeLessThan(room.getObjectByName('DungeonObjectiveHalo').position.y);
    expect(bounds.max.y).toBeLessThan(room.getObjectByName(`${identity}:outer-ward`).position.y);
});

test('rejects unsupported paving before allocating geometry', () => {
    expect(() => createDungeonProcessionalPaving('boss_lair')).toThrow('Unknown dungeon paving identity');
    expect(() => createDungeonProcessionalPaving('toString')).toThrow('Unknown dungeon paving identity');
});

test('the shared finish releases its material and reused physical maps exactly once', () => {
    const kit = createProceduralDungeonInteriorKit('molten_core', { quality: 'low' });
    const root = new THREE.Group();
    for (const [, room] of rooms) root.add(kit.createRoomDressing({ ...room, width: 120 }, 0, { optimized: false }));
    const paving = root.getObjectByName('entry_gate:processional-paving');
    const watched = [paving.material, paving.material.map, paving.material.normalMap, paving.material.roughnessMap]
        .map(resource => jest.spyOn(resource, 'dispose'));
    RenderSystem.prototype.disposeObjectResources.call({}, root);
    for (const spy of watched) expect(spy).toHaveBeenCalledTimes(1);
});
