import * as THREE from 'three';
import { jest } from '@jest/globals';
import { CONSTANTS } from '../src/core/Constants.js';
import { AbilityController } from '../src/core/AbilityController.js';
import { AUDIO_CUES } from '../src/audio/AudioManager.js';
import { GameEngine } from '../src/core/GameEngine.js';

describe('Ability range interaction', () => {
    test('doubles configured ranges for charge, piercing throw, and fireball', () => {
        expect(CONSTANTS.ABILITY_CONFIG.Fighter.default.range).toBe(28.0);
        expect(CONSTANTS.ABILITY_CONFIG.Fighter.skills.Charge.range).toBe(28.0);
        expect(CONSTANTS.ABILITY_CONFIG.Rogue.default.range).toBe(24.0);
        expect(CONSTANTS.ABILITY_CONFIG.Rogue.skills['Piercing Throw'].range).toBe(24.0);
        expect(CONSTANTS.ABILITY_CONFIG.Wizard.default.range).toBe(36.0);
        expect(CONSTANTS.ABILITY_CONFIG.Wizard.skills.Fireball.range).toBe(36.0);
    });

    test.each([
        ['Fighter', 4],
        ['Rogue', 16],
        ['Wizard', 16],
        ['Cleric', 4]
    ])('keeps %s basic-attack click and chase range aligned with the server at %sm', (className, expectedRange) => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            constructor: { name: className },
            scale: 1,
            abilityName: className === 'Cleric' ? 'Spirit Guardians' : 'Fireball'
        };
        engine.abilityController = {
            getAbilityCastRange: jest.fn(() => 99),
            pendingAbilitySkill: null
        };
        engine.isHostileActorTarget = jest.fn(() => true);
        const target = { scale: 1 };

        expect(CONSTANTS.BASIC_ATTACK_RANGES[className]).toBe(expectedRange);
        expect(engine.getBasicAttackRangeForEntity(target)).toBe(expectedRange);
        expect(engine.getInteractionRangeForEntity(target)).toBe(expectedRange);
        expect(engine.abilityController.getAbilityCastRange).not.toHaveBeenCalled();
    });

    test('mirrors the server scale allowance for large basic-attack participants', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = { constructor: { name: 'Fighter' }, scale: 2 };
        expect(engine.getBasicAttackRangeForEntity({ scale: 3 })).toBe(8.5);
    });

    test('ability controller chases only to the fireball cast edge', () => {
        const player = {
            constructor: { name: 'Wizard' },
            abilityName: 'Fireball',
            position: new THREE.Vector3(0, 0, 0),
            targetPosition: null,
            state: 'IDLE',
            velocity: new THREE.Vector3(),
            getMovementAnimationName: () => 'Walk',
            playAnimation: () => {}
        };
        const target = {
            isActive: true,
            state: 'IDLE',
            position: new THREE.Vector3(100, 0, 0)
        };
        const controller = new AbilityController({ player });
        controller.pendingAbilityTarget = target;

        expect(controller.updatePendingTarget()).toBe(true);
        expect(player.targetPosition.x).toBeCloseTo(67.6, 5);
    });

    test('queued skill overrides use that skill range while chasing', () => {
        const player = {
            constructor: { name: 'Rogue' },
            abilityName: 'Piercing Throw',
            position: new THREE.Vector3(0, 0, 0),
            targetPosition: null,
            state: 'IDLE',
            velocity: new THREE.Vector3(),
            getMovementAnimationName: () => 'Walk',
            playAnimation: () => {}
        };
        const target = {
            isActive: true,
            state: 'IDLE',
            position: new THREE.Vector3(100, 0, 0)
        };
        const controller = new AbilityController({ player });
        controller.pendingAbilityTarget = target;
        controller.pendingAbilitySkill = 'Piercing Throw';

        expect(controller.updatePendingTarget()).toBe(true);
        expect(player.targetPosition.x).toBeCloseTo(78.4, 5);
    });

    test('buildSoftDamagePreview returns deterministic estimated basic and ability damage', () => {
        const player = {
            constructor: { name: 'Wizard' },
            abilityName: 'Fireball',
            stats: { damage: 40 }
        };
        const controller = new AbilityController({ player });

        const preview = controller.buildSoftDamagePreview({ id: 'enemy-1' });

        expect(preview.basicAttack).toBe(40);
        expect(preview.abilityName).toBe('Fireball');
        expect(preview.ability).toBe(60);
        expect(preview.isEstimate).toBe(true);
    });

    test('basic attacks play miss cue and do not send when the target is out of range', () => {
        const player = {
            position: new THREE.Vector3(0, 0, 0),
            state: 'IDLE'
        };
        const target = {
            id: 'enemy-1',
            position: new THREE.Vector3(20, 0, 0)
        };
        const engine = {
            player,
            playerJumpState: null,
            network: { send: jest.fn() },
            getInteractionRangeForEntity: jest.fn(() => 4),
            playAudioCue: jest.fn()
        };
        const controller = new AbilityController(engine);

        controller.performAttack(target);

        expect(engine.network.send).not.toHaveBeenCalled();
        expect(engine.playAudioCue).toHaveBeenCalledWith(AUDIO_CUES.combatMiss);
    });
});
