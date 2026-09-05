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
const { UIManager } = await import('../src/ui/UIManager.js');
const { QuestUI } = await import('../src/ui/QuestUI.js');

function buildDom() {
    document.body.innerHTML = `
        <div id="player-hud"></div>
        <div id="player-hp-bar"></div>
        <div id="player-hp-text"></div>
        <div id="player-mana-bar"></div>
        <div id="player-mana-text"></div>
        <div id="ui-layer"></div>
        <div id="game-timer"></div>
        <div id="combat-intent-panel" style="display:none"></div>
        <div id="combat-intent-name"></div>
        <div id="combat-intent-meta"></div>
        <div id="combat-intent-status"></div>
        <div id="combat-intent-preview-basic"></div>
        <div id="combat-intent-preview-ability"></div>
        <div id="combat-intent-preview-ability-label"></div>
        <div id="dungeon-entrance-hint"></div>
        <div id="dungeon-entrance-hint-name"></div>
        <div id="dungeon-entrance-hint-status"></div>
        <div id="dungeon-entrance-hint-prompt"></div>
        <div id="xp-bar-fill"></div>
        <div id="xp-text"></div>
        <div id="character-sheet"></div>
        <div id="stats-content"></div>
        <div id="quest-window"></div>
        <div id="quest-list"></div>
        <div id="quest-journal"></div>
        <div id="journal-list"></div>
        <div id="objectives-panel"></div>
        <div id="objectives-list"></div>
        <button id="btn-close-quest"></button>
        <button id="btn-close-journal"></button>
        <div id="esc-menu"></div>
        <div id="help-screen"></div>
        <div id="settings-screen"></div>
        <div id="patch-notes-screen"></div>
        <button id="btn-resume"></button>
        <button id="btn-help"></button>
        <button id="btn-settings"></button>
        <button id="btn-patch-notes"></button>
        <button id="btn-report"></button>
        <button id="btn-menu"></button>
        <button id="btn-close-help"></button>
        <button id="btn-close-settings"></button>
        <button id="btn-close-patch-notes"></button>
        <button id="btn-respawn"></button>
        <div id="abilities-menu"></div>
        <div id="abilities-content"></div>
        <button id="btn-close-abilities"></button>
        <div id="hotbar-container"></div>
        <div class="hotbar-slot"></div>
        <div id="report-screen"></div>
        <button id="btn-cancel-report"></button>
        <button id="btn-submit-report"></button>
        <select id="report-type"></select>
        <textarea id="report-text"></textarea>
        <select id="graphics-quality"></select>
        <input id="graphics-brightness" />
        <div id="graphics-brightness-value"></div>
        <input id="auto-loot-enabled" type="checkbox" />
        <button id="btn-download-core-assets"></button>
        <button id="btn-download-dungeon-assets"></button>
        <button id="btn-download-environment-assets"></button>
        <button id="btn-download-recommended-assets"></button>
        <button id="btn-refresh-outdated-assets"></button>
        <button id="btn-update-cached-assets"></button>
        <button id="btn-clear-cached-assets"></button>
        <div id="asset-download-status"></div>
        <div id="asset-download-progress"></div>
        <div id="asset-download-progress-bar"></div>
        <div id="asset-cache-state-detail"></div>
        <div id="asset-last-synced-version"></div>
        <div id="asset-pack-core-badge"></div>
        <div id="asset-pack-core-status"></div>
        <div id="asset-pack-core-size"></div>
        <div id="asset-pack-core-version"></div>
        <div id="asset-pack-dungeon-badge"></div>
        <div id="asset-pack-dungeon-status"></div>
        <div id="asset-pack-dungeon-size"></div>
        <div id="asset-pack-dungeon-version"></div>
        <div id="asset-pack-environment-badge"></div>
        <div id="asset-pack-environment-status"></div>
        <div id="asset-pack-environment-size"></div>
        <div id="asset-pack-environment-version"></div>
        <div id="inventory-screen"></div>
        <div id="inventory-grid"></div>
        <button id="btn-sort-inventory"></button>
        <div id="gold-display"></div>
        <div id="shop-screen"></div>
        <div id="shop-gamble-title"></div>
        <div id="shop-content-main"></div>
        <div id="shop-content-buyback"></div>
        <button id="tab-shop-main"></button>
        <button id="tab-shop-buyback"></button>
        <button id="btn-close-shop"></button>
        <button id="btn-sell-common"></button>
        <button id="btn-sell-uncommon"></button>
        <button id="btn-sell-rare"></button>
        <div id="shop-grid"></div>
        <div id="stash-screen"></div>
        <div id="stash-grid"></div>
        <div id="buyback-grid"></div>
        <div id="split-stack-window"></div>
        <button id="btn-close-split"></button>
        <div id="split-item-name"></div>
        <input id="split-amount-range" />
        <input id="split-amount-input" />
        <button id="btn-confirm-split"></button>
        <button id="btn-cancel-split"></button>
        <div id="forge-screen"></div>
        <div id="forge-potency-info"></div>
        <div id="forge-potency-item-name"></div>
        <div id="forge-potency-stats"></div>
        <div id="forge-potency-cost-value"></div>
        <button id="btn-forge-potency"></button>
        <div id="forge-socket-info"></div>
        <div id="forge-socket-item-name"></div>
        <div id="forge-socket-stats"></div>
        <div id="forge-socket-cost-hearts"></div>
        <div id="forge-socket-cost-shards"></div>
        <button id="btn-forge-socket"></button>
        <div id="trading-house-screen"></div>
        <div id="trading-inventory-grid"></div>
        <div id="trading-search-results"></div>
        <div id="trading-my-auctions"></div>
        <button id="btn-trading-search"></button>
        <button id="btn-trading-create"></button>
        <button id="btn-trading-my-auctions"></button>
        <button id="btn-close-trading"></button>
        <input id="trading-search-name" />
        <select id="trading-search-rarity"></select>
        <input id="trading-create-price" />
        <input id="trading-create-duration" />
        <div id="social-window"></div>
        <div id="party-panel"></div>
        <div id="skill-tree-window"></div>
        <div id="menu-bar"></div>
        <button id="btn-menu-map"></button>
        <button id="btn-menu-social"></button>
        <button id="btn-menu-inventory"></button>
        <button id="btn-menu-character"></button>
        <button id="btn-menu-quest"></button>
        <button id="btn-menu-skills"></button>
        <div id="ability-container"></div>
        <div id="ability-icon"></div>
        <div id="ability-cooldown"></div>
        <div id="ability-tooltip"></div>
        <div id="ability-name"></div>
        <div id="ability-desc"></div>
        <div id="ability-cost"></div>
        <div id="stat-tooltip"></div>
        <div id="stat-tooltip-title"></div>
        <div id="stat-tooltip-desc"></div>
        <div id="compare-tooltip"></div>
        <div id="compare-tooltip-title"></div>
        <div id="compare-tooltip-desc"></div>
        <div id="chat-box"></div>
        <div id="chat-messages"></div>
        <input id="chat-input" />
        <div id="death-screen"></div>
        <div id="xp-bar-container"></div>
    `;
}

