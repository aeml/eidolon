import { jest } from '@jest/globals';
import * as THREE from 'three';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { createChronicleSiteModel, getChronicleSiteColliders } from '../src/art/ChronicleSiteModels.js';
import { ChronicleSite } from '../src/entities/ChronicleSite.js';
import { Actor } from '../src/entities/Actor.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { requestChronicleInspection } from '../src/core/ChronicleInspection.js';

const cases = chronicleInvestigations.flatMap(chapter => chapter.sites.filter(site => site.kind === 'inspect').map(site => ({ site, realm: chapter.realm })));

test.each(cases)('native discovery $site.model has finite geometry, picking identity and an open approach', ({ site, realm }) => {
    const model = createChronicleSiteModel(site, realm);
    const bounds = new THREE.Box3().setFromObject(model.mesh);
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.toArray().every(Number.isFinite)).toBe(true);
    expect(bounds.max.toArray().every(Number.isFinite)).toBe(true);
    expect(bounds.max.y).toBeLessThan(5);
    expect(model.beacon.visible).toBe(false);
    model.mesh.traverse(object => expect(object.userData.entityId).toBe(site.entityId));
    // A radius-one player can approach the evidence from the open front.
    for (let z = 5; z >= 0; z -= 0.25) {
        expect(model.walls.some(wall => wall.clone().expandByScalar(1).containsPoint(new THREE.Vector3(0, 0.5, z)))).toBe(false);
    }
    model.mesh.position.set(site.x, 0, site.z);
    const colliders = getChronicleSiteColliders(model.mesh, model.walls);
    for (const collider of colliders) {
        const restored = new THREE.Vector3(site.x, 0, site.z).applyMatrix4(collider.inverse);
        expect(restored.length()).toBeLessThan(0.0001);
    }
    model.dispose();
});

test('factory creates a noncombat landmark and chunk reload owns exactly its own colliders', async () => {
    const engine = Object.create(GameEngine.prototype);
    const site = engine.createRemotePlayer('NPC', cases[0].site.entityId, 'ChronicleSite');
    expect(site).toBeInstanceOf(ChronicleSite);
    expect(site).not.toBeInstanceOf(Actor);
    expect(engine.isInteractableEntity(site)).toBe(true);
    expect(engine.isHostileActorTarget(site)).toBe(false);
    const collisionManager = new CollisionManager();
    const canvasContext = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        measureText: text => ({ width: text.length * 16 }), strokeText: jest.fn(), fillText: jest.fn()
    });
    const quest = { id: site.discovery.chapter.id, accepted: true, investigationMask: 0 };
    site.gameEngine = { collisionManager, player: { quests: [quest] } };
    await site.ensureMesh();
    expect(collisionManager.orientedColliders).toHaveLength(3);
    expect(site.siteModel.beacon.visible).toBe(true);
    quest.investigationMask = 1;
    site.update();
    expect(site.siteModel.beacon.visible).toBe(false);
    const geometry = site.mesh.children.find(child => child.isMesh).geometry;
    const dispose = jest.spyOn(geometry, 'dispose');
    site.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(collisionManager.orientedColliders).toHaveLength(0);
    await site.ensureMesh();
    expect(collisionManager.orientedColliders).toHaveLength(3);
    expect(site.siteModel.beacon.visible).toBe(false);
    site.dispose();
    site.dispose();
    expect(collisionManager.orientedColliders).toHaveLength(0);
    canvasContext.mockRestore();
});

test.each(['valid', 'far', 'dead', 'dungeon', 'offline', 'removed', 'combat'])('ordinary inspection request is server-confirmed: %s', scenario => {
    const site = new ChronicleSite(cases[0].site.entityId);
    const engine = { player: { id: 'reader', position: new THREE.Vector3(0, 0, 4), state: 'IDLE' }, isMultiplayer: true, currentInstanceId: '', network: { send: jest.fn() } };
    if (scenario === 'far') engine.player.position.z = 5.01;
    if (scenario === 'dead') engine.player.state = 'DEAD';
    if (scenario === 'dungeon') engine.currentInstanceId = 'dungeon';
    if (scenario === 'offline') engine.isMultiplayer = false;
    if (scenario === 'removed') site.isActive = false;
    if (scenario === 'combat') site.type = 'MagmaGolem';
    expect(requestChronicleInspection(engine, site)).toBe(scenario === 'valid');
    expect(engine.network.send).toHaveBeenCalledTimes(scenario === 'valid' ? 1 : 0);
    if (scenario === 'valid') {
        expect(engine.network.send).toHaveBeenCalledWith('chronicle_inspect', { entityId: site.id });
        expect(engine.pendingChronicleInspection).toMatchObject({ entityId: site.id, playerId: 'reader', instanceId: '' });
        expect(engine.player.quests).toBeUndefined();
    }
});
