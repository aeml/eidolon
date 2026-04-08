import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Fighter } from '../src/entities/Fighter.js';
import { Cleric } from '../src/entities/Cleric.js';

describe('class visual effectScene guards', () => {
    test('Fighter routes transient visuals when only effectScene is available', () => {
        const fighter = new Fighter('fighter-1');
        fighter.mesh = new THREE.Group();
        const spawnTransientEffect = jest.fn(() => true);

        fighter.spawnVisualEffect(
            {
                scene: null,
                effectScene: new THREE.Group(),
                spawnTransientEffect
            },
            new THREE.Vector3(1, 0, 2),
            0xff5500,
            'wave'
        );

        expect(spawnTransientEffect).toHaveBeenCalledWith(
            'wave',
            expect.any(THREE.Vector3),
            0xff5500,
            { source: fighter }
        );
    });

    test('Cleric routes transient visuals when only effectScene is available', () => {
        const cleric = new Cleric('cleric-1');
        cleric.mesh = new THREE.Group();
        const spawnTransientEffect = jest.fn(() => true);

        cleric.spawnVisualEffect(
            {
                scene: null,
                effectScene: new THREE.Group(),
                spawnTransientEffect
            },
            new THREE.Vector3(3, 0, 4),
            0x00ff88,
            'pillar'
        );

        expect(spawnTransientEffect).toHaveBeenCalledWith(
            'pillar',
            expect.any(THREE.Vector3),
            0x00ff88,
            { source: cleric }
        );
    });
});
