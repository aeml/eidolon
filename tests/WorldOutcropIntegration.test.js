import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { compileRockSolids, firstRockHit, insideRockSolids } from '../src/core/RockCollision.js';
import { EARTH_OUTCROP_COLLISIONS, EARTH_OUTCROP_PROFILE } from '../src/data/earthOutcrops.js';
import { EARTH_ELEVATION } from '../src/data/worldElevation.js';

test('formations leave capsule-width space beside existing static collision geometry', () => {
    const { overworld } = JSON.parse(readFileSync(new URL('../server/internal/game/content/admin-landing-colliders.json', import.meta.url)));
    const solids = compileRockSolids(EARTH_OUTCROP_COLLISIONS);
    for (const box of overworld.boxes) {
        const c = Math.cos(box[4]), s = Math.sin(box[4]);
        const corners = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,z]) => ({
            x: box[0] + c*x*box[2] + s*z*box[3], z: box[1] - s*x*box[2] + c*z*box[3]
        }));
        for (let i = 0; i < 4; i++) expect(firstRockHit(solids, corners[i], corners[(i+1)%4], 2.6).hit).toBe(false);
    }
    for (const [x,z,radius] of overworld.circles) {
        expect(insideRockSolids(solids, { x,z }, radius+2.6)).toBe(false);
    }
});

test('production world generator installs matching render and collision only for negotiated outcrops', async () => {
    for (const profile of ['flat-v1', 'earth-elevation-v1', EARTH_OUTCROP_PROFILE]) {
        const scene = new THREE.Group(), collisions = new CollisionManager();
        const world = new WorldGenerator(scene, collisions, { terrainProfile: profile,
            terrainElevation: profile === 'flat-v1' ? null : EARTH_ELEVATION, graphicsQuality: 'low' });
        await world.loadBuildings(0, 200);
        const rocks = scene.getObjectByName('Earth exposed rock shelves');
        expect(collisions.rockSolids.length).toBe(profile === EARTH_OUTCROP_PROFILE ? 18 : 0);
        expect(rocks?.children.length ?? 0).toBe(profile === EARTH_OUTCROP_PROFILE ? 6 : 0);
        scene.traverse(object => {
            object.geometry?.dispose();
            for (const material of [object.material].flat().filter(Boolean)) material.dispose();
        });
        collisions.clear();
        expect(collisions.rockSolids).toEqual([]);
    }
    const instance = new WorldGenerator(new THREE.Group(), new CollisionManager(), {
        instanceId: 'dungeon-test', terrainProfile: EARTH_OUTCROP_PROFILE, terrainElevation: EARTH_ELEVATION
    });
    expect(instance.hasEarthOutcrops).toBe(false);
});
