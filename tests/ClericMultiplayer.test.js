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

    test('spirits do not expire locally in multiplayer', () => {
        cleric.isMultiplayer = true;
        cleric.spiritsActive = true;
        cleric.spiritDuration = 1.0;

        // Update for 2 seconds
        cleric.update(2.0, null);

        expect(cleric.spiritsActive).toBe(true);
        expect(cleric.spiritDuration).toBe(1.0); // Should not decrement
    });

    test('spirits expire locally in singleplayer', () => {
        cleric.isMultiplayer = false;
        cleric.spiritsActive = true;
        cleric.spiritDuration = 1.0;

        // Update for 0.5 seconds
        cleric.update(0.5, null);
        expect(cleric.spiritsActive).toBe(true);
        expect(cleric.spiritDuration).toBeCloseTo(0.5);

        // Update for another 0.6 seconds (total 1.1)
        cleric.update(0.6, null);
        expect(cleric.spiritsActive).toBe(false);
    });
});
