import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { createProceduralLanternholdStructure, getLanternholdWalkCollider } from '../src/art/ProceduralLanternholdArchitecture.js';

describe('current town building footprints', () => {
    test.each([false, true])('rotated trading hall uses its walls, not roof/AABB/name extents (batched %s)', (optimized) => {
        const mesh = createProceduralLanternholdStructure('trading_house', { optimized });
        mesh.position.set(-22, 0.5, 185);
        mesh.rotation.y = Math.PI / 4;
        const collision = new CollisionManager();
        const shape = getLanternholdWalkCollider(mesh);
        collision.addOrientedCollider(shape);
        expect(collision.checkCollision(new THREE.Vector3(-14, 0, 193), 0.5)).toBeNull();
        const wall = new THREE.Vector3(6.2, 0, 0).applyMatrix4(shape.matrix);
        const old = new THREE.Vector3(8, 0, 0).applyMatrix4(shape.matrix);
        const corrected = collision.checkCollision(wall, 0.5, old);
        expect(corrected).not.toBeNull();
        expect(corrected.clone().applyMatrix4(shape.inverse).x).toBeCloseTo(6.175 + 0.5);
        collision.removeOrientedCollider(shape);
        expect(collision.checkCollision(wall, 0.5)).toBeNull();
        collision.addOrientedCollider(shape);
        collision.clear();
        expect(collision.orientedColliders).toHaveLength(0);
    });

    test('stash building approach is clear while masonry and coffer still block walking', () => {
        const manager = new CollisionManager();
        const hall = createProceduralLanternholdStructure('oathhall');
        hall.position.set(0, -0.5, 170);
        manager.addOrientedCollider(getLanternholdWalkCollider(hall));
        const stash = createProceduralLanternholdStructure('stash');
        stash.position.set(0, 0.5, 185);
        manager.addOrientedCollider(getLanternholdWalkCollider(stash));
        expect(manager.checkCollision(new THREE.Vector3(0, 0, 180.5), 0.5)).toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(0, 0, 177.5), 0.5)).not.toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(0, 0, 185), 0.5)).not.toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(2.5, 0, 185), 0.5)).toBeNull();
    });
});
