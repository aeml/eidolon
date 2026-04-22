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
        baseStats: {
            strength: 10,
            dexterity: 10,
            intelligence: 10,
            wisdom: 10,
            vitality: 10
        },
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
            defense: 10,
            hpRegen: 5,
            manaRegen: 5
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
        skillTree: {
            isOpen: false,
            skillTreeMode: 'skills',
            renderSkillTree: jest.fn()
        },
        forge: {
            isOpen: false,
            forgeScreen: { style: { display: 'none' } },
            selectedForgeSlot: null,
            selectedForgePotencySlot: null,
            selectedForgeSocketSlot: null,
            updateForgeUI: jest.fn(),
            updateForgePotencyUI: jest.fn(),
            updateForgeSocketUI: jest.fn(),
            updateForgeInfo: jest.fn(),
            updateForgePotencyInfo: jest.fn(),
            updateForgeSocketInfo: jest.fn()
        },
        trading: {
            isOpen: false,
            onTradingSearch: null,
            onTradingCreate: null,
            onTradingMyAuctions: null,
            onTradingBuyout: null,
            onTradingBid: null,
            onTradingCollect: null,
            onTradingCancel: null,
            renderAuctionList: jest.fn(),
            renderMyAuctions: jest.fn(),
            handleSearch: jest.fn()
        },
        inventory: {
            onBuyGamble: null,
            onSellItem: null,
            onSellAll: null,
            onBuyback: null,
            onStashDeposit: null,
            onStashWithdraw: null,
            onUnequipRequest: null,
            updateInventory: jest.fn(),
            updateStash: jest.fn(),
            updateBuybackList: jest.fn(),
            updateEquipSlot: jest.fn(),
            inventoryScreen: { style: { display: 'none' } },
            shopScreen: { style: { display: 'none' } },
            stashScreen: { style: { display: 'none' } }
        },
        quest: {
            onAcceptQuest: null,
            onCompleteQuest: null,
            isOpen: false
        },
        social: {
            onSocialOpen: null,
            onPartyInvite: null,
            onPartyLeave: null,
            onPartyResponse: null,
            partyData: null
        },
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

    test('delta self teleport seeds a short-lived visual correction state for overworld smoothing', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.stats.hp = 100;
        engine.player.position.set(0, 0, 0);

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
        expect(engine.playerCorrectionVisualState).toEqual(expect.objectContaining({
            from: expect.any(THREE.Vector3),
            to: expect.any(THREE.Vector3),
            displayPosition: expect.any(THREE.Vector3),
            duration: expect.any(Number)
        }));
        expect(engine.playerCorrectionVisualState.from.x).toBe(0);
        expect(engine.playerCorrectionVisualState.to.x).toBe(80);
        expect(engine.playerCorrectionVisualState.displayPosition.x).toBe(0);
    });

    test('delta self sync applies authoritative regeneration stats', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.stats.hp = 80;
        engine.player.stats.mana = 40;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        health: 80,
                        maxHealth: 100,
                        mana: 40,
                        maxMana: 100,
                        hpRegen: 12,
                        manaRegen: 9
                    }
                },
                r: []
            }
        });

        expect(engine.player.stats.hpRegen).toBe(12);
        expect(engine.player.stats.manaRegen).toBe(9);
    });

    test('delta self sync applies authoritative base stats for character sheet truth', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        health: 80,
                        maxHealth: 100,
                        mana: 40,
                        maxMana: 100,
                        baseStats: {
                            strength: 14,
                            dexterity: 11,
                            intelligence: 12,
                            wisdom: 13,
                            vitality: 15
                        }
                    }
                },
                r: []
            }
        });

        expect(engine.player.baseStats.strength).toBe(14);
        expect(engine.player.baseStats.dexterity).toBe(11);
        expect(engine.player.baseStats.intelligence).toBe(12);
        expect(engine.player.baseStats.wisdom).toBe(13);
        expect(engine.player.baseStats.vitality).toBe(15);
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
                    baseStats: {
                        strength: 16,
                        dexterity: 12,
                        intelligence: 14,
                        wisdom: 15,
                        vitality: 18
                    },
                    experience: 0,
                    maxExperience: 100,
                    level: 1,
                    damage: 20,
                    defense: 10,
                    hpRegen: 11,
                    manaRegen: 7,
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
        expect(engine.player.baseStats.strength).toBe(16);
        expect(engine.player.baseStats.dexterity).toBe(12);
        expect(engine.player.baseStats.intelligence).toBe(14);
        expect(engine.player.baseStats.wisdom).toBe(15);
        expect(engine.player.baseStats.vitality).toBe(18);
        expect(engine.player.stats.hpRegen).toBe(11);
        expect(engine.player.stats.manaRegen).toBe(7);
    });
});
