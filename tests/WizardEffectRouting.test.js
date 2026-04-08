import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Wizard } from '../src/entities/Wizard.js';

describe('Wizard combat effect routing', () => {
    test('Scorch Beam routes the beam telegraph through transient effects without direct scene writes', () => {
        const wizard = new Wizard('test-wizard');
        wizard.mesh = new THREE.Group();
        wizard.position.set(0, 0, 0);
        wizard.unlockedSkills.push('Scorch Beam');

        const spawnTransientEffect = jest.fn(() => true);
        const gameEngine = {
            chunkManager: { getActiveEntities: () => [] },
            floatingTextManager: { spawn: jest.fn() },
            spawnTransientEffect,
            effectScene: new THREE.Group(),
            scene: null
        };

        const target = new THREE.Vector3(8, 0, 0);
        wizard.useAbility(target, gameEngine, 'Scorch Beam');

        expect(spawnTransientEffect).toHaveBeenCalledTimes(1);
        const [type, position, color, options] = spawnTransientEffect.mock.calls[0];
        expect(type).toBe('beam');
        expect(color).toBe(0xffaa00);
        expect(position.x).toBeGreaterThan(10);
        expect(position.y).toBeCloseTo(1.5, 5);
        expect(options.source).toBe(wizard);
    });
});
