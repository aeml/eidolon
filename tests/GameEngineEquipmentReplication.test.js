import * as THREE from 'three';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: { decode: jest.fn() }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');

function engineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.chunkManager = { updateEntityChunk: jest.fn() };
    engine.socialController = { myPartyId: '' };
    engine.showRemoteStateReadability = jest.fn();
    engine.syncRemoteSupportEffects = jest.fn();
    engine.syncPlayerStatusClears = jest.fn();
    engine.syncPlayerStatusDetails = jest.fn();
    engine.clearAuthoritativeJumpState = jest.fn();
    return engine;
}

function remoteHarness() {
    return {
        id: 'remote-fighter',
        position: new THREE.Vector3(),
        state: 'IDLE',
        stats: {},
        mesh: new THREE.Group(),
        syncEquipmentVisuals: jest.fn(),
        resetTransformInterpolation: jest.fn(),
        pushRemoteTransform: jest.fn(),
        syncAttachedStatusEffects: jest.fn()
    };
}

describe('remote equipment replication', () => {
    test('forwards observer equipment payloads to the actor visual attachment layer', () => {
        const engine = engineHarness();
        const remote = remoteHarness();
        const equipment = {
            mainHand: {
                id: 'remote-sword',
                name: 'Iron Sword',
                slot: 'mainHand',
                rarity: 'Rare'
            }
        };

        engine.syncRemoteEntity(remote, {
            id: remote.id,
            type: 'Player',
            subType: 'Fighter',
            x: 4,
            y: 0,
            z: 8,
            rotation: 0.2,
            state: 'IDLE',
            equipment
        });

        expect(remote.syncEquipmentVisuals).toHaveBeenCalledWith(equipment);
    });

    test('applies an explicit empty map so remote unequips clear stale visuals', () => {
        const engine = engineHarness();
        const remote = remoteHarness();

        engine.syncRemoteEntity(remote, {
            id: remote.id,
            type: 'Player',
            subType: 'Fighter',
            x: 0,
            y: 0,
            z: 0,
            rotation: 0,
            state: 'IDLE',
            equipment: {}
        });

        expect(remote.syncEquipmentVisuals).toHaveBeenCalledWith({});
    });

    test('does not replace retained equipment when the field is genuinely absent', () => {
        const engine = engineHarness();
        const remote = remoteHarness();

        engine.syncRemoteEntity(remote, {
            id: remote.id,
            type: 'Player',
            subType: 'Fighter',
            x: 0,
            y: 0,
            z: 0,
            rotation: 0,
            state: 'IDLE'
        });

        expect(remote.syncEquipmentVisuals).not.toHaveBeenCalled();
    });
});
