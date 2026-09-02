import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    FOLIAGE_HAZARD_CLEARINGS,
    PROCEDURAL_FOLIAGE_RECIPES,
    createProceduralFoliagePlacements,
    createProceduralFoliagePreview,
    getProceduralFoliageArchetype,
    getProceduralFoliageCacheMetrics,
    isProceduralFoliagePlacementClear
} from '../src/art/ProceduralRealmFoliage.js';

const SERVER_WORLD_SOURCE = readFileSync(
    resolve(process.cwd(), 'server/internal/game/world.go'),
    'utf8'
);

function parseServerHazardAnchors(sliceName) {
    const start = SERVER_WORLD_SOURCE.indexOf(`${sliceName} := []struct`);
    const end = SERVER_WORLD_SOURCE.indexOf(`for i, h := range ${sliceName}`, start);
    if (start < 0 || end < 0) throw new Error(`Unable to locate authoritative ${sliceName} slice`);
    const block = SERVER_WORLD_SOURCE.slice(start, end);
    return [...block.matchAll(/\{\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\s*\}/g)]
        .map((match) => match.slice(1).map(Number));
}

describe('procedural realm foliage', () => {
    test('every overworld realm owns intentional, distinct foliage silhouettes', () => {
        expect(PROCEDURAL_FOLIAGE_RECIPES).toHaveLength(9);
        expect(new Set(PROCEDURAL_FOLIAGE_RECIPES.map((recipe) => recipe.id)).size).toBe(9);
        expect(new Set(PROCEDURAL_FOLIAGE_RECIPES.map((recipe) => recipe.theme)).size).toBe(9);
        expect(new Set(PROCEDURAL_FOLIAGE_RECIPES.map((recipe) => recipe.region))).toEqual(
            new Set(['earth', 'water', 'fire', 'air'])
        );

        for (const recipe of PROCEDURAL_FOLIAGE_RECIPES) {
            const preview = createProceduralFoliagePreview(recipe.id);
            const meshes = preview.children.filter((child) => child.isMesh);
            const bounds = new THREE.Box3().setFromObject(preview);
            expect(preview.userData).toEqual(expect.objectContaining({
                proceduralFoliage: true,
                foliageId: recipe.id,
                region: recipe.region,
                theme: recipe.theme
            }));
            expect(meshes.length).toBeGreaterThanOrEqual(4);
            expect(bounds.min.y).toBeGreaterThanOrEqual(-0.35);
            expect(bounds.max.y).toBeGreaterThan(2);
            expect(meshes.every((mesh) => mesh.material.flatShading)).toBe(true);
            expect(meshes.every((mesh) => mesh.matrixWorld.elements.every(Number.isFinite))).toBe(true);
        }
    });

    test('placements are deterministic, bounded, and keep hazards and travel lanes readable', () => {
        for (const recipe of PROCEDURAL_FOLIAGE_RECIPES) {
            const first = createProceduralFoliagePlacements(recipe);
            const second = createProceduralFoliagePlacements(recipe);
            const [minX, maxX, minZ, maxZ] = recipe.bounds;
            expect(first).toEqual(second);
            expect(first).toHaveLength(recipe.count);
            for (const placement of first) {
                expect(placement.x).toBeGreaterThanOrEqual(minX);
                expect(placement.x).toBeLessThanOrEqual(maxX);
                expect(placement.z).toBeGreaterThanOrEqual(minZ);
                expect(placement.z).toBeLessThanOrEqual(maxZ);
                expect(placement.scale).toBeGreaterThanOrEqual(recipe.scale[0]);
                expect(placement.scale).toBeLessThanOrEqual(recipe.scale[1]);
                expect(isProceduralFoliagePlacementClear(recipe.region, placement.x, placement.z)).toBe(true);
                for (const [x, z, radius] of FOLIAGE_HAZARD_CLEARINGS[recipe.region]) {
                    expect(Math.hypot(placement.x - x, placement.z - z)).toBeGreaterThan(radius + 8);
                }
            }
        }
    });

    test('archetypes share immutable geometry and material resources without sharing preview transforms', () => {
        for (const recipe of PROCEDURAL_FOLIAGE_RECIPES) {
            const descriptors = getProceduralFoliageArchetype(recipe.id);
            expect(getProceduralFoliageArchetype(recipe.id)).toBe(descriptors);
            const first = createProceduralFoliagePreview(recipe.id);
            const second = createProceduralFoliagePreview(recipe.id);
            expect(first).not.toBe(second);
            expect(first.children[0]).not.toBe(second.children[0]);
            expect(first.children[0].geometry).toBe(second.children[0].geometry);
            expect(first.children[0].material).toBe(second.children[0].material);
        }

        expect(getProceduralFoliageCacheMetrics()).toEqual({
            geometries: 10,
            materials: 28,
            archetypes: 9
        });
    });

    test('every foliage clearing exactly tracks the authoritative server hazard anchors and radii', () => {
        const serverSlices = {
            earth: 'earthHazards',
            water: 'waterHazards',
            fire: 'fireHazards',
            air: 'airHazards'
        };
        for (const [region, sliceName] of Object.entries(serverSlices)) {
            expect(FOLIAGE_HAZARD_CLEARINGS[region]).toEqual(parseServerHazardAnchors(sliceName));
        }
        expect(Object.values(FOLIAGE_HAZARD_CLEARINGS).flat()).toHaveLength(65);
    });

    test('new realm dressing cannot introduce movement blockers outside the legacy forest', () => {
        expect(PROCEDURAL_FOLIAGE_RECIPES.filter((recipe) => recipe.collision).map((recipe) => recipe.region))
            .toEqual(['earth', 'earth', 'earth']);
    });

    test('unknown foliage ids fail loudly instead of becoming generic props', () => {
        expect(() => getProceduralFoliageArchetype('generic-tree')).toThrow('Unknown procedural foliage archetype');
        expect(() => createProceduralFoliagePreview('generic-tree')).toThrow('Unknown procedural foliage archetype');
    });
});
