import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Actor } from '../src/entities/Actor.js';
import { Entity } from '../src/entities/Entity.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import {
    exponentialSmoothingFactor,
    horizontalDistance,
    horizontalDistanceSquared,
    interpolateAngle,
    MOVEMENT_ARRIVAL_DISTANCE,
    RemoteTransformBuffer
} from '../src/core/MovementSmoothing.js';

const actorConfig = {
    STATS: {
        STRENGTH: 10,
        INTELLIGENCE: 10,
        DEXTERITY: 10,
        WISDOM: 10,
        STAMINA: 10
    },
    MANA_STAT: 'INTELLIGENCE'
};

describe('movement smoothing primitives', () => {
    test('horizontal distance deliberately ignores terrain height', () => {
        const a = new THREE.Vector3(2, 40, -3);
        const b = new THREE.Vector3(5, -20, 1);
        expect(horizontalDistanceSquared(a, b)).toBe(25);
        expect(horizontalDistance(a, b)).toBe(5);
    });

    test('exponential smoothing is frame-rate independent over equal elapsed time', () => {
        const simulate = (fps) => {
            let value = 0;
            const dt = 1 / fps;
            for (let frame = 0; frame < fps; frame += 1) {
                value += (1 - value) * exponentialSmoothingFactor(10, dt);
            }
            return value;
        };

        expect(simulate(30)).toBeCloseTo(simulate(60), 10);
        expect(simulate(60)).toBeCloseTo(simulate(120), 10);
    });

    test('angle interpolation takes the short path across the wrap boundary', () => {
        const from = Math.PI - 0.1;
        const to = -Math.PI + 0.1;
        expect(Math.abs(interpolateAngle(from, to, 0.5))).toBeCloseTo(Math.PI, 5);
    });
});

describe('Actor nearby movement invariants', () => {
    let actor;

    beforeEach(() => {
        actor = new Actor('smooth-actor', actorConfig);
        actor.mesh = new THREE.Group();
        actor.playAnimation = jest.fn();
        actor.stats.speed = 8;
    });

    test('a held click inside the arrival radius remains an idempotent idle no-op', () => {
        const nearby = new THREE.Vector3(MOVEMENT_ARRIVAL_DISTANCE * 0.5, 99, 0);
        for (let frame = 0; frame < 120; frame += 1) {
            expect(actor.move(nearby)).toBe(false);
            actor.update(1 / 60, null, null, null);
        }

        expect(actor.position.toArray()).toEqual([0, 0, 0]);
        expect(actor.targetPosition).toBeNull();
        expect(actor.state).toBe('IDLE');
        expect(actor.playAnimation).not.toHaveBeenCalledWith('Run');
        expect(actor.movementMetrics.nearbyNoops).toBe(120);
    });

    test('equivalent held destinations do not replace or restart an active path', () => {
        const target = new THREE.Vector3(4, 0, 0);
        expect(actor.move(target)).toBe(true);
        const acceptedTarget = actor.targetPosition;

        for (let frame = 0; frame < 60; frame += 1) {
            expect(actor.move(new THREE.Vector3(4.01, 10, 0.005))).toBe(false);
        }

        expect(actor.targetPosition).toBe(acceptedTarget);
        expect(actor.movementMetrics.accepted).toBe(1);
        expect(actor.movementMetrics.equivalentTargets).toBe(60);
    });

    test('held movement waits through a root without Run/Idle thrash and resumes afterward', () => {
        const target = new THREE.Vector3(4, 0, 0);
        actor.rootTimer = 0.5;

        expect(actor.move(target)).toBe(false);
        expect(actor.state).toBe('IDLE');
        expect(actor.targetPosition).not.toBeNull();
        for (let frame = 0; frame < 20; frame += 1) {
            expect(actor.move(target)).toBe(false);
            actor.update(1 / 60, null, null, null);
        }
        expect(actor.playAnimation).not.toHaveBeenCalledWith('Run');

        actor.update(0.2, null, null, null);
        expect(actor.rootTimer).toBeLessThanOrEqual(0);
        expect(actor.move(target)).toBe(true);
        expect(actor.state).toBe('MOVING');
        expect(actor.movementMetrics.accepted).toBe(1);
    });

    test('a short path is monotonic, never overshoots, and settles exactly once', () => {
        expect(actor.move(new THREE.Vector3(1, 0, 0))).toBe(true);
        const positions = [];
        for (let frame = 0; frame < 30 && actor.state === 'MOVING'; frame += 1) {
            actor.update(1 / 60, null, null, null);
            positions.push(actor.position.x);
        }

        expect(positions.length).toBeGreaterThan(1);
        expect(positions.every((position, index) => index === 0 || position >= positions[index - 1])).toBe(true);
        expect(Math.max(...positions)).toBeLessThanOrEqual(1);
        expect(actor.position.x).toBe(1);
        expect(actor.state).toBe('IDLE');
        expect(actor.targetPosition).toBeNull();
        expect(actor.movementMetrics.arrivals).toBe(1);
        actor.update(1 / 60, null, null, null);
        expect(actor.movementMetrics.arrivals).toBe(1);
    });

    test('a blocked destination settles at contact instead of moving forward and snapping back', () => {
        const collision = new CollisionManager();
        const obstacle = {
            id: 'blocking-actor',
            position: new THREE.Vector3(3, 0, 0),
            radius: 1.25,
            stats: { hp: 100 },
            state: 'IDLE',
            isActive: true,
            isRemote: true
        };
        const chunkManager = {
            getChunkKey: jest.fn(() => '0,0'),
            chunks: new Map([['0,0', new Set([actor, obstacle])]])
        };
        const target = obstacle.position.clone();
        const positions = [];

        for (let frame = 0; frame < 90; frame += 1) {
            actor.move(target);
            actor.update(1 / 60, collision, actor, chunkManager);
            positions.push(actor.position.x);
        }

        expect(positions.every((position, index) => index === 0 || position >= positions[index - 1] - 0.001)).toBe(true);
        expect(actor.state).toBe('IDLE');
        expect(actor.targetPosition).toBeNull();
        expect(actor.blockedTargetPosition).not.toBeNull();
        expect(actor.movementMetrics.blockedStops).toBe(1);
        expect(actor.movementMetrics.blockedTargetNoops).toBeGreaterThan(0);

        actor.clearBlockedMovementTarget();
        expect(actor.move(target)).toBe(true);
    });
});