function createRoomClearSummary(overrides = {}) {
    return {
        playerId: 'player-1',
        title: 'Room Cleared: Forgotten Hall',
        subtitle: 'Verdant Bastion Catacombs • Normal',
        gold: 120,
        xp: 450,
        itemCount: 0,
        gemCount: 0,
        heartCount: 0,
        hint: 'Path opened to the boss room',
        roomIndex: 1,
        objectiveRoomIndex: 2,
        roomType: 'normal',
        roomHook: '',
        healthRestored: 0,
        manaRestored: 0,
        buffName: '',
        buffDurationSeconds: 0,
        damageReductionPct: 0,
        ...overrides
    };
}

describe('Dungeon room clear feedback', () => {
    test('GameEngine room_clear_reward handling spawns floating text and forwards summary to UI', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            id: 'player-1',
            position: new THREE.Vector3(5, 0, 10),
            quests: []
        };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 1,
            rooms: [
                { index: 1, explored: true, cleared: false },
                { index: 2, explored: false, cleared: false }
            ]
        };
        engine.uiManager = {
            showRewardSummary: jest.fn(),
            showRoomClearReward: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.floatingTextManager = {
            spawn: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
        engine.getDungeonRoomSummary = GameEngine.prototype.getDungeonRoomSummary;
        engine.buildDungeonBeatAdvanceCallout = GameEngine.prototype.buildDungeonBeatAdvanceCallout;
        engine.getDungeonBeatLabel = GameEngine.prototype.getDungeonBeatLabel;

        const summary = createRoomClearSummary();
        engine.handleServerMessage({ type: 'room_clear_reward', payload: summary });

        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('ROOM CLEARED!', engine.player.position, '#7CFFB2', '26px');
        expect(engine.uiManager.showRoomClearReward).toHaveBeenCalledWith(summary);
        expect(engine.getDungeonRoomSummary()).toEqual(expect.objectContaining({
            objectiveRoomIndex: 2
        }));
    });

    test('GameEngine room_clear_reward handling raises a boss warning when the next objective becomes the boss room', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            id: 'player-1',
            position: new THREE.Vector3(5, 0, 10),
            quests: []
        };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 1,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'normal', hook: 'shrine', explored: true, cleared: false },
                { index: 2, type: 'boss', explored: false, cleared: false }
            ]
        };
        engine.uiManager = {
            showRewardSummary: jest.fn(),
            showRoomClearReward: jest.fn(),
            showCombatCallout: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.floatingTextManager = {
            spawn: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
        engine.getDungeonRoomSummary = GameEngine.prototype.getDungeonRoomSummary;
        engine.buildDungeonBeatAdvanceCallout = GameEngine.prototype.buildDungeonBeatAdvanceCallout;
        engine.getDungeonBeatLabel = GameEngine.prototype.getDungeonBeatLabel;

        const summary = createRoomClearSummary({
            roomIndex: 1,
            objectiveRoomIndex: 2,
            hint: 'Path opened to the boss room'
        });
        engine.handleServerMessage({ type: 'room_clear_reward', payload: summary });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Next: Boss Lair',
            tone: 'boss',
            subtitle: 'Boss room ahead — reset and commit'
        }));
    });

    test('GameEngine room_clear_reward handling frames shrine unlocks as the last reset before boss', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            id: 'player-1',
            position: new THREE.Vector3(5, 0, 10),
            quests: []
        };
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
            showRewardSummary: jest.fn(),
            showRoomClearReward: jest.fn(),
            showCombatCallout: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.floatingTextManager = {
            spawn: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
        engine.getDungeonRoomSummary = GameEngine.prototype.getDungeonRoomSummary;
        engine.buildDungeonBeatAdvanceCallout = GameEngine.prototype.buildDungeonBeatAdvanceCallout;
        engine.getDungeonBeatLabel = GameEngine.prototype.getDungeonBeatLabel;

        const summary = createRoomClearSummary({
            roomIndex: 1,
            objectiveRoomIndex: 2,
            hint: 'Shrine restored your strength for the next push'
        });
        engine.handleServerMessage({ type: 'room_clear_reward', payload: summary });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Next: Restorative Shrine',
            tone: 'support',
            subtitle: 'Last reset before the boss push'
        }));
    });

    test('GameEngine room_clear_reward handling frames chest unlocks as a quick score before ambush pressure', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            id: 'player-1',
            position: new THREE.Vector3(5, 0, 10),
            quests: []
        };
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
            showRewardSummary: jest.fn(),
            showRoomClearReward: jest.fn(),
            showCombatCallout: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.floatingTextManager = {
            spawn: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
        engine.getDungeonRoomSummary = GameEngine.prototype.getDungeonRoomSummary;
        engine.buildDungeonBeatAdvanceCallout = GameEngine.prototype.buildDungeonBeatAdvanceCallout;
        engine.getDungeonBeatLabel = GameEngine.prototype.getDungeonBeatLabel;

        const summary = createRoomClearSummary({
            roomIndex: 0,
            objectiveRoomIndex: 1,
            hint: 'Treasure secured — cash in before the boss'
        });
        engine.handleServerMessage({ type: 'room_clear_reward', payload: summary });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Next: Treasure Cache',
            tone: 'support',
            subtitle: 'Quick score before the ambush spike'
        }));
    });

    test('GameEngine room_clear_reward handling distinguishes a boss room that is live now', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            id: 'player-1',
            position: new THREE.Vector3(5, 0, 10),
            quests: []
        };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 1,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'normal', hook: 'shrine', explored: true, cleared: false },
                { index: 2, type: 'boss', explored: false, cleared: false }
            ]
        };
        engine.uiManager = {
            showRewardSummary: jest.fn(),
            showRoomClearReward: jest.fn(),
            showCombatCallout: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.floatingTextManager = {
            spawn: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
        engine.getDungeonRoomSummary = GameEngine.prototype.getDungeonRoomSummary;
        engine.buildDungeonBeatAdvanceCallout = GameEngine.prototype.buildDungeonBeatAdvanceCallout;
        engine.getDungeonBeatLabel = GameEngine.prototype.getDungeonBeatLabel;

        const summary = createRoomClearSummary({
            roomIndex: 1,
            objectiveRoomIndex: 2,
            currentRoomIndex: 2,
            hint: 'Path opened to the boss room'
        });
        engine.handleServerMessage({ type: 'room_clear_reward', payload: summary });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Boss Now',
            tone: 'boss',
            subtitle: 'You are in the boss room — commit and survive'
        }));
    });

    test('UIManager.showRoomClearReward emits concise reward and hint messages', () => {
        buildDom();
        const ui = new UIManager(false);

        ui.showRoomClearReward(createRoomClearSummary());

        const chatMessages = Array.from(document.querySelectorAll('#chat-messages > div')).map(node => node.textContent);
        expect(chatMessages).toHaveLength(3);
        expect(chatMessages[0]).toContain('Room');
        expect(chatMessages[0]).toContain('Room Cleared: Forgotten Hall');
        expect(chatMessages[1]).toContain('Verdant Bastion Catacombs • Normal');
        expect(chatMessages[2]).toContain('+120 gold');
        expect(chatMessages[2]).toContain('+450 XP');
        expect(chatMessages[2]).toContain('Path opened to the boss room');
        expect(document.getElementById('combat-intent-name').textContent).toContain('Room Cleared: Forgotten Hall');
        expect(document.getElementById('combat-intent-meta').textContent).toContain('Verdant Bastion Catacombs');
        expect(document.getElementById('combat-intent-status').textContent).toContain('Path opened to the boss room');
    });

    test('UIManager.showRoomClearReward surfaces elite room urgency in messaging', () => {
        buildDom();
        const ui = new UIManager(false);

        ui.showRoomClearReward(createRoomClearSummary({
            title: 'Room Cleared: Elite Chamber 2',
            roomType: 'elite',
            itemCount: 1,
            hint: 'Elite cleared — push toward the next objective'
        }));

        const chatMessages = Array.from(document.querySelectorAll('#chat-messages > div')).map(node => node.textContent);
        expect(chatMessages[0]).toContain('Elite Chamber 2');
        expect(chatMessages[2]).toContain('elite room broken');
        expect(chatMessages[2]).toContain('1 item dropped');
        expect(chatMessages[3]).toContain('Elite cleared — push toward the next objective');
    });

    test('UIManager.showRoomClearReward surfaces shrine restoration, buff, and treasure/ambush beats', () => {
        buildDom();
        const ui = new UIManager(false);

        ui.showRoomClearReward(createRoomClearSummary({
            title: 'Room Cleared: Shrine Room',
            hint: 'Shrine restored your strength for the next push',
            healthRestored: 300,
            manaRestored: 90,
            buffName: 'Sanctuary',
            buffDurationSeconds: 8,
            damageReductionPct: 25
        }));
        ui.showRoomClearReward(createRoomClearSummary({
            title: 'Room Cleared: Treasure Room',
            hint: 'Treasure secured — cash in before the boss',
            gold: 220,
            xp: 520
        }));
        ui.showRoomClearReward(createRoomClearSummary({
            title: 'Room Cleared: Ambush Room',
            roomType: 'elite',
            hint: 'Ambush survived — momentum and spoils increased',
            gold: 320,
            xp: 760
        }));

        const chatMessages = Array.from(document.querySelectorAll('#chat-messages > div')).map(node => node.textContent);
        expect(chatMessages.some((line) => line.includes('+300 health'))).toBe(true);
        expect(chatMessages.some((line) => line.includes('+90 mana'))).toBe(true);
        expect(chatMessages.some((line) => line.includes('Sanctuary for 8s'))).toBe(true);
        expect(chatMessages.some((line) => line.includes('25% DR'))).toBe(true);
        expect(chatMessages.some((line) => line.includes('Treasure secured — cash in before the boss'))).toBe(true);
        expect(chatMessages.some((line) => line.includes('Ambush survived — momentum and spoils increased'))).toBe(true);
    });

    test('GameEngine room_clear_reward handling preserves hook loot counts for UI summaries', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            id: 'player-1',
            position: new THREE.Vector3(5, 0, 10),
            quests: []
        };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 2,
            rooms: [
                { index: 0, explored: true, cleared: false, type: 'start' },
                { index: 1, explored: true, cleared: false, type: 'normal' },
                { index: 2, explored: false, cleared: false, type: 'boss' }
            ]
        };
        engine.uiManager = {
            showRewardSummary: jest.fn(),
            showRoomClearReward: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.floatingTextManager = {
            spawn: jest.fn()
        };

        const summary = createRoomClearSummary({
            roomHook: 'chest',
            gemCount: 1,
            itemCount: 0,
            heartCount: 0,
            hint: 'Treasure secured — cash in before the boss'
        });
        engine.handleServerMessage({ type: 'room_clear_reward', payload: summary });

        expect(engine.uiManager.showRoomClearReward).toHaveBeenCalledWith(expect.objectContaining({
            roomHook: 'chest',
            gemCount: 1,
            itemCount: 0,
            heartCount: 0
        }));
    });

    test('GameEngine room_clear_reward handling tracks active shrine buffs for the HUD', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            id: 'player-1',
            position: new THREE.Vector3(5, 0, 10),
            quests: []
        };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 2,
            rooms: [
                { index: 0, explored: true, cleared: false, type: 'start' },
                { index: 1, explored: true, cleared: false, type: 'normal' },
                { index: 2, explored: false, cleared: false, type: 'boss' }
            ]
        };
        engine.uiManager = {
            showRewardSummary: jest.fn(),
            showRoomClearReward: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.floatingTextManager = {
            spawn: jest.fn()
        };

        const summary = createRoomClearSummary({
            roomHook: 'shrine',
            hint: 'Shrine restored your strength for the next push',
            buffName: 'Sanctuary',
            buffDurationSeconds: 8,
            damageReductionPct: 25
        });
        engine.handleServerMessage({ type: 'room_clear_reward', payload: summary });

        expect(engine.getActiveBuffs()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'sanctuary',
                name: 'Sanctuary',
                icon: '🛡️',
                durationSeconds: 8,
                remainingSeconds: expect.any(Number),
                detail: expect.stringContaining('25%')
            })
        ]));
    });

    test('UIManager.showRoomClearReward surfaces chest gem and ambush loot beats', () => {
        buildDom();
        const ui = new UIManager(false);

        ui.showRoomClearReward(createRoomClearSummary({
            title: 'Room Cleared: Treasure Room',
            roomHook: 'chest',
            gemCount: 1,
            hint: 'Treasure secured — cash in before the boss'
        }));
        ui.showRoomClearReward(createRoomClearSummary({
            title: 'Room Cleared: Ambush Room',
            roomType: 'elite',
            roomHook: 'elite_ambush',
            itemCount: 1,
            hint: 'Ambush survived — momentum and spoils increased'
        }));

        const chatMessages = Array.from(document.querySelectorAll('#chat-messages > div')).map(node => node.textContent);
        expect(chatMessages.some((line) => line.includes('+1 gem'))).toBe(true);
        expect(chatMessages.some((line) => line.includes('+1 item'))).toBe(true);
    });

    test('QuestUI renders objective entries with dungeon routing hints', () => {
        buildDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] })
        });

        questUI.renderObjectivesPanel([
            {
                id: 'dungeon-route',
                title: 'Clear the next dungeon room',
                progressLabel: '1 / 3',
                progressPct: 33,
                rewardXP: 0,
                completed: false,
                hint: 'Path opened to the boss room'
            }
        ]);

        expect(document.getElementById('objectives-panel').style.display).toBe('flex');
        expect(document.querySelector('.objective-entry__hint').textContent).toContain('Path opened to the boss room');
    });

    test('QuestUI renders richer objective panel hints for dungeon progress states', () => {
        buildDom();
        const questUI = new QuestUI({
            getLastPlayer: () => ({ quests: [] })
        });

        questUI.renderObjectivesPanel([
            {
                id: 'dungeon-route-open',
                title: 'Break through the last approach room',
                progressLabel: '2 / 4',
                progressPct: 50,
                rewardXP: 0,
                completed: false,
                hint: 'Boss path open — one last room before the boss'
            },
            {
                id: 'dungeon-route-ready',
                title: 'Confront the boss',
                progressLabel: '4 / 4',
                progressPct: 100,
                rewardXP: 1200,
                completed: true,
                hint: 'Boss room unlocked'
            }
        ]);

        const hints = Array.from(document.querySelectorAll('.objective-entry__hint')).map(node => node.textContent);
        expect(hints[0]).toContain('Boss path open — one last room before the boss');
        expect(hints[1]).toContain('Return for your reward: 1200 XP');
    });
});
