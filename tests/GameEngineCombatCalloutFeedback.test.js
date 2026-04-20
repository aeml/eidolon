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

    test('shows a nearby remote-player ability label and forces an attacking state', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-1',
            name: 'Ayla',
            position: new THREE.Vector3(8, 0, 0),
            state: 'IDLE',
            isRemote: true,
            constructor: { name: 'Wizard' },
            rotation: new THREE.Quaternion(),
            mesh: {
                quaternion: new THREE.Quaternion(),
                lookAt: jest.fn(function lookAt() {
                    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 6);
                })
            },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([['remote-1', remotePlayer]]);
        engine.abilityController = { triggerRemoteAbilityVisuals: jest.fn() };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'ability',
            payload: {
                sourceId: 'remote-1',
                skillName: 'Fireball',
                targetX: 12,
                targetZ: 3
            }
        });

        expect(remotePlayer.mesh.lookAt).toHaveBeenCalledWith(expect.any(THREE.Vector3));
        expect(engine.abilityController.triggerRemoteAbilityVisuals).toHaveBeenCalledWith(remotePlayer, 'Fireball', 12, 3);
        expect(remotePlayer.updateState).toHaveBeenCalledWith('ATTACKING');
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('AYLA: FIREBALL', remotePlayer.position, '#8fe7ff', '18px');
    });

    test('remote ability casts can face a replicated target entity immediately before later state updates arrive', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-ability-facing',
            name: 'Selene',
            position: new THREE.Vector3(6, 0, 1),
            state: 'IDLE',
            isRemote: true,
            constructor: { name: 'Cleric' },
            rotation: new THREE.Quaternion(),
            mesh: {
                quaternion: new THREE.Quaternion(),
                lookAt: jest.fn(function lookAt() {
                    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 3);
                })
            },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };
        const ally = {
            id: 'ally-1',
            position: new THREE.Vector3(10, 0, 4)
        };

        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([
            ['remote-ability-facing', remotePlayer],
            ['ally-1', ally]
        ]);
        engine.abilityController = { triggerRemoteAbilityVisuals: jest.fn() };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'ability',
            payload: {
                sourceId: 'remote-ability-facing',
                targetId: 'ally-1',
                skillName: 'Healing Light',
                targetX: 10,
                targetZ: 4
            }
        });

        expect(remotePlayer.mesh.lookAt).toHaveBeenCalledWith(expect.any(THREE.Vector3));
        expect(engine.abilityController.triggerRemoteAbilityVisuals).toHaveBeenCalledWith(remotePlayer, 'Healing Light', 10, 4);
        expect(remotePlayer.updateState).toHaveBeenCalledWith('ATTACKING');
    });

    test('explicit remote ability events can restart a new cast presentation even when the actor is already attacking', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-ability-refresh',
            name: 'Tarin',
            position: new THREE.Vector3(8, 0, 1),
            state: 'ATTACKING',
            isRemote: true,
            constructor: { name: 'Wizard' },
            rotation: new THREE.Quaternion(),
            mesh: {
                quaternion: new THREE.Quaternion(),
                lookAt: jest.fn(function lookAt() {
                    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 5);
                })
            },
            setAttackingState: jest.fn(function setAttackingState() {
                this.state = 'ATTACKING';
            }),
            updateState: jest.fn()
        };
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([['remote-ability-refresh', remotePlayer]]);
        engine.abilityController = { triggerRemoteAbilityVisuals: jest.fn() };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'ability',
            payload: {
                sourceId: 'remote-ability-refresh',
                skillName: 'Arcane Missile',
                targetX: 12,
                targetZ: 2
            }
        });

        expect(remotePlayer.setAttackingState).toHaveBeenCalledWith(true);
        expect(remotePlayer.updateState).not.toHaveBeenCalled();
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('TARIN: ARCANE MISSILE', remotePlayer.position, '#8fe7ff', '18px');
    });

    test('shows a nearby replicated remote-player basic attack immediately from the explicit attack event', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-attack-event',
            name: 'Bram',
            position: new THREE.Vector3(7, 0, 0),
            state: 'IDLE',
            isRemote: true,
            constructor: { name: 'Fighter' },
            rotation: new THREE.Quaternion(),
            mesh: {
                quaternion: new THREE.Quaternion(),
                lookAt: jest.fn(function lookAt() {
                    this.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
                })
            },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };
        const enemy = {
            id: 'enemy-1',
            position: new THREE.Vector3(9, 0, 2)
        };

        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([
            ['remote-attack-event', remotePlayer],
            ['enemy-1', enemy]
        ]);
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'attack',
            payload: {
                sourceId: 'remote-attack-event',
                targetId: 'enemy-1',
                targetX: 9,
                targetZ: 2
            }
        });

        expect(remotePlayer.mesh.lookAt).toHaveBeenCalledWith(expect.any(THREE.Vector3));
        expect(remotePlayer.updateState).toHaveBeenCalledWith('ATTACKING');
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('BRAM: ATTACK', remotePlayer.position, '#8fe7ff', '18px');
    });

    test('shows nearby remote-player damage numbers in crowded fights without requiring the local player to be source or target', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-1',
            position: new THREE.Vector3(6, 0, 0),
            state: 'IDLE',
            isRemote: true,
            constructor: { name: 'Cleric' },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };
        const enemy = {
            id: 'enemy-1',
            position: new THREE.Vector3(9, 0, 0),
            state: 'IDLE',
            constructor: { name: 'Skeleton' }
        };
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([
            ['remote-1', remotePlayer],
            ['enemy-1', enemy]
        ]);
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'damage',
            payload: {
                sourceId: 'remote-1',
                targetId: 'enemy-1',
                amount: 182
            }
        });

        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith(182, enemy.position, '#8fe7ff', '20px');
        expect(remotePlayer.updateState).not.toHaveBeenCalled();
    });

    test('damage against the local player can still refresh remote attacker presentation when no explicit action start was seen', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-2',
            position: new THREE.Vector3(6, 0, 0),
            state: 'IDLE',
            isRemote: true,
            constructor: { name: 'Fighter' },
            setAttackingState: jest.fn(function setAttackingState() {
                this.state = 'ATTACKING';
            })
        };

        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([['remote-2', remotePlayer]]);
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
        engine.beginRemoteActionPresentation = GameEngine.prototype.beginRemoteActionPresentation;

        engine.handleServerMessage({
            type: 'damage',
            payload: {
                sourceId: 'remote-2',
                targetId: 'player-1',
                amount: 31
            }
        });

        expect(remotePlayer.setAttackingState).toHaveBeenCalledWith(true);
    });

    test('does not show remote readability text for faraway remote-player actions', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-2',
            name: 'Doran',
            position: new THREE.Vector3(120, 0, 0),
            state: 'IDLE',
            isRemote: true,
            constructor: { name: 'Wizard' },
            updateState: jest.fn()
        };
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([['remote-2', remotePlayer]]);
        engine.abilityController = { triggerRemoteAbilityVisuals: jest.fn() };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'ability',
            payload: {
                sourceId: 'remote-2',
                skillName: 'Meteor',
                targetX: 125,
                targetZ: 0
            }
        });

        expect(engine.floatingTextManager.spawn).not.toHaveBeenCalled();
    });

    test('shows a nearby remote-player jump label when replicated state enters jumping', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-jump',
            name: 'Mira',
            position: new THREE.Vector3(6, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            isRemote: true,
            constructor: { name: 'Rogue' },
            mesh: {
                visible: true,
                position: new THREE.Vector3(6, 0, 0),
                quaternion: new THREE.Quaternion(),
                scale: new THREE.Vector3(1, 1, 1),
                userData: {}
            },
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map();
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.chunkManager = { updateEntityChunk: jest.fn() };
        engine.syncAuthoritativeJumpState = jest.fn();
        engine.clearAuthoritativeJumpState = jest.fn();
        engine.isPlayerClassEntity = GameEngine.prototype.isPlayerClassEntity;
        engine.isPositionNearPlayer = GameEngine.prototype.isPositionNearPlayer;
        engine.canShowThrottledReadabilityEvent = GameEngine.prototype.canShowThrottledReadabilityEvent;
        engine.formatRemoteActionLabel = GameEngine.prototype.formatRemoteActionLabel;
        engine.getRemoteActionSourceLabel = GameEngine.prototype.getRemoteActionSourceLabel;
        engine.buildRemoteActionReadabilityText = GameEngine.prototype.buildRemoteActionReadabilityText;
        engine.showRemoteStateReadability = GameEngine.prototype.showRemoteStateReadability;
        engine.syncRemoteEntity = GameEngine.prototype.syncRemoteEntity;

        engine.syncRemoteEntity(remotePlayer, {
            id: 'remote-jump',
            type: 'Player',
            state: 'JUMPING',
            x: 10,
            y: 0,
            z: 0,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(remotePlayer.updateState).toHaveBeenCalledWith('JUMPING');
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('MIRA: JUMP', remotePlayer.position, '#d3f2ff', '16px');
    });

    test('shows a nearby remote-player attack label when replicated state enters attacking', () => {
        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-attack',
            name: 'Bram',
            position: new THREE.Vector3(7, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            isRemote: true,
            constructor: { name: 'Fighter' },
            mesh: null,
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.chunkManager = { updateEntityChunk: jest.fn() };
        engine.syncAuthoritativeJumpState = jest.fn();
        engine.clearAuthoritativeJumpState = jest.fn();
        engine.renderSystem = { effectGroup: new THREE.Group() };
        engine.effects = [];
        engine.isPlayerClassEntity = GameEngine.prototype.isPlayerClassEntity;
        engine.isPositionNearPlayer = GameEngine.prototype.isPositionNearPlayer;
        engine.canShowThrottledReadabilityEvent = GameEngine.prototype.canShowThrottledReadabilityEvent;
        engine.formatRemoteActionLabel = GameEngine.prototype.formatRemoteActionLabel;
        engine.getRemoteActionSourceLabel = GameEngine.prototype.getRemoteActionSourceLabel;
        engine.buildRemoteActionReadabilityText = GameEngine.prototype.buildRemoteActionReadabilityText;
        engine.showRemoteStateReadability = GameEngine.prototype.showRemoteStateReadability;
        engine.syncRemoteEntity = GameEngine.prototype.syncRemoteEntity;

        engine.syncRemoteEntity(remotePlayer, {
            id: 'remote-attack',
            type: 'Player',
            state: 'ATTACKING',
            x: 7,
            y: 0,
            z: 0,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(remotePlayer.updateState).toHaveBeenCalledWith('ATTACKING');
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('BRAM: ATTACK', remotePlayer.position, '#ffd36b', '16px');
    });

    test('suppresses the generic remote ATTACK label right after a named ability readability callout for the same actor', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-04-19T12:00:00Z'));

        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-echo',
            name: 'Ayla',
            position: new THREE.Vector3(8, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            isRemote: true,
            constructor: { name: 'Wizard' },
            mesh: null,
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([['remote-echo', remotePlayer]]);
        engine.abilityController = { triggerRemoteAbilityVisuals: jest.fn() };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
        engine.chunkManager = { updateEntityChunk: jest.fn() };
        engine.syncAuthoritativeJumpState = jest.fn();
        engine.clearAuthoritativeJumpState = jest.fn();
        engine.renderSystem = { effectGroup: new THREE.Group() };
        engine.effects = [];
        engine.isPlayerClassEntity = GameEngine.prototype.isPlayerClassEntity;
        engine.isPositionNearPlayer = GameEngine.prototype.isPositionNearPlayer;
        engine.canShowThrottledReadabilityEvent = GameEngine.prototype.canShowThrottledReadabilityEvent;
        engine.formatRemoteActionLabel = GameEngine.prototype.formatRemoteActionLabel;
        engine.getRemoteActionSourceLabel = GameEngine.prototype.getRemoteActionSourceLabel;
        engine.buildRemoteActionReadabilityText = GameEngine.prototype.buildRemoteActionReadabilityText;
        engine.showRemoteActionReadability = GameEngine.prototype.showRemoteActionReadability;
        engine.showRemoteStateReadability = GameEngine.prototype.showRemoteStateReadability;
        engine.syncRemoteEntity = GameEngine.prototype.syncRemoteEntity;

        engine.handleServerMessage({
            type: 'ability',
            payload: {
                sourceId: 'remote-echo',
                skillName: 'Fireball',
                targetX: 12,
                targetZ: 3
            }
        });

        engine.syncRemoteEntity(remotePlayer, {
            id: 'remote-echo',
            type: 'Player',
            state: 'ATTACKING',
            x: 8,
            y: 0,
            z: 0,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(engine.floatingTextManager.spawn).toHaveBeenCalledTimes(1);
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('AYLA: FIREBALL', remotePlayer.position, '#8fe7ff', '18px');

        jest.useRealTimers();
    });

    test('repeated explicit ability starts keep suppressing the generic ATTACK echo even when the named callout is throttled', () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-04-19T12:00:00Z'));

        const engine = Object.create(GameEngine.prototype);
        const remotePlayer = {
            id: 'remote-throttled-echo',
            name: 'Ayla',
            position: new THREE.Vector3(8, 0, 0),
            targetServerPosition: null,
            targetServerRotation: undefined,
            rotation: new THREE.Quaternion(),
            state: 'IDLE',
            isCharging: false,
            isDead: false,
            deadTimer: 0,
            isRemote: true,
            constructor: { name: 'Wizard' },
            mesh: null,
            stats: { hp: 100, maxHp: 100, mana: 10, maxMana: 10, speed: 3, attackSpeed: 1 },
            updateState: jest.fn(function updateState(nextState) {
                this.state = nextState;
            })
        };

        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.remotePlayers = new Map([['remote-throttled-echo', remotePlayer]]);
        engine.abilityController = { triggerRemoteAbilityVisuals: jest.fn() };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.readabilityFeedbackTimestamps = new Map();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
        engine.chunkManager = { updateEntityChunk: jest.fn() };
        engine.syncAuthoritativeJumpState = jest.fn();
        engine.clearAuthoritativeJumpState = jest.fn();
        engine.renderSystem = { effectGroup: new THREE.Group() };
        engine.effects = [];
        engine.isPlayerClassEntity = GameEngine.prototype.isPlayerClassEntity;
        engine.isPositionNearPlayer = GameEngine.prototype.isPositionNearPlayer;
        engine.canShowThrottledReadabilityEvent = GameEngine.prototype.canShowThrottledReadabilityEvent;
        engine.formatRemoteActionLabel = GameEngine.prototype.formatRemoteActionLabel;
        engine.getRemoteActionSourceLabel = GameEngine.prototype.getRemoteActionSourceLabel;
        engine.buildRemoteActionReadabilityText = GameEngine.prototype.buildRemoteActionReadabilityText;
        engine.showRemoteActionReadability = GameEngine.prototype.showRemoteActionReadability;
        engine.showRemoteStateReadability = GameEngine.prototype.showRemoteStateReadability;
        engine.syncRemoteEntity = GameEngine.prototype.syncRemoteEntity;

        engine.handleServerMessage({
            type: 'ability',
            payload: {
                sourceId: 'remote-throttled-echo',
                skillName: 'Fireball',
                targetX: 12,
                targetZ: 3
            }
        });

        jest.advanceTimersByTime(500);
        jest.setSystemTime(new Date('2026-04-19T12:00:00.500Z'));

        engine.handleServerMessage({
            type: 'ability',
            payload: {
                sourceId: 'remote-throttled-echo',
                skillName: 'Fireball',
                targetX: 12,
                targetZ: 3
            }
        });

        engine.syncRemoteEntity(remotePlayer, {
            id: 'remote-throttled-echo',
            type: 'Player',
            state: 'ATTACKING',
            x: 8,
            y: 0,
            z: 0,
            health: 100,
            maxHealth: 100,
            mana: 10,
            maxMana: 10
        });

        expect(engine.floatingTextManager.spawn).toHaveBeenCalledTimes(1);
        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('AYLA: FIREBALL', remotePlayer.position, '#8fe7ff', '18px');

        jest.useRealTimers();
    });
});
