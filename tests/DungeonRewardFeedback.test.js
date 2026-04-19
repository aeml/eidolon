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

function createRewardSummary(overrides = {}) {
    return {
        playerId: 'player-1',
        title: 'Boss Defeated: Zephyrion',
        subtitle: 'Tempest Spire • Heroic',
        gold: 4200,
        xp: 900000,
        itemCount: 3,
        gemCount: 1,
        heartCount: 2,
        bossName: 'Zephyrion',
        instanceType: 'tempest_spire',
        difficulty: 'heroic',
        runLevel: 100,
        roomsCleared: 6,
        totalRooms: 6,
        eliteRoomsCleared: 2,
        totalEliteRooms: 2,
        difficultyNote: 'Heroic bosses guarantee one bonus gem drop.',
        exitHint: 'Return to the entrance to leave the dungeon.',
        ...overrides
    };
}

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.player = {
        id: 'player-1',
        position: new THREE.Vector3(5, 0, 10)
    };
    engine.uiManager = {
        showRewardSummary: jest.fn(),
        addChatMessage: jest.fn()
    };
    engine.floatingTextManager = {
        spawn: jest.fn()
    };
    engine.handleServerMessage = GameEngine.prototype.handleServerMessage;
    return engine;
}

describe('Dungeon reward feedback', () => {
    test('UIManager.showRewardSummary emits a stronger dungeon completion summary', () => {
        buildDom();
        const ui = new UIManager(false);

        ui.showRewardSummary(createRewardSummary());

        const chatMessages = Array.from(document.querySelectorAll('#chat-messages > div')).map(node => node.textContent);
        expect(chatMessages).toHaveLength(9);
        expect(chatMessages[0]).toContain('Rewards');
        expect(chatMessages[0]).toContain('Boss Defeated: Zephyrion');
        expect(chatMessages[1]).toContain('Tempest Spire • Heroic • Level 100');
        expect(chatMessages[2]).toContain('Dungeon complete');
        expect(chatMessages[2]).toContain('6 / 6 rooms');
        expect(chatMessages[2]).toContain('2 / 2 elite rooms');
        expect(chatMessages[3]).toContain('Heroic bosses guarantee one bonus gem drop.');
        expect(chatMessages[4]).toContain('Zephyrion down');
        expect(chatMessages[4]).toContain('3 items secured');
        expect(chatMessages[4]).toContain('1 gem secured');
        expect(chatMessages[4]).toContain('2 hearts secured');
        expect(chatMessages[5]).toContain('+4200 gold');
        expect(chatMessages[5]).toContain('+900000 XP');
        expect(chatMessages[6]).toContain('3 items');
        expect(chatMessages[6]).toContain('1 gem');
        expect(chatMessages[6]).toContain('2 hearts');
        expect(chatMessages[7]).toContain('build drops ready');
        expect(chatMessages[8]).toContain('Return to the entrance to leave the dungeon.');
        expect(document.getElementById('combat-intent-name').textContent).toContain('Boss Defeated: Zephyrion');
        expect(document.getElementById('combat-intent-meta').textContent).toContain('Tempest Spire');
        expect(document.getElementById('combat-intent-status').textContent).toContain('Dungeon complete');
        expect(document.getElementById('combat-intent-status').textContent).toContain('Heroic bosses guarantee one bonus gem drop.');
        expect(document.getElementById('combat-intent-status').textContent).toContain('Zephyrion down');
    });

    test('GameEngine reward_summary handling spawns floating text and forwards summary to UI', () => {
        const engine = createEngineHarness();
        const summary = createRewardSummary();

        engine.handleServerMessage({
            type: 'reward_summary',
            payload: summary
        });

        expect(engine.floatingTextManager.spawn).toHaveBeenCalledWith('BOSS DEFEATED!', engine.player.position, '#ffd700', '32px');
        expect(engine.uiManager.showRewardSummary).toHaveBeenCalledWith(summary);
    });

    test('GameEngine ignores reward_summary for a different player', () => {
        const engine = createEngineHarness();

        engine.handleServerMessage({
            type: 'reward_summary',
            payload: createRewardSummary({ playerId: 'player-2' })
        });

        expect(engine.floatingTextManager.spawn).not.toHaveBeenCalled();
        expect(engine.uiManager.showRewardSummary).not.toHaveBeenCalled();
    });

    test('GameEngine still handles partial reward summaries without crashing', () => {
        const engine = createEngineHarness();
        const partial = createRewardSummary({ subtitle: '', itemCount: 0, gemCount: 0, heartCount: 0, title: 'Boss Defeated: Hollow Sentinel' });

        expect(() => {
            engine.handleServerMessage({
                type: 'reward_summary',
                payload: partial
            });
        }).not.toThrow();

        expect(engine.uiManager.showRewardSummary).toHaveBeenCalledWith(partial);
    });
});
