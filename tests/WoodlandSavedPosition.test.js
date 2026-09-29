import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';

test('ordinary movement escapes saved positions inside every relocated trunk without a town teleport', async () => {
    const scene = new THREE.Group(), collision = new CollisionManager();
    const world = new WorldGenerator(scene, collision);
    await world.loadTrees(0, 200);
    const trunks = collision.colliders.slice();
    expect(trunks).toHaveLength(391);
    // Include surrounding scenery so an escape cannot silently enter another
    // structure. No production save or login is rewritten by this check.
    await world.loadBuildings(0, 200);
    const actor = new Actor('saved-position-review', {});
    actor.radius = 1.25; actor.isMultiplayer = true;
    const sphere = new THREE.Sphere(), center = new THREE.Vector3();
    let samples = 0;
    for (const trunk of trunks) {
        trunk.getCenter(center); center.y = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            actor.position.copy(center);
            actor.move(center.clone().add(new THREE.Vector3(dx * 5, 0, dz * 5)));
            actor.update(1 / 60, collision, null, null);
            sphere.set(actor.position, actor.radius - .001);
            expect(collision.colliders.some(box => box.intersectsSphere(sphere))).toBe(false);
            expect(actor.position.distanceTo(center)).toBeLessThan(4);
            const escaped = actor.position.clone();
            for (let frame = 0; frame < 10; frame++) actor.update(1 / 60, collision, null, null);
            expect(actor.position.distanceTo(escaped)).toBeGreaterThan(.1);
            samples++;
        }
    }
    expect(samples).toBe(1564);
    actor.dispose();
});
