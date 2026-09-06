import { jest } from '@jest/globals';
import * as THREE from 'three';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: { decode: jest.fn() }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');
const { Actor } = await import('../src/entities/Actor.js');
const { Fighter } = await import('../src/entities/Fighter.js');
const { LootDrop } = await import('../src/entities/LootDrop.js');

const actorConfig = {
    STATS: {
        STRENGTH: 10,
        INTELLIGENCE: 10,
        DEXTERITY: 10,
        WISDOM: 10,
        STAMINA: 10
    },
    MANA_STAT: 'INTELLIGENCE'
};

describe('GameEngine raycast target priority', () => {
    test.each([false, true])('live enemies remain selectable through overlapping loot (mobile=%s)', mobile => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = new Fighter('overlap-player');
        engine.isMobile = mobile;
        engine.uiManager = { isEscMenuOpen: false, isPatchNotesOpen: false, reportScreen: { style: { display: 'none' } } };
        const enemy = new Actor('overlap-enemy', actorConfig);
        enemy.state = 'IDLE'; enemy.isActive = true;
        const loot = Object.assign(Object.create(LootDrop.prototype), { id: 'overlap-loot', isActive: true });
        for (const entity of [enemy, loot]) {
            entity.mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), new THREE.MeshBasicMaterial());
            entity.mesh.userData.entityId = entity.id;
        }
        // The loot is nearer the camera, but both silhouettes cover this click.
        loot.mesh.position.z = 1;
        enemy.mesh.updateMatrixWorld(true); loot.mesh.updateMatrixWorld(true);
        const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
        camera.position.z = 12; camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        engine.renderSystem = { camera, environmentGroup: new THREE.Group() };
        engine.inputManager = { raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(), keys: {} };
        engine.activeEntitiesCache = [loot, enemy];
        engine.refreshDungeonEntranceHint = jest.fn(); engine.refreshCombatIntentState = jest.fn();
        engine.moveToAndInteract = jest.fn(); engine.setMobileCombatTarget = jest.fn();
        engine.getMobileCombatTarget = () => null;
        engine.handlePrimaryClick({});
        expect(engine.raycastHitEntities).toEqual([enemy, loot]);
        expect(engine.hoveredEntity).toBe(enemy);
        if (mobile) {
            expect(engine.setMobileCombatTarget).toHaveBeenLastCalledWith(enemy);
            expect(engine.moveToAndInteract).not.toHaveBeenCalled();
        } else expect(engine.moveToAndInteract).toHaveBeenLastCalledWith(enemy);
        // Once the target is dead, the same click can still collect the item.
        enemy.state = 'DEAD'; engine.handlePrimaryClick({});
        expect(engine.hoveredEntity).toBe(loot);
        expect(engine.moveToAndInteract).toHaveBeenLastCalledWith(loot);
        for (const entity of [enemy, loot]) { entity.mesh.geometry.dispose(); entity.mesh.material.dispose(); }
    });
    test('canvas pointer movement raycasts immediately from one coherent input sample', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.mousePosition = new THREE.Vector2();
        engine.inputManager = { pointerOverCanvas: true };
        engine.needsRaycast = true;
        engine.raycastTimer = 0.06;
        engine.performRaycast = jest.fn();

        expect(engine.handlePointerRaycast(new THREE.Vector2(0.25, -0.5))).toBe(true);
        expect(engine.mousePosition.toArray()).toEqual([0.25, -0.5]);
        expect(engine.performRaycast).toHaveBeenCalledTimes(1);
        expect(engine.needsRaycast).toBe(false);
        expect(engine.raycastTimer).toBe(0);
    });

    test('pointer movement over UI does not raycast through the interface', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.mousePosition = new THREE.Vector2();
        engine.inputManager = { pointerOverCanvas: false };
        engine.needsRaycast = true;
        engine.raycastTimer = 0.06;
        engine.performRaycast = jest.fn();

        expect(engine.handlePointerRaycast(new THREE.Vector2(-0.4, 0.2))).toBe(false);
        expect(engine.performRaycast).not.toHaveBeenCalled();
        expect(engine.needsRaycast).toBe(false);
    });

    test('rapid canvas pointer samples remain deferred inside the hover budget', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.mousePosition = new THREE.Vector2();
        engine.inputManager = { pointerOverCanvas: true };
        engine.needsRaycast = false;
        engine.raycastTimer = 0.04;
        engine.performRaycast = jest.fn();

        expect(engine.handlePointerRaycast(new THREE.Vector2(0.1, 0.3))).toBe(false);
        expect(engine.performRaycast).not.toHaveBeenCalled();
        expect(engine.needsRaycast).toBe(true);
        expect(engine.raycastTimer).toBe(0.04);
    });

    test('a friendly player hitbox cannot intercept a hostile behind it', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = new Fighter('local-player');

        const partyMember = new Fighter('party-member');
        partyMember.isActive = true;
        partyMember.state = 'IDLE';

        const hostile = new Actor('hostile', actorConfig);
        hostile.isActive = true;
        hostile.state = 'ATTACKING';

        expect(engine.sortRaycastEntities([partyMember, hostile, partyMember])).toEqual([
            hostile,
            partyMember
        ]);
    });

    test('actor raycasts use the lightweight interaction proxy instead of the animated rig', () => {
        const engine = Object.create(GameEngine.prototype);
        const hostile = new Actor('hostile-proxy', actorConfig);
        const mesh = new THREE.Group();
        mesh.userData.bounds = { radius: 1.4, height: 3.2 };
        mesh.add(new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial()
        ));
        hostile.setMesh(mesh);

        const hitbox = mesh.getObjectByName('ActorInteractionHitbox');
        expect(hitbox).toBeTruthy();
        expect(engine.getRaycastMeshForEntity(hostile)).toBe(hitbox);
        expect(engine.getRaycastMeshForEntity({ mesh })).toBe(hitbox);
        expect(engine.getRaycastMeshForEntity({})).toBeNull();
    });
});
