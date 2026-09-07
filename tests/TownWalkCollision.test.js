import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { createProceduralLanternholdStructure, getLanternholdWalkCollider } from '../src/art/ProceduralLanternholdArchitecture.js';
import { Forge } from '../src/entities/Forge.js';
import { installGameEngineMovement } from '../src/core/GameEngineMovement.js';

class InteractionFixture {}
installGameEngineMovement(InteractionFixture);

describe('current town building footprints', () => {
    test.each([false, true])('forge hearth blocks walking but leaves its interaction edge reachable by a full-size hero (batched %s)', optimized => {
        const forge = createProceduralLanternholdStructure('forge', { optimized });
        forge.position.set(-28, 0.5, 218);
        forge.rotation.y = Math.PI / 2;
        const shape = getLanternholdWalkCollider(forge);
        expect(shape).not.toBeNull();
        const manager = new CollisionManager();
        manager.addOrientedCollider(shape);
        const range = new InteractionFixture().getInteractionRangeForEntity(Object.create(Forge.prototype));
        for (const [x, z] of [[0, 4.5], [0, -4.5], [4.5, 0], [-4.5, 0]]) {
            const approach = new THREE.Vector3(x, 0, z).applyMatrix4(shape.matrix);
            expect(Math.hypot(approach.x + 28, approach.z - 218)).toBeLessThan(range);
            expect(manager.checkCollision(approach, 1.25)).toBeNull();
        }
        expect(manager.checkCollision(new THREE.Vector3(-28, 0, 218), 1.25)).not.toBeNull();
    });

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
