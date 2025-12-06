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
});
