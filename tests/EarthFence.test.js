import { WORLD_REGIONS, WORLD_GEOGRAPHY, getRegionFencePosts } from '../src/data/worldGeography.js';
import { createLanternholdPerimeter, ownsPerimeterFence } from '../src/art/LanternholdPerimeter.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { Scene } from 'three';
import { jest } from '@jest/globals';

test('Earth perimeter models match authoritative post identities and leave every gate open', () => {
    const region = WORLD_REGIONS.earth, posts = getRegionFencePosts(region);
    expect(new Set(posts.map(([x, z]) => `${x}:${z}`)).size).toBe(posts.length);
    expect(WORLD_GEOGRAPHY.fenceStep).toBe(4);
    const root = createLanternholdPerimeter(0, 200, 2000, 1600, { segments: posts, name: 'EarthFence' });
    try {
        expect(root.name).toBe('EarthFence');
        expect(root.userData.walkColliders).toHaveLength(posts.length);
        expect(root.children).toHaveLength(3);
        expect(root.userData.gatePosts).toBe(6);
        for (const [x, z, rotation] of posts) expect(ownsPerimeterFence(root, { x, z, rotation })).toBe(true);
        for (const [x, z] of [[0, -600], [-1000, 200], [1000, 200]]) {
            expect(ownsPerimeterFence(root, { x, z })).toBe(false);
            expect(root.userData.walkColliders.some(box => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z)).toBe(false);
        }
        expect(root.children.every(mesh => mesh.isBatchedMesh && mesh.castShadow && mesh.receiveShadow)).toBe(true);
        expect(root.children.map(mesh => mesh.material.name).sort()).toEqual([
            'lanternhold-perimeter:amber', 'lanternhold-perimeter:iron', 'lanternhold-perimeter:timber'
        ]);
    } finally {
        root.traverse(mesh => { mesh.dispose?.(); mesh.geometry?.dispose(); mesh.material?.dispose(); });
    }
});

test('retired overworld construction does not attach the new perimeter', () => {
    const scene = new Scene(), collision = { addCollider: jest.fn() };
    const generator = new WorldGenerator(scene, collision);
    expect(generator.createEarthPerimeter({ shouldAttach: () => false })).toBe(false);
    expect(scene.children).toHaveLength(0);
    expect(collision.addCollider).not.toHaveBeenCalled();
});
