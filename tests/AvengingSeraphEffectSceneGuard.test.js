import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AvengingSeraph } from '../src/entities/AvengingSeraph.js';

describe('AvengingSeraph visual effectScene guard', () => {
    test('routes transient visuals when only effectScene is available', () => {
        const seraph = new AvengingSeraph('seraph-1');
        seraph.mesh = new THREE.Group();
        const spawnTransientEffect = jest.fn(() => true);

        seraph.spawnVisualEffect(
            {
                scene: null,
                effectScene: new THREE.Group(),
                spawnTransientEffect
            },
            new THREE.Vector3(2, 0, 5),
            0xffdd88,
            'pillar'
        );

        expect(spawnTransientEffect).toHaveBeenCalledWith(
            'pillar',
            expect.any(THREE.Vector3),
            0xffdd88,
            { source: seraph }
        );
    });
});
