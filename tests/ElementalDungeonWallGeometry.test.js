import * as THREE from 'three';
import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { createElementalDungeonWallGeometry } from '../src/art/ElementalDungeonWallGeometry.js';
import { createProceduralDungeonInteriorKit } from '../src/art/ProceduralDungeonInteriors.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';

const families = ['molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus'];
const layouts = JSON.parse(readFileSync(new URL('./fixtures/production-dungeon-layouts.json', import.meta.url), 'utf8'));

test.each(families)('%s has finite, bounded, textured opaque architecture at both detail levels', type => {
    for (const quality of ['high', 'low']) for (const width of [6, 23.5, 122, 500]) {
        const geometry = createElementalDungeonWallGeometry(type, width, 15, 2, quality);
        const original = new THREE.BoxGeometry(width, 15, 2); original.computeBoundingBox();
        expect(geometry.boundingBox.min.toArray()).toEqual(original.boundingBox.min.toArray());
        expect(geometry.boundingBox.max.toArray()).toEqual(original.boundingBox.max.toArray());
        expect(geometry.groups).toHaveLength(0);
        expect(geometry.userData.elementalWall).toBe(type);
        expect(geometry.userData.bays).toBeLessThanOrEqual(8);
        expect(geometry.attributes.position.count / 3).toBeLessThanOrEqual(3000);
        const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
        let crownFaces = 0, bottomFaces = 0;
        for (let i = 0; i < p.count; i++) {
            if (![p.getX(i), p.getY(i), p.getZ(i), uv.getX(i), uv.getY(i)].every(Number.isFinite)) throw new Error('invalid vertex');
            if (Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) > .0001) throw new Error('invalid normal');
        }
        for (let i = 0; i < p.count; i += 3) {
            if ([i, i + 1, i + 2].every(index => p.getY(index) === 7.5)) crownFaces++;
            if ([i, i + 1, i + 2].every(index => p.getY(index) === -7.5)) bottomFaces++;
            const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
            const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
            if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-12) throw new Error('degenerate triangle');
            const area = (uv.getX(i + 1) - uv.getX(i)) * (uv.getY(i + 2) - uv.getY(i)) -
                (uv.getX(i + 2) - uv.getX(i)) * (uv.getY(i + 1) - uv.getY(i));
            if (Math.abs(area) < 1e-12) throw new Error('collapsed texture mapping');
        }
        expect(crownFaces).toBe(2); expect(bottomFaces).toBe(2);
        geometry.dispose(); original.dispose();
    }
});

test('four wall languages have distinct profiles and narrow walls retain their original box', () => {
    const geometries = families.map(type => createElementalDungeonWallGeometry(type, 122, 15, 2));
    expect(new Set(geometries.map(geometry => geometry.userData.archProfile)).size).toBe(4);
    expect(new Set(geometries.map(geometry => Array.from(geometry.attributes.position.array).join(','))).size).toBe(4);
    for (const geometry of geometries) geometry.dispose();
    for (const type of families) for (const size of [[2, 15, 2], [20, 3, 2]]) {
        const geometry = createElementalDungeonWallGeometry(type, ...size);
        expect(geometry).toBeInstanceOf(THREE.BoxGeometry); geometry.dispose();
    }
    expect(() => createElementalDungeonWallGeometry('unknown', 10, 15, 2)).toThrow(TypeError);
    expect(() => createElementalDungeonWallGeometry('molten_core', Infinity, 15, 2)).toThrow(TypeError);
});

test.each(families)('%s caches one opaque mesh geometry and keeps foreground cutaways simple', type => {
    const kit = createProceduralDungeonInteriorKit(type, { quality: 'low' });
    const wall = kit.wallGeometry(122, 15, 2), cutaway = kit.wallGeometry(122, 15, 2, true);
    expect(wall).toBe(kit.wallGeometry(122, 15, 2));
    expect(wall.userData.elementalWall).toBe(type);
    expect(cutaway).toBeInstanceOf(THREE.BoxGeometry);
    expect(cutaway).toBe(kit.wallGeometry(122, 15, 2, true));
    expect(kit.wallMaterial(122, 15, true).depthWrite).toBe(false);
});

test.each([...families, 'verdant_bastion_catacombs'])('%s legacy corridor cutaways never use layered geometry', type => {
    const scene = new THREE.Group(), collision = { addCollider: jest.fn() };
    const world = new WorldGenerator(scene, collision, { graphicsQuality: 'low' });
    world.dungeonInteriorKit = createProceduralDungeonInteriorKit(type, { quality: 'low' });
    world.createCorridor(0, 0, 120, 0, 20);
    const walls = scene.children.filter(part => part.name === 'ProceduralDungeonCorridorWall');
    expect(walls).toHaveLength(2);
    expect(walls.filter(part => part.material.transparent)).toHaveLength(1);
    for (const wall of walls) {
        if (wall.material.transparent) expect(wall.geometry).toBeInstanceOf(THREE.BoxGeometry);
        else expect(wall.geometry.userData.elementalWall || wall.geometry.userData.cryptWall).toBeTruthy();
        expect(new THREE.Box3().setFromObject(wall).getSize(new THREE.Vector3()).toArray()).toEqual([120, 15, 2]);
    }
    expect(collision.addCollider).toHaveBeenCalledTimes(2);
});

test.each(families)('%s full production layout retains exact old-box collision and walk-floor partitions', type => {
    const { layout } = layouts.find(fixture => fixture.dungeonType === type);
    const kit = createProceduralDungeonInteriorKit(type, { quality: 'low' });
    const build = detailed => {
        const scene = new THREE.Group(), collision = { addCollider: jest.fn() };
        const world = new WorldGenerator(scene, collision, { graphicsQuality: 'low' });
        world.dungeonInteriorKit = detailed ? kit : { ...kit,
            wallGeometry: (width, height, depth) => new THREE.BoxGeometry(width, height, depth) };
        world.createCanonicalLayoutDungeon(layout);
        return { colliders: collision.addCollider.mock.calls.map(([box]) => [box.min.toArray(), box.max.toArray()]),
            floors: scene.children.filter(part => part.name === 'DungeonUnionFloor').map(part => ({
                position: part.position.toArray(), vertices: Array.from(part.geometry.attributes.position.array),
                uv: Array.from(part.geometry.attributes.uv.array), surface: part.userData.walkSurface
            })) };
    };
    expect(build(true)).toEqual(build(false));
});
