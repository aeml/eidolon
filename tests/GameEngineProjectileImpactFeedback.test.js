import * as THREE from 'three';
import { jest } from '@jest/globals';
import { GameEngine } from '../src/core/GameEngine.js';
import { Projectile } from '../src/entities/Projectile.js';

function makeEngine() {
    return {
        player: { id: 'player-local', skillRunes: {}, position: new THREE.Vector3() },
        currentInstanceId: 'dungeon-impact-test',
        remotePlayers: new Map(),
        projectileImpactCueKeys: new Map(),
        spawnTransientEffect: jest.fn(() => true),
        renderProjectileImpactFeedback: GameEngine.prototype.renderProjectileImpactFeedback,
        handleServerMessage: GameEngine.prototype.handleServerMessage
    };
}

describe('authoritative projectile impact feedback', () => {
    test('renders the server identity, direction, target, and exact radius', () => {
        const engine = makeEngine();
        engine.handleServerMessage({
            type: 'projectile_impact',
            payload: {
                projectileId: 'meteor-1', projectileType: 'Meteor', sourceId: 'player-local',
                targetId: 'enemy-1', instanceId: 'dungeon-impact-test', skillName: 'Meteor Drop',
                x: 12, y: 0, z: -8, directionX: 0.5, directionZ: 1,
                radius: 39.6, terminal: true
            }
        });
        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'projectile_impact',
            expect.objectContaining({ x: 12, y: 0.04, z: -8 }),
            0xffffff,
            expect.objectContaining({
                projectileType: 'Meteor',
                source: engine.player,
                radius: 39.6,
                targetId: 'enemy-1',
                terminal: true,
                skillName: 'Meteor Drop'
            })
        );
        expect(engine.lastProjectileImpactPresentation).toEqual(expect.objectContaining({
            projectileId: 'meteor-1', projectileType: 'Meteor', radius: 39.6, terminal: true
        }));
    });

    test('filters other instances and unknown projectile identities', () => {
        const engine = makeEngine();
        expect(engine.renderProjectileImpactFeedback({
            projectileId: 'other', projectileType: 'Dagger', instanceId: 'another-dungeon', x: 0, z: 0
        })).toBe(false);
        expect(engine.renderProjectileImpactFeedback({
            projectileId: 'unknown', projectileType: 'UnknownBolt', instanceId: 'dungeon-impact-test', x: 0, z: 0
        })).toBe(false);
        expect(engine.spawnTransientEffect).not.toHaveBeenCalled();
    });

    test('ignores distant overworld impacts unless their source or projectile is replicated', () => {
        const engine = makeEngine();
        engine.currentInstanceId = null;
        expect(engine.renderProjectileImpactFeedback({
            projectileId: 'far-dagger', projectileType: 'Dagger', sourceId: 'far-player',
            instanceId: '', x: 900, z: -900, targetId: 'far-enemy', terminal: false
        })).toBe(false);
        engine.remotePlayers.set('near-player', { id: 'near-player' });
        expect(engine.renderProjectileImpactFeedback({
            projectileId: 'near-dagger', projectileType: 'Dagger', sourceId: 'near-player',
            instanceId: '', x: 4, z: 3, targetId: 'near-enemy', terminal: false
        })).toBe(true);
        expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(1);
    });

    test('deduplicates terminal delivery while preserving separate piercing targets', () => {
        const engine = makeEngine();
        const base = {
            projectileId: 'dagger-1', projectileType: 'Dagger', sourceId: 'player-local',
            instanceId: 'dungeon-impact-test', x: 1, y: 1, z: 2
        };
        expect(engine.renderProjectileImpactFeedback({ ...base, targetId: 'enemy-a', terminal: false })).toBe(true);
        expect(engine.renderProjectileImpactFeedback({ ...base, targetId: 'enemy-a', terminal: false })).toBe(false);
        expect(engine.renderProjectileImpactFeedback({ ...base, targetId: 'enemy-b', terminal: false })).toBe(true);
        expect(engine.renderProjectileImpactFeedback({ ...base, targetId: 'enemy-b', terminal: true })).toBe(true);
        expect(engine.renderProjectileImpactFeedback({ ...base, targetId: 'enemy-c', terminal: true })).toBe(false);
        expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(3);
    });

    test('derives a missing explosive radius from the projectile contract', () => {
        const engine = makeEngine();
        engine.renderProjectileImpactFeedback({
            projectileId: 'fireball-1', projectileType: 'Fireball', sourceId: 'player-local',
            instanceId: 'dungeon-impact-test', x: 0, z: 0, terminal: true
        });
        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'projectile_impact', expect.any(THREE.Vector3), 0xffffff,
            expect.objectContaining({ radius: 10 })
        );
    });

    test('remote Meteor removal uses the typed deduplicated fallback', () => {
        const engine = makeEngine();
        const owner = {
            id: 'player-local', stats: { intelligence: 10, dexterity: 10, wisdom: 10 },
            skillRunes: {}, isMultiplayer: true, isRemote: false, constructor: { name: 'Wizard' }
        };
        const meteor = new Projectile('meteor-removal', owner, 'Meteor',
            new THREE.Vector3(3, 8, 4), new THREE.Vector3(3, 0, 4));
        meteor.explosionRadius = 26.4;
        engine.remotePlayers.set(meteor.id, meteor);
        engine.chunkManager = {
            getChunkKey: jest.fn(() => '0,0'),
            chunks: new Map()
        };
        engine.renderSystem = { remove: jest.fn() };
        engine.removeRemoteEntity = GameEngine.prototype.removeRemoteEntity;

        engine.removeRemoteEntity(meteor.id);

        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'projectile_impact', expect.any(THREE.Vector3), 0xffffff,
            expect.objectContaining({ projectileType: 'Meteor', radius: 26.4, terminal: true })
        );
        expect(engine.remotePlayers.has(meteor.id)).toBe(false);
    });
});
