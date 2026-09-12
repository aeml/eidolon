import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AbilityController } from '../src/core/AbilityController.js';
import { Wizard } from '../src/entities/Wizard.js';

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

test.each(['hotbar', 'primary'])('%s casts beneath an expired Meteor through the real Wizard implementation', input => {
    const { engine } = fixture();
    const player = new Wizard('wizard');
    player.mesh = new THREE.Group();
    player.isMultiplayer = true;
    player.stats.mana = 1000;
    player.unlockedSkills.push('Inferno Cataclysm');
    player.hotbar = ['Inferno Cataclysm'];
    engine.player = player;
    engine.spawnTransientEffect = jest.fn(() => true);
    engine.showReadabilityFeedback = jest.fn();
    engine.hoveredEntity = { id: 'proj-meteor-expired', isActive: false, state: '', position: new THREE.Vector3(9, 4, 9) };
    const controller = new AbilityController(engine);
    engine.abilityController = controller;
    const skill = input === 'hotbar' ? 'Inferno Cataclysm' : 'Fireball';
    const cost = controller.getConfiguredManaCost(skill);

    if (input === 'hotbar') controller.performHotbarAbility(0);
    else controller.performAbility();

    expect(engine.network.send).toHaveBeenCalledTimes(1);
    expect(engine.network.send).toHaveBeenCalledWith('ability', {
        targetId: '', targetX: 3, targetZ: 2, skillName: skill
    });
    expect(player.stats.mana).toBe(1000 - cost);
    expect(player.cooldowns[skill]).toBeGreaterThan(0);
    expect(engine.spawnTransientEffect).toHaveBeenCalled();
    expect(engine.showReadabilityFeedback).not.toHaveBeenCalled();
    expect(controller.pendingAbilityTarget).toBeNull();
});

test('an inactive hover without a ground intersection does not spend a cast', () => {
    const { engine, controller, target, player } = fixture();
    target.isActive = false;
    engine.inputManager.getGroundIntersection.mockReturnValue(null);
    controller.performHotbarAbility(0);
    expect(engine.network.send).not.toHaveBeenCalled();
    expect(player.useSkill).not.toHaveBeenCalled();
    expect(controller.pendingAbilityTarget).toBeNull();
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

test.each(['Spirit Guardians', 'Avenging Seraph'])('%s hotbar casts at the owner without a cursor ground intersection', skill => {
    const { engine, controller, player } = fixture();
    player.constructor.name = 'Cleric'; player.hotbar = [skill];
    engine.hoveredEntity = null;
    engine.inputManager.getGroundIntersection.mockReturnValue(null);
    controller.performHotbarAbility(0);
    expect(engine.network.send).toHaveBeenCalledWith('ability', {
        targetId: '', targetX: 0, targetZ: 0, skillName: skill
    });
});

test('Seraph summoning cannot chase a distant hovered actor or redirect its spawn', () => {
    const { engine, controller, player, target } = fixture();
    player.constructor.name = 'Cleric'; player.hotbar = ['Avenging Seraph'];
    target.position.set(100, 0, 100);
    player.move = jest.fn();
    controller.performHotbarAbility(0);
    expect(player.move).not.toHaveBeenCalled();
    expect(engine.network.send).toHaveBeenCalledWith('ability', {
        targetId: '', targetX: 0, targetZ: 0, skillName: 'Avenging Seraph'
    });
    expect(controller.pendingAbilityTarget).toBeNull();
});

test('a buffered Seraph follows its moving owner even after the hovered enemy disappears', () => {
    const { engine, controller, player, target } = fixture();
    player.constructor.name = 'Cleric'; player.hotbar = ['Avenging Seraph'];
    player.cooldowns['Avenging Seraph'] = .2;
    controller.performHotbarAbility(0);
    target.isActive = false;
    player.position.set(4, 0, 3);
    player.cooldowns['Avenging Seraph'] = 0;
    controller.processInputBuffer();
    expect(engine.network.send).toHaveBeenCalledWith('ability', {
        targetId: '', targetX: 4, targetZ: 3, skillName: 'Avenging Seraph'
    });
});

test.each([false, true])('Executioner Spin casts around its owner, not a distant selection, mobile=%s', mobile => {
    const { engine, controller, player, target } = fixture();
    player.constructor.name = 'Fighter'; player.subType = 'Fighter'; player.hotbar = ['Executioner Spin'];
    player.move = jest.fn(); target.position.set(100, 0, 100);
    engine.isMobile = mobile; engine.getMobileCombatTarget = () => target;
    controller.performHotbarAbility(0);
    expect(engine.network.send).toHaveBeenCalledWith('ability', { targetId: '', targetX: 0, targetZ: 0, skillName: 'Executioner Spin' });
    expect(player.move).not.toHaveBeenCalled(); expect(controller.pendingAbilityTarget).toBeNull();
});

test('Executioner Spin works without ground hover and buffered input follows its moving owner', () => {
    const { engine, controller, player } = fixture();
    player.constructor.name = 'Fighter'; player.subType = 'Fighter'; player.hotbar = ['Executioner Spin'];
    engine.hoveredEntity = null; engine.inputManager.getGroundIntersection.mockReturnValue(null);
    player.cooldowns['Executioner Spin'] = .2; controller.performHotbarAbility(0);
    player.position.set(3, 0, 4); player.cooldowns['Executioner Spin'] = 0; controller.processInputBuffer();
    expect(engine.network.send).toHaveBeenCalledWith('ability', { targetId: '', targetX: 3, targetZ: 4, skillName: 'Executioner Spin' });
});
