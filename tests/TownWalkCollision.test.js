import * as THREE from 'three';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { createProceduralLanternholdStructure, getLanternholdWalkCollider } from '../src/art/ProceduralLanternholdArchitecture.js';
import { Forge } from '../src/entities/Forge.js';
import { installGameEngineMovement } from '../src/core/GameEngineMovement.js';
import { WorldGenerator } from '../src/world/WorldGenerator.js';
import { installGameEngineEntitySync } from '../src/core/GameEngineEntitySync.js';

class InteractionFixture { isHostileActorTarget() { return false; } }
installGameEngineMovement(InteractionFixture);
installGameEngineEntitySync(InteractionFixture);

describe('current town building footprints', () => {
    test('entity synchronization preserves authoritative stash placement', () => {
        const stash = { id: 'stash-1', x: -16, y: 0.5, z: 193 };
        new InteractionFixture().applyPositionHacks(stash);
        expect(stash).toEqual({ id: 'stash-1', x: -16, y: 0.5, z: 193 });
    });
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

    test('the full generated town leaves the stash outside buildings with a clear interaction path', async () => {
        const manager = new CollisionManager();
        const scene = new THREE.Scene();
        await new WorldGenerator(scene, manager).loadBuildings(0, 200);
        expect(scene.children.some(mesh => mesh.userData.structureId === 'blacksmith')).toBe(true);
        // The former coffer centre and proposed front were inside the smithy.
        expect(manager.checkCollision(new THREE.Vector3(-28, 0, 193), 1.25)).not.toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(-28, 0, 196), 1.25)).not.toBeNull();
        const trading = createProceduralLanternholdStructure('trading_house');
        trading.position.set(-22, .5, 185); trading.rotation.y = Math.PI / 4;
        manager.addOrientedCollider(getLanternholdWalkCollider(trading));
        // A circle enclosing the entire coffer footprint fits between buildings.
        expect(manager.checkCollision(new THREE.Vector3(-16, 0, 193), 2.2)).toBeNull();
        const stash = createProceduralLanternholdStructure('stash');
        stash.position.set(-16, 0.5, 193);
        manager.addOrientedCollider(getLanternholdWalkCollider(stash));
        expect(manager.checkCollision(new THREE.Vector3(0, 0, 180.5), 0.5)).toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(-16, 0, 193), 1.25)).not.toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(-16, 0, 197), 1.25)).toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(-10, 0, 193), 1.25)).toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(-8, 0, 185), 1.25)).toBeNull();
        expect(manager.checkCollision(new THREE.Vector3(-4, 0, 185), 1.25)).toBeNull();
        manager.addCircularCollider(-20, 200, 1.25);
        const path = (from, to) => Array.from({ length: 101 }, (_, i) =>
            new THREE.Vector3(...from).lerp(new THREE.Vector3(...to), i / 100));
        const approach = [-12, 0, 195];
        expect(Math.hypot(approach[0] + 16, approach[2] - 193)).toBeLessThan(5);
        for (const start of [[-1.25, 0, 200], [-8, 0, 197]]) for (const p of path(start, approach)) {
            expect(manager.checkCollision(p, 1.25)).toBeNull();
        }
    });
});
