import * as THREE from 'three';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/proto/state_pb.js', () => ({
    eidolon: {
        StateEnvelope: {
            decode: jest.fn()
        }
    }
}));

const { GameEngine } = await import('../src/core/GameEngine.js');

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);

    const player = {
        id: 'player-1',
        state: 'DEAD',
        level: 1,
        hasSyncedLevel: false,
        xp: 0,
        xpToNextLevel: 100,
        gold: 0,
        targetPosition: new THREE.Vector3(5, 0, 5),
        position: new THREE.Vector3(50, 0, 50),
        stats: {
            hp: 0,
            maxHp: 100,
            mana: 0,
            maxMana: 100,
            strength: 10,
            dexterity: 10,
            intelligence: 10,
            wisdom: 10,
            vitality: 10,
            damage: 20,
            defense: 10
        },
        inventory: [],
        equipment: {},
        hotbar: [],
        unlockedSkills: [],
        respawn: jest.fn(function respawn(x, z) {
            this.position.set(x, 0, z);
            this.state = 'IDLE';
            this.stats.hp = this.stats.maxHp;
            this.targetPosition = null;
        })
    };

    engine.player = player;
    engine.remotePlayers = new Map();
    engine.recentlyPickedUpLoot = new Set();
    engine.pendingEntityIds = new Set();
    engine.entityCreationQueue = [];
    engine.frameCount = 1;
    engine.effects = [];
    engine.collisionManager = {};
    engine.socket = null;
    engine.username = 'tester';
    engine.playerType = 'Fighter';

    engine.chunkManager = {
        updateEntityChunk: jest.fn(),
        update: jest.fn(),
        getChunkKey: jest.fn(() => '0,0'),
        chunks: new Map()
    };

    engine.renderSystem = {
        scene: {},
        setCameraTarget: jest.fn(),
        remove: jest.fn()
    };

    engine.uiManager = {
        updateXP: jest.fn(),
        updateHotbar: jest.fn(),
        updateCharacterSheet: jest.fn(),
        updatePlayerStats: jest.fn(),
        updateInventory: jest.fn(),
        updateForgeUI: jest.fn(),
        updateForgePotencyUI: jest.fn(),
        updateForgeSocketUI: jest.fn(),
        updateForgeInfo: jest.fn(),
        updateForgePotencyInfo: jest.fn(),
        updateForgeSocketInfo: jest.fn(),
        renderSkillTree: jest.fn(),
        skillTreeWindow: { style: { display: 'none' } },
        forgeScreen: { style: { display: 'none' } },
        selectedForgeSlot: null,
        selectedForgePotencySlot: null,
        selectedForgeSocketSlot: null
    };

    engine.floatingTextManager = {
        spawn: jest.fn()
    };

    engine.hydrateItem = jest.fn((item) => item);
    engine.handlePlayerDeathTransition = jest.fn(() => {
        player.state = 'DEAD';
    });
    engine.syncDeathScreen = jest.fn();

    return engine;
}

describe('GameEngine multiplayer respawn sync', () => {
    test('delta DEAD->alive without position respawns to town and refreshes chunks', () => {
        const engine = createEngineHarness();

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        state: 'IDLE',
                        health: 100,
                        maxHealth: 100,
                        mana: 50,
                        maxMana: 100
                    }
                },
                r: []
            }
        });

        expect(engine.player.respawn).toHaveBeenCalledWith(-1.25, 200);
        expect(engine.player.position.x).toBeCloseTo(-1.25);
        expect(engine.player.position.z).toBe(200);
        expect(engine.chunkManager.updateEntityChunk).toHaveBeenCalledWith(engine.player);
        expect(engine.chunkManager.update).toHaveBeenCalledWith(engine.player, 0, engine.collisionManager);
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);
    });

    test('delta self teleport applies server position when distance is large', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.stats.hp = 100;
        engine.player.position.set(0, 0, 0);
        engine.player.targetPosition = new THREE.Vector3(10, 0, 10);

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        state: 'IDLE',
                        health: 100,
                        maxHealth: 100,
                        mana: 100,
                        maxMana: 100,
                        x: 80,
                        z: 240,
                        y: 0
                    }
                },
                r: []
            }
        });

        expect(engine.player.position.x).toBe(80);
        expect(engine.player.position.z).toBe(240);
        expect(engine.player.targetPosition).toBeNull();
        expect(engine.chunkManager.updateEntityChunk).toHaveBeenCalledWith(engine.player);
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);
    });

    test('full state DEAD->alive also forces town respawn', () => {
        const engine = createEngineHarness();

        engine.handleServerMessage({
            type: 'state',
            payload: {
                'player-1': {
                    id: 'player-1',
                    state: 'IDLE',
                    health: 100,
                    maxHealth: 100,
                    mana: 100,
                    maxMana: 100,
                    experience: 0,
                    maxExperience: 100,
                    level: 1,
                    damage: 20,
                    defense: 10,
                    skillPoints: 0,
                    selectedBranch: null,
                    unlockedSkills: [],
                    gold: 0
                }
            }
        });

        expect(engine.player.respawn).toHaveBeenCalledWith(-1.25, 200);
        expect(engine.chunkManager.updateEntityChunk).toHaveBeenCalledWith(engine.player);
        expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);
    });
});
