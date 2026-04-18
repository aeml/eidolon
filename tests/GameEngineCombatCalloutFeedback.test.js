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

    test('frames chest objectives as a quick score before an ambush spike', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 0,
            objectiveRoomIndex: 0,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'normal', hook: 'chest', explored: false, cleared: false },
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
                currentRoomIndex: 0,
                objectiveRoomIndex: 1,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: false },
                    { index: 2, type: 'elite', hook: 'elite_ambush', explored: false, cleared: false },
                    { index: 3, type: 'boss', explored: false, cleared: false }
                ]
            }
        });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Next: Chest',
            tone: 'support',
            subtitle: 'Quick score before the ambush spike'
        }));
    });

    test('distinguishes boss rooms that are live now from bosses that are only unlocked ahead', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 2,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'normal', hook: 'shrine', explored: true, cleared: true },
                { index: 2, type: 'boss', explored: true, cleared: false }
            ]
        };
        engine.uiManager = {
            showCombatCallout: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'dungeon_room_state',
            payload: {
                currentRoomIndex: 2,
                objectiveRoomIndex: 2,
                rooms: [
                    { index: 0, type: 'start', explored: true, cleared: true },
                    { index: 1, type: 'normal', hook: 'shrine', explored: true, cleared: true },
                    { index: 2, type: 'boss', explored: true, cleared: false }
                ]
            }
        });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Boss Now',
            tone: 'boss',
            subtitle: 'You are in the boss room — commit and survive'
        }));
    });

    test('moveToAndInteract surfaces a move-into-range callout for hostile targets', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            position: new THREE.Vector3(0, 0, 0),
            move: jest.fn()
        };
        engine.abilityController = {
            pendingAbilityTarget: null,
            pendingAbilitySkill: null
        };
        engine.pendingInteraction = null;
        engine.getInteractionRangeForEntity = jest.fn(() => 4.0);
        engine.getInteractableEntityLabel = jest.fn(() => 'Skeleton Archer');
        engine.isHostileActorTarget = jest.fn(() => true);
        engine.showReadabilityFeedback = jest.fn();
        engine.moveToAndInteract = GameEngine.prototype.moveToAndInteract;

        engine.moveToAndInteract({
            id: 'enemy-1',
            name: 'Skeleton Archer',
            position: new THREE.Vector3(10, 0, 0)
        });

        expect(engine.showReadabilityFeedback).toHaveBeenCalledWith(
            'interact-range-hostile',
            expect.objectContaining({
                title: 'Move into range',
                metaText: '10.0m away'
            }),
            900
        );
        expect(engine.player.move).toHaveBeenCalled();
    });

    test('handleLevelUpFeedback announces milestone unlock guidance', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            position: new THREE.Vector3(0, 0, 0)
        };
        engine.renderSystem = { effectGroup: new THREE.Group() };
        engine.effects = [];
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.uiManager = { showCombatCallout: jest.fn() };
        engine.network = { send: jest.fn() };
        engine.username = 'tester';
        engine.handleLevelUpFeedback = GameEngine.prototype.handleLevelUpFeedback;
        engine.getLevelUpReadabilityHint = GameEngine.prototype.getLevelUpReadabilityHint;

        engine.handleLevelUpFeedback(29, 30);

        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('LEVEL UP!', expect.any(THREE.Vector3), '#ffd700');
        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Level 30 Reached',
            subtitle: expect.stringContaining('All base dungeons are now unlocked')
        }));
        expect(engine.network.send).toHaveBeenCalledWith('chat', expect.objectContaining({ message: expect.stringContaining('level 30') }));
    });
});
