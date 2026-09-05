import * as THREE from 'three';
import { jest } from '@jest/globals';
import { Wizard } from '../src/entities/Wizard.js';
import { CollisionManager } from '../src/core/CollisionManager.js';

describe('Wizard ability regression checks', () => {
    test.each([
        ['Air', 2100, 200, ''],
        ['Fire', -2100, 200, ''],
        ['Water', 100, -1800, ''],
        ['Dungeon', 20000, 20000, 'dungeon_teleport']
    ])('offline Teleport preserves valid %s coordinates', (_, x, z, currentInstanceId) => {
        const wizard = new Wizard('teleport-wizard');
        wizard.position.set(x, 0, z);
        wizard.mesh = new THREE.Group();
        wizard.unlockedSkills.push('Teleport');
        const collisionManager = new CollisionManager();
        collisionManager.setDungeonWalkableGeometry([{ x, z, width: 100, height: 100 }]);
        wizard.useAbility(new THREE.Vector3(x + 10, 0, z), {
            currentInstanceId, collisionManager, scene: null
        }, 'Teleport');
        expect(wizard.position).toEqual(new THREE.Vector3(x + 10, 0, z));
        expect(wizard.mesh.position).toEqual(wizard.position);
    });

    test('Meteor Drop cast no longer relies on removed burningGround node', () => {
        const wizard = new Wizard('test-wizard');
        wizard.mesh = new THREE.Group();
        wizard.unlockedSkills.push('Meteor Drop');

        const gameEngine = {
            addEntity: jest.fn(),
            floatingTextManager: { spawn: jest.fn() },
            scene: null
        };

        const target = new THREE.Vector3(6, 0, 6);

        expect(() => wizard.useAbility(target, gameEngine, 'Meteor Drop')).not.toThrow();
        expect(gameEngine.addEntity).toHaveBeenCalledTimes(1);

        const meteor = gameEngine.addEntity.mock.calls[0][0];
        expect(meteor.type).toBe('Meteor');
        expect(meteor.leaveBurningGround).toBeUndefined();
    });
});
