import * as THREE from 'three';
import { jest } from '@jest/globals';
import { AbilityController } from '../src/core/AbilityController.js';

describe('AbilityController pending target casting', () => {
    function createPlayer() {
        return {
            id: 'player-1',
            abilityName: 'Fireball',
            position: new THREE.Vector3(0, 0, 0),
            targetPosition: new THREE.Vector3(4, 0, 0),
            state: 'MOVING',
            velocity: new THREE.Vector3(1, 0, 0),
            mesh: new THREE.Object3D(),
            rotation: new THREE.Quaternion(),
            useAbility: jest.fn(),
            useSkill: jest.fn(),
            playAnimation: jest.fn(),
            getMovementAnimationName: jest.fn()
        };
    }

    test('casts queued primary abilities locally after moving into range in multiplayer', () => {
        const player = createPlayer();
        const target = {
            id: 'enemy-1',
            isActive: true,
            state: 'IDLE',
            position: new THREE.Vector3(10, 0, 0)
        };
        const engine = {
            player,
            isMultiplayer: true,
            network: { send: jest.fn() }
        };

        const controller = new AbilityController(engine);
        controller.pendingAbilityTarget = target;

        jest.spyOn(controller, 'getAbilityCastRange').mockReturnValue(12.0);

        expect(controller.updatePendingTarget()).toBe(true);

        expect(engine.network.send).toHaveBeenCalledWith('ability', {
            targetX: 10,
            targetZ: 0,
            targetId: 'enemy-1',
            skillName: 'Fireball'
        });
        expect(player.useAbility).toHaveBeenCalledWith(target.position, engine);
        expect(player.useSkill).not.toHaveBeenCalled();
        expect(controller.pendingAbilityTarget).toBeNull();
        expect(controller.pendingAbilitySkill).toBeNull();
    });

    test('preserves queued skill overrides when the pending cast resolves', () => {
        const player = createPlayer();
        player.abilityName = 'Piercing Throw';

        const target = {
            id: 'enemy-2',
            isActive: true,
            state: 'IDLE',
            position: new THREE.Vector3(8, 0, 0)
        };
        const engine = {
            player,
            isMultiplayer: false,
            network: { send: jest.fn() }
        };

        const controller = new AbilityController(engine);
        controller.pendingAbilityTarget = target;
        controller.pendingAbilitySkill = 'Shadow Lunge';

        jest.spyOn(controller, 'getAbilityCastRange').mockReturnValue(12.0);

        expect(controller.updatePendingTarget()).toBe(true);

        expect(player.useSkill).toHaveBeenCalledWith('Shadow Lunge', target.position, engine);
        expect(player.useAbility).not.toHaveBeenCalled();
        expect(engine.network.send).not.toHaveBeenCalled();
    });

    test('does not stomp state or consume a pending cast while the player is jumping', () => {
        const player = createPlayer();
        player.state = 'JUMPING';

        const target = {
            id: 'enemy-3',
            isActive: true,
            state: 'IDLE',
            position: new THREE.Vector3(6, 0, 0)
        };
        const engine = {
            player,
            isMultiplayer: true,
            playerJumpState: { serverDriven: false },
            network: { send: jest.fn() }
        };

        const controller = new AbilityController(engine);
        controller.pendingAbilityTarget = target;
        controller.pendingAbilitySkill = 'Fireball';

        expect(controller.updatePendingTarget()).toBe(false);
        expect(player.state).toBe('JUMPING');
        expect(controller.pendingAbilityTarget).toBe(target);
        expect(controller.pendingAbilitySkill).toBe('Fireball');
        expect(player.useAbility).not.toHaveBeenCalled();
        expect(engine.network.send).not.toHaveBeenCalled();
    });
});
