import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AbilityController } from '../src/core/AbilityController.js';

function fixture(skill, hostile = true) {
    const player = { id: 'cleric', constructor: { name: 'Cleric' },
        position: new THREE.Vector3(), state: 'IDLE', abilityName: skill,
        hotbar: [skill], stats: { mana: 1000 }, cooldowns: {},
        useSkill: jest.fn(), useAbility: jest.fn() };
    const hoveredEntity = { id: hostile ? 'enemy' : 'ally', isActive: true,
        state: 'IDLE', position: new THREE.Vector3(2, 0, 1) };
    const engine = { player, hoveredEntity, isMobile: false, isMultiplayer: true,
        isHostileActorTarget: jest.fn(() => hostile), network: { send: jest.fn() },
        uiManager: { reportScreen: { style: { display: 'none' } } },
        inputManager: { getGroundIntersection: jest.fn(() => new THREE.Vector3(.1, 0, .2)) } };
    return { engine, controller: new AbilityController(engine) };
}

describe.each(['Healing Light', 'Divine Intervention'])('%s cursor intent', skill => {
    test.each(['hotbar', 'direct'])('%s ignores an overlapping hostile and keeps ground healing intent', route => {
        const { engine, controller } = fixture(skill);
        if (route === 'hotbar') controller.performHotbarAbility(0);
        else controller.performAbility(null, skill);
        expect(engine.network.send).toHaveBeenCalledWith('ability', {
            targetX: .1, targetZ: .2, targetId: '', skillName: skill
        });
        expect(controller.pendingAbilityTarget).toBeNull();
    });
    test('a hovered ally retains explicit identity', () => {
        const { engine, controller } = fixture(skill, false);
        controller.performHotbarAbility(0);
        expect(engine.network.send).toHaveBeenCalledWith('ability', {
            targetX: 2, targetZ: 1, targetId: 'ally', skillName: skill
        });
    });
    test('already captured target intent is not silently replaced with self healing', () => {
        const { engine, controller } = fixture(skill);
        controller.performAbility(engine.hoveredEntity.position, skill, engine.hoveredEntity);
        expect(engine.network.send).toHaveBeenCalledWith('ability', expect.objectContaining({ targetId: 'enemy' }));
    });
});

test('offensive hotbar skills retain the hovered hostile', () => {
    const { engine, controller } = fixture('Radiant Strike');
    controller.performHotbarAbility(0);
    expect(engine.network.send).toHaveBeenCalledWith('ability', expect.objectContaining({ targetId: 'enemy' }));
});
