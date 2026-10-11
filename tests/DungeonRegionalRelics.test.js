import * as THREE from 'three';
import { jest } from '@jest/globals';
import { createDungeonRegionalRelics } from '../src/art/DungeonRegionalRelics.js';
import { createProceduralDungeonInteriorKit, DUNGEON_ROOM_IDENTITY_IDS } from '../src/art/ProceduralDungeonInteriors.js';
import { RenderSystem } from '../src/core/RenderSystem.js';

const types = ['molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus'];

test.each(types.flatMap(type => ['high', 'low'].map(quality => [type, quality])))('%s %s relic has bounded deterministic physical channels', (type, quality) => {
    const first = createDungeonRegionalRelics(type, quality), repeat = createDungeonRegionalRelics(type, quality);
    expect(Object.keys(first)).toEqual(['body', 'metal', 'glow']);
    let triangles = 0;
    for (const [role, geometry] of Object.entries(first)) {
        expect(geometry.attributes.position.array).toEqual(repeat[role].attributes.position.array);
        expect(geometry.groups).toHaveLength(0);
        expect(Object.keys(geometry.attributes).sort()).toEqual(['normal', 'position', 'uv']);
        for (const attribute of Object.values(geometry.attributes)) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
        const bounds = geometry.boundingBox;
        expect(bounds.min.y).toBeGreaterThan(-.03); expect(bounds.max.y).toBeLessThan(3.1);
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThan(1.5);
        expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThan(1);
        expect(geometry.userData.dungeonRegionalRelic).toEqual({ type, role, quality, visualOnly: true });
        triangles += geometry.attributes.position.count / 3;
        geometry.dispose(); repeat[role].dispose();
    }
    expect(triangles).toBeLessThanOrEqual(quality === 'low' ? 1000 : 3000);
});

test.each(types)('%s shares shapes and existing physical finishes in every room identity', type => {
    const kit = createProceduralDungeonInteriorKit(type, { quality: 'low' });
    let previous;
    for (const identity of DUNGEON_ROOM_IDENTITY_IDS) {
        const room = { x: 30000, z: 20000, width: 120, height: 120, identity, roomIdentity: identity };
        const root = kit.createRoomDressing(room, 0, { optimized: false });
        expect(root.userData.roomIdentity).toBe(identity);
        expect(root.userData.regionalRelic).toMatchObject({ type, count: 2, quality: 'low' });
        const body = root.getObjectByName(`regional:${type}:-1:body`), glow = root.getObjectByName(`regional:${type}:1:glow`);
        if (previous) expect(body.geometry).toBe(previous);
        previous = body.geometry;
        expect(body.material.userData.dungeonPropSurface).toBe('stone');
        expect(body.material.emissiveIntensity).toBe(0); expect(body.castShadow).toBe(true);
        expect(glow.castShadow).toBe(false); expect(glow.material.emissiveIntensity).toBeLessThanOrEqual(1.42);
        const optimized = kit.createRoomDressing(room, 0);
        expect(optimized.userData.drawMeshCount).toBeLessThanOrEqual(8);
        const a = new THREE.Box3().setFromObject(root, true), b = new THREE.Box3().setFromObject(optimized, true);
        expect(a.min.distanceTo(b.min)).toBeLessThan(.01); expect(a.max.distanceTo(b.max)).toBeLessThan(.01);
        const count = object => { let triangles = 0; object.traverse(part => {
            if (part.isMesh && !part.userData.proceduralDungeonRoomState)
                triangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3;
        }); return triangles; };
        expect(count(root)).toBe(count(optimized));
    }
    expect(kit.metrics().detailGeometries).toBe(25); expect(kit.metrics().surfaceTextures).toBe(8);
});

test('zone disposal releases shared relic channels once and keeps material/texture reuse', () => {
    const kit = createProceduralDungeonInteriorKit('abyssal_well', { quality: 'low' });
    const root = new THREE.Group();
    root.add(kit.createRoomDressing({ type: 'start', width: 120 }, 0, { optimized: false }),
        kit.createRoomDressing({ type: 'normal', width: 120 }, 1, { optimized: false }));
    const parts = ['body', 'metal', 'glow'].map(role => root.getObjectByName(`regional:abyssal_well:-1:${role}`));
    const watched = parts.map(part => jest.spyOn(part.geometry, 'dispose'));
    expect(parts[0].material).toBe(root.getObjectByName('entry:left-vigil:base').material);
    expect(parts[1].material).toBe(root.getObjectByName('entry:left-vigil:shaft').material);
    RenderSystem.prototype.disposeObjectResources.call({}, root);
    for (const spy of watched) expect(spy).toHaveBeenCalledTimes(1);
});

test('Verdant keeps its previously reviewed root geometry and material counts', () => {
    const kit = createProceduralDungeonInteriorKit('verdant_bastion_catacombs', { quality: 'low' });
    const root = kit.createRoomDressing({ type: 'start', width: 120 }, 0, { optimized: false });
    expect(root.userData.regionalRelic).toBeUndefined();
    expect(root.getObjectByName('verdant:grave-root:-1').geometry.userData.dungeonGraveRoot.branches).toBe(3);
    expect(kit.metrics().detailGeometries).toBe(18); expect(kit.metrics().detailMaterials).toBe(8);
});

test('unsupported families are rejected before constructing channels', () => {
    expect(() => createDungeonRegionalRelics('missing')).toThrow('Unknown dungeon relic');
});
