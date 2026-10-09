import * as THREE from 'three';
import { PROCEDURAL_FOLIAGE_RECIPES, createProceduralFoliagePlacements } from '../src/data/worldFoliage.js';
import { WATER_PATHS, FIRE_PATHS, AIR_PATHS, AIR_LOCATIONS } from '../src/data/elementalPopulation.js';
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

test('the ordinary Air passage has visible cypress framing between intentional site clearings', () => {
    const trees = createProceduralFoliagePlacements(PROCEDURAL_FOLIAGE_RECIPES.find(recipe => recipe.id === 'gale_cypress'));
    const passage = AIR_PATHS.find(path => path.id === 'air-passage');
    const samples = [];
    for (let segment = 1; segment < passage.points.length; segment++) {
        const [ax, az] = passage.points[segment - 1], [bx, bz] = passage.points[segment];
        const length = Math.hypot(bx - ax, bz - az);
        for (let distance = 0; distance < length; distance += 20) {
            const x = ax + (bx - ax) * distance / length, z = az + (bz - az) * distance / length;
            // Landmarks deliberately retain open approach space. Check actual
            // travel intervals, not the sites or the realm gateway boundary.
            if (x < 1050 || Math.hypot(x - 2400, z - 200) < 80 ||
                AIR_LOCATIONS.some(site => Math.hypot(x - site.x, z - site.z) < site.radius + 12)) continue;
            samples.push({ x, z, nearest: Math.min(...trees.map(tree => Math.hypot(tree.x - x, tree.z - z))) });
        }
    }
    expect(samples).toHaveLength(66);
    expect(Math.max(...samples.map(sample => sample.nearest))).toBeLessThan(55);
    expect(Math.min(...trees.map(tree => Math.hypot(tree.x - 1710, tree.z - 130)))).toBeLessThan(35);
});
