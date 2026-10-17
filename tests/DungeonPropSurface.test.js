import * as THREE from 'three';
import { sampleDungeonPropSurface, createDungeonPropSurfaceMaps } from '../src/art/DungeonPropSurface.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';

test.each(['stone', 'metal'])('%s finish repeats continuously with distinct albedo, relief and roughness', surface => {
    const heights = [], roughness = [];
    for (const u of [-1.31, -.01, 0, .23, .999, 2.41]) for (const v of [-.54, 0, .47, .999]) {
        const a = sampleDungeonPropSurface(surface, u, v), b = sampleDungeonPropSurface(surface, u + 3, v - 2);
        for (let i = 0; i < 3; i++) expect(a.color[i]).toBeCloseTo(b.color[i], 9);
        expect(a.height).toBeCloseTo(b.height, 9); expect(a.roughness).toBeCloseTo(b.roughness, 9);
        expect(a.color.every(value => value >= 170 && value <= 255)).toBe(true);
        expect(a.roughness).toBeGreaterThanOrEqual(surface === 'stone' ? .84 : .46);
        expect(a.roughness).toBeLessThanOrEqual(surface === 'stone' ? .96 : .82);
        heights.push(a.height); roughness.push(a.roughness);
    }
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(.1);
    expect(Math.max(...roughness) - Math.min(...roughness)).toBeGreaterThan(.02);
});

test.each(['stone', 'metal'].flatMap(surface => ['high', 'low'].map(quality => [surface, quality])))('%s %s maps retain proper color encoding, mips and finite unit normals', (surface, quality) => {
    const maps = createDungeonPropSurfaceMaps(surface, quality), other = createDungeonPropSurfaceMaps(surface, quality);
    for (const key of ['map', 'normalMap', 'roughnessMap']) {
        expect(maps[key]).not.toBe(other[key]); expect(maps[key].image.data).toEqual(other[key].image.data);
        expect(maps[key].image.width).toBe(quality === 'low' ? 64 : 128);
        expect(maps[key].colorSpace).toBe(key === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace);
        expect(maps[key].wrapS).toBe(THREE.RepeatWrapping); expect(maps[key].wrapT).toBe(THREE.RepeatWrapping);
        expect(maps[key].generateMipmaps).toBe(true); expect(maps[key].minFilter).toBe(THREE.LinearMipmapLinearFilter);
    }
    const normals = maps.normalMap.image.data;
    for (let offset = 0; offset < normals.length; offset += 4) {
        const length = Math.hypot(...[0, 1, 2].map(i => normals[offset + i] / 255 * 2 - 1));
        expect(length).toBeGreaterThan(.99); expect(length).toBeLessThan(1.01);
        expect(normals[offset + 2]).toBeGreaterThan(240); expect(normals[offset + 3]).toBe(255);
    }
    for (const map of [...Object.values(maps), ...Object.values(other)]) map.dispose();
});

test.each(['verdant_bastion_catacombs', 'molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus'])('%s shares six kit-owned prop maps across prop and paving finishes', type => {
    const kit = createProceduralDungeonInteriorKit(type, { quality: 'low' });
    const rooms = [kit.createRoomDressing({ type: 'start', x: 0, z: 0, width: 120 }, 0, { optimized: false }),
        kit.createRoomDressing({ type: 'normal', hook: 'chest', x: 400, z: 0, width: 120 }, 1, { optimized: false }),
        kit.createRoomDressing({ type: 'normal', hook: 'shrine', x: 800, z: 0, width: 120 }, 2, { optimized: false })];
    const materials = new Set(), textures = new Set();
    for (const room of rooms) room.traverse(part => {
        if (!part.material?.userData.dungeonPropSurface) return;
        materials.add(part.material);
        for (const key of ['map', 'normalMap', 'roughnessMap']) textures.add(part.material[key]);
        expect(part.material.transparent).toBe(false); expect(part.material.flatShading).toBe(false);
        expect(part.material.emissiveIntensity).toBe(0);
    });
    expect(materials.size).toBe(5); expect(textures.size).toBe(6);
    expect(rooms[0].getObjectByName('entry:left-vigil:base').material).toBe(rooms[2].getObjectByName('shrine:basin').material);
    expect(rooms[0].getObjectByName('entry:left-vigil:shaft').material).toBe(rooms[1].getObjectByName('cache:coffer-lid').material);
    expect(kit.metrics().detailMaterials).toBe(type === 'verdant_bastion_catacombs' ? 8 : 7);
    expect(kit.metrics().surfaceTextures).toBe(8);
});

test('unknown prop finish is rejected before a map can be created', () => {
    expect(() => createDungeonPropSurfaceMaps('missing')).toThrow(TypeError);
});
