import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { UIManager } from '../src/ui/UIManager.js';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';

const windowsCssPath = fileURLToPath(new URL('../src/styles/windows.css', import.meta.url));
const worldMapCssPath = fileURLToPath(new URL('../src/styles/world-map.css', import.meta.url));
const partyCssPath = fileURLToPath(new URL('../src/styles/party.css', import.meta.url));
const indexHtmlPath = fileURLToPath(new URL('../index.html', import.meta.url));

function createTouchLikeEvent(type, options = {}) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'touches', {
        configurable: true,
        value: options.touches || [{ clientX: 100, clientY: 120 }]
    });
    return event;
}

function buildStaticWindowDom() {
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
        <div id="dungeon-entrance-hint" style="display:none"></div>
        <div id="dungeon-entrance-hint-name"></div>
        <div id="dungeon-entrance-hint-status"></div>
        <div id="dungeon-entrance-hint-prompt"></div>
        <div id="xp-bar-fill"></div>
        <div id="xp-text"></div>
        <div id="character-sheet" style="display:none"></div>
        <button id="btn-close-character"></button>
        <div id="stats-content"></div>
        <div id="quest-window" style="display:none"></div>
        <div id="quest-list"></div>
        <div id="quest-journal" style="display:none"></div>
        <div id="journal-list"></div>
        <div id="objectives-panel"></div>
        <div id="objectives-list"></div>
        <button id="btn-close-quest"></button>
        <button id="btn-close-journal"></button>
        <div id="esc-menu" class="window" style="display:none; z-index: 100;"></div>
        <div id="help-screen" class="window" style="display:none; z-index: 101;"></div>
        <button id="btn-close-help-header"></button>
        <div id="settings-screen" class="window" style="display:none; z-index: 102;"></div>
        <button id="btn-close-settings-header"></button>
        <div id="patch-notes-screen" class="window" style="display:none; z-index: 101;"></div>
        <button id="btn-close-patch-notes-header"></button>
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
        <div id="abilities-menu" style="display:none"></div>
        <div id="abilities-content"></div>
        <button id="btn-close-abilities"></button>
        <div id="hotbar-container"></div>
        <div class="hotbar-slot"><div class="hotbar-icon"></div></div>
        <div id="report-screen" class="window" style="display:none; z-index: 102;"></div>
        <button id="btn-close-report-header"></button>
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
        <div id="inventory-screen" style="display:none"></div>
        <button id="btn-close-inventory"></button>
        <div id="inventory-grid"></div>
        <button id="btn-sort-inventory"></button>
        <div id="gold-display"></div>
        <div id="shop-screen" style="display:none"></div>
        <button id="btn-close-shop"></button>
        <button id="btn-close-shop-header"></button>
        <div id="shop-gamble-title"></div>
        <div id="shop-content-main"></div>
        <div id="shop-content-buyback"></div>
        <button id="tab-shop-main"></button>
        <button id="tab-shop-buyback"></button>
        <button id="btn-sell-common"></button>
        <button id="btn-sell-uncommon"></button>
        <button id="btn-sell-rare"></button>
        <div id="shop-grid"></div>
        <div id="stash-screen" style="display:none"></div>
        <button id="btn-close-stash"></button>
        <div id="stash-grid"></div>
        <div id="buyback-grid"></div>
        <div id="split-stack-window" style="display:none"></div>
        <button id="btn-close-split"></button>
        <div id="split-item-name"></div>
        <input id="split-amount-range" />
        <input id="split-amount-input" />
        <button id="btn-confirm-split"></button>
        <button id="btn-cancel-split"></button>
        <div id="forge-screen" style="display:none"></div>
        <button id="btn-close-forge"></button>
        <button id="tab-forge-upgrade"></button>
        <button id="tab-forge-potency"></button>
        <button id="tab-forge-socket"></button>
        <button id="tab-forge-gems"></button>
        <button id="tab-gem-insert"></button>
        <button id="tab-gem-combine"></button>
        <button id="tab-gem-remove"></button>
        <button id="btn-forge-upgrade"></button>
        <button id="btn-forge-upgrade-1"></button>
        <button id="btn-forge-upgrade-10"></button>
        <button id="btn-forge-potency"></button>
        <button id="btn-forge-socket"></button>
        <button id="btn-forge-insert-gem"></button>
        <button id="btn-forge-combine-gem"></button>
        <button id="btn-forge-remove-gem"></button>
        <div id="forge-potency-info"></div>
        <div id="forge-potency-item-name"></div>
        <div id="forge-potency-stats"></div>
        <div id="forge-potency-cost-value"></div>
        <div id="forge-socket-info"></div>
        <div id="forge-socket-item-name"></div>
        <div id="forge-socket-stats"></div>
        <div id="forge-socket-cost-hearts"></div>
        <div id="forge-socket-cost-shards"></div>
        <div id="trading-house-screen" style="display:none"></div>
        <button id="btn-close-trading-house"></button>
        <button id="tab-trading-bid"></button>
        <button id="tab-trading-list"></button>
        <button id="tab-trading-my"></button>
        <div id="trading-panel-bid"></div>
        <div id="trading-panel-list"></div>
        <div id="trading-panel-my"></div>
        <input id="trading-search-input" />
        <button id="btn-trading-search"></button>
        <div id="trading-list-container"></div>
        <div id="trading-sell-slot"></div>
        <input id="trading-input-bid" />
        <input id="trading-input-buyout" />
        <select id="trading-input-duration"></select>
        <button id="btn-trading-create"></button>
        <div id="trading-inventory-list"></div>
        <div id="trading-my-list"></div>
        <div id="world-map" class="window" style="display:none">
            <div id="world-map-header" class="window-header">
                <span class="world-map__title">WORLD MAP</span>
                <button id="btn-close-world-map" class="close-btn" type="button">×</button>
            </div>
            <canvas id="world-map-canvas"></canvas>
        </div>
        <div id="social-window" style="display:none"></div>
        <div id="party-panel">
            <div class="party-panel__header">
                <span class="party-panel__title">PARTY</span>
                <button id="btn-leave-party" class="party-btn party-btn--danger" type="button">Leave</button>
            </div>
            <div id="party-panel-guidance"></div>
            <div id="party-list"></div>
            <div class="party-panel__footer">
                <input type="text" id="party-invite-input" class="party-panel__invite-input" />
                <button id="btn-invite-party" class="party-btn party-btn--success" type="button">Invite</button>
            </div>
        </div>
        <div id="party-request-modal" style="display:none">
            <div id="party-inviter-name"></div>
            <div id="party-request-benefits"></div>
            <button id="btn-accept-party"></button>
            <button id="btn-decline-party"></button>
        </div>
        <div id="skill-tree-window" style="display:none"></div>
        <button id="btn-close-skills"></button>
        <div id="skill-tree-content"></div>
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

describe('menu polish regressions', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        delete window.game;
    });

    test('window headers do not start dragging when close controls are pressed', () => {
        const uiManager = Object.create(UIManager.prototype);
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.innerHTML = `
            <div class="window-header">
                <span>Inventory</span>
                <span class="close-btn">×</span>
            </div>
            <div>Body</div>
        `;
        document.body.appendChild(windowEl);

        uiManager.setupWindow(windowEl);

        const closeBtn = windowEl.querySelector('.close-btn');
        closeBtn.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: 160,
            clientY: 60
        }));

        expect(windowEl.style.position).toBe('');
        expect(windowEl.style.left).toBe('');
        expect(windowEl.style.top).toBe('');
    });

    test('window headers do not start dragging when close controls are tapped', () => {
        const uiManager = Object.create(UIManager.prototype);
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.innerHTML = `
            <div class="window-header">
                <span>Inventory</span>
                <span class="close-btn">×</span>
            </div>
            <div>Body</div>
        `;
        document.body.appendChild(windowEl);

        uiManager.setupWindow(windowEl);

        const closeBtn = windowEl.querySelector('.close-btn');
        closeBtn.dispatchEvent(createTouchLikeEvent('touchstart', {
            touches: [{ clientX: 180, clientY: 80 }]
        }));

        expect(windowEl.style.position).toBe('');
        expect(windowEl.style.left).toBe('');
        expect(windowEl.style.top).toBe('');
    });

    test('dungeon menu renders as a dismissible modal with header close and backdrop close', () => {
        const uiManager = Object.create(UIManager.prototype);
        window.game = { socket: { send: jest.fn() } };

        uiManager.showDungeonMenu({ hasInstance: false, isLeader: false });

        const backdrop = document.getElementById('dungeon-menu-backdrop');
        const menu = document.getElementById('dungeon-menu');
        const closeBtn = document.getElementById('btn-close-dungeon-menu');
        const ladderBox = document.getElementById('dungeon-reward-ladder-box');
        const partyStateBox = document.getElementById('dungeon-party-state-box');

        expect(backdrop).not.toBeNull();
        expect(menu).not.toBeNull();
        expect(closeBtn).not.toBeNull();
        expect(ladderBox).not.toBeNull();
        expect(partyStateBox).not.toBeNull();

        closeBtn.click();
        expect(document.getElementById('dungeon-menu')).toBeNull();
        expect(document.getElementById('dungeon-menu-backdrop')).toBeNull();

        uiManager.showDungeonMenu({ hasInstance: false, isLeader: false });
        document.getElementById('dungeon-menu-backdrop').click();
        expect(document.getElementById('dungeon-menu')).toBeNull();
        expect(document.getElementById('dungeon-menu-backdrop')).toBeNull();
    });

    test('respec menu renders as a dismissible modal with header close and backdrop close', () => {
        const skillTree = new SkillTreeUI({
            getLastPlayer: () => ({ level: 12, gold: 9999 }),
            sendRespec: jest.fn()
        });

        skillTree.showRespecMenu();

        const backdrop = document.getElementById('respec-menu-backdrop');
        const menu = document.getElementById('respec-menu');
        const closeBtn = document.getElementById('btn-close-respec-menu');

        expect(backdrop).not.toBeNull();
        expect(menu).not.toBeNull();
        expect(closeBtn).not.toBeNull();
        expect(menu.textContent).toContain('Reset talents to fine-tune passives');
        expect(menu.textContent).toContain('Use this when you want to reroll passive ranks without changing your current spec branch');
        expect(menu.textContent).toContain('Use this when you want to swap branch path or active skill unlocks without wiping talents');
        expect(menu.textContent).toContain('Use this for a full rebuild after major gear changes or a new build direction');

        closeBtn.click();
        expect(document.getElementById('respec-menu')).toBeNull();
        expect(document.getElementById('respec-menu-backdrop')).toBeNull();

        skillTree.showRespecMenu();
        document.getElementById('respec-menu-backdrop').click();
        expect(document.getElementById('respec-menu')).toBeNull();
        expect(document.getElementById('respec-menu-backdrop')).toBeNull();
    });

    test('dungeon and respec menus close on Escape and keep chrome non-selectable while fields stay interactive', () => {
        const uiManager = Object.create(UIManager.prototype);
        window.game = { socket: { send: jest.fn() } };

        uiManager.showDungeonMenu({ hasInstance: false, isLeader: false });
        const dungeonMenu = document.getElementById('dungeon-menu');
        const dungeonSelect = document.getElementById('dungeon-type-select');
        const runLevelSelect = document.getElementById('dungeon-run-level-select');
        const ladderBox = document.getElementById('dungeon-reward-ladder-box');
        const partyStateBox = document.getElementById('dungeon-party-state-box');
        expect(dungeonMenu).not.toBeNull();
        expect(dungeonMenu.style.userSelect).toBe('none');
        expect(dungeonSelect.style.userSelect).toBe('text');
        expect(runLevelSelect.style.userSelect).toBe('text');
        expect(ladderBox.textContent).toContain('Repeat-Run Ladder');
        expect(partyStateBox.textContent).toContain('No active party instance');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.getElementById('dungeon-menu')).toBeNull();
        expect(document.getElementById('dungeon-menu-backdrop')).toBeNull();

        const skillTree = new SkillTreeUI({
            getLastPlayer: () => ({ level: 12, gold: 9999 }),
            sendRespec: jest.fn()
        });
        skillTree.showRespecMenu();

        const respecMenu = document.getElementById('respec-menu');
        expect(respecMenu).not.toBeNull();
        expect(respecMenu.style.userSelect).toBe('none');

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.getElementById('respec-menu')).toBeNull();
        expect(document.getElementById('respec-menu-backdrop')).toBeNull();
    });

    test('dungeon and respec menus keep inside clicks open but footer close buttons dismiss them', () => {
        const uiManager = Object.create(UIManager.prototype);
        window.game = { socket: { send: jest.fn() } };

        uiManager.showDungeonMenu({ hasInstance: false, isLeader: false });
        const dungeonMenu = document.getElementById('dungeon-menu');
        const dungeonFooterCloseBtn = document.getElementById('btn-close-dungeon-menu-footer');
        expect(dungeonMenu).not.toBeNull();
        expect(dungeonFooterCloseBtn).not.toBeNull();

        dungeonMenu.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById('dungeon-menu')).not.toBeNull();
        dungeonFooterCloseBtn.click();
        expect(document.getElementById('dungeon-menu')).toBeNull();
        expect(document.getElementById('dungeon-menu-backdrop')).toBeNull();

        const skillTree = new SkillTreeUI({
            getLastPlayer: () => ({ level: 12, gold: 9999 }),
            sendRespec: jest.fn()
        });
        skillTree.showRespecMenu();

        const respecMenu = document.getElementById('respec-menu');
        const respecFooterCloseBtn = document.getElementById('btn-close-respec-menu-footer');
        expect(respecMenu).not.toBeNull();
        expect(respecFooterCloseBtn).not.toBeNull();

        respecMenu.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.getElementById('respec-menu')).not.toBeNull();
        respecFooterCloseBtn.click();
        expect(document.getElementById('respec-menu')).toBeNull();
        expect(document.getElementById('respec-menu-backdrop')).toBeNull();
    });

    test('static windows expose header close buttons and backdrop dismissal for older menu screens', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        ui.toggleHelp();
        expect(document.getElementById('help-screen').style.display).toBe('block');
        expect(document.getElementById('ui-static-modal-backdrop')).not.toBeNull();
        document.getElementById('btn-close-help-header').click();
        expect(document.getElementById('help-screen').style.display).toBe('none');
        expect(document.getElementById('ui-static-modal-backdrop')).toBeNull();

        ui.togglePatchNotes();
        expect(document.getElementById('patch-notes-screen').style.display).toBe('flex');
        expect(document.getElementById('ui-static-modal-backdrop')).not.toBeNull();
        document.getElementById('ui-static-modal-backdrop').click();
        expect(document.getElementById('patch-notes-screen').style.display).toBe('none');
        expect(document.getElementById('ui-static-modal-backdrop')).toBeNull();
    });

    test('static modal backdrop stays beneath modal windows inside ui-layer', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        ui.toggleSettings();

        const backdrop = document.getElementById('ui-static-modal-backdrop');
        const settingsScreen = document.getElementById('settings-screen');

        expect(backdrop).not.toBeNull();
        expect(backdrop.parentElement).toBe(document.getElementById('ui-layer'));
        expect(Number(backdrop.style.zIndex)).toBeLessThan(Number(settingsScreen.style.zIndex));
    });

    test('skill tree surfaces class identity and branch role cards', () => {
        buildStaticWindowDom();
        const skillTree = new SkillTreeUI({
            getLastPlayer: () => ({
                level: 25,
                skillPoints: 2,
                subType: 'Wizard',
                selectedBranch: 'B',
                unlockedSkills: ['Fireball']
            }),
            sendRespec: jest.fn()
        });

        skillTree.renderSkillTree('Wizard');

        expect(document.getElementById('skill-tree-content').textContent).toContain('Wizard Identity:');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Ranged spellcaster with explosive AoE');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Pyromancer path for large-area fire damage');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Focused caster path built for single-target spikes');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Control mage path that repositions fights');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Single-Target Caster (Active)');
        expect(document.getElementById('skill-tree-content').textContent).toContain('AoE Caster');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Boss Caster');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Control Mage');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Wants: priority targets, channel windows, damage focus');
        expect(document.getElementById('skill-tree-content').textContent).toContain('Excels at: melting elites and bosses with concentrated spell pressure');
    });

    test('escape closes static modal first and keeps esc menu open', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        ui.toggleEscMenu();
        ui.toggleHelp();
        expect(document.getElementById('esc-menu').style.display).toBe('block');
        expect(document.getElementById('help-screen').style.display).toBe('block');
        expect(document.getElementById('ui-static-modal-backdrop')).not.toBeNull();

        ui.handleEscape();
        expect(document.getElementById('help-screen').style.display).toBe('none');
        expect(document.getElementById('esc-menu').style.display).toBe('block');
        expect(document.getElementById('ui-static-modal-backdrop')).toBeNull();

        ui.toggleSettings();
        expect(document.getElementById('settings-screen').style.display).toBe('block');
        expect(document.getElementById('ui-static-modal-backdrop')).not.toBeNull();

        ui.handleEscape();
        expect(document.getElementById('settings-screen').style.display).toBe('none');
        expect(document.getElementById('esc-menu').style.display).toBe('block');
        expect(document.getElementById('ui-static-modal-backdrop')).toBeNull();
    });

    test('character and inventory windows close from dedicated header controls', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        ui.toggleCharacterSheet();
        expect(document.getElementById('character-sheet').style.display).toBe('block');
        document.getElementById('btn-close-character').click();
        expect(document.getElementById('character-sheet').style.display).toBe('none');

        ui.toggleInventory();
        expect(document.getElementById('inventory-screen').style.display).toBe('block');
        document.getElementById('btn-close-inventory').click();
        expect(document.getElementById('inventory-screen').style.display).toBe('none');
    });

    test('abilities and social windows reuse shared chrome and close cleanly', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        expect(document.querySelectorAll('#social-window')).toHaveLength(1);

        ui.toggleAbilitiesMenu();
        expect(document.getElementById('abilities-menu').style.display).toBe('flex');
        document.getElementById('btn-close-abilities').click();
        expect(document.getElementById('abilities-menu').style.display).toBe('none');

        ui.toggleSocial(true);
        const socialWindow = document.getElementById('social-window');
        expect(socialWindow.style.display).toBe('block');
        expect(document.getElementById('party-panel').style.display).toBe('block');
        socialWindow.querySelector('#close-social').click();
        expect(socialWindow.style.display).toBe('none');
        expect(document.getElementById('party-panel').style.display).toBe('none');
    });

    test('primary hud menus open one at a time and world map header close works', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        ui.onMapToggle = jest.fn(() => {
            const worldMap = document.getElementById('world-map');
            const isHidden = worldMap.style.display === 'none' || worldMap.style.display === '';
            worldMap.style.display = isHidden ? 'flex' : 'none';
        });

        ui.toggleInventory();
        expect(document.getElementById('inventory-screen').style.display).toBe('block');

        ui.toggleSocial(true);
        expect(document.getElementById('inventory-screen').style.display).toBe('none');
        expect(document.getElementById('social-window').style.display).toBe('block');
        expect(document.getElementById('party-panel').style.display).toBe('block');

        ui.toggleJournal();
        expect(document.getElementById('social-window').style.display).toBe('none');
        expect(document.getElementById('party-panel').style.display).toBe('none');
        expect(document.getElementById('quest-journal').style.display).toBe('flex');

        ui.toggleWorldMap();
        expect(ui.onMapToggle).toHaveBeenCalledTimes(1);
        expect(document.getElementById('quest-journal').style.display).toBe('none');
        expect(document.getElementById('world-map').style.display).toBe('flex');

        document.getElementById('btn-close-world-map').click();
        expect(ui.onMapToggle).toHaveBeenCalledTimes(2);
        expect(document.getElementById('world-map').style.display).toBe('none');
    });

    test('legacy button markup uses close-btn chrome for remaining windows', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');

        [
            'btn-close-abilities',
            'btn-close-skills',
            'btn-close-split',
            'btn-close-world-map'
        ].forEach((buttonId) => {
            expect(html).toMatch(new RegExp(`id="${buttonId}"[^>]*class="close-btn"`));
        });
    });

    test('world map and party panel styles prevent accidental text selection', () => {
        const worldMapCss = readFileSync(worldMapCssPath, 'utf8');
        const partyCss = readFileSync(partyCssPath, 'utf8');

        expect(worldMapCss).toMatch(/#world-map\s*\{[^}]*user-select:\s*none;/s);
        expect(partyCss).toMatch(/#party-panel\s*\{[^}]*user-select:\s*none;/s);
    });

    test('browser warning and party markup use reusable classes instead of inline close hacks', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');

        expect(html).toContain('id="btn-close-browser-warning"');
        expect(html).not.toContain('onclick="this.parentElement.style.display=\'none\'"');
        expect(html).toContain('class="party-panel__header"');
        expect(html).toContain('class="party-panel__footer"');
        expect(html).toContain('class="party-request-modal"');
        expect(html).toContain('class="party-request-modal__actions"');
    });

    test('shop forge and trading markup reuse shared tab and footer layout classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');

        expect(html).toContain('class="window-tabs"');
        expect(html).toContain('class="menu-btn window-tab is-active"');
        expect(html).toContain('class="window-action-row"');
        expect(html).toContain('class="window-footer"');
        expect(html).not.toContain('style="display: flex; border-bottom: 1px solid #444;"');
        expect(html).not.toContain('style="text-align: center; padding: 10px; border-top: 1px solid #444;"');
    });

    test('shop forge and trading tabs toggle shared active-tab chrome', () => {
        buildStaticWindowDom();
        new UIManager(false);

        const shopMainTab = document.getElementById('tab-shop-main');
        const shopBuybackTab = document.getElementById('tab-shop-buyback');
        shopBuybackTab.click();
        expect(shopBuybackTab.classList.contains('is-active')).toBe(true);
        expect(shopMainTab.classList.contains('is-active')).toBe(false);

        const forgeUpgradeTab = document.getElementById('tab-forge-upgrade');
        const forgeGemsTab = document.getElementById('tab-forge-gems');
        forgeGemsTab.click();
        expect(forgeGemsTab.classList.contains('is-active')).toBe(true);
        expect(forgeUpgradeTab.classList.contains('is-active')).toBe(false);

        const tradingBidTab = document.getElementById('tab-trading-bid');
        const tradingMyTab = document.getElementById('tab-trading-my');
        tradingMyTab.click();
        expect(tradingMyTab.classList.contains('is-active')).toBe(true);
        expect(tradingBidTab.classList.contains('is-active')).toBe(false);
    });

    test('forge trading quest and journal markup reuse shared body and form layout classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');

        expect(html).toContain('class="window-body"');
        expect(html).toContain('class="window-panel"');
        expect(html).toContain('class="window-list"');
        expect(html).toContain('class="window-data-header"');
        expect(html).toContain('class="window-split-row"');
        expect(html).toContain('class="window-form-column"');
        expect(html).toContain('class="window-form-row"');
        expect(html).not.toContain('style="display: flex; flex-grow: 1; padding: 10px; flex-direction: column;"');
        expect(html).not.toContain('style="flex-grow: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 10px;"');
        expect(html).not.toContain('style="display: flex; gap: 20px; padding: 10px; border-bottom: 1px solid #444;"');
        expect(html).not.toContain('style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 5px; background: #333; font-weight: bold; font-size: 12px; color: #ccc;"');
    });

    test('forge gem markup reuses shared split/grid/detail layout classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');

        expect(html).toContain('class="window-split-row window-split-row--tight"');
        expect(html).toContain('class="window-panel window-panel--centered"');
        expect(html).toContain('class="window-grid window-grid--triple"');
        expect(html).toContain('class="window-grid window-grid--triple window-grid--scroll-sm"');
        expect(html).toContain('class="window-detail-card"');
        expect(html).toContain('class="window-detail-compare"');
        expect(html).toContain('class="window-detail-slots"');
        expect(html).not.toContain('style="display: flex; gap: 10px; flex: 1;"');
        expect(html).not.toContain('style="flex: 1; display: flex; flex-direction: column;"');
        expect(html).not.toContain('style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px;"');
        expect(html).not.toContain('style="border-top: 1px solid #444; padding-top: 10px; display: none; flex-direction: column; align-items: center;"');
        expect(html).not.toContain('style="display: flex; gap: 20px; margin-bottom: 10px; align-items: center;"');
    });

    test('forge combine and trading controls reuse shared compact control classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');

        expect(html).toContain('class="window-inline-stack"');
        expect(html).toContain('class="combine-slot window-token-slot window-token-slot--empty"');
        expect(html).toContain('class="window-token-slot window-token-slot--result"');
        expect(html).toContain('class="btn-menu menu-btn--auto-width menu-btn--wide-padding"');
        expect(html).toContain('class="btn-menu btn-menu--danger"');
        expect(html).not.toContain('style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;"');
        expect(html).not.toContain('style="display: flex; gap: 5px;"');
        expect(html).not.toContain('style="width: 40px; height: 40px; border: 2px dashed #444; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #666;"');
        expect(html).not.toContain('style="width: 40px; height: 40px; border: 2px solid #444; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #666;"');
        expect(html).not.toContain('style="width: auto; padding: 0 20px;"');
        expect(html).not.toContain('style="width: 100%; background: #661111;"');
    });

    test('social window uses reusable class-based chrome', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);
        const socialWindow = document.getElementById('social-window');

        expect(socialWindow.classList.contains('social-window')).toBe(true);
        expect(socialWindow.querySelector('.social-window__header')).not.toBeNull();
        expect(socialWindow.querySelector('.social-window__title')).not.toBeNull();
        expect(socialWindow.querySelector('.social-window__columns')).not.toBeNull();
        expect(socialWindow.querySelector('.social-window__list')).not.toBeNull();
    });

    test('social list renders polished reusable rows and invite actions', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);
        const inviteSpy = jest.fn();
        ui.social.onPartyInvite = inviteSpy;
        ui.lastPlayerRef = { name: 'Rob' };

        ui.updateSocialList([
            { name: 'Rob', class: 'Wizard', level: 12 },
            { name: 'Alice', class: 'Rogue', level: 18 }
        ]);

        const rows = document.querySelectorAll('.social-window__row');
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('.social-window__name--self')).not.toBeNull();
        expect(rows[0].querySelector('.social-window__self-badge')).not.toBeNull();

        const inviteBtn = rows[1].querySelector('.social-window__invite-btn');
        expect(inviteBtn).not.toBeNull();
        inviteBtn.click();
        expect(inviteSpy).toHaveBeenCalledWith('Alice');
    });

    test('party panel surfaces role visibility and cooperative reward guidance', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);
        ui.lastPlayerRef = { id: 'player-1', name: 'Rob' };

        ui.updateParty({
            partyId: 'party-1',
            leaderId: 'player-1',
            members: [
                { id: 'player-1', name: 'Rob', class: 'Wizard', level: 25, hp: 80, maxHp: 100, isLeader: true },
                { id: 'player-2', name: 'Alice', class: 'Rogue', level: 24, hp: 70, maxHp: 100, isLeader: false }
            ]
        });

        expect(document.getElementById('party-panel').textContent).toContain('Leader view');
        expect(document.getElementById('party-panel').textContent).toContain('+20%');

        const members = document.querySelectorAll('.party-member');
        expect(members).toHaveLength(2);
        expect(members[0].querySelector('.party-member-role').textContent).toBe('Leader');
        expect(members[0].querySelector('.party-member-bonus').textContent).toContain('+20%');
        expect(members[1].querySelector('.party-member-role').textContent).toBe('Member');
    });

    test('party invite modal explains cooperative benefits before accepting', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        ui.showPartyRequest('Alice');

        expect(document.getElementById('party-request-modal').style.display).toBe('block');
        expect(document.getElementById('party-request-benefits').textContent).toContain('share nearby kill rewards');
        expect(document.getElementById('party-request-benefits').textContent).toContain('dungeon boss credit');
    });

    test('older static window markup uses consistent close button chrome', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');

        [
            'btn-close-help-header',
            'btn-close-settings-header',
            'btn-close-patch-notes-header',
            'btn-close-report-header',
            'btn-close-shop-header',
            'btn-close-stash',
            'btn-close-forge',
            'btn-close-trading-house',
            'btn-close-quest',
            'btn-close-journal'
        ].forEach((buttonId) => {
            expect(html).toMatch(new RegExp(`id="${buttonId}"[^>]*class="close-btn"`));
        });

        expect(html).toContain('id="btn-close-character"');
        expect(html).toContain('id="btn-close-inventory"');
    });

    test('settings window stays within the viewport and scrolls internally when content is tall', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');

        expect(html).toMatch(/id="settings-screen"[^>]*max-height: calc\(100vh - 24px\);/);
        expect(html).toMatch(/id="settings-screen"[^>]*overflow: hidden;/);
        expect(html).toMatch(/id="settings-screen"[\s\S]*?overflow-y: auto;/);
    });

    test('window chrome disables accidental selection while preserving text selection inside form fields', () => {
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(css).toContain('user-select: none;');
        expect(css).toContain('.window input,');
        expect(css).toContain('user-select: text;');
        expect(css).toContain('.close-btn');
    });
});
