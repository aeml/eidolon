import { jest } from '@jest/globals';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { WORLD_LOCATIONS, RESONANCE_PORTAL, PORTAL_DIRECTIONS } from '../src/data/worldLocations.js';
import { CHRONICLE_RESTORATIONS } from '../src/core/ChronicleRestoration.js';
import { getResonancePortalState } from '../src/core/ResonancePortalState.js';
import { ResonancePortal } from '../src/entities/ResonancePortal.js';
import { Entity } from '../src/entities/Entity.js';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { TOWN_SERVICE_POINTS } from '../src/ui/townServiceConfig.js';
import { createLanternholdCampPlacements } from '../src/art/ProceduralLanternholdArchitecture.js';
import { getIlyraCompletionReply } from '../src/ui/QuestConversation.js';

const repaired = () => Object.values(CHRONICLE_RESTORATIONS).map(({ questId }) => ({ id: questId, completed: true }));

test('canonical registry drives client locations, map and Ilyra directions', () => {
    expect(WORLD_LOCATIONS).toEqual(JSON.parse(fs.readFileSync('server/internal/game/content/world-locations.json')));
    execFileSync(process.execPath, ['scripts/generate-world-locations.mjs', '--check']);
    for (const location of WORLD_LOCATIONS) {
        expect(TOWN_SERVICE_POINTS.find(point => point.id === location.id)).toMatchObject({ x: location.x, z: location.z });
    }
    expect(getIlyraCompletionReply({ id: 'chronicle_13_skyglass_raid' })).toContain(PORTAL_DIRECTIONS);
    // The entire eight-metre plaza stays clear of all actual deterministic camps.
    for (const camp of createLanternholdCampPlacements(0, 200)) {
        expect(Math.hypot(camp.x - RESONANCE_PORTAL.x, camp.z - RESONANCE_PORTAL.z)).toBeGreaterThan(13);
    }
});

test('personal locked, ready and active states require claims and preserve veteran access', () => {
    const player = { level: 100, quests: repaired() };
    expect(getResonancePortalState(player).stage).toBe('active');
    player.level = 99;
    expect(getResonancePortalState(player).stage).toBe('ready');
    player.level = 100;
    for (const quest of player.quests) {
        quest.completed = false; quest.accepted = true; quest.count = 1;
        expect(getResonancePortalState(player).stage).toBe('locked');
        quest.completed = true;
    }
    for (const id of ['chronicle_14_resonance_gate', 'chronicle_15_dark_king']) {
        for (const flag of ['accepted', 'completed']) {
            expect(getResonancePortalState({ level: 100, quests: [{ id, [flag]: true }] }).eligible).toBe(true);
            expect(getResonancePortalState({ level: 99, quests: [{ id, [flag]: true }] }).eligible).toBe(false);
        }
    }
    expect(getResonancePortalState(null).eligible).toBe(false);
});

test('portal is an interactable landmark, not an attack target; geometry and colliders clean up on re-entry', async () => {
    const tags = jest.spyOn(Entity.prototype, 'updateNameTag').mockImplementation(() => {});
    try {
        const engine = Object.create(GameEngine.prototype);
        engine.player = { level: 100, quests: repaired(), position: new THREE.Vector3(28, 0, 237), state: 'IDLE' };
        engine.collisionManager = new CollisionManager();
        engine.currentInstanceId = '';
        const portal = engine.createRemotePlayer('NPC', RESONANCE_PORTAL.entityId, 'ResonancePortal');
        portal.position.set(RESONANCE_PORTAL.x, 0, RESONANCE_PORTAL.z); portal.gameEngine = engine;
        expect(portal).toBeInstanceOf(ResonancePortal);
        expect(portal).not.toBeInstanceOf(Actor);
        expect(engine.isInteractableEntity(portal)).toBe(true);
        expect(engine.getInteractionRangeForEntity(portal)).toBe(9);
        engine.player.position.set(28, 0, 244);
        expect(portal.canInteract(engine)).toBe(true);
        engine.player.position.z = 244.01;
        expect(portal.canInteract(engine)).toBe(false);
        engine.player.position.set(28, 0, 237);
        for (let visit = 0; visit < 2; visit++) {
            await portal.ensureMesh();
            expect(engine.collisionManager.orientedColliders).toHaveLength(6);
            expect(portal.mesh.userData.portalStage).toBe('active');
            expect(portal.portalModel.crystals.every(crystal => crystal.ray.visible)).toBe(true);
            // A hero-sized capsule has an open path through the central arch.
            for (const collider of engine.collisionManager.orientedColliders) {
                expect(collider.box.intersectsBox(new THREE.Box3(new THREE.Vector3(-1.25, 0, -8), new THREE.Vector3(1.25, 3, 8)))).toBe(false);
            }
            expect(portal.canInteract(engine)).toBe(true);
            const camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
            camera.position.set(28, 4.2, 250); camera.lookAt(28, 4.2, 235); camera.updateMatrixWorld(true);
            engine.inputManager = { raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2() };
            engine.renderSystem = { camera, environmentGroup: new THREE.Group() };
            engine.activeEntitiesCache = [portal];
            engine.refreshDungeonEntranceHint = jest.fn(); engine.refreshCombatIntentState = jest.fn();
            engine.performRaycast();
            expect(engine.hoveredEntity).toBe(portal);
            engine.currentInstanceId = 'other'; expect(portal.canInteract(engine)).toBe(false);
            engine.currentInstanceId = '';
            portal.dispose(); expect(engine.collisionManager.orientedColliders).toHaveLength(0);
        }
    } finally { tags.mockRestore(); }
});
