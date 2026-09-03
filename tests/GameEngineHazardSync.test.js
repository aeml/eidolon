import * as THREE from 'three';
import { jest } from '@jest/globals';
import { EnvironmentalHazard } from '../src/entities/EnvironmentalHazard.js';

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

function hazardPayload(overrides = {}) {
    return {
        id: 'hazard-lava-0',
        type: 'Hazard',
        subType: 'lava_pool',
        x: -1150,
        y: 0,
        z: 100,
        scale: 6,
        state: 'IDLE',
        ...overrides
    };
}

function createHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.player = { id: 'player-1' };
    engine.remotePlayers = new Map();
    engine.hazards = new Map();
    engine.recentlyPickedUpLoot = new Set();
    engine.pendingEntityIds = new Set();
    engine.entityCreationQueue = [];
    engine.frameCount = 1;
    engine.isMultiplayer = false;
    engine._firstStateReceived = true;
    engine.renderSystem = {
        environmentGroup: new THREE.Group(),
        instanceEnvironmentGroup: new THREE.Group(),
        graphicsQuality: 'low'
    };
    engine.applyPositionHacks = GameEngine.prototype.applyPositionHacks;
    engine.removeRemoteEntity = jest.fn();
    return engine;
}

describe('GameEngine authoritative environmental-hazard reconciliation', () => {
    test('repeated full snapshots retain exactly one matching visual instance', () => {
        const engine = createHarness();
        const payload = hazardPayload();
        const hazard = new EnvironmentalHazard(
            payload.id,
            payload.subType,
            { x: payload.x, y: 0, z: payload.z },
            { radius: payload.scale, quality: 'low' }
        );
        hazard.addToScene(engine.renderSystem.instanceEnvironmentGroup);
        engine.hazards.set(payload.id, hazard);
        const originalMeshes = [...hazard.meshes];

        engine.handleServerMessage({ type: 'state', payload: { [payload.id]: payload } });
        engine.handleServerMessage({ type: 'state', payload: { [payload.id]: payload } });

        expect(engine.hazards.get(payload.id)).toBe(hazard);
        expect(engine.entityCreationQueue).toHaveLength(0);
        expect(engine.renderSystem.instanceEnvironmentGroup.children).toEqual(originalMeshes);
    });

    test('changed authoritative footprint disposes the old visual and queues one replacement', () => {
        const engine = createHarness();
        const payload = hazardPayload();
        const hazard = new EnvironmentalHazard(
            payload.id,
            payload.subType,
            { x: payload.x, y: 0, z: payload.z },
            { radius: payload.scale }
        );
        hazard.addToScene(engine.renderSystem.instanceEnvironmentGroup);
        engine.hazards.set(payload.id, hazard);
        const disposeSpy = jest.spyOn(hazard, 'dispose');

        const changed = hazardPayload({ x: -1148, scale: 8 });
        engine.handleServerMessage({ type: 'delta', payload: { u: { [changed.id]: changed }, r: [] } });
        engine.handleServerMessage({ type: 'delta', payload: { u: { [changed.id]: changed }, r: [] } });

        expect(disposeSpy).toHaveBeenCalledTimes(1);
        expect(engine.hazards.has(payload.id)).toBe(false);
        expect(engine.entityCreationQueue).toHaveLength(1);
        expect(engine.entityCreationQueue[0]).toEqual(expect.objectContaining({
            id: payload.id,
            x: -1148,
            scale: 8,
            subType: 'lava_pool'
        }));
        expect(engine.pendingEntityIds).toEqual(new Set([payload.id]));
        expect(engine.renderSystem.instanceEnvironmentGroup.children).toHaveLength(0);
    });

    test('full state removes stale live and pending hazards before they can reappear', () => {
        const engine = createHarness();
        const live = new EnvironmentalHazard(
            'hazard-stale-live',
            'wind_gust',
            { x: 1200, z: 100 },
            { radius: 6 }
        );
        live.addToScene(engine.renderSystem.instanceEnvironmentGroup);
        engine.hazards.set(live.id, live);
        const disposeSpy = jest.spyOn(live, 'dispose');
        engine.queueEntityCreation(hazardPayload({ id: 'hazard-stale-pending' }));

        engine.handleServerMessage({ type: 'state', payload: {} });

        expect(disposeSpy).toHaveBeenCalledTimes(1);
        expect(engine.hazards.size).toBe(0);
        expect(engine.entityCreationQueue).toHaveLength(0);
        expect(engine.pendingEntityIds.size).toBe(0);
        expect(engine.renderSystem.instanceEnvironmentGroup.children).toHaveLength(0);
    });

    test('delta removal cancels a hazard that has not reached its creation frame', () => {
        const engine = createHarness();
        const payload = hazardPayload({ id: 'hazard-removed-before-create' });
        engine.queueEntityCreation(payload);

        engine.handleServerMessage({
            type: 'delta',
            payload: { u: {}, r: [payload.id] }
        });

        expect(engine.entityCreationQueue).toHaveLength(0);
        expect(engine.pendingEntityIds.size).toBe(0);
        expect(engine.hazards.size).toBe(0);
    });

    test('full state also cancels stale pending ordinary entities', () => {
        const engine = createHarness();
        engine.queueEntityCreation({ id: 'enemy-stale', type: 'Enemy', x: 1, z: 2 });
        engine.queueEntityCreation({ id: 'enemy-current', type: 'Enemy', x: 3, z: 4 });

        engine.handleServerMessage({
            type: 'state',
            payload: {
                'enemy-current': { id: 'enemy-current', type: 'Enemy', x: 3, z: 4 }
            }
        });

        expect(engine.entityCreationQueue.map(entry => entry.id)).toEqual(['enemy-current']);
        expect(engine.pendingEntityIds).toEqual(new Set(['enemy-current']));
    });

    test('snapshot comparison includes type, position, and exact gameplay radius', () => {
        const engine = createHarness();
        const snapshot = engine.getEnvironmentalHazardSnapshot(hazardPayload());
        const hazard = new EnvironmentalHazard(
            snapshot.id,
            snapshot.hazardType,
            { x: snapshot.x, z: snapshot.z },
            { radius: snapshot.radius }
        );

        expect(engine.environmentalHazardMatchesSnapshot(hazard, snapshot)).toBe(true);
        expect(engine.environmentalHazardMatchesSnapshot(hazard, { ...snapshot, radius: 6.001 })).toBe(false);
        expect(engine.environmentalHazardMatchesSnapshot(hazard, { ...snapshot, x: snapshot.x + 1 })).toBe(false);
        expect(engine.environmentalHazardMatchesSnapshot(hazard, { ...snapshot, hazardType: 'sandstorm' })).toBe(false);

        hazard.dispose();
    });
});
