import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AbilityController } from '../src/core/AbilityController.js';
import { Fighter } from '../src/entities/Fighter.js';
import { Skeleton } from '../src/entities/Skeleton.js';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const eidolon = { state: {} };
    return { default: { eidolon }, eidolon };
});
const { GameEngine } = await import('../src/core/GameEngine.js');

function harness() {
    const engine = Object.create(GameEngine.prototype);
    const player = new Fighter('player');
    const near = new Skeleton('near');
    const selected = new Skeleton('selected');
    near.position.set(2, 0, 0);
    selected.position.set(6, 0, 0);
    Object.assign(engine, {
        player, isMobile: true, isMultiplayer: true, currentInstanceId: 'dungeon-a',
        uiManager: { reportScreen: { style: { display: 'none' } } },
        chunkManager: { getActiveEntities: () => [player, near, selected] },
        performRaycast: jest.fn(), moveToAndInteract: jest.fn(), refreshCombatIntentState: jest.fn(),
        inputManager: { keys: {} }, network: { send: jest.fn() }, showReadabilityFeedback: jest.fn()
    });
    engine.abilityController = new AbilityController(engine);
    player.useAbility = jest.fn();
    player.useSkill = jest.fn();
    player.abilityCooldown = 0;
    player.stats.mana = 1000;
    return { engine, player, near, selected };
}

describe('deliberate phone combat targets', () => {
    test('a world tap selects its hit, does not attack, and survives later hover changes', () => {
        const { engine, selected, near } = harness();
        engine.hoveredEntity = selected;
        engine.handlePrimaryClick({ clientX: 100, clientY: 100 });
        expect(engine.getMobileCombatTarget()).toBe(selected);
        expect(engine.moveToAndInteract).not.toHaveBeenCalled();
        engine.hoveredEntity = near;
        expect(engine.getEffectiveCombatTarget()).toBe(selected);
        engine.handlePrimaryClick();
        expect(engine.moveToAndInteract).toHaveBeenCalledWith(selected);
    });

    test('Attack without a selected enemy does not silently choose the nearest', () => {
        const { engine } = harness();
        engine.handlePrimaryClick();
        expect(engine.moveToAndInteract).not.toHaveBeenCalled();
        expect(engine.pendingInteraction).toBeFalsy();
        expect(engine.showReadabilityFeedback).toHaveBeenCalled();
    });

    test('repeated taps cycle overlapping hostiles in stable id order without attacking', () => {
        const { engine, near, selected } = harness();
        engine.raycastHitEntities = [selected, near];
        engine.hoveredEntity = near;
        const tap = { clientX: 100, clientY: 100 };
        engine.handlePrimaryClick(tap);
        expect(engine.getMobileCombatTarget()).toBe(near);
        engine.handlePrimaryClick(tap);
        expect(engine.getMobileCombatTarget()).toBe(selected);
        engine.raycastHitEntities.reverse();
        engine.handlePrimaryClick(tap);
        expect(engine.getMobileCombatTarget()).toBe(near);
        expect(engine.moveToAndInteract).not.toHaveBeenCalled();
    });

    test('NPC taps retain their interaction path rather than selecting them for combat', () => {
        const { engine } = harness();
        const npc = { constructor: { name: 'QuestNPC' }, position: new THREE.Vector3(2, 0, 0) };
        engine.hoveredEntity = npc;
        engine.handlePrimaryClick({ clientX: 100, clientY: 100 });
        expect(engine.getMobileCombatTarget()).toBeNull();
        expect(engine.moveToAndInteract).toHaveBeenCalledWith(npc);
    });

    test('friendly players cannot become combat targets, and changing PvP hostility invalidates selection', () => {
        const { engine, player } = harness();
        const other = new Fighter('other');
        engine.chunkManager.getActiveEntities = () => [player, other];
        engine.socialController = { isPvPHostile: jest.fn(() => false) };
        engine.setMobileCombatTarget(other);
        expect(engine.getMobileCombatTarget()).toBeNull();
        engine.socialController.isPvPHostile.mockReturnValue(true);
        engine.setMobileCombatTarget(other);
        expect(engine.getMobileCombatTarget()).toBe(other);
        engine.socialController.isPvPHostile.mockReturnValue(false);
        expect(engine.getMobileCombatTarget()).toBeNull();
    });

    test('empty ground cancels selection, pursuit and buffered abilities', () => {
        const { engine, selected, player } = harness();
        engine.setMobileCombatTarget(selected);
        engine.pendingInteraction = selected;
        player.targetPosition = selected.position.clone();
        player.targetEntity = selected;
        engine.abilityController.pendingAbilityTarget = selected;
        engine.abilityController.inputBuffer = [{ skillName: 'Charge' }];
        engine.hoveredEntity = null;
        engine.handlePrimaryClick({ clientX: 100, clientY: 100 });
        expect(engine.getMobileCombatTarget()).toBeNull();
        expect(engine.pendingInteraction).toBeNull();
        expect(player.targetPosition).toBeNull();
        expect(player.targetEntity).toBeNull();
        expect(engine.abilityController.pendingAbilityTarget).toBeNull();
        expect(engine.abilityController.inputBuffer).toEqual([]);
    });

    test.each(['dead', 'inactive', 'removed', 'new instance', 'player dead'])('%s selection is invalidated without acquiring another enemy', reason => {
        const { engine, selected, player } = harness();
        engine.setMobileCombatTarget(selected);
        if (reason === 'dead') selected.state = 'DEAD';
        if (reason === 'inactive') selected.isActive = false;
        if (reason === 'removed') engine.chunkManager.getActiveEntities = () => [player];
        if (reason === 'new instance') engine.currentInstanceId = 'dungeon-b';
        if (reason === 'player dead') player.state = 'DEAD';
        expect(engine.getMobileCombatTarget()).toBeNull();
        expect(engine.mobileCombatTarget).toBeNull();
    });

    test('offensive casts honor selection rather than a closer enemy', () => {
        const { engine, selected, player } = harness();
        engine.setMobileCombatTarget(selected);
        player.abilityName = 'Fireball';
        jest.spyOn(engine.abilityController, 'getAbilityCastRange').mockReturnValue(20);
        engine.abilityController.performAbility();
        expect(engine.network.send).toHaveBeenCalledWith('ability', expect.objectContaining({ targetId: selected.id, targetX: 6 }));
        expect(player.useAbility).toHaveBeenCalledWith(selected.position, engine, null);
    });

    test('an out-of-range selected target does not redirect a cast or spend resources', () => {
        const { engine, selected, player } = harness();
        engine.setMobileCombatTarget(selected);
        selected.position.set(50, 0, 0);
        jest.spyOn(engine.abilityController, 'getAbilityCastRange').mockReturnValue(20);
        engine.abilityController.performAbility();
        expect(engine.network.send).not.toHaveBeenCalled();
        expect(player.useAbility).not.toHaveBeenCalled();
    });

    test('unselected directional casts use facing, never an arbitrary nearby enemy', () => {
        const { engine, player } = harness();
        player.mesh = new THREE.Object3D();
        engine.abilityController.performAbility();
        expect(engine.network.send).toHaveBeenCalledWith('ability', expect.objectContaining({ targetId: '', targetX: 0, targetZ: 5 }));
    });

    test('mobile self-centered abilities still cast at the player with no selected enemy', () => {
        const { engine, player } = harness();
        player.abilityName = 'Spirit Guardians';
        engine.abilityController.performAbility();
        expect(engine.network.send).toHaveBeenCalledWith('ability', expect.objectContaining({ targetId: '', targetX: 0, targetZ: 0 }));
    });
});
