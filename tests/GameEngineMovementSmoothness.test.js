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
const { MeshFactory } = await import('../src/utils/MeshFactory.js');

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
    test('approved recovery context tags fresh movement and forces a new sample', () => {
        const engine = movementHarness();
        engine.sendPlayerMovementIfNeeded(1 / 60);
        expect(engine.network.send.mock.lastCall[1].movementContext).toBe('');
        engine.handleServerMessage({ type: 'movement_context', payload: { movementContext: 'fresh-recall' } });
        expect(engine.ensureMovementNetworkState().lastPacket).toBeNull();
        engine.sendPlayerMovementIfNeeded(1 / 30);
        expect(engine.network.send.mock.lastCall[1].movementContext).toBe('fresh-recall');
        engine.handleServerMessage({ type: 'movement_context', payload: { movementContext: '' } });
        expect(engine.ensureMovementNetworkState().recoveryContext).toBe('');
    });
    test('server-owned charge reconciles short steps and the final landing without replaying it', () => {
        const engine = movementHarness();
        engine.sendPlayerMovementIfNeeded(1 / 60);
        const point = new THREE.Vector3(0, 0, 1);
        expect(engine.getLocalPositionCorrectionReason({ moveSequence: 1, isCharging: true }, point, 1))
            .not.toBeNull();
        point.z = 2;
        expect(engine.getLocalPositionCorrectionReason({ moveSequence: 1, isCharging: true }, point, 1))
            .toBe('authoritative charge');
        point.z = 2.5;
        expect(engine.getLocalPositionCorrectionReason({ moveSequence: 1, isCharging: false }, point, 0.5))
            .toBe('authoritative charge landing');
        const next = engine.getLocalPositionCorrectionReason({ moveSequence: 1, isCharging: false }, point, 0);
        expect(next).not.toBe('authoritative charge landing');
        expect(engine.getLocalPositionCorrectionReason({ moveSequence: 1, isCharging: false }, point, 0)).toBeNull();
    });

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

    test('a duplicate acknowledgement never stops a high-speed prediction far ahead of it', () => {
        const engine = movementHarness();
        engine.sendPlayerMovementIfNeeded(1 / 60);

        expect(engine.getLocalPositionCorrectionReason(
            { moveSequence: 1, state: 'MOVING' },
            new THREE.Vector3(0, 0, 0),
            0
        )).toBeNull();

        // At the 28.8 unit/s movement cap the client can be more than the
        // three-unit discontinuity threshold ahead during a latency spike.
        engine.player.position.x = 4.8;
        expect(engine.getLocalPositionCorrectionReason(
            { moveSequence: 1, state: 'MOVING' },
            new THREE.Vector3(0, 0, 0),
            4.8
        )).toBeNull();
        expect(engine.getMovementMetrics().local).toEqual(expect.objectContaining({
            duplicateAcknowledgements: 1,
            hardCorrections: 0
        }));
    });

    test('server-owned movement with an unchanged acknowledgement remains authoritative', () => {
        const engine = movementHarness();
        engine.sendPlayerMovementIfNeeded(1 / 60);
        engine.getLocalPositionCorrectionReason(
            { moveSequence: 1, state: 'MOVING' },
            new THREE.Vector3(0, 0, 0),
            0
        );

        expect(engine.getLocalPositionCorrectionReason(
            { moveSequence: 1, state: 'ATTACKING' },
            new THREE.Vector3(8, 0, 0),
            8
        )).toBe('authoritative discontinuity');
        expect(engine.getMovementMetrics().local.hardCorrections).toBe(1);
    });

    test('predicted movement ignores stale idle and ordinary cast states', () => {
        const engine = movementHarness();
        engine.player.state = 'MOVING';
        engine.player.targetPosition = new THREE.Vector3(12, 0, 0);

        expect(engine.shouldPreservePredictedPlayerMovement('IDLE')).toBe(true);
        expect(engine.shouldPreservePredictedPlayerMovement('ATTACKING')).toBe(false);

        engine.player.currentAbilityAnimation = { skillName: 'Spirit Guardians' };

        expect(engine.shouldPreservePredictedPlayerMovement('ATTACKING')).toBe(true);
        expect(engine.shouldPreservePredictedPlayerMovement('DEAD')).toBe(false);
        engine.player.targetPosition = null;
        expect(engine.shouldPreservePredictedPlayerMovement('IDLE')).toBe(false);
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

    test('a failed simulation tick does not permanently stop the animation frame pump', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.lastTime = 0;
        engine.accumulator = 0;
        engine.fixedTimeStep = 1 / 60;
        engine.isDestroyed = false;
        engine.update = jest.fn(() => {
            throw new Error('transient entity update failure');
        });
        engine.render = jest.fn();

        const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        const requestFrame = jest.fn(() => 42);
        globalThis.requestAnimationFrame = requestFrame;
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

        try {
            engine.loop(20);
            expect(consoleError).toHaveBeenCalledWith(
                'GameEngine Loop Error:',
                expect.objectContaining({ message: 'transient entity update failure' })
            );
            expect(engine.accumulator).toBe(0);
            expect(requestFrame).toHaveBeenCalledTimes(1);
            expect(engine.animationFrameId).toBe(42);
        } finally {
            consoleError.mockRestore();
            globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        }
    });

    test('a slow rendered frame advances at most two fixed movement ticks', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.lastTime = 0;
        engine.accumulator = 0;
        engine.fixedTimeStep = 1 / 60;
        engine.isDestroyed = false;
        engine.update = jest.fn();
        engine.render = jest.fn();

        const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = jest.fn(() => 43);

        try {
            engine.loop(100);
            expect(engine.update).toHaveBeenCalledTimes(2);
            expect(engine.render).toHaveBeenCalledTimes(1);
        } finally {
            globalThis.requestAnimationFrame = originalRequestAnimationFrame;
        }
    });

    test('loads noncritical overworld scenery after startup without blocking and deduplicates the job', async () => {
        const engine = Object.create(GameEngine.prototype);
        engine.isDestroyed = false;
        engine.currentInstanceType = null;
        engine.overworldSceneGeneration = 0;
        engine.overworldSceneryReady = false;
        engine.deferredOverworldSceneryPromise = null;
        engine.worldGenerator = {
            loadTrees: jest.fn().mockResolvedValue(true),
            loadBuildings: jest.fn().mockResolvedValue(),
            createOverworldStructures: jest.fn().mockResolvedValue(true)
        };
        const preloadSpy = jest.spyOn(MeshFactory, 'preloadAllModels').mockResolvedValue({
            completed: 4,
            total: 4,
            failures: []
        });

        try {
            const first = engine.startDeferredOverworldScenery();
            const second = engine.startDeferredOverworldScenery();
            expect(second).toBe(first);
            await expect(first).resolves.toBe(true);

            expect(preloadSpy).toHaveBeenCalledWith(expect.objectContaining({
                phase: 'background',
                failFast: false
            }));
            expect(engine.worldGenerator.loadTrees).toHaveBeenCalledWith(0, 200, {
                shouldAttach: expect.any(Function)
            });
            expect(engine.worldGenerator.loadBuildings).toHaveBeenCalledWith(0, 200, {
                shouldAttach: expect.any(Function)
            });
            expect(engine.worldGenerator.createOverworldStructures).toHaveBeenCalledTimes(1);
            expect(engine.overworldSceneryReady).toBe(true);
        } finally {
            preloadSpy.mockRestore();
        }
    });

    test('optional background preload failures do not suppress functional overworld structures', async () => {
        const engine = Object.create(GameEngine.prototype);
        engine.isDestroyed = false;
        engine.currentInstanceType = null;
        engine.overworldSceneGeneration = 0;
        engine.overworldSceneryReady = false;
        engine.deferredOverworldSceneryPromise = null;
        engine.worldGenerator = {
            loadTrees: jest.fn().mockResolvedValue(true),
            loadBuildings: jest.fn().mockResolvedValue(),
            createOverworldStructures: jest.fn().mockResolvedValue(true)
        };
        const preloadSpy = jest.spyOn(MeshFactory, 'preloadAllModels').mockResolvedValue({
            completed: 3,
            total: 4,
            failures: [{ path: './assets/plants/optional.glb', error: new Error('optional timeout') }]
        });
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

        try {
            await expect(engine.startDeferredOverworldScenery()).resolves.toBe(true);
            expect(engine.worldGenerator.createOverworldStructures).toHaveBeenCalledTimes(1);
            expect(engine.worldGenerator.loadTrees).toHaveBeenCalledTimes(1);
            expect(engine.worldGenerator.loadBuildings).toHaveBeenCalledTimes(1);
            expect(engine.overworldSceneryReady).toBe(true);
            expect(consoleWarn).toHaveBeenCalledWith(
                expect.stringContaining('continuing after 1 optional model preload failure')
            );
        } finally {
            consoleWarn.mockRestore();
            preloadSpy.mockRestore();
        }
    });

    test('does not attach deferred overworld scenery after an instance transition', async () => {
        const engine = Object.create(GameEngine.prototype);
        engine.isDestroyed = false;
        engine.currentInstanceType = null;
        engine.overworldSceneGeneration = 0;
        engine.overworldSceneryReady = false;
        engine.deferredOverworldSceneryPromise = null;
        engine.worldGenerator = {
            loadTrees: jest.fn().mockResolvedValue(true),
            loadBuildings: jest.fn().mockResolvedValue(),
            createOverworldStructures: jest.fn(async ({ shouldAttach }) => {
                await Promise.resolve();
                return shouldAttach();
            })
        };
        let finishPreload;
        const preloadSpy = jest.spyOn(MeshFactory, 'preloadAllModels').mockImplementation(() => (
            new Promise(resolve => { finishPreload = resolve; })
        ));

        try {
            const scenery = engine.startDeferredOverworldScenery();
            engine.overworldSceneGeneration += 1;
            engine.currentInstanceType = 'molten_core';
            finishPreload({ completed: 4, total: 4, failures: [] });

            await expect(scenery).resolves.toBe(false);
            expect(engine.worldGenerator.loadTrees).toHaveBeenCalledTimes(1);
            expect(engine.worldGenerator.loadBuildings).toHaveBeenCalledWith(0, 200, {
                shouldAttach: expect.any(Function)
            });
            expect(engine.worldGenerator.createOverworldStructures).toHaveBeenCalledTimes(1);
            expect(engine.worldGenerator.createOverworldStructures).toHaveBeenCalledWith({
                shouldAttach: expect.any(Function)
            });
        } finally {
            preloadSpy.mockRestore();
        }
    });
});
