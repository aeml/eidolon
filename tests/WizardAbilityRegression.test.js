import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Wizard } from '../src/entities/Wizard.js';

describe('Wizard ability regression checks', () => {
    test('Meteor Drop cast no longer relies on removed burningGround node', () => {
        const wizard = new Wizard('test-wizard');
        wizard.mesh = new THREE.Group();
        wizard.unlockedSkills.push('Meteor Drop');

        const gameEngine = {
            addEntity: jest.fn(),
            floatingTextManager: { spawn: jest.fn() },
            scene: null
        };

        const target = new THREE.Vector3(6, 0, 6);

        expect(() => wizard.useAbility(target, gameEngine, 'Meteor Drop')).not.toThrow();
        expect(gameEngine.addEntity).toHaveBeenCalledTimes(1);

        const meteor = gameEngine.addEntity.mock.calls[0][0];
        expect(meteor.type).toBe('Meteor');
        expect(meteor.leaveBurningGround).toBeUndefined();
    });
});
