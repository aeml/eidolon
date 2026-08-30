import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Fighter } from '../src/entities/Fighter.js';
import { Rogue } from '../src/entities/Rogue.js';
import { Wizard } from '../src/entities/Wizard.js';
import { Cleric } from '../src/entities/Cleric.js';

function multiplayerHarness() {
    return {
        isMultiplayer: true,
        pendingInteraction: null,
        abilityController: {
            pendingAbilityTarget: null,
            pendingAbilitySkill: null
        },
        spawnTransientEffect: jest.fn(() => true),
        floatingTextManager: { spawn: jest.fn() },
        chunkManager: { getActiveEntities: jest.fn(() => []) },
        addEntity: jest.fn()
    };
}

describe('multiplayer ability authority boundary', () => {
    test.each([
        [Fighter, 'Shield Slam', 6],
        [Rogue, 'Smoke Bomb', 20],
        [Wizard, 'Teleport', 12],
        [Cleric, 'Guardian Embrace', 30]
    ])('%s predicts only the canonical contract for %s', (ClassType, skillName, expectedCooldown) => {
        const actor = new ClassType(`test-${skillName}`);
        actor.mesh = new THREE.Group();
        actor.isMultiplayer = true;
        actor.unlockedSkills.push(skillName);
        actor.stats.mana = 1000;
        actor.stats.cooldownReduction = 0;
        const originalPosition = actor.position.clone();
        const engine = multiplayerHarness();

        const result = actor.useAbility(new THREE.Vector3(8, 0, 4), engine, skillName);

        expect(result).toBe(true);
        expect(actor.cooldowns[skillName]).toBe(expectedCooldown);
        expect(actor.position).toEqual(originalPosition);
        expect(engine.addEntity).not.toHaveBeenCalled();
        expect(engine.chunkManager.getActiveEntities).not.toHaveBeenCalled();
    });
});
