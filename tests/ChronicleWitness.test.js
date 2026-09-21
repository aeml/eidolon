import { jest } from '@jest/globals';
import * as THREE from 'three';
import fs from 'node:fs';
import { CHRONICLE_WITNESSES } from '../src/data/chronicleWitnesses.js';
import { DARK_REALM_WITNESSES } from '../src/data/darkRealmWitnesses.js';
import { darkRealmChapters } from '../src/data/chronicleCatalog.js';
import { CHRONICLE_RESTORATIONS } from '../src/core/ChronicleRestoration.js';
import { chronicleInvestigations } from '../src/data/chronicleInvestigations.generated.js';
import { getWitnessConversation } from '../src/ui/ChronicleWitnessConversation.js';
import { ChronicleWitness } from '../src/entities/ChronicleWitness.js';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { QuestUI } from '../src/ui/QuestUI.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';
import { Entity } from '../src/entities/Entity.js';

test.each([...CHRONICLE_WITNESSES, ...DARK_REALM_WITNESSES])('$name clicks its own conversation after borrowing a pooled service model', async witness => {
    const previousPool = MeshFactory.pool[witness.model];
    // Canvas text rendering is outside this geometry/interaction regression.
    const nameTags = jest.spyOn(Entity.prototype, 'updateNameTag').mockImplementation(() => {});
    MeshFactory.pool[witness.model] = [];
    const engine = Object.create(GameEngine.prototype);
    engine.player = { position: new THREE.Vector3(), state: 'IDLE' };
    engine.currentInstanceId = witness.instanceId || '';
    engine.uiManager = { quest: { openWitnessConversation: jest.fn(() => true) } };
    engine.inputManager = { raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2() };
    const camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
    camera.position.set(0, 1, 12); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
    engine.renderSystem = { camera, environmentGroup: new THREE.Group() };
    engine.refreshDungeonEntranceHint = jest.fn(); engine.refreshCombatIntentState = jest.fn();
    const residents = [];
    try {
        const original = engine.createRemotePlayer('NPC', `service-${witness.model}`, witness.model);
        residents.push(original);
        await original.ensureMesh();
        const reusedMesh = original.mesh;
        expect(reusedMesh.getObjectByName('ActorInteractionHitbox').userData.entityId).toBe(original.id);
        original.dispose();

        const npc = new ChronicleWitness(witness.id);
        residents.push(npc);
        await npc.ensureMesh();
        expect(npc.mesh).toBe(reusedMesh);
        npc.mesh.updateMatrixWorld(true);

        // The real service is present elsewhere in town, so a stale ID would
        // route the witness's hitbox to that service rather than just miss.
        const service = engine.createRemotePlayer('NPC', original.id, witness.model);
        residents.push(service);
        await service.ensureMesh();
        service.mesh.position.x = 20; service.mesh.updateMatrixWorld(true);
        engine.activeEntitiesCache = [service, npc];
        engine.performRaycast();
        expect(engine.hoveredEntity?.id).toBe(npc.id);
        expect(engine.hoveredEntity.interact(engine)).toBe(true);
        expect(engine.uiManager.quest.openWitnessConversation).toHaveBeenCalledWith(witness.id);

        // Re-entering town can return the same mesh to a service NPC again.
        npc.dispose();
        const returningService = engine.createRemotePlayer('NPC', 'returning-service', witness.model);
        residents.push(returningService);
        await returningService.ensureMesh();
        expect(returningService.mesh).toBe(reusedMesh);
        returningService.mesh.updateMatrixWorld(true);
        engine.activeEntitiesCache = [service, returningService];
        engine.performRaycast();
        expect(engine.hoveredEntity?.id).toBe(returningService.id);
    } finally {
        for (const resident of residents) if (resident.mesh) resident.dispose();
        MeshFactory.pool[witness.model] = previousPool;
        nameTags.mockRestore();
    }
});

test.each(DARK_REALM_WITNESSES)('$name stays in the expedition and unlocks only recorded discussion', witness => {
    const server = fs.readFileSync('server/internal/game/dark_realm.go', 'utf8');
    expect(server).toContain(`{"${witness.id}", "${witness.name}", ${witness.x}, ${witness.z}}`);
    const topic = witness.topics.find(topic => topic.requiresDiscovery);
    const chapter = darkRealmChapters.find(chapter => chapter.sites?.some(site => site.id === topic.requiresDiscovery));
    expect(chapter).toBeDefined();
    const index = chapter.sites.findIndex(site => site.id === topic.requiresDiscovery);
    const quests = [{ id: chapter.id, accepted: true, investigationMask: 1 << index }];
    const snapshot = JSON.stringify(quests);
    expect(getWitnessConversation(witness.id, []).topics).toHaveLength(1);
    expect(getWitnessConversation(witness.id, quests).topics).toHaveLength(2);
    expect(JSON.stringify(quests)).toBe(snapshot);
    const npc = new ChronicleWitness(witness.id);
    const open = jest.fn(() => true);
    const engine = { currentInstanceId: 'dark-realm', player: { state: 'IDLE', position: new THREE.Vector3(0, 0, 3) },
        uiManager: { quest: { openWitnessConversation: open } } };
    expect(npc.interact(engine)).toBe(true);
    for (const instance of ['', 'casino', 'dungeon-test']) {
        engine.currentInstanceId = instance;
        expect(npc.interact(engine)).toBe(false);
    }
    expect(open).toHaveBeenCalledTimes(1);
});

