import { jest } from '@jest/globals';
import * as THREE from 'three';

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

function movementHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.isMultiplayer = true;
    engine.player = {
        id: 'player-smooth',
        position: new THREE.Vector3(),
        rotation: new THREE.Quaternion(),
        state: 'IDLE',
        movementMetrics: {}
    };
    engine.network = { send: jest.fn() };
    engine.remotePlayers = new Map();
    return engine;
}

describe('GameEngine ordered movement transport', () => {
    test('sends movement at 30 Hz, sends state edges immediately, and suppresses idle floods', () => {
        const engine = movementHarness();

        expect(engine.sendPlayerMovementIfNeeded(1 / 60)).toBe(true);
        for (let frame = 0; frame < 120; frame += 1) {
            engine.sendPlayerMovementIfNeeded(1 / 60);
        }
        expect(engine.network.send.mock.calls.length).toBeLessThanOrEqual(3);

        engine.player.state = 'MOVING';
        expect(engine.sendPlayerMovementIfNeeded(1 / 60)).toBe(true);
        for (let frame = 0; frame < 60; frame += 1) {
            engine.player.position.x += 0.1;
            engine.sendPlayerMovementIfNeeded(1 / 60);
        }
        const movingPackets = engine.network.send.mock.calls
            .map(([, payload]) => payload)
            .filter((payload) => payload.state === 'MOVING');
        expect(movingPackets.length).toBeGreaterThanOrEqual(29);
        expect(movingPackets.length).toBeLessThanOrEqual(32);

        engine.player.state = 'IDLE';
        expect(engine.sendPlayerMovementIfNeeded(0)).toBe(true);
        const payloads = engine.network.send.mock.calls.map(([, payload]) => payload);
        expect(payloads.at(-1).state).toBe('IDLE');
        expect(payloads.every((payload, index) => index === 0 || payload.sequence > payloads[index - 1].sequence)).toBe(true);
    });

    test('an acknowledged prediction is never treated as delayed pullback', () => {
        const engine = movementHarness();
        engine.sendPlayerMovementIfNeeded(1 / 60);
        engine.player.position.x = 1;

        const reason = engine.getLocalPositionCorrectionReason(
            { moveSequence: 1, state: 'MOVING' },
            new THREE.Vector3(0, 0, 0),
            1
        );

        expect(reason).toBeNull();
        expect(engine.getMovementMetrics().local).toEqual(expect.objectContaining({
            acknowledged: 1,
            pendingAcknowledgements: 0,
            serverAdjustments: 0
        }));
    });

    test('a server clamp at the acknowledged sequence is a real correction', () => {
        const engine = movementHarness();
        engine.player.position.set(4, 0, 0);
        engine.sendPlayerMovementIfNeeded(1 / 60);

        const reason = engine.getLocalPositionCorrectionReason(
            { moveSequence: 1, state: 'IDLE' },
            new THREE.Vector3(3.5, 0, 0),
            0.5
        );

        expect(reason).toBe('acknowledged server adjustment');
        expect(engine.getMovementMetrics().local).toEqual(expect.objectContaining({
            serverAdjustments: 1,
            maxServerAdjustment: 0.5
        }));
    });

    test('an authoritative resume counter rebases a freshly constructed client sequence', () => {
        const engine = movementHarness();

        expect(engine.getLocalPositionCorrectionReason(
            { moveSequence: 73, state: 'IDLE' },
            new THREE.Vector3(0, 0, 0),
            0
        )).toBeNull();
        expect(engine.movementNetworkState.nextSequence).toBe(74);

        expect(engine.sendPlayerMovementIfNeeded(1 / 60)).toBe(true);
        expect(engine.network.send).toHaveBeenLastCalledWith(
            'move',
            expect.objectContaining({ sequence: 74 })
        );
    });

    test('a stale acknowledgement never pulls the player backward even when far away', () => {
        const engine = movementHarness();
        engine.movementNetworkState = {
            playerId: engine.player.id,
            clock: 1,
            lastSentAt: 1,
            nextSequence: 12,
            lastAcknowledgedSequence: 10,
            lastPacket: null,
            sentHistory: new Map()
        };

        expect(engine.getLocalPositionCorrectionReason(
            { moveSequence: 9, state: 'MOVING' },
            new THREE.Vector3(-20, 0, 0),
            20
        )).toBeNull();
        expect(engine.movementTelemetry.staleAcknowledgements).toBe(1);
    });

    test('prediction history remains bounded during sustained movement', () => {
        const engine = movementHarness();
        engine.player.state = 'MOVING';
        for (let sample = 0; sample < 400; sample += 1) {
            engine.player.position.x += 0.1;
            engine.sendPlayerMovementIfNeeded(1 / 30);
        }
        expect(engine.ensureMovementNetworkState().sentHistory.size).toBe(180);
    });
});
