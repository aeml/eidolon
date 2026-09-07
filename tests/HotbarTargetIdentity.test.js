import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AbilityController } from '../src/core/AbilityController.js';

function fixture() {
    const player = { id: 'rogue', constructor: { name: 'Rogue' }, subType: 'Rogue',
        position: new THREE.Vector3(), mesh: new THREE.Object3D(), rotation: new THREE.Quaternion(),
        state: 'IDLE', stats: { mana: 200 }, cooldowns: {}, hotbar: ['Shadow Lunge'],
        useSkill: jest.fn(), abilityName: 'Piercing Throw' };
    const target = { id: 'selected-enemy', isActive: true, state: 'IDLE', position: new THREE.Vector3(6, 0, 0) };
    const engine = { player, hoveredEntity: target, isMultiplayer: true, isMobile: false,
        network: { send: jest.fn() }, inputManager: { getGroundIntersection: jest.fn(() => new THREE.Vector3(3, 0, 2)) },
        uiManager: { reportScreen: { style: { display: 'none' } } } };
    return { player, target, engine, controller: new AbilityController(engine) };
}

test('desktop hotbar preserves the hovered actor identity as well as its position', () => {
    const { engine, controller } = fixture();
    controller.performHotbarAbility(0);
    expect(engine.network.send).toHaveBeenCalledWith('ability', {
        targetId: 'selected-enemy', targetX: 6, targetZ: 0, skillName: 'Shadow Lunge'
    });
});

test('a ground hotbar cast remains an explicit ground cast', () => {
    const { engine, controller } = fixture();
    engine.hoveredEntity = null;
    controller.performHotbarAbility(0);
    expect(engine.network.send).toHaveBeenCalledWith('ability', {
        targetId: '', targetX: 3, targetZ: 2, skillName: 'Shadow Lunge'
    });
});

test('buffered hotbar intent follows the original actor, not a later overlapping hover', () => {
    const { engine, controller, target, player } = fixture();
    player.cooldowns['Shadow Lunge'] = .2;
    controller.performHotbarAbility(0);
    engine.hoveredEntity = { ...target, id: 'different-enemy', position: new THREE.Vector3(6, 0, 0) };
    target.position.x = 7;
    player.cooldowns['Shadow Lunge'] = 0;
    controller.processInputBuffer();
    expect(engine.network.send).toHaveBeenCalledWith('ability', {
        targetId: 'selected-enemy', targetX: 7, targetZ: 0, skillName: 'Shadow Lunge'
    });
});

test('a buffered actor becoming inactive cannot silently turn into a ground retarget', () => {
    const { engine, controller, target, player } = fixture();
    player.cooldowns['Shadow Lunge'] = .2;
    controller.performHotbarAbility(0);
    target.isActive = false;
    player.cooldowns['Shadow Lunge'] = 0;
    controller.processInputBuffer();
    expect(engine.network.send).not.toHaveBeenCalled();
    expect(player.useSkill).not.toHaveBeenCalled();
});

test('self-centered Spirit Guardians does not depend on a buffered hovered actor staying alive', () => {
    const { engine, controller, target, player } = fixture();
    player.constructor.name = 'Cleric';
    player.hotbar = ['Spirit Guardians'];
    player.cooldowns['Spirit Guardians'] = .2;
    controller.performHotbarAbility(0);
    target.state = 'DEAD';
    player.cooldowns['Spirit Guardians'] = 0;
    controller.processInputBuffer();
    expect(engine.network.send).toHaveBeenCalledWith('ability', {
        targetId: '', targetX: 0, targetZ: 0, skillName: 'Spirit Guardians'
    });
});
