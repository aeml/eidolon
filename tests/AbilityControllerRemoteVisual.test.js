import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AbilityController } from '../src/core/AbilityController.js';

describe('AbilityController remote presentation evidence', () => {
    test('records the explicit visual played for a replicated ability', () => {
        const entity = {
            constructor: { name: 'Cleric' },
            position: new THREE.Vector3(1, 0, 2),
            playAbilityAnimation: jest.fn(),
            spawnVisualEffect: jest.fn()
        };
        const controller = new AbilityController({});

        controller.triggerRemoteAbilityVisuals(entity, 'Spirit Guardians', 4, 6);

        expect(entity.playAbilityAnimation).toHaveBeenCalledWith('Spirit Guardians');
        expect(entity.spawnVisualEffect).toHaveBeenCalledTimes(2);
        expect(entity.lastRemoteAbilityPresentation).toMatchObject({
            skillName: 'Spirit Guardians',
            layerCount: 2,
            fallback: false
        });
    });
});
