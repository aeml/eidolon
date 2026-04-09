import * as THREE from 'three';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => {
    const mock = {
        eidolon: {
            state: {
                StateEnvelope: {
                    decode: jest.fn()
                }
            }
        }
    };
    return { default: mock, ...mock };
});

const { GameEngine } = await import('../src/core/GameEngine.js');

describe('GameEngine encounter callouts', () => {
    test('notifies UI when a boss telegraph arrives', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.effects = [];
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.spawnTransientEffect = jest.fn(() => true);
        engine.uiManager = {
            showCombatCallout: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'telegraph',
            payload: {
                x: 3,
                z: 9,
                radius: 12,
                duration: 2,
                threatTier: 'boss',
                label: 'MAELSTROM SLAM'
            }
        });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'MAELSTROM SLAM',
            tone: 'boss',
            duration: 2,
            subtitle: 'Brace for impact'
        }));
    });

    test('announces the next dangerous dungeon beat when room state advances', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 0,
            objectiveRoomIndex: 1,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: false },
                { index: 2, type: 'elite', hook: 'elite_ambush', explored: false, cleared: false },
                { index: 3, type: 'boss', explored: false, cleared: false }
            ]
        };
        engine.uiManager = {
            showCombatCallout: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'dungeon_room_state',
            payload: {
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: true },
                    { index: 2, type: 'elite', hook: 'elite_ambush', explored: true, cleared: false },
                    { index: 3, type: 'boss', explored: false, cleared: false }
                ]
            }
        });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Next: Ambush',
            tone: 'warning',
            subtitle: 'Elite room ahead — pressure spike incoming'
        }));
    });

    test('frames shrine objectives as the last reset before the boss push', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 1,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'elite', hook: 'elite_ambush', explored: true, cleared: false },
                { index: 2, type: 'normal', hook: 'shrine', explored: false, cleared: false },
                { index: 3, type: 'boss', explored: false, cleared: false }
            ]
        };
        engine.uiManager = {
            showCombatCallout: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'dungeon_room_state',
            payload: {
                currentRoomIndex: 1,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'elite', hook: 'elite_ambush', explored: true, cleared: true },
                    { index: 2, type: 'normal', hook: 'shrine', explored: true, cleared: false },
                    { index: 3, type: 'boss', explored: false, cleared: false }
                ]
            }
        });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Next: Shrine',
            tone: 'support',
            subtitle: 'Last reset before the boss push'
        }));
    });
});
