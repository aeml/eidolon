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
    expect(generator.createRealmPerimeters({ shouldAttach: () => false })).toBe(false);
    expect(scene.children).toHaveLength(0);
    expect(collision.addCollider).not.toHaveBeenCalled();
});

test('all four realm perimeters own the authoritative walls once and keep shared gates open', () => {
    const scene = new Scene(), collision = { addCollider: jest.fn() };
    const generator = new WorldGenerator(scene, collision);
    try {
        expect(generator.createRealmPerimeters()).toBe(true);
        const count = collision.addCollider.mock.calls.length;
        for (const id of ['earth', 'water', 'fire', 'air']) {
            const name = `${id[0].toUpperCase()}${id.slice(1)}Fence`;
            const root = scene.getObjectByName(name);
            expect(root).toBeDefined();
            expect(root.userData.fenceSegments).toEqual(getRegionFencePosts(WORLD_REGIONS[id]).map(post => post.slice(0, 3)));
            expect(root.children.every(mesh => mesh.isBatchedMesh)).toBe(true);
            expect(root.children.map(mesh => mesh.material.name)).toContain('lanternhold-perimeter:timber');
            for (const [x, z, rotation] of getRegionFencePosts(WORLD_REGIONS[id])) {
                expect(ownsPerimeterFence(root, { x, z, rotation })).toBe(true);
            }
        }
        expect(generator.createRealmPerimeters()).toBe(true);
        expect(scene.children).toHaveLength(4);
        expect(collision.addCollider).toHaveBeenCalledTimes(count);
        for (const [x, z] of [[0, -600], [-1000, 200], [1000, 200]]) {
            expect(collision.addCollider.mock.calls.some(([box]) => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z)).toBe(false);
        }
    } finally { scene.traverse(mesh => { mesh.dispose?.(); mesh.geometry?.dispose(); mesh.material?.dispose(); }); }
});