describe('render transform interpolation', () => {
    test('renders between fixed transforms at the display refresh fraction', () => {
        const entity = new Entity('interpolated');
        entity.mesh = new THREE.Group();
        entity.position.set(0, 0, 0);
        entity.rotation.identity();
        entity.resetTransformInterpolation();
        entity.capturePreviousTransform();
        entity.position.set(2, 0, 4);
        entity.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        entity.visualOffset = new THREE.Vector3(0.25, 0, -0.5);

        entity.render(0.5);

        expect(entity.mesh.position.x).toBeCloseTo(1.25);
        expect(entity.mesh.position.z).toBeCloseTo(1.5);
        const halfway = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        expect(entity.mesh.quaternion.angleTo(halfway)).toBeCloseTo(0, 5);
    });
});

describe('timestamped remote transform buffer', () => {
    test('preserves server spacing despite jittery receipt times', () => {
        const buffer = new RemoteTransformBuffer({ delay: 0.1, maxExtrapolation: 0.08 });
        buffer.push(new THREE.Vector3(0, 0, 0), 0, {
            serverTimeMs: 100_000,
            receiptTimeSeconds: 0,
            state: 'MOVING'
        });
        buffer.push(new THREE.Vector3(10, 0, 0), Math.PI / 2, {
            serverTimeMs: 100_100,
            receiptTimeSeconds: 0.19,
            state: 'MOVING'
        });

        const midpoint = buffer.sample({ nowSeconds: 0.15 });
        expect(midpoint.mode).toBe('interpolate');
        expect(midpoint.position.x).toBeCloseTo(5, 5);
        expect(midpoint.rotation).toBeCloseTo(Math.PI / 4, 5);
    });

    test('rejects stale samples and resets history for a real teleport', () => {
        const buffer = new RemoteTransformBuffer({ teleportDistance: 10 });
        buffer.push(new THREE.Vector3(0, 0, 0), 0, {
            serverTimeMs: 10_000,
            receiptTimeSeconds: 0,
            state: 'MOVING'
        });
        buffer.push(new THREE.Vector3(1, 0, 0), 0, {
            serverTimeMs: 10_100,
            receiptTimeSeconds: 0.1,
            state: 'MOVING'
        });
        expect(buffer.push(new THREE.Vector3(-4, 0, 0), 0, {
            serverTimeMs: 10_050,
            receiptTimeSeconds: 0.2,
            state: 'MOVING'
        })).toEqual(expect.objectContaining({ accepted: false, reason: 'stale' }));

        expect(buffer.push(new THREE.Vector3(30, 0, 0), 0, {
            serverTimeMs: 10_200,
            receiptTimeSeconds: 0.2,
            state: 'IDLE'
        })).toEqual(expect.objectContaining({ accepted: true, teleported: true }));
        expect(buffer.getMetrics()).toEqual(expect.objectContaining({ samples: 1, stale: 1, teleports: 1 }));
    });

    test('extrapolation is bounded and stops when the authoritative state is idle', () => {
        const buffer = new RemoteTransformBuffer({ delay: 0, maxExtrapolation: 0.08 });
        buffer.push(new THREE.Vector3(0, 0, 0), 0, {
            receiptTimeSeconds: 0,
            state: 'MOVING'
        });
        buffer.push(new THREE.Vector3(1, 0, 0), 0, {
            receiptTimeSeconds: 0.1,
            state: 'MOVING'
        });
        expect(buffer.sample({ nowSeconds: 0.15 }).position.x).toBeCloseTo(1.5, 5);
        expect(buffer.sample({ nowSeconds: 0.3 }).position.x).toBe(1);

        buffer.push(new THREE.Vector3(1, 0, 0), 0, {
            receiptTimeSeconds: 0.31,
            state: 'IDLE'
        });
        const stopped = buffer.sample({ nowSeconds: 0.35 });
        expect(stopped.mode).toBe('hold');
        expect(stopped.position.x).toBe(1);
    });
});