test.each(CHRONICLE_WITNESSES)('$name has a shared neutral identity and spoiler-gated dialogue without changing quests', witness => {
    const server = fs.readFileSync('server/internal/game/chronicle_witnesses.go', 'utf8');
    expect(server).toContain(`{"${witness.id}", "${witness.name}", ${witness.x}}`);
    expect(server).toContain(`Z: ${witness.z}`);
    expect(Math.hypot(witness.x, witness.z - 200)).toBeLessThan(50);
    expect(getWitnessConversation(witness.id, []).topics).toHaveLength(1);
    const quests = chronicleInvestigations.filter(chapter => chapter.realm === witness.realm)
        .map(chapter => ({ id: chapter.id, accepted: true, investigationMask: (1 << chapter.sites.length) - 1 }));
    const snapshot = JSON.stringify(quests);
    expect(getWitnessConversation(witness.id, quests).topics).toHaveLength(3);
    expect(JSON.stringify(quests)).toBe(snapshot);
    const receipt = { id: CHRONICLE_RESTORATIONS[witness.realm].questId, count: 1, maxCount: 1 };
    expect(getWitnessConversation(witness.id, [...quests, receipt]).topics).toHaveLength(3);
    receipt.completed = true;
    expect(getWitnessConversation(witness.id, [...quests, receipt]).topics).toHaveLength(4);
    const npc = GameEngine.prototype.createRemotePlayer.call({}, 'NPC', witness.id, 'ChronicleWitness');
    expect(npc).toBeInstanceOf(ChronicleWitness);
    expect(npc).not.toBeInstanceOf(Actor);
    expect(GameEngine.prototype.isInteractableEntity(npc)).toBe(true);
});

test.each(['near', 'far', 'dead', 'instance', 'removed', 'nonfinite'])('physical witness conversation guards: %s', scenario => {
    const npc = new ChronicleWitness(CHRONICLE_WITNESSES[0].id);
    const open = jest.fn(() => true);
    const engine = { player: { position: new THREE.Vector3(0, 0, 4), state: 'IDLE' }, uiManager: { quest: { openWitnessConversation: open } } };
    if (scenario === 'far') engine.player.position.z = 6;
    if (scenario === 'dead') engine.player.state = 'DEAD';
    if (scenario === 'instance') engine.currentInstanceId = 'dungeon';
    if (scenario === 'removed') npc.isActive = false;
    if (scenario === 'nonfinite') engine.player.position.z = NaN;
    expect(npc.interact(engine)).toBe(scenario === 'near');
    expect(open).toHaveBeenCalledTimes(scenario === 'near' ? 1 : 0);
});

test('witness reading survives quest refresh, never offers quest actions, and closes on character change', () => {
    document.body.innerHTML = '<div id="quest-window" style="display:none"><div class="window-header"><span></span></div><div id="quest-list"></div></div>';
    let player = { id: 'reader', state: 'IDLE', quests: [] };
    const ui = new QuestUI({ getLastPlayer: () => player });
    ui.onAcceptQuest = jest.fn(); ui.onCompleteQuest = jest.fn(); ui.onRequestQuests = jest.fn();
    expect(ui.openWitnessConversation(CHRONICLE_WITNESSES[0].id)).toBe(true);
    const topic = ui.questList.querySelector('details');
    topic.open = true;
    ui.updateQuestWindow([]);
    expect(ui.questList.querySelector('details')).toBe(topic);
    expect(topic.open).toBe(true);
    expect(ui.questList.querySelector('[data-quest-action]')).toBeNull();
    expect(ui.onAcceptQuest).not.toHaveBeenCalled();
    expect(ui.onCompleteQuest).not.toHaveBeenCalled();
    expect(ui.onRequestQuests).not.toHaveBeenCalled();
    player = { ...player, id: 'another-reader' };
    ui.updateQuestWindow([]);
    expect(ui.isQuestWindowOpen).toBe(false);
    expect(ui.questList.childElementCount).toBe(0);
    ui.openWitnessConversation(CHRONICLE_WITNESSES[0].id);
    ui.toggleQuestWindow('story');
    expect(ui.witnessId).toBeNull();
    expect(document.querySelector('.window-header span').textContent).toContain('ILYRA');
});
