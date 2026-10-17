import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createProceduralDungeonInteriorKit, DUNGEON_INTERIOR_IDS } from '../src/art/ProceduralDungeonInteriors.js';
import { RenderSystem } from '../src/core/RenderSystem.js';
import { createDungeonDaisMasonry } from '../src/art/DungeonDaisMasonry.js';

test.each(DUNGEON_INTERIOR_IDS)('%s boss floor is grounded, mapped stone with unchanged center and arena footprint', type => {
    for (const quality of ['low', 'high']) {
        const kit = createProceduralDungeonInteriorKit(type, { quality });
        let shared;
        const root = new THREE.Group();
        for (const hook of ['', 'crystal_vigil']) {
            const room = { x: 30000, z: 20000, width: 200, height: 180, type: 'boss', hook };
            const source = kit.createRoomDressing(room, 3, { optimized: false });
            source.updateMatrixWorld(true);
            const floor = source.getObjectByName('boss:buried-dais');
            const bounds = new THREE.Box3().setFromObject(floor);
            // The authoritative walk floor is Y0. The old .32-high black
            // cylinder covered feet and had no stone maps or visible joints.
            expect(bounds.min.y).toBeGreaterThan(0);
            expect(bounds.max.y).toBeLessThan(.05);
            expect(bounds.min.x).toBeGreaterThanOrEqual(room.x - 17.4);
            expect(bounds.max.x).toBeLessThanOrEqual(room.x + 17.4);
            expect(bounds.min.z).toBeGreaterThanOrEqual(room.z - 17.4);
            expect(bounds.max.z).toBeLessThanOrEqual(room.z + 17.4);
            expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(room.x, 1);
            expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(room.z, 1);
            expect(floor.material.userData.dungeonPropSurface).toBe('stone');
            expect(floor.material.emissiveIntensity).toBe(0);
            expect(floor.material.vertexColors).toBe(true);
            expect(floor.castShadow).toBe(false); expect(floor.receiveShadow).toBe(true);
            expect(floor.material).toBe(source.getObjectByName('boss_lair:floor-composition').material);
            for (const map of ['map', 'normalMap', 'roughnessMap']) expect(floor.material[map].image.width).toBe(quality === 'low' ? 64 : 128);
            const inlay = source.getObjectByName(hook ? 'boss:crystal-vigil-inlay' : 'boss:soul-circuit');
            expect(inlay.position.y).toBe(.035);
            if (shared) expect(floor.geometry).toBe(shared);
            shared = floor.geometry;
            const optimized = kit.createRoomDressing(room, 3);
            const a = new THREE.Box3().setFromObject(optimized, true), b = new THREE.Box3().setFromObject(source, true);
            expect(a.min.distanceTo(b.min)).toBeLessThan(.01); expect(a.max.distanceTo(b.max)).toBeLessThan(.01);
            expect(optimized.userData.drawMeshCount).toBeLessThanOrEqual(8);
            const state = optimized.children.find(part => part.userData.proceduralDungeonRoomState);
            expect(state.position.toArray()).toEqual([room.x, 0, room.z]);
            root.add(source, optimized);
        }
        const floor = root.getObjectByName('boss:buried-dais');
        const watched = [floor.geometry, floor.material, floor.material.map, floor.material.normalMap, floor.material.roughnessMap]
            .map(resource => jest.spyOn(resource, 'dispose'));
        RenderSystem.prototype.disposeObjectResources.call({}, root);
        for (const spy of watched) expect(spy).toHaveBeenCalledTimes(1);
    }
});

test('laid stone covers the former octagonal floor, with finite upward normals and physical UV scale', () => {
    const geometry = createDungeonDaisMasonry(), repeat = createDungeonDaisMasonry();
    expect(geometry.attributes.position.array).toEqual(repeat.attributes.position.array);
    expect(geometry.groups).toHaveLength(0);
    expect(geometry.attributes.position.count / 3).toBeLessThanOrEqual(640);
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    let topArea = 0;
    for (let i = 0; i < p.count; i++) {
        if (![p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite)) throw new Error('Nonfinite masonry');
        if (n.getY(i) <= 0 || Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) > 1e-5) throw new Error('Invalid masonry normal');
        for (let side = 0; side < 8; side++) {
            const angle = Math.PI / 8 + side * Math.PI / 4;
            if (p.getX(i) * Math.cos(angle) + p.getZ(i) * Math.sin(angle) > 17.4 * Math.cos(Math.PI / 8) + .00001)
                throw new Error('Masonry outside original octagon');
        }
        if (Math.abs(uv.getX(i) - p.getX(i) / 4) > 1e-5 || Math.abs(uv.getY(i) - p.getZ(i) / 4) > 1e-5) throw new Error('Stretched masonry UV');
    }
    for (let i = 0; i < p.count; i += 3) {
        const triangle = new THREE.Triangle(...[i, i + 1, i + 2].map(j => new THREE.Vector3().fromBufferAttribute(p, j)));
        if (triangle.getArea() <= .00001) throw new Error('Collapsed masonry triangle');
        if (n.getY(i) > .9999) topArea += triangle.getArea();
    }
    const originalArea = 2 * Math.SQRT2 * 17.4 ** 2;
    expect(topArea / originalArea).toBeGreaterThan(.9);
    expect(topArea / originalArea).toBeLessThan(.99);
    geometry.dispose(); repeat.dispose();
});

test('dais allocation is lazy and shared across boss rooms of one kit', () => {
    const kit = createProceduralDungeonInteriorKit('molten_core', { quality: 'low' });
    const initial = kit.metrics().detailGeometries;
    kit.createRoomDressing({ type: 'start', width: 120 }, 0);
    expect(kit.metrics().detailGeometries).toBe(initial + 1);
    kit.createRoomDressing({ type: 'boss', width: 180 }, 1);
    expect(kit.metrics().detailGeometries).toBe(initial + 3); // nave, arena border, dais
    kit.createRoomDressing({ type: 'boss', width: 200, hook: 'crystal_vigil' }, 2);
    expect(kit.metrics().detailGeometries).toBe(initial + 3);
});
