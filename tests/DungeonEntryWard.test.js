import { jest } from '@jest/globals';
import * as THREE from 'three';
import { DUNGEON_INTERIOR_IDS, createDungeonRoomStatePresentation,
    applyDungeonRoomStatePresentation, animateDungeonRoomStatePresentation } from '../src/art/ProceduralDungeonInteriors.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(DUNGEON_INTERIOR_IDS)('%s entry ward is grounded, bounded and keeps its physical opening stable across room states', type => {
    const room = { x: 280, z: -350, width: 40, height: 40, type: 'start' };
    const root = createDungeonRoomStatePresentation(type, room, 0, { worldSpace: true });
    const ward = root.getObjectByName('DungeonEntryWard'), veil = root.getObjectByName('DungeonExitPortal');
    expect(ward.children).toHaveLength(3);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ward);
    expect(box.min.y).toBeGreaterThanOrEqual(.1);
    expect(box.max.y).toBeLessThan(10);
    expect(box.min.x).toBeGreaterThan(room.x - 4); expect(box.max.x).toBeLessThan(room.x + 4);
    expect(box.min.z).toBeGreaterThan(room.z - 5); expect(box.max.z).toBeLessThan(room.z - 2);
    let triangles = 0;
    ward.traverse(part => {
        expect(part.userData.visualOnly).toBe(true);
        if (!part.isMesh) return;
        triangles += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
        expect(part.geometry.groups).toHaveLength(0);
        expect([...part.geometry.attributes.position.array, ...part.geometry.attributes.normal.array].every(Number.isFinite)).toBe(true);
    });
    expect(triangles).toBeLessThan(4000);
    // A real geometric opening through the stone, not an opaque frame filling
    // the hero's route. No collider or new interaction is registered by the art.
    const ray = new THREE.Raycaster(new THREE.Vector3(room.x, 3, room.z + 5), new THREE.Vector3(0, 0, -1));
    expect(ray.intersectObject(ward.getObjectByName('DungeonEntryWard:Masonry'))).toHaveLength(0);
    const position = veil.position.clone(), rotation = veil.quaternion.clone(), scale = veil.scale.clone();
    for (const objectiveRoomIndex of [0, 1, -1, 0]) {
        applyDungeonRoomStatePresentation(root, { cleared: objectiveRoomIndex === -1 }, { currentRoomIndex: 0, objectiveRoomIndex });
        expect(veil.material.opacity).toBe(objectiveRoomIndex === -1 ? .9 : .18);
        animateDungeonRoomStatePresentation(root, 2.5);
        expect(veil.material.userData.dungeonVeilTime.value).toBe(2.5);
        expect(veil.position.equals(position) && veil.quaternion.equals(rotation) && veil.scale.equals(scale)).toBe(true);
        expect(root.userData.exitReady).toBe(objectiveRoomIndex === -1);
        expect(veil.material.opacity).toBeGreaterThan(0); expect(veil.material.opacity).toBeLessThanOrEqual(.94);
    }
    RenderSystem.prototype.disposeObjectResources.call({}, root);
});

test('room teardown releases each entry-ward material and geometry once; non-entry rooms allocate no ward', () => {
    const root = createDungeonRoomStatePresentation('verdant_bastion_catacombs', { type: 'start', width: 120 }, 0);
    const ward = root.getObjectByName('DungeonEntryWard'), disposals = [];
    for (const part of ward.children) disposals.push(jest.spyOn(part.geometry, 'dispose'), jest.spyOn(part.material, 'dispose'));
    RenderSystem.prototype.disposeObjectResources.call({}, root);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
    const ordinary = createDungeonRoomStatePresentation('verdant_bastion_catacombs', { type: 'normal' }, 1);
    expect(ordinary.getObjectByName('DungeonEntryWard')).toBeUndefined();
    RenderSystem.prototype.disposeObjectResources.call({}, ordinary);
});
