import { jest } from '@jest/globals';
import { Vector3 } from 'three';
import { installGameEngineMovement } from '../src/core/GameEngineMovement.js';

class Harness {}
installGameEngineMovement(Harness);
const setup = (type = 'ChronicleSite') => Object.assign(new Harness(), {
    isMobile: false, player: { move: jest.fn(), position: new Vector3() },
    uiManager: { isEscMenuOpen: false, isPatchNotesOpen: false, reportScreen: { style: { display: 'none' } } },
    inputManager: { keys: {}, getGroundIntersectionFromEvent: jest.fn(() => new Vector3(9, 0, 4)),
        getGroundIntersection: jest.fn(() => new Vector3(1, 0, 1)) },
    hoveredEntity: { id: 'covered-ground', type }, pendingInteraction: { id: 'old' },
    abilityController: { pendingAbilityTarget: { id: 'cast' }, pendingAbilitySkill: 'Fireball' },
    performRaycast: jest.fn(), moveToAndInteract: jest.fn(), requestPlayerJump: jest.fn(() => true),
    isHostileActorTarget: jest.fn(() => false), isInteractableEntity: jest.fn(() => true),
    setMobileCombatTarget: jest.fn()
});

test.each(['ChronicleSite', 'LootDrop', 'Skeleton', 'QuestNPC'])('Shift-click walks without interacting with %s', type => {
    const engine = setup(type), event = { shiftKey: true, clientX: 120, clientY: 240 };
    expect(engine.handlePrimaryClick(event)).toBe(true);
    expect(engine.player.move).toHaveBeenCalledWith(new Vector3(9, 0, 4));
    expect(engine.inputManager.getGroundIntersectionFromEvent).toHaveBeenCalledWith(event);
    expect(engine.moveToAndInteract).not.toHaveBeenCalled();
    expect(engine.requestPlayerJump).not.toHaveBeenCalled();
    expect(engine.pendingInteraction).toBeNull();
    expect(engine.abilityController).toEqual({ pendingAbilityTarget: null, pendingAbilitySkill: null });
});

test('held Shift also applies when the repeated click has no event coordinates', () => {
    const engine = setup();
    engine.inputManager.keys.shift = true;
    engine.handlePrimaryClick();
    expect(engine.player.move).toHaveBeenCalledWith(new Vector3(1, 0, 1));
});

test('normal clicks still interact with the pointed-at entity', () => {
    const engine = setup();
    engine.handlePrimaryClick({});
    expect(engine.moveToAndInteract).toHaveBeenCalledWith(engine.hoveredEntity);
    expect(engine.player.move).not.toHaveBeenCalled();
});

test('Ctrl-click jump keeps priority when Shift is also held', () => {
    const engine = setup();
    engine.handlePrimaryClick({ ctrlKey: true, shiftKey: true });
    expect(engine.requestPlayerJump).toHaveBeenCalledWith(new Vector3(9, 0, 4));
    expect(engine.player.move).not.toHaveBeenCalled();
});

test('a missing ground intersection preserves the current intent', () => {
    const engine = setup();
    engine.inputManager.getGroundIntersectionFromEvent.mockReturnValue(null);
    expect(engine.handlePrimaryClick({ shiftKey: true })).toBe(false);
    expect(engine.pendingInteraction).toEqual({ id: 'old' });
    expect(engine.player.move).not.toHaveBeenCalled();
});

test('mobile taps and an open menu do not become desktop movement', () => {
    const engine = setup();
    engine.isMobile = true;
    engine.handlePrimaryClick({ shiftKey: true });
    expect(engine.moveToAndInteract).toHaveBeenCalledWith(engine.hoveredEntity);
    expect(engine.player.move).not.toHaveBeenCalled();
    engine.isMobile = false;
    engine.uiManager.isEscMenuOpen = true;
    expect(engine.handlePrimaryClick({ shiftKey: true })).toBe(false);
    expect(engine.player.move).not.toHaveBeenCalled();
});
