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

        const summary = createRoomClearSummary();
        engine.handleServerMessage({ type: 'room_clear_reward', payload: summary });

        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('ROOM CLEARED!', engine.player.position, '#7CFFB2', '26px');
        expect(engine.uiManager.showRoomClearReward).toHaveBeenCalledWith(summary);
        expect(engine.getDungeonRoomSummary()).toEqual(expect.objectContaining({
            objectiveRoomIndex: 2
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
});
