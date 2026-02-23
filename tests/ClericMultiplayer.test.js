import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Cleric } from '../src/entities/Cleric.js';

describe('Cleric Multiplayer Logic', () => {
    let cleric;

    beforeEach(() => {
        cleric = new Cleric('test-cleric');
        // Mock mesh
        cleric.mesh = new THREE.Group();
    });

    test('cleric initializes with correct base stats', () => {
        expect(cleric.stats.wisdom).toBeDefined();
        expect(cleric.meshType).toBe('Cleric');
    });

    test('spirits can be activated', () => {
        cleric.spiritsActive = true;
        cleric.spiritDuration = 10.0;
        cleric.spirits = [];

        expect(cleric.spiritsActive).toBe(true);
        expect(cleric.spiritDuration).toBe(10.0);
    });

    test('spirit duration decrements over time', () => {
        cleric.spiritsActive = true;
        cleric.spiritDuration = 5.0;
        cleric.spirits = [];

        // Update for 1 second
        cleric.update(1.0, null);

        expect(cleric.spiritDuration).toBeLessThan(5.0);
    });

    test('spirit guardians tick damages nearby enemies', () => {
        cleric.spiritsActive = true;
        cleric.spiritBoosted = false;
        cleric.spiritDuration = 5.0;
        cleric.spiritDamageTimer = 0;
        cleric.spirits = [
            { mesh: { position: new THREE.Vector3(), parent: null } }
        ];

        const enemy = {
            isActive: true,
            state: 'IDLE',
            constructor: { name: 'Skeleton' },
            position: new THREE.Vector3(2, 0, 0),
            takeDamage: jest.fn()
        };

        const chunkManager = {
            getActiveEntities: () => [enemy]
        };

        const floatingTextManager = {
            spawn: jest.fn()
        };

        cleric.update(0.6, null, null, chunkManager, floatingTextManager);

        expect(enemy.takeDamage).toHaveBeenCalledTimes(1);
        expect(floatingTextManager.spawn).toHaveBeenCalled();
    });

    test('spirit guardians do not damage player classes', () => {
        cleric.spiritsActive = true;
        cleric.spiritBoosted = true;
        cleric.spiritDuration = 5.0;
        cleric.spiritDamageTimer = 0;
        cleric.spirits = [
            { mesh: { position: new THREE.Vector3(), parent: null } }
        ];

        const ally = {
            isActive: true,
            state: 'IDLE',
            constructor: { name: 'Fighter' },
            position: new THREE.Vector3(1, 0, 0),
            takeDamage: jest.fn()
        };

        const chunkManager = {
            getActiveEntities: () => [ally]
        };

        cleric.update(0.6, null, null, chunkManager, { spawn: jest.fn() });

        expect(ally.takeDamage).not.toHaveBeenCalled();
    });

    test('Spirit Guardians skill name activates guardian state', () => {
        const gameEngine = {
            chunkManager: { getActiveEntities: () => [] },
            floatingTextManager: { spawn: jest.fn() }
        };

        cleric.useAbility(new THREE.Vector3(1, 0, 1), gameEngine, 'Spirit Guardians');

        expect(cleric.spiritsActive).toBe(true);
        expect(cleric.spiritDuration).toBeGreaterThan(0);
    });
});
