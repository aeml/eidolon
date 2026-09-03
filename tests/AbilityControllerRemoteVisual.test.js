import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AbilityController } from '../src/core/AbilityController.js';

describe('AbilityController remote presentation evidence', () => {
    test('routes every replicated layer through its canonical procedural cast identity', () => {
        const entity = {
            constructor: { name: 'Actor' },
            meshType: 'Cleric',
            position: new THREE.Vector3(1, 0, 2),
            playAbilityAnimation: jest.fn()
        };
        const spawnTransientEffect = jest.fn(() => true);
        const controller = new AbilityController({ spawnTransientEffect });

        controller.triggerRemoteAbilityVisuals(entity, 'Spirit Guardians', 4, 6);

        expect(spawnTransientEffect).toHaveBeenCalledTimes(2);
        expect(spawnTransientEffect).toHaveBeenNthCalledWith(
            1,
            'buff',
            entity.position,
            0xffe066,
            expect.objectContaining({
                source: entity,
                abilityName: 'Spirit Guardians',
                abilityLayer: 0,
                direction: expect.any(THREE.Vector3)
            })
        );
        expect(spawnTransientEffect).toHaveBeenNthCalledWith(
            2,
            'ring',
            entity.position,
            0xfff4a3,
            expect.objectContaining({
                source: entity,
                abilityName: 'Spirit Guardians',
                abilityLayer: 1,
                radius: 16
            })
        );
    });

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
