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
});
