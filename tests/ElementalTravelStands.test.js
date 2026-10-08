import * as THREE from 'three';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../src/data/worldFoliage.js';
import { WATER_PATHS, FIRE_PATHS, AIR_PATHS } from '../src/data/elementalPopulation.js';
import { distanceToPath } from '../src/data/worldPopulation.js';
import { getProceduralFoliageArchetype } from '../src/art/ProceduralRealmFoliage.js';

test.each([['water', WATER_PATHS], ['fire', FIRE_PATHS], ['air', AIR_PATHS]])(
    '%s retained population forms bounded travel stands with unchanged individual scale/rotation', (realm, paths) => {
        const trees = [];
        for (const recipe of PROCEDURAL_FOLIAGE_RECIPES.filter(recipe => recipe.region === realm)) {
            const original = createProceduralFoliagePlacements({ ...recipe });
            const composed = createProceduralFoliagePlacements(recipe);
            expect(composed).toHaveLength(recipe.count);
            expect(createProceduralFoliagePlacements(recipe)).toBe(composed);
            expect(Object.isFrozen(composed)).toBe(true);
            expect(recipe.collision).toBeNull();
            composed.forEach((tree, index) => {
                expect(tree.scale).toBe(original[index].scale);
                expect(tree.rotation).toBe(original[index].rotation);
                expect(Object.isFrozen(tree)).toBe(true);
            });
            trees.push(...composed);
            const point = new THREE.Vector3();
            for (const part of getProceduralFoliageArchetype(recipe.id)) {
                const positions = part.geometry.attributes.position;
                for (let index = 0; index < positions.count; index++) {
                    point.fromBufferAttribute(positions, index).applyMatrix4(part.matrix);
                    expect(Math.hypot(point.x, point.z) * recipe.scale[1]).toBeLessThan(8);
                }
            }
        }
        for (let index = 0; index < trees.length; index++) {
            for (let other = index + 1; other < trees.length; other++) {
                expect(Math.hypot(trees[index].x - trees[other].x, trees[index].z - trees[other].z)).toBeGreaterThanOrEqual(7);
            }
        }
        expect(trees.filter(tree => Math.min(...paths.map(path => distanceToPath(tree.x, tree.z, path.points))) < 32).length)
            .toBeGreaterThanOrEqual(Math.floor(trees.length * .75));
    });
