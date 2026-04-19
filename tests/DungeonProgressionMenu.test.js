import { jest } from '@jest/globals';
import { UIManager } from '../src/ui/UIManager.js';

function buildDom() {
    document.body.innerHTML = `
        <div id="player-hud"></div>
        <div id="player-hp-bar"></div>
        <div id="player-hp-text"></div>
        <div id="player-mana-bar"></div>
        <div id="player-mana-text"></div>
        <div id="ui-layer"></div>
        <div id="game-timer"></div>
        <div id="combat-intent-panel"></div>
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

describe('dungeon progression menu', () => {
    beforeEach(() => {
        buildDom();
        window.game = { socket: { send: jest.fn() } };
    });

    test('shows all dungeons at level 30, only unlocked run levels, and locks endgame difficulties', () => {
        const ui = new UIManager(false);

        ui.showDungeonMenu({
            hasInstance: false,
            isLeader: false,
            playerLevel: 30,
            maxPlayerLevel: 100,
            dungeonUnlockLevel: 30,
            endgameDifficultyUnlockLevel: 100,
            availableRunLevels: [30]
        });

        const dungeonSelect = document.getElementById('dungeon-type-select');
        const runLevelSelect = document.getElementById('dungeon-run-level-select');
        const infoBox = document.getElementById('difficulty-info-box');

        expect(dungeonSelect).not.toBeNull();
        expect(dungeonSelect.options).toHaveLength(4);
        expect(runLevelSelect).not.toBeNull();
        expect(Array.from(runLevelSelect.options).map((option) => option.value)).toEqual(['30']);
        expect(infoBox.textContent).toContain('Heroic and Mythic unlock at level 100');
        expect(infoBox.textContent).toContain('Baseline route for learning layouts, boss kits, and room pacing.');
        expect(infoBox.textContent).toContain('Boss rewards stay on the standard gold, XP, and heart line.');
        expect(document.getElementById('dungeon-reward-ladder-box').textContent).toContain('Accept dungeon dailies at the Quest Giver');
    });

    test('shows the daily dungeon reward ladder for the selected dungeon and difficulty', () => {
        const ui = new UIManager(false);

        ui.showDungeonMenu({
            hasInstance: false,
            isLeader: false,
            playerLevel: 100,
            maxPlayerLevel: 100,
            dungeonUnlockLevel: 30,
            endgameDifficultyUnlockLevel: 100,
            availableRunLevels: [30, 40, 50, 60, 70, 80, 90, 100],
            quests: [
                { id: 'daily_tempest_spire_bosses', count: 2, maxCount: 5, rewardXP: 9000000, accepted: true, completed: false },
                { id: 'daily_dungeon_bosses_mythic', count: 1, maxCount: 4, rewardXP: 15000000, accepted: true, completed: false }
            ]
        });

        document.getElementById('dungeon-type-select').value = 'tempest_spire';
        document.getElementById('diff-btn-mythic').click();

        const ladderBox = document.getElementById('dungeon-reward-ladder-box');
        expect(ladderBox.textContent).toContain('Repeat-Run Ladder');
        expect(ladderBox.textContent).toContain('Tempest Spire bosses');
        expect(ladderBox.textContent).toContain('2 / 5');
        expect(ladderBox.textContent).toContain('9,000,000 XP');
        expect(ladderBox.textContent).toContain('Mythic dungeon bosses');
        expect(ladderBox.textContent).toContain('1 / 4');
        expect(ladderBox.textContent).toContain('15,000,000 XP');
    });

    test('sends selected run level with enter_dungeon payload', () => {
        const ui = new UIManager(false);

        ui.showDungeonMenu({
            hasInstance: false,
            isLeader: false,
            playerLevel: 100,
            maxPlayerLevel: 100,
            dungeonUnlockLevel: 30,
            endgameDifficultyUnlockLevel: 100,
            availableRunLevels: [30, 40, 50, 60, 70, 80, 90, 100]
        });

        document.getElementById('dungeon-type-select').value = 'tempest_spire';
        document.getElementById('dungeon-run-level-select').value = '80';
        document.getElementById('diff-btn-mythic').click();

        const infoBox = document.getElementById('difficulty-info-box');
        expect(infoBox.textContent).toContain('Capstone push where bosses hit hardest and every kill pays out build-defining loot.');
        expect(infoBox.textContent).toContain('Bosses guarantee one bonus gem and one unique-effect item.');

        document.getElementById('btn-enter-dungeon').click();

        expect(window.game.socket.send).toHaveBeenCalledWith(JSON.stringify({
            type: 'enter_dungeon',
            payload: {
                dungeonType: 'tempest_spire',
                difficulty: 'mythic',
                runLevel: 80
            }
        }));
    });
});
