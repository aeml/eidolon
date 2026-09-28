import { jest } from '@jest/globals';
import * as THREE from 'three';
import { WORLD_READINGS } from '../src/data/worldPopulation.js';
import { WorldReading } from '../src/entities/WorldReading.js';
import { Entity } from '../src/entities/Entity.js';
import { Actor } from '../src/entities/Actor.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { requestNearbyChronicleInspection } from '../src/core/ChronicleInspection.js';

beforeEach(() => {
    document.body.replaceChildren();
    jest.spyOn(Entity.prototype, 'updateNameTag').mockImplementation(() => {});
    HTMLDialogElement.prototype.showModal = function() { this.open = true; };
});
afterEach(() => { jest.restoreAllMocks(); document.body.replaceChildren(); });

function setup(site = WORLD_READINGS[0]) {
    const engine = Object.create(GameEngine.prototype);
    engine.currentInstanceId = ''; engine.currentInstanceType = 'overworld'; engine.isMultiplayer = true;
    engine.player = { id: 'reader', position: new THREE.Vector3(site.x, 0, site.z + 4), state: 'MOVING', targetPosition: {}, playAnimation: jest.fn(), quests: [] };
    engine.inputManager = { clearInputState: jest.fn() }; engine.clearCombatIntentState = jest.fn();
    engine.network = { send: jest.fn() };
    const entity = engine.createRemotePlayer('NPC', site.id, 'WorldReading');
    entity.position.set(site.x, 0, site.z); entity.gameEngine = engine;
    engine.chunkManager = { getActiveEntities: () => [entity] };
    return { engine, entity };
}

test.each(WORLD_READINGS)('$name is a streamed, noncombat reading with no quest or network side effects', async site => {
    const { engine, entity } = setup(site);
    expect(entity).toBeInstanceOf(WorldReading); expect(entity).not.toBeInstanceOf(Actor);
    expect(engine.isInteractableEntity(entity)).toBe(true);
    expect(engine.getInteractionRangeForEntity(entity)).toBe(5);
    await entity.ensureMesh();
    expect(entity.mesh.children).toHaveLength(1);
    expect(entity.mesh.children[0].userData.entityId).toBe(site.id);
    expect(requestNearbyChronicleInspection(engine)).toBe(true);
    expect(engine.inputManager.clearInputState).toHaveBeenCalled();
    expect(engine.clearCombatIntentState).toHaveBeenCalled();
    expect(engine.player.targetPosition).toBeNull(); expect(engine.player.state).toBe('IDLE');
    const dialog = document.querySelector('dialog');
    expect(dialog.open).toBe(true);
    for (const text of site.reading.paragraphs) expect(dialog.textContent).toContain(text);
    expect(dialog.textContent).toContain('not a safe zone');
    expect(engine.network.send).not.toHaveBeenCalled(); expect(engine.player.quests).toEqual([]);
    dialog.querySelector('button').click(); expect(document.querySelector('dialog')).toBeNull();
    entity.dispose();
});

test('reading requires the actual living owner in overworld range, and closes on state/context changes', () => {
    const { engine, entity } = setup();
    engine.player.position.z = entity.position.z + 5.01;
    expect(entity.interact(engine)).toBe(false);
    engine.player.position.z = entity.position.z + 5;
    for (const [key, value] of [['currentInstanceId', 'private-1'], ['currentInstanceType', 'casino']]) {
        const original = engine[key]; engine[key] = value;
        expect(entity.interact(engine)).toBe(false); engine[key] = original;
    }
    for (const change of [() => { engine.player.id = 'another'; }, () => { engine.player.state = 'DEAD'; },
        () => { engine.currentInstanceId = 'private-1'; }, () => { engine.player.position.z += 6; }]) {
        engine.player.id = 'reader'; engine.player.state = 'IDLE'; engine.currentInstanceId = '';
        engine.player.position.z = entity.position.z + 4;
        expect(entity.interact(engine)).toBe(true); change(); entity.update();
        expect(document.querySelector('dialog')).toBeNull();
    }
});

test('mobile USE selects the nearby lore object through the normal interaction path', () => {
    const { engine, entity } = setup(); engine.isMobile = true;
    engine.moveToAndInteract = jest.fn();
    expect(engine.interactWithNearbyEntity()).toBe(true);
    expect(engine.moveToAndInteract).toHaveBeenCalledWith(entity);
    expect(engine.isHostileActorTarget(entity)).toBe(false);
});

test('reading contains keyboard/pointer input, restores focus and releases owned meshes on unload/reload', async () => {
    const { engine, entity } = setup();
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    const escaped = jest.fn(); document.body.addEventListener('keydown', escaped);
    for (let visit = 0; visit < 2; visit++) {
        await entity.ensureMesh();
        const geometry = entity.mesh.children[0].geometry;
        const disposed = jest.spyOn(geometry, 'dispose');
        entity.interact(engine);
        const dialog = document.querySelector('dialog');
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(dialog.querySelector('button'));
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(escaped).not.toHaveBeenCalled(); expect(document.activeElement).toBe(opener);
        entity.interact(engine); entity.dispose();
        expect(disposed).toHaveBeenCalledTimes(1); expect(entity.mesh).toBeNull();
        expect(document.querySelector('dialog')).toBeNull();
    }
    document.body.removeEventListener('keydown', escaped);
});
