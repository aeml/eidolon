import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createDungeonFloorComposition, getDungeonFloorCompositionPlan } from '../src/art/DungeonFloorComposition.js';
import { createProceduralDungeonInteriorKit, DUNGEON_INTERIOR_IDS, DUNGEON_ROOM_IDENTITY_IDS } from '../src/art/ProceduralDungeonInteriors.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

test.each(['nave', 'court', 'procession', 'arena'])('%s preserves readable central floor and finite shallow masonry', plan => {
    const a = createDungeonFloorComposition(plan), b = createDungeonFloorComposition(plan);
    expect(a.attributes.position.array).toEqual(b.attributes.position.array);
    expect(a.groups).toHaveLength(0);
    const p = a.attributes.position, n = a.attributes.normal, uv = a.attributes.uv;
    expect(p.count / 3).toBeLessThanOrEqual(440);
    expect(a.boundingBox.min.y).toBeGreaterThan(.1);
    expect(a.boundingBox.max.y).toBeLessThan(.14);
    const vertex = i => new THREE.Vector3().fromBufferAttribute(p, i);
    for (let i = 0; i < p.count; i += 3) {
        const points = [vertex(i), vertex(i + 1), vertex(i + 2)];
        const triangle = new THREE.Triangle(...points);
        expect(triangle.getArea()).toBeGreaterThan(.00001);
        // The closest point on every triangle, not only its vertices, must
        // remain outside the original center seal's radius6.
        const closest = triangle.closestPointToPoint(new THREE.Vector3(0, .12, 0), new THREE.Vector3());
        expect(Math.hypot(closest.x, closest.z)).toBeGreaterThan(7.5);
    }
    for (let i = 0; i < p.count; i++) {
        expect([p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite)).toBe(true);
        expect(n.getY(i)).toBeGreaterThan(0);
        expect(uv.getX(i)).toBeCloseTo(p.getX(i) / 4, 5);
        expect(uv.getY(i)).toBeCloseTo(p.getZ(i) / 4, 5);
    }
    a.dispose(); b.dispose();
});

test.each(DUNGEON_INTERIOR_IDS)('%s fits every identity and shares existing finish maps without extra material', type => {
    for (const quality of ['high', 'low']) {
        const kit = createProceduralDungeonInteriorKit(type, { quality });
        expect(kit.metrics().detailGeometries).toBe(type === 'verdant_bastion_catacombs' ? 17 : 20);
        const root = new THREE.Group();
        const shapes = new Map();
        for (const identity of DUNGEON_ROOM_IDENTITY_IDS) {
            const room = { x: 30000, z: 20000, width: 40, height: 24, identity };
            const source = kit.createRoomDressing(room, 0, { optimized: false });
            const paving = source.getObjectByName(`${identity}:floor-composition`);
            const plan = getDungeonFloorCompositionPlan(identity);
            expect(paving.geometry.userData.dungeonFloorComposition.plan).toBe(plan);
            expect(paving.castShadow).toBe(false); expect(paving.receiveShadow).toBe(true);
            expect(paving.material.vertexColors).toBe(true);
            if (shapes.has(plan)) expect(paving.geometry).toBe(shapes.get(plan));
            shapes.set(plan, paving.geometry);
            source.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(paving);
            expect(box.min.x).toBeGreaterThan(room.x - 8); expect(box.max.x).toBeLessThan(room.x + 8);
            expect(box.min.z).toBeGreaterThan(room.z - 4.8); expect(box.max.z).toBeLessThan(room.z + 4.8);
            const optimized = kit.createRoomDressing(room, 0);
            expect(optimized.userData.drawMeshCount).toBeLessThanOrEqual(9);
            const batch = optimized.children.find(part => part.isMesh && part.material === paving.material);
            expect(batch).toBeDefined();
            expect(batch.castShadow).toBe(false);
            const sourceBounds = new THREE.Box3().setFromObject(source, true);
            const batchedBounds = new THREE.Box3().setFromObject(optimized, true);
            expect(sourceBounds.min.distanceTo(batchedBounds.min)).toBeLessThan(.01);
            expect(sourceBounds.max.distanceTo(batchedBounds.max)).toBeLessThan(.01);
            root.add(source, optimized);
        }
        expect(shapes.size).toBe(4);
        expect(kit.metrics().detailGeometries).toBe(type === 'verdant_bastion_catacombs' ? 22 : 25);
        expect(kit.metrics().detailMaterials).toBe(type === 'verdant_bastion_catacombs' ? 8 : 7);
        const paving = root.getObjectByName('entry_gate:floor-composition');
        const old = root.getObjectByName('entry_gate:processional-paving');
        expect(paving.material).toBe(old.material);
        const watched = [paving.geometry, paving.material, paving.material.map, paving.material.normalMap, paving.material.roughnessMap]
            .map(resource => jest.spyOn(resource, 'dispose'));
        RenderSystem.prototype.disposeObjectResources.call({}, root);
        for (const spy of watched) expect(spy).toHaveBeenCalledTimes(1);
    }
});

test('entry borders do not intersect existing processional paving and boss borders stay outside its dais', () => {
    const nave = createDungeonFloorComposition('nave');
    const p = nave.attributes.position;
    for (let i = 0; i < p.count; i++) {
        expect(Math.abs(p.getX(i)) > 17.2 || p.getZ(i) < -14 || p.getZ(i) > 11).toBe(true);
    }
    const arena = createDungeonFloorComposition('arena');
    const a = arena.attributes.position;
    for (let i = 0; i < a.count; i += 3) {
        const triangle = new THREE.Triangle(...[i, i + 1, i + 2].map(j => new THREE.Vector3().fromBufferAttribute(a, j)));
        const point = triangle.closestPointToPoint(new THREE.Vector3(), new THREE.Vector3());
        expect(Math.hypot(point.x, point.z)).toBeGreaterThan(20);
    }
    nave.dispose(); arena.dispose();
});

test('invalid plan is rejected before allocating buffers', () => {
    expect(() => createDungeonFloorComposition('unknown')).toThrow('Unknown dungeon floor composition');
});
