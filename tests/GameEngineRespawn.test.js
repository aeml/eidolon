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
        scale: 1,
        isCharging: false,
        stunTimer: 0,
        slowTimer: 0,
        slowFactor: 0,
        rootTimer: 0,
        bleedTimer: 0,
        bleedStacks: 0,
        bleedTickDamage: 0,
        poisonTimer: 0,
        poisonStacks: 0,
        poisonTickDamage: 0,
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
            manaRegen: 5,
            castSpeed: 1.02
        },
        inventory: [],
        equipment: {},
        quests: [],
        hotbar: [],
        unlockedSkills: [],
        unlockedTalents: [],
        skillRunes: {},
        setScale: jest.fn(function setScale(scale) {
            this.scale = scale;
        }),
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
        updateQuestWindow: jest.fn(),
        updateJournal: jest.fn(),
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

    test('delta self sync applies authoritative cast speed', () => {
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
                        castSpeed: 1.37
                    }
                },
                r: []
            }
        });

        expect(engine.player.stats.castSpeed).toBe(1.37);
    });

    test('delta self sync applies authoritative quests and refreshes quest UI', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        const quests = [{ id: 'daily-1', title: 'Clear the crypt', objective: 'Kill 10 skeletons' }];

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        quests
                    }
                },
                r: []
            }
        });

        expect(engine.player.quests).toEqual(quests);
        expect(engine.uiManager.updateQuestWindow).toHaveBeenCalledWith(quests);
        expect(engine.uiManager.updateJournal).toHaveBeenCalledWith(quests);
    });

    test('delta self sync applies authoritative scale through setScale', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        scale: 1.75
                    }
                },
                r: []
            }
        });

        expect(engine.player.setScale).toHaveBeenCalledWith(1.75);
        expect(engine.player.scale).toBe(1.75);
    });

    test('delta self sync applies authoritative charge state', () => {
        const engine = createEngineHarness();
        engine.player.state = 'MOVING';
        engine.player.isCharging = false;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        state: 'MOVING',
                        isCharging: true
                    }
                },
                r: []
            }
        });

        expect(engine.player.isCharging).toBe(true);
    });

    test('delta self sync applies authoritative skill runes', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        skillRunes: {
                            meteor_drop: 'meteor_burn',
                            scorch_beam: 'beam_split'
                        }
                    }
                },
                r: []
            }
        });

        expect(engine.player.skillRunes).toEqual({
            meteor_drop: 'meteor_burn',
            scorch_beam: 'beam_split'
        });
    });

    test('delta self sync applies authoritative unlocked talents', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        unlockedTalents: ['fighter_brutality', 'fighter_unbreakable']
                    }
                },
                r: []
            }
        });

        expect(engine.player.unlockedTalents).toEqual(['fighter_brutality', 'fighter_unbreakable']);
    });

    test('delta self sync clears authoritative debuff timers when the server says statuses are gone', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.stunTimer = 2.5;
        engine.player.slowTimer = 5;
        engine.player.slowFactor = 0.6;
        engine.player.rootTimer = 3;
        engine.player.bleedTimer = 8;
        engine.player.bleedStacks = 2;
        engine.player.poisonTimer = 6;
        engine.player.poisonStacks = 4;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        stunned: false,
                        slowed: false,
                        rooted: false,
                        bleeding: false,
                        poisoned: false
                    }
                },
                r: []
            }
        });

        expect(engine.player.stunTimer).toBe(0);
        expect(engine.player.slowTimer).toBe(0);
        expect(engine.player.slowFactor).toBe(0);
        expect(engine.player.rootTimer).toBe(0);
        expect(engine.player.bleedTimer).toBe(0);
        expect(engine.player.bleedStacks).toBe(0);
        expect(engine.player.poisonTimer).toBe(0);
        expect(engine.player.poisonStacks).toBe(0);
    });

    test('delta self sync applies authoritative slow factor detail', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.slowTimer = 0;
        engine.player.slowFactor = 0;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        slowed: true,
                        slowFactor: 0.35
                    }
                },
                r: []
            }
        });

        expect(engine.player.slowFactor).toBe(0.35);
        expect(engine.player.slowTimer).toBe(0.1);
    });

    test('delta self sync applies authoritative root duration detail', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.rootTimer = 0;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        rooted: true,
                        rootDuration: 2.5
                    }
                },
                r: []
            }
        });

        expect(engine.player.rootTimer).toBe(2.5);
    });

    test('delta self sync applies authoritative stun duration detail', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.stunTimer = 0;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        stunned: true,
                        stunDuration: 1.75
                    }
                },
                r: []
            }
        });

        expect(engine.player.stunTimer).toBe(1.75);
    });

    test('delta self sync applies authoritative bleed duration detail', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.bleedTimer = 0;
        engine.player.bleedStacks = 2;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        bleeding: true,
                        bleedDuration: 3.25
                    }
                },
                r: []
            }
        });

        expect(engine.player.bleedTimer).toBe(3.25);
        expect(engine.player.bleedStacks).toBe(2);
    });

    test('delta self sync applies authoritative bleed damage detail', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.bleedTickDamage = 0;
        engine.player.bleedStacks = 2;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        bleeding: true,
                        bleedDamage: 14
                    }
                },
                r: []
            }
        });

        expect(engine.player.bleedTickDamage).toBe(14);
        expect(engine.player.bleedStacks).toBe(2);
    });

    test('delta self sync applies authoritative poison duration detail', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.poisonTimer = 0;
        engine.player.poisonStacks = 3;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        poisoned: true,
                        poisonDuration: 4.5
                    }
                },
                r: []
            }
        });

        expect(engine.player.poisonTimer).toBe(4.5);
        expect(engine.player.poisonStacks).toBe(3);
    });

    test('delta self sync applies authoritative poison damage detail', () => {
        const engine = createEngineHarness();
        engine.player.state = 'IDLE';
        engine.player.poisonTickDamage = 0;
        engine.player.poisonStacks = 3;

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        poisoned: true,
                        poisonDamage: 11
                    }
                },
                r: []
            }
        });

        expect(engine.player.poisonTickDamage).toBe(11);
        expect(engine.player.poisonStacks).toBe(3);
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
                    scale: 1.5,
                    isCharging: true,
                    skillRunes: {
                        spirit_guardians: 'radiant_orbit'
                    },
                    unlockedTalents: ['cleric_devotion'],
                    stunned: false,
                    stunDuration: 0,
                    slowed: false,
                    slowFactor: 0,
                    rooted: false,
                    rootDuration: 0,
                    bleeding: false,
                    bleedDuration: 0,
                    bleedDamage: 0,
                    poisoned: false,
                    poisonDuration: 0,
                    poisonDamage: 0,
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
                    castSpeed: 1.25,
                    quests: [{ id: 'story-1', title: 'Speak to the guardian', objective: 'Find the shrine' }],
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
        expect(engine.player.setScale).toHaveBeenCalledWith(1.5);
        expect(engine.player.scale).toBe(1.5);
        expect(engine.player.isCharging).toBe(true);
        expect(engine.player.skillRunes).toEqual({ spirit_guardians: 'radiant_orbit' });
        expect(engine.player.unlockedTalents).toEqual(['cleric_devotion']);
        expect(engine.player.stunTimer).toBe(0);
        expect(engine.player.slowTimer).toBe(0);
        expect(engine.player.slowFactor).toBe(0);
        expect(engine.player.rootTimer).toBe(0);
        expect(engine.player.bleedTimer).toBe(0);
        expect(engine.player.bleedStacks).toBe(0);
        expect(engine.player.poisonTimer).toBe(0);
        expect(engine.player.poisonStacks).toBe(0);
        expect(engine.player.stats.hpRegen).toBe(11);
        expect(engine.player.stats.manaRegen).toBe(7);
        expect(engine.player.stats.castSpeed).toBe(1.25);
        expect(engine.player.quests).toEqual([{ id: 'story-1', title: 'Speak to the guardian', objective: 'Find the shrine' }]);
        expect(engine.uiManager.updateQuestWindow).toHaveBeenCalledWith(engine.player.quests);
        expect(engine.uiManager.updateJournal).toHaveBeenCalledWith(engine.player.quests);
    });
});
