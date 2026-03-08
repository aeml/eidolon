import * as THREE from 'three';
import { CONSTANTS } from '../src/core/Constants.js';
import { AbilityController } from '../src/core/AbilityController.js';

describe('Ability range interaction', () => {
    test('doubles configured ranges for charge, piercing throw, and fireball', () => {
        expect(CONSTANTS.ABILITY_CONFIG.Fighter.default.range).toBe(28.0);
        expect(CONSTANTS.ABILITY_CONFIG.Fighter.skills.Charge.range).toBe(28.0);
        expect(CONSTANTS.ABILITY_CONFIG.Rogue.default.range).toBe(24.0);
        expect(CONSTANTS.ABILITY_CONFIG.Rogue.skills['Piercing Throw'].range).toBe(24.0);
        expect(CONSTANTS.ABILITY_CONFIG.Wizard.default.range).toBe(36.0);
        expect(CONSTANTS.ABILITY_CONFIG.Wizard.skills.Fireball.range).toBe(36.0);
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
});
