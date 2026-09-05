import fs from 'fs';
import * as THREE from 'three';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { buildDungeonTraversalRoutes, sampleDungeonTraversalRoute } from './dungeonTraversalRoutes.js';

const fixtures = JSON.parse(fs.readFileSync('tests/fixtures/production-dungeon-layouts.json', 'utf8'));
const generators = {
    verdant_bastion_catacombs: 'createVerdantBastionCatacombs',
    molten_core: 'createMoltenCore', tempest_spire: 'createTempestSpire',
    abyssal_well: 'createAbyssalWell', umbral_nexus: 'createUmbralNexus',
    weekly_raid: 'createUmbralNexus', earth_crystal_raid: 'createVerdantBastionCatacombs',
    water_crystal_raid: 'createAbyssalWell', fire_crystal_raid: 'createMoltenCore', air_crystal_raid: 'createTempestSpire'
};

test.each(fixtures.map(fixture => [fixture.dungeonType, fixture.layout.generationSeed, fixture.layout]))(
    '%s seed %s has traversable rendered joins and one floor per route point', async (dungeonType, seed, layout) => {
        const scene = new THREE.Group();
        const collision = new CollisionManager();
        collision.setDungeonWalkableGeometry(layout.walkRects);
        const generator = new WorldGenerator(scene, collision);
        await generator[generators[dungeonType]](0, 0, layout);
        const floors = scene.children.filter(mesh => mesh.name === 'DungeonUnionFloor');
        expect(floors.length).toBeGreaterThan(0);
        let samplesChecked = 0;
        for (const route of buildDungeonTraversalRoutes(layout)) {
            for (const { x, z } of sampleDungeonTraversalRoute(route)) {
                const point = new THREE.Vector3(x, 0, z);
                const corrected = collision.checkCollision(point, 1.25, point);
                if (corrected && corrected.distanceTo(point) > 0.01) {
                    throw new Error(`${dungeonType} seed ${seed}: blocked route point (${x}, ${z})`);
                }
                // Avoid counting touching partition edges as overlap.
                const floorCount = floors.filter(mesh => {
                    const r = mesh.userData.walkSurface;
                    return x + 0.0001 > r.left && x + 0.0001 < r.right && z + 0.0001 > r.top && z + 0.0001 < r.bottom;
                }).length;
                if (floorCount !== 1) throw new Error(`${dungeonType} seed ${seed}: ${floorCount} floors at (${x}, ${z})`);
                samplesChecked++;
            }
        }
        expect(samplesChecked).toBeGreaterThan(100);
    }
);
