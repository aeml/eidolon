import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { UIManager } from '../src/ui/UIManager.js';
import { SkillTreeUI } from '../src/ui/SkillTreeUI.js';

const windowsCssPath = fileURLToPath(new URL('../src/styles/windows.css', import.meta.url));
const overlaysCssPath = fileURLToPath(new URL('../src/styles/overlays.css', import.meta.url));
const abilitiesCssPath = fileURLToPath(new URL('../src/styles/abilities.css', import.meta.url));
const worldMapCssPath = fileURLToPath(new URL('../src/styles/world-map.css', import.meta.url));
const partyCssPath = fileURLToPath(new URL('../src/styles/party.css', import.meta.url));
const socialCssPath = fileURLToPath(new URL('../src/styles/social.css', import.meta.url));
const skillTreeCssPath = fileURLToPath(new URL('../src/styles/skill-tree.css', import.meta.url));
const chatCssPath = fileURLToPath(new URL('../src/styles/chat.css', import.meta.url));
const startScreenCssPath = fileURLToPath(new URL('../src/styles/start-screen.css', import.meta.url));
const variablesCssPath = fileURLToPath(new URL('../src/styles/variables.css', import.meta.url));
const baseCssPath = fileURLToPath(new URL('../src/styles/base.css', import.meta.url));
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
        <div id="esc-menu" class="window pause-menu" style="display:none; z-index: 100;"></div>
        <div id="help-screen" class="window support-window support-window--help" style="display:none;"></div>
        <button id="btn-close-help-header"></button>
        <div id="settings-screen" class="window support-window support-window--settings" style="display:none;"></div>
        <button id="btn-close-settings-header"></button>
        <div id="patch-notes-screen" class="window support-window support-window--patch-notes" style="display:none;"></div>
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
        <div id="report-screen" class="window support-window support-window--report" style="display:none;"></div>
        <button id="btn-close-report-header"></button>
        <button id="btn-cancel-report"></button>
        <button id="btn-submit-report"></button>
        <select id="report-type"></select>
        <textarea id="report-text"></textarea>
        <select id="graphics-quality"></select>
        <input id="graphics-brightness" />
        <div id="graphics-brightness-value"></div>
        <input id="auto-loot-enabled" type="checkbox" />
        <input id="audio-enabled" type="checkbox" />
        <input id="audio-volume" />
        <div id="audio-volume-value"></div>
        <select id="audio-detail-level"></select>
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
        <div id="trading-house-guidance"></div>
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
        localStorage.clear();
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

    test('dragged windows clamp the full frame inside the viewport', () => {
        const uiManager = Object.create(UIManager.prototype);
        const windowEl = document.createElement('div');
        windowEl.className = 'window';
        windowEl.style.display = 'block';
        windowEl.style.width = '300px';
        windowEl.style.height = '220px';
        windowEl.style.left = '100px';
        windowEl.style.top = '100px';
        windowEl.innerHTML = `
            <div class="window-header">
                <span>Inventory</span>
            </div>
            <div>Body</div>
        `;

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 640 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 });
        windowEl.getBoundingClientRect = jest.fn(() => ({
            left: Number.parseFloat(windowEl.style.left) || 100,
            top: Number.parseFloat(windowEl.style.top) || 100,
            right: (Number.parseFloat(windowEl.style.left) || 100) + 300,
            bottom: (Number.parseFloat(windowEl.style.top) || 100) + 220,
            width: 300,
            height: 220
        }));

        document.body.appendChild(windowEl);
        uiManager.setupWindow(windowEl);

        windowEl.querySelector('.window-header').dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            clientX: 110,
            clientY: 110
        }));
        window.dispatchEvent(new MouseEvent('mousemove', {
            bubbles: true,
            clientX: 1000,
            clientY: 1000
        }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

        expect(windowEl.style.position).toBe('fixed');
        expect(windowEl.style.left).toBe('328px');
        expect(windowEl.style.top).toBe('248px');
        expect(windowEl.dataset.draggedWindow).toBe('true');
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
        expect(dungeonMenu.classList.contains('generated-menu')).toBe(true);
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
        expect(respecMenu.classList.contains('generated-menu')).toBe(true);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(document.getElementById('respec-menu')).toBeNull();
        expect(document.getElementById('respec-menu-backdrop')).toBeNull();
    });

    test('gameplay Escape closes the adventure dialog without opening pause and restores its opener', () => {
        const ui = Object.create(UIManager.prototype);
        ui.toggleEscMenu = jest.fn();
        const opener = document.createElement('button');
        document.body.append(opener);
        opener.focus();
        ui.showDungeonMenu({ playerLevel: 30, hasInstance: false, isLeader: true });
        ui.handleEscape();
        expect(document.getElementById('dungeon-menu')).toBeNull();
        expect(document.getElementById('dungeon-menu-backdrop')).toBeNull();
        expect(ui.toggleEscMenu).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(opener);
        opener.remove();
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

    test('generated dungeon and respec menus cap to the viewport and scroll to footer actions', () => {
        const css = readFileSync(windowsCssPath, 'utf8');
        const uiManager = Object.create(UIManager.prototype);
        uiManager.getDungeonDailyQuestEntries = () => [];
        window.game = { socket: { send: jest.fn() } };

        uiManager.showDungeonMenu({
            hasInstance: false,
            isLeader: true,
            playerLevel: 100,
            availableRunLevels: [30, 60, 90],
            quests: []
        });

        const dungeonMenu = document.getElementById('dungeon-menu');
        const dungeonSelect = document.getElementById('dungeon-type-select');
        const runLevelSelect = document.getElementById('dungeon-run-level-select');
        const heroicButton = document.getElementById('diff-btn-heroic');
        const dungeonFooterCloseBtn = document.getElementById('btn-close-dungeon-menu-footer');

        expect(document.getElementById('dungeon-menu-backdrop').classList.contains('generated-menu-backdrop')).toBe(true);
        expect(dungeonMenu.classList.contains('generated-menu')).toBe(true);
        expect(dungeonMenu.classList.contains('generated-menu--dungeon')).toBe(true);
        expect(dungeonMenu.getAttribute('style') || '').not.toContain('max-height');
        expect(css).toMatch(/\.generated-menu\s*\{[^}]*width:\s*min\(92vw, 540px\);[^}]*max-width:\s*calc\(100vw - 24px\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow-y:\s*auto;[^}]*overflow-x:\s*hidden;[^}]*padding:\s*20px 20px 24px;/s);
        expect(dungeonSelect.classList.contains('generated-menu__select')).toBe(true);
        expect(runLevelSelect.classList.contains('generated-menu__select')).toBe(true);
        expect(dungeonSelect.style.width).toBe('');
        expect(runLevelSelect.style.width).toBe('');
        expect(heroicButton.parentElement.classList.contains('generated-menu__choice-row')).toBe(true);
        expect(heroicButton.parentElement.getAttribute('style')).toBeNull();
        expect(dungeonFooterCloseBtn.parentElement.classList.contains('generated-menu__actions')).toBe(true);
        expect(dungeonFooterCloseBtn).not.toBeNull();
        dungeonFooterCloseBtn.click();

        const skillTree = new SkillTreeUI({
            getLastPlayer: () => ({ level: 100, gold: 999999 }),
            sendRespec: jest.fn()
        });
        skillTree.showRespecMenu();

        const respecMenu = document.getElementById('respec-menu');
        const respecFooterCloseBtn = document.getElementById('btn-close-respec-menu-footer');

        expect(document.getElementById('respec-menu-backdrop').classList.contains('generated-menu-backdrop')).toBe(true);
        expect(respecMenu.classList.contains('generated-menu')).toBe(true);
        expect(respecMenu.classList.contains('generated-menu--respec')).toBe(true);
        expect(respecMenu.getAttribute('style') || '').not.toContain('max-height');
        expect(css).toMatch(/\.generated-menu--respec\s*\{[^}]*width:\s*min\(92vw, 460px\);/s);
        expect(respecFooterCloseBtn.parentElement.classList.contains('generated-menu__actions')).toBe(true);
        expect(respecFooterCloseBtn.parentElement.getAttribute('style')).toBeNull();
        expect(respecFooterCloseBtn).not.toBeNull();
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
        expect(backdrop.id).toBe('ui-static-modal-backdrop');
        expect(settingsScreen.classList.contains('support-window--settings')).toBe(true);
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

    test('rune clicks wait for the authoritative server response before changing player state', () => {
        buildStaticWindowDom();
        const player = {
            level: 100,
            subType: 'Fighter',
            selectedBranch: 'A',
            unlockedSkills: ['Shield Bash', 'Iron Fortress', 'Guardian Roar', 'Bulwark'],
            skillRunes: { 'Iron Fortress': 'ironfortress_extended' }
        };
        const skillTree = new SkillTreeUI({
            getLastPlayer: () => player,
            sendRespec: jest.fn()
        });
        skillTree.skillTreeMode = 'runes';
        skillTree.onSelectRune = jest.fn();
        skillTree.renderSkillTree('Fighter');

        const thornsName = [...document.querySelectorAll('#skill-tree-content div')]
            .find((element) => element.textContent === 'Thorns');
        expect(thornsName).toBeDefined();
        thornsName.click();

        expect(skillTree.onSelectRune).toHaveBeenCalledWith('Iron Fortress', 'ironfortress_thorns');
        expect(player.skillRunes['Iron Fortress']).toBe('ironfortress_extended');
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

    test('server time updates the hud clock and refreshes the open journal with authoritative reset timing', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);
        ui.lastPlayerRef = {
            quests: [
                {
                    id: 'daily_molten_core_bosses',
                    target: 'MoltenCoreBoss',
                    accepted: false,
                    completed: false,
                    count: 0,
                    maxCount: 5,
                    rewardXP: 9000000
                }
            ]
        };

        ui.toggleJournal();
        ui.updateServerTime(Date.UTC(2026, 3, 19, 3, 30, 15) / 1000);

        expect(document.getElementById('game-timer').textContent).toBe('11:30:15 PM');
        expect(document.getElementById('game-timer').title).toBe('Authoritative server time (ET)');
        expect(document.getElementById('journal-list').textContent).toContain('Daily reset: 00:29:45 remaining');
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
        const socialCss = readFileSync(socialCssPath, 'utf8');

        expect(worldMapCss).toMatch(/#world-map\s*\{[^}]*user-select:\s*none;/s);
        expect(partyCss).toMatch(/#party-panel\s*\{[^}]*user-select:\s*none;/s);
        expect(socialCss).toMatch(/\.social-window\s*\{[^}]*width:\s*min\(560px, calc\(100vw - 40px\)\);/s);
        expect(socialCss).toMatch(/\.social-window__status-select\s*\{[^}]*min-width:\s*170px;/s);
    });

    test('special skill tree and party surfaces stay inside the viewport', () => {
        const skillTreeCss = readFileSync(skillTreeCssPath, 'utf8');
        const partyCss = readFileSync(partyCssPath, 'utf8');

        expect(skillTreeCss).toMatch(/#skill-tree-window\s*\{[^}]*width:\s*min\(900px, calc\(100vw - 24px\)\);[^}]*height:\s*fit-content;[^}]*min-height:\s*min\(540px, calc\(100vh - 24px\)\);/s);
        expect(skillTreeCss).toMatch(/#skill-tree-window\s*\{[^}]*max-width:\s*calc\(100vw - 24px\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow:\s*hidden;/s);
        expect(skillTreeCss).toMatch(/\.skill-tree-content\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);

        expect(partyCss).toMatch(/#party-panel\s*\{[^}]*max-width:\s*calc\(100vw - 40px\);[^}]*max-height:[^;]*var\(--chat-panel-height, 230px\)[^;]*;[^}]*overflow-y:\s*auto;/s);
        expect(partyCss).toMatch(/\.party-request-modal\s*\{[^}]*width:\s*min\(360px, calc\(100vw - 24px\)\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow-y:\s*auto;/s);
    });

    test('skill tree empty state uses a shared placeholder class', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(skillTreeCssPath, 'utf8');

        expect(html).toContain('<div class="skill-tree-empty-state">');
        expect(html).toContain('Select a class to view skills.');
        expect(html).not.toContain('<div style="text-align: center; color: #aaa; margin-top: 50px;">');
        expect(css).toMatch(/\.skill-tree-empty-state\s*\{[^}]*text-align:\s*center;[^}]*color:\s*var\(--color-text-muted\);[^}]*margin-top:\s*50px;/s);
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

    test('forge window is large enough and scrolls internally so bottom tab actions stay reachable', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toMatch(/id="forge-screen"[^>]*class="window forge-window"[^>]*style="display: none;"/);
        expect(html).not.toContain('<div id="forge-screen" class="window forge-window" style="display: none; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(92vw, 760px); height: min(860px, calc(100vh - 24px)); z-index: 101; flex-direction: column;">');
        expect(css).toMatch(/#forge-screen\s*\{[^}]*max-height:\s*calc\(100vh - 24px\);/s);
        expect(css).toMatch(/\.forge-window\s*\{[^}]*width:\s*min\(92vw, 760px\);[^}]*height:\s*min\(860px, calc\(100vh - 24px\)\);[^}]*z-index:\s*101;[^}]*flex-direction:\s*column;/s);
        expect(css).toMatch(/#forge-screen\s+\.window-body\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*padding-bottom:\s*18px;/s);
        expect(css).toMatch(/#forge-screen\s+\.btn-menu\s*\{[^}]*min-height:\s*38px;/s);
    });

    test('social window uses reusable class-based chrome', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);
        const socialWindow = document.getElementById('social-window');

        expect(socialWindow.classList.contains('social-window')).toBe(true);
        expect(socialWindow.querySelector('.social-window__header')).not.toBeNull();
        expect(socialWindow.querySelector('.social-window__title')).not.toBeNull();
        expect(socialWindow.querySelector('.social-window__status-control')).not.toBeNull();
        expect(socialWindow.querySelector('.social-window__columns')).not.toBeNull();
        expect(socialWindow.querySelector('.social-window__list')).not.toBeNull();
    });

    test('social list renders polished reusable rows statuses and invite actions', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);
        const inviteSpy = jest.fn();
        const statusSpy = jest.fn();
        ui.social.onPartyInvite = inviteSpy;
        ui.social.onSocialStatusChange = statusSpy;
        ui.lastPlayerRef = { name: 'Rob' };

        document.getElementById('social-status-select').value = 'looking_party';
        document.getElementById('social-status-select').dispatchEvent(new Event('change'));
        expect(statusSpy).toHaveBeenCalledWith('looking_party');
        expect(ui.social.currentSocialStatus).toBe('looking_party');

        ui.updateSocialList([
            { name: 'Rob', class: 'Wizard', level: 12, socialStatus: 'looking_party' },
            { name: 'Alice', class: 'Rogue', level: 18, socialStatus: 'busy' }
        ]);

        const rows = document.querySelectorAll('.social-window__row');
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('.social-window__name--self')).not.toBeNull();
        expect(rows[0].querySelector('.social-window__self-badge')).not.toBeNull();
        expect(rows[0].querySelector('.social-window__status').textContent).toBe('Looking for Party');
        expect(rows[1].querySelector('.social-window__status').textContent).toBe('Busy');

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
				{ id: 'player-1', name: 'Rob', class: 'Wizard', role: 'damage', level: 25, hp: 80, maxHp: 100, isLeader: true, ready: true },
				{ id: 'player-2', name: 'Alice', class: 'Cleric', role: 'support', level: 24, hp: 70, maxHp: 100, isLeader: false, ready: false }
            ]
        });

        expect(document.getElementById('party-panel').textContent).toContain('Leader view');
        expect(document.getElementById('party-panel').textContent).toContain('+20%');

        const members = document.querySelectorAll('.party-member');
        expect(members).toHaveLength(2);
		expect(members[0].querySelector('.party-member-role').textContent).toBe('damage • Leader • Ready');
        expect(members[0].querySelector('.party-member-bonus').textContent).toContain('+20%');
		expect(members[1].querySelector('.party-member-role').textContent).toBe('support');
    });

    test('party invite modal explains cooperative benefits before accepting', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        ui.showPartyRequest('Alice');

        expect(document.getElementById('party-request-modal').style.display).toBe('block');
        expect(document.getElementById('party-request-benefits').textContent).toContain('share nearby kill rewards');
        expect(document.getElementById('party-request-benefits').textContent).toContain('dungeon boss credit');
    });

    test('trading house tabs explain browse, listing, and collection intent', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);
        ui.lastPlayerRef = { inventory: [] };

        ui.trading.switchTab('bid');
        expect(document.getElementById('trading-house-guidance').textContent).toContain('watch the time remaining');

        ui.trading.switchTab('list');
        expect(document.getElementById('trading-house-guidance').textContent).toContain('sales fee plus your deposit');

        ui.trading.switchTab('my');
        expect(document.getElementById('trading-house-guidance').textContent).toContain('collect gold or reclaim items');
    });

    test('trading house renders auction timing and collection outcome hints', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        ui.renderAuctionList([
            {
                id: 'auction-1',
                item: { name: 'Stormblade', rarity: 'Rare' },
                sellerName: 'Alice',
                currentBid: 1200,
                buyoutPrice: 2400,
                bidderName: 'Rob',
                endTime: new Date(Date.now() + (45 * 60000)).toISOString()
            }
        ]);

        const browseRow = document.getElementById('trading-list-container').firstChild;
        expect(browseRow.textContent).toContain('Stormblade');
        expect(browseRow.textContent).toContain('Alice');
        expect(browseRow.textContent).toContain('45m left');
        expect(browseRow.querySelector('span').title).toContain('High bid: Rob');

        ui.renderMyAuctions([
            {
                id: 'auction-2',
                item: { name: 'Zephyr Bow', rarity: 'Epic' },
                status: 'SOLD',
                currentBid: 5000
            },
            {
                id: 'auction-3',
                item: { name: 'Old Boots', rarity: 'Common' },
                status: 'EXPIRED',
                currentBid: 200
            }
        ]);

        const myRows = document.getElementById('trading-my-list').children;
        expect(myRows[0].textContent).toContain('Collect Gold');
        expect(myRows[0].querySelector('button').title).toContain('deposit refund');
        expect(myRows[1].textContent).toContain('Reclaim Item');
        expect(myRows[1].querySelector('button').title).toContain('inventory or stash');
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

    test('pause menu uses reusable viewport-safe menu chrome', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toMatch(/id="esc-menu"[^>]*class="window pause-menu"[^>]*style="display: none;"/);
        expect(html).toContain('class="pause-menu__actions"');
        expect(html).toContain('id="btn-report" class="menu-btn pause-menu__button--report"');
        expect(html).toContain('id="btn-respawn" class="menu-btn pause-menu__button--danger"');
        expect(html).not.toContain('id="esc-menu" class="window" style="display: none; top: 50%; left: 50%;');
        expect(html).not.toContain('id="btn-report" class="menu-btn" style="border-color: #ffd700; color: #ffd700;"');
        expect(html).not.toContain('id="btn-respawn" class="menu-btn" style="border-color: #ff4444; color: #ff4444;"');
        expect(css).toMatch(/\.pause-menu\s*\{[^}]*width:\s*min\(300px, calc\(100vw - 24px\)\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow:\s*hidden;/s);
        expect(css).toMatch(/\.pause-menu__actions\s*\{[^}]*max-height:\s*calc\(100vh - 92px\);[^}]*overflow-y:\s*auto;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
        expect(css).toMatch(/\.pause-menu__button--report\s*\{[^}]*border-color:\s*var\(--color-gold\);[^}]*color:\s*var\(--color-gold\);/s);
        expect(css).toMatch(/\.pause-menu__button--danger\s*\{[^}]*border-color:\s*#ff4444;[^}]*color:\s*#ff4444;/s);
    });

    test('settings window stays within the viewport and scrolls internally when content is tall', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toMatch(/id="settings-screen"[^>]*class="window support-window support-window--settings"[^>]*style="display: none;"/);
        expect(html).toContain('class="support-window__body support-window__body--settings"');
        expect(css).toMatch(/\.support-window\s*\{[^}]*max-width:\s*calc\(100vw - 24px\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow:\s*hidden;/s);
        expect(css).toMatch(/\.support-window--settings\s*\{[^}]*width:\s*min\(360px, calc\(100vw - 24px\)\);[^}]*z-index:\s*102;/s);
        expect(css).toMatch(/\.support-window__body--settings\s*\{[^}]*gap:\s*16px;[^}]*max-height:\s*calc\(100vh - 76px\);/s);
    });

    test('static help report and patch notes windows stay within the viewport and scroll internally', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toMatch(/id="help-screen"[^>]*class="window support-window support-window--help"[^>]*style="display: none;"/);
        expect(html).toContain('class="support-window__body support-window__body--help"');
        expect(html).toMatch(/id="report-screen"[^>]*class="window support-window support-window--report"[^>]*style="display: none;"/);
        expect(html).toContain('class="support-window__body support-window__body--report"');
        expect(html).toMatch(/id="patch-notes-screen"[^>]*class="window support-window support-window--patch-notes"[^>]*style="display: none;"/);
        expect(html).toMatch(/id="patch-notes-history" class="support-window__body support-window__body--patch-notes"/);

        expect(css).toMatch(/\.support-window--help\s*\{[^}]*width:\s*min\(460px, calc\(100vw - 24px\)\);[^}]*z-index:\s*101;/s);
        expect(css).toMatch(/\.support-window__body--help\s*\{[^}]*max-height:\s*calc\(100vh - 160px\);[^}]*text-align:\s*left;/s);
        expect(css).toMatch(/\.support-window--report\s*\{[^}]*width:\s*min\(400px, calc\(100vw - 24px\)\);[^}]*z-index:\s*102;/s);
        expect(css).toMatch(/\.support-window__body--report\s*\{[^}]*gap:\s*10px;[^}]*max-height:\s*calc\(100vh - 110px\);/s);
        expect(css).toMatch(/\.support-window--patch-notes\s*\{[^}]*width:\s*min\(500px, calc\(100vw - 24px\)\);[^}]*height:\s*min\(600px, calc\(100vh - 24px\)\);/s);
        expect(css).toMatch(/\.support-window__body--patch-notes\s*\{[^}]*flex-grow:\s*1;[^}]*color:\s*#ccc;/s);
    });

    test('help guide content reuses shared title key and separator classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div class="help-guide">');
        expect(html).toContain('<div id="help-first-hour-guide" class="help-guide help-guide--separated">');
        expect(html).toContain('<div id="help-daily-return-guide" class="help-guide help-guide--separated">');
        expect(html).toContain('<div id="help-keyboard-reference" class="help-guide help-guide--separated help-guide--keyboard-reference" style="display: none;">');
        expect(html).toContain('<div class="help-guide__title">Core Controls</div>');
        expect(html).toContain('<div class="help-guide__title">Detailed Keyboard Reference</div>');
        expect(html).toContain('<div class="help-guide__grid">');
        expect(html).toContain('<strong class="help-guide__key">Left Click:</strong>');
        expect(html).toContain('<strong class="help-guide__key">Combat:</strong> Left Click for melee/basic attack, Right Click to use your selected ability, 1-4 for hotbar abilities');
        expect(html).toContain('<strong class="help-guide__key">1.</strong> Meet <strong>Archmage Ilyra</strong>');
        expect(html).toContain('click <strong>Complete Quest</strong> to receive your rewards.');
        expect(html).not.toContain('<div style="color: #ffd700; font-size: 15px; font-weight: bold; margin-bottom: 6px;">Core Controls</div>');
        expect(html).not.toContain('<div id="help-first-hour-guide" style="border-top: 1px solid #444; padding-top: 10px;">');
        expect(html).not.toContain('<strong style="color: #ffd700;">Left Click:</strong>');

        expect(css).toMatch(/\.help-guide--separated\s*\{[^}]*border-top:\s*1px solid #444;[^}]*padding-top:\s*10px;/s);
        expect(css).toMatch(/\.help-guide__title\s*\{[^}]*color:\s*#ffd700;[^}]*font-size:\s*15px;[^}]*font-weight:\s*bold;[^}]*margin-bottom:\s*6px;/s);
        expect(css).toMatch(/\.help-guide__key\s*\{[^}]*color:\s*#ffd700;/s);
        expect(css).toMatch(/\.help-guide__grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s);
        expect(css).toMatch(/@media \(max-width: 640px\)\s*\{\s*\.help-guide__grid\s*\{[^}]*grid-template-columns:\s*1fr;/s);
    });

    test('patch notes history entries reuse shared title and list classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div class="patch-note-entry" data-version="0.31.7">');
        expect(html).toContain('<h3 class="patch-note-entry__title">Patch 0.31.7');
        expect(html).toContain('<ul class="patch-note-entry__list">');
        expect(html).not.toContain('class="patch-note-entry" data-version="0.31.7" style="margin-bottom: 20px;"');
        expect(html).not.toContain('<h3 style="color: #ffd700; border-bottom: 1px solid #444; padding-bottom: 5px;">Patch');
        expect(html).not.toContain('<ul style="list-style-type: disc; padding-left: 20px; line-height: 1.6;">');

        expect(css).toMatch(/\.patch-note-entry\s*\{[^}]*margin-bottom:\s*20px;/s);
        expect(css).toMatch(/\.patch-note-entry__title\s*\{[^}]*color:\s*#ffd700;[^}]*border-bottom:\s*1px solid #444;[^}]*padding-bottom:\s*5px;/s);
        expect(css).toMatch(/\.patch-note-entry__list\s*\{[^}]*list-style-type:\s*disc;[^}]*padding-left:\s*20px;[^}]*line-height:\s*1\.6;/s);
    });

    test('patch notes header helper text uses shared meta and link classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<span class="patch-notes-header__meta">');
        expect(html).toContain('<a class="patch-notes-header__link" href="https://github.com/aeml/eidolon/commits/master/" target="_blank">here</a>');
        expect(html).not.toContain('<span style="font-size: 12px; font-weight: normal; color: #ccc; margin-left: 10px;">');
        expect(html).not.toContain('target="_blank" style="color: #ffd700; text-decoration: underline; cursor: pointer;"');

        expect(css).toMatch(/\.patch-notes-header__meta\s*\{[^}]*font-size:\s*12px;[^}]*font-weight:\s*normal;[^}]*color:\s*#ccc;[^}]*margin-left:\s*10px;/s);
        expect(css).toMatch(/\.patch-notes-header__link\s*\{[^}]*color:\s*#ffd700;[^}]*text-decoration:\s*underline;[^}]*cursor:\s*pointer;/s);
    });

    test('start screen version row uses shared label and patch notes link classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(startScreenCssPath, 'utf8');

        expect(html).toContain('<div class="start-version-row">');
        expect(html).toContain('<span class="start-version-row__label">Alpha 1.0.1</span>');
        expect(html).toContain('<button id="login-patch-notes-link" class="start-version-row__link" type="button">Patch notes</button>');
        expect(html).not.toContain('<div style="text-align: center; margin-top: -20px; margin-bottom: 20px;">');
        expect(html).not.toContain('<span style="color: white; font-size: 18px; font-weight: bold;">Alpha');
        expect(html).not.toContain('id="login-patch-notes-link" style="color: #ffd700; cursor: pointer; text-decoration: underline; font-size: 14px; margin-left: 5px;"');

        expect(css).toMatch(/\.start-version-row\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*text-align:\s*center;/s);
        expect(css).toMatch(/\.start-version-row__label\s*\{[^}]*color:\s*var\(--entry-muted\);/s);
        expect(css).toMatch(/\.start-version-row__link\s*\{[^}]*color:\s*var\(--entry-gold\);[^}]*cursor:\s*pointer;/s);
    });

    test('start flow panel uses shared shell body and copy classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(startScreenCssPath, 'utf8');

        expect(html).toContain('<div id="start-flow-panel" class="start-flow-panel">');
        expect(html).toContain('<div class="start-flow-panel__body">');
        expect(html).toContain('<div id="start-flow-title" class="start-flow-panel__title">');
        expect(html).toContain('Four crystals.');
        expect(html).toContain('<div id="start-flow-copy" class="start-flow-panel__copy">');
        expect(html).toContain('<div id="start-flow-steps" class="start-flow-panel__steps">');
        expect(html).not.toContain('id="start-flow-panel" class="window" style="position: relative; top: auto; left: auto; transform: none; width: min(560px, calc(100vw - 40px)); margin: 0 auto 20px auto; display: flex; flex-direction: column; gap: 10px;"');
        expect(html).not.toContain('<div style="padding: 16px; display: flex; flex-direction: column; gap: 10px; text-align: left;">');
        expect(html).not.toContain('id="start-flow-title" style="color: #ffd700; font-size: 20px; font-weight: bold;"');

        expect(css).toMatch(/\.start-flow-panel\s*\{[^}]*min-width:\s*0;/s);
        expect(css).toMatch(/\.start-flow-panel__body\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
        expect(css).toMatch(/\.start-flow-panel__title\s*\{[^}]*font-size:\s*clamp\(/s);
        expect(css).toMatch(/\.start-flow-panel__copy\s*\{[^}]*line-height:\s*1\.7;/s);
        expect(css).toMatch(/\.start-flow-panel__steps\s*\{[^}]*line-height:\s*1\.6;/s);
    });

    test('auth entry controls use shared classes instead of inline chrome', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(startScreenCssPath, 'utf8');

        expect(html).toContain('<div class="auth-panel__title">Welcome, traveler</div>');
        expect(html).toContain('<div class="auth-panel__actions">');
        expect(html).toContain('<button id="btn-login" class="auth-btn auth-btn--fill">Login</button>');
        expect(html).toContain('<button id="btn-register" class="auth-btn auth-btn--fill">Register</button>');
        expect(html).toContain('<div id="auth-status" class="auth-status" role="status" aria-live="polite"></div>');
        for (const field of ['username', 'email', 'password']) {
            expect(html).toContain(`<label class="auth-field" for="auth-${field}">`);
        }
        expect(html).toContain('<div id="play-container" class="play-container">');
        expect(html).toContain('<button id="btn-play-character" class="menu-btn play-container__button">ENTER WORLD</button>');
        expect(html).not.toContain('<div style="text-align: center; font-size: 1.2rem; color: #ffd700; margin-bottom: 10px; font-weight: bold;">LOGIN / REGISTER</div>');
        expect(html).not.toContain('<button id="btn-login" class="auth-btn" style="flex: 1;">Login</button>');
        expect(html).not.toContain('<div id="auth-status" style="color: #ffeb3b; font-size: 14px; text-align: center; min-height: 20px;"></div>');
        expect(html).not.toContain('<div id="play-container" style="display: none; text-align: center; margin-top: 20px;">');

        expect(css).toMatch(/\.auth-panel__title\s*\{[^}]*font-family:\s*Georgia,/s);
        expect(css).toMatch(/\.auth-panel__actions\s*\{[^}]*display:\s*flex;[^}]*gap:\s*10px;[^}]*margin-top:\s*10px;/s);
        expect(css).toMatch(/\.auth-btn--fill\s*\{[^}]*flex:\s*1;/s);
        expect(css).toMatch(/\.auth-status\s*\{[^}]*text-align:\s*center;[^}]*min-height:\s*20px;/s);
        expect(css).toMatch(/\.play-container\s*\{[^}]*display:\s*none;/s);
        expect(css).toMatch(/#start-screen \.play-container__button\s*\{[^}]*min-height:\s*56px;/s);
    });

    test('death overlay uses reusable closeout classes instead of inline chrome', () => {
        buildStaticWindowDom();
        const overlaysCss = readFileSync(overlaysCssPath, 'utf8');
        new UIManager(false);

        const deathScreen = document.getElementById('death-screen');
        expect(deathScreen.classList.contains('death-screen')).toBe(true);
        expect(deathScreen.querySelector('#death-screen-title').className).toBe('death-screen__title');
        expect(deathScreen.querySelector('#death-screen-hint').className).toBe('death-screen__hint');
        expect(deathScreen.querySelector('#death-screen-meta').className).toBe('death-screen__meta');
        expect(deathScreen.querySelector('#btn-death-respawn').className).toBe('menu-btn death-screen__button');

        expect(deathScreen.innerHTML).not.toContain('style=');
        expect(deathScreen.style.position).toBe('');
        expect(deathScreen.style.backgroundColor).toBe('');
        expect(deathScreen.style.zIndex).toBe('');
        expect(overlaysCss).toMatch(/\.death-screen\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*background:\s*rgba\(0, 0, 0, 0\.8\);[^}]*z-index:\s*2000;/s);
        expect(overlaysCss).toMatch(/\.death-screen__title\s*\{[^}]*font-size:\s*clamp\(42px, 9vw, 72px\);/s);
        expect(overlaysCss).toMatch(/\.death-screen__button\s*\{[^}]*width:\s*auto;[^}]*min-height:\s*52px;/s);
    });

    test('class selection descriptions use shared title and class-color classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(startScreenCssPath, 'utf8');

        expect(html).toContain('<div class="class-selection__title">Create New Character</div>');
        expect(html).toContain('id="class-fighter-description" class="class-selection__description class-selection__description--fighter"');
        expect(html).toContain('id="class-rogue-description" class="class-selection__description class-selection__description--rogue"');
        expect(html).toContain('id="class-wizard-description" class="class-selection__description class-selection__description--wizard"');
        expect(html).toContain('id="class-cleric-description" class="class-selection__description class-selection__description--cleric"');
        expect(html).not.toContain('<div style="width: 100%; text-align: center; color: #aaa; margin-bottom: 10px;">Create New Character</div>');
        expect(html).not.toContain('style="width: 100%; text-align: center; color: #8ec5ff; margin-bottom: 6px; font-size: 13px;"');
        expect(html).not.toContain('style="width: 100%; text-align: center; color: #ffd27a; margin-bottom: 6px; font-size: 13px;"');

        expect(css).toMatch(/\.class-selection__title,[\s\S]*\.class-selection__description\s*\{[^}]*width:\s*100%;[^}]*text-align:\s*left;/s);
        expect(css).toMatch(/\.class-selection__description\s*\{[^}]*font-size:\s*13px;[^}]*line-height:\s*1\.45;/s);
        const start = new DOMParser().parseFromString(html, 'text/html').getElementById('start-screen');
        for (const type of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
            const button = start.querySelector(`.class-btn[data-type="${type}"]`);
            const name = button.querySelector(`#${button.getAttribute('aria-labelledby')}`);
            const description = button.querySelector(`#${button.getAttribute('aria-describedby')}`);
            expect(name.textContent).toBe(type);
            expect(description.textContent.length).toBeGreaterThan(20);
        }
    });

    test('loading overlay uses shared shell title progress and text classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(overlaysCssPath, 'utf8');

        expect(html).toContain('<div id="loading-screen" class="loading-screen">');
        expect(html).toContain('<h2 class="loading-screen__title">LOADING...</h2>');
        expect(html).toContain('<div class="loading-screen__bar">');
        expect(html).toContain('<div id="loading-bar-fill" class="loading-screen__bar-fill"></div>');
        expect(html).toContain('<div id="loading-text" class="loading-screen__text">Initializing...</div>');
        expect(html).not.toContain('id="loading-screen" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #000; z-index: 200; flex-direction: column; justify-content: center; align-items: center;"');
        expect(html).not.toContain('<h2 style="color: #ffd700; margin-bottom: 20px; font-size: 2rem;">LOADING...</h2>');
        expect(html).not.toContain('id="loading-bar-fill" style="width: 0%; height: 100%; background: #ffd700; transition: width 0.2s;"');

        expect(css).toMatch(/\.loading-screen\s*\{[^}]*display:\s*none;[^}]*position:\s*absolute;[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*background:\s*#000;[^}]*z-index:\s*200;[^}]*flex-direction:\s*column;[^}]*justify-content:\s*center;[^}]*align-items:\s*center;/s);
        expect(css).toMatch(/\.loading-screen__title\s*\{[^}]*color:\s*#ffd700;[^}]*margin-bottom:\s*20px;[^}]*font-size:\s*2rem;/s);
        expect(css).toMatch(/\.loading-screen__bar\s*\{[^}]*width:\s*min\(300px, calc\(100vw - 40px\)\);[^}]*height:\s*20px;[^}]*background:\s*#333;[^}]*border:\s*2px solid #666;[^}]*border-radius:\s*4px;[^}]*overflow:\s*hidden;/s);
        expect(css).toMatch(/\.loading-screen__bar-fill\s*\{[^}]*width:\s*0%;[^}]*height:\s*100%;[^}]*background:\s*#ffd700;[^}]*transition:\s*width 0\.2s;/s);
        expect(css).toMatch(/\.loading-screen__text\s*\{[^}]*color:\s*#888;[^}]*margin-top:\s*10px;[^}]*font-size:\s*14px;/s);
    });

    test('ability tooltip text uses shared name description and cost classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(abilitiesCssPath, 'utf8');

        expect(html).toContain('<h4 id="ability-name" class="ability-tooltip__name">Ability</h4>');
        expect(html).toContain('<div id="ability-desc" class="ability-tooltip__desc">Description</div>');
        expect(html).toContain('<div id="ability-cost" class="ability-tooltip__cost">Mana: 0</div>');
        expect(html).not.toContain('<h4 id="ability-name" style="margin: 0 0 5px 0; color: #ffd700;">Ability</h4>');
        expect(html).not.toContain('<div id="ability-desc" style="font-size: 12px; color: #ccc;">Description</div>');
        expect(html).not.toContain('<div id="ability-cost" style="font-size: 12px; color: #aaf; margin-top: 5px;">Mana: 0</div>');

        expect(css).toMatch(/\.ability-tooltip__name\s*\{[^}]*margin:\s*0 0 5px 0;[^}]*color:\s*#ffd700;/s);
        expect(css).toMatch(/\.ability-tooltip__desc\s*\{[^}]*font-size:\s*12px;[^}]*color:\s*#ccc;/s);
        expect(css).toMatch(/\.ability-tooltip__cost\s*\{[^}]*font-size:\s*12px;[^}]*color:\s*#aaf;[^}]*margin-top:\s*5px;/s);
    });

    test('abilities menu shell and content use shared layout classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div id="abilities-menu" class="window abilities-menu content-aware-window" style="display: none;">');
        expect(html).toContain('<div id="abilities-content" class="abilities-content">');
        expect(html).not.toContain('<div id="abilities-menu" class="window" style="display: none; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(350px, calc(100vw - 24px)); height: min(400px, calc(100vh - 24px)); z-index: 101; flex-direction: column;">');
        expect(html).not.toContain('<div id="abilities-content" style="padding: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; min-height: 0; overflow-y: auto;">');

        expect(css).toMatch(/\.abilities-menu\s*\{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*transform:\s*translate\(-50%, -50%\);[^}]*width:\s*min\(380px, calc\(100vw - 24px\)\);[^}]*height:\s*fit-content;[^}]*z-index:\s*101;[^}]*flex-direction:\s*column;/s);
        expect(css).toMatch(/\.abilities-content\s*\{[^}]*padding:\s*var\(--spacing-md\);[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(4, 1fr\);[^}]*gap:\s*var\(--spacing-md\);/s);
    });

    test('support menus reuse footer and action row classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div class="support-window__footer">');
        expect(html).toContain('class="support-window__actions support-window__actions--split"');
        expect(html).toContain('id="btn-cancel-report" class="menu-btn support-window__button--half"');
        expect(html).toContain('id="btn-submit-report" class="menu-btn support-window__button--half support-window__button--success"');
        expect(html).not.toContain('id="btn-cancel-report" class="menu-btn" style="width: 45%;"');
        expect(html).not.toContain('id="btn-submit-report" class="menu-btn" style="width: 45%; background: #4CAF50; border-color: #45a049;"');

        expect(css).toMatch(/\.support-window__actions\s*\{[^}]*display:\s*flex;[^}]*gap:\s*10px;[^}]*flex-wrap:\s*wrap;/s);
        expect(css).toMatch(/\.support-window__button--half\s*\{[^}]*width:\s*min\(45%, 180px\);[^}]*min-width:\s*120px;/s);
        expect(css).toMatch(/\.support-window__button--success\s*\{[^}]*background:\s*#4CAF50;[^}]*border-color:\s*#45a049;/s);
    });

    test('report form fields reuse support field controls', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<select id="report-type" class="support-field__control">');
        expect(html).toContain('<textarea id="report-text" class="support-field__control support-field__textarea" rows="8" placeholder="Describe your issue or idea..."></textarea>');
        expect(html).not.toContain('<select id="report-type" style="padding: 10px; background: #333; color: white; border: 1px solid #666; font-family: inherit;">');
        expect(html).not.toContain('<textarea id="report-text" rows="8" placeholder="Describe your issue or idea..." style="padding: 10px; background: #333; color: white; border: 1px solid #666; resize: none; font-family: inherit;"></textarea>');

        expect(css).toMatch(/\.support-field__control\s*\{[^}]*padding:\s*10px;[^}]*background:\s*var\(--bg-input\);[^}]*color:\s*var\(--color-white\);[^}]*border:\s*1px solid var\(--border-light\);[^}]*font-family:\s*inherit;/s);
        expect(css).toMatch(/\.support-field__textarea\s*\{[^}]*resize:\s*none;/s);
    });

    test('settings core fields reuse support field classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<label for="graphics-quality" class="support-field__label">Graphics Quality</label>');
        expect(html).toContain('<select id="graphics-quality" class="support-field__control">');
        expect(html).toContain('<label for="graphics-brightness" class="support-field__label">Brightness</label>');
        expect(html).toContain('<span id="graphics-brightness-value" class="support-field__value">100%</span>');
        expect(html).toContain('<input id="graphics-brightness" class="support-field__range" type="range"');
        expect(html).toContain('<label for="ui-scale" class="support-field__label">UI Scale</label>');
        expect(html).toContain('<span id="ui-scale-value" class="support-field__value">100%</span>');
        expect(html).toContain('<input id="ui-scale" class="support-field__range" type="range" min="85" max="125" step="5" value="100" />');
        expect(html).toContain('Scales menus and HUD text while viewport-safe windows keep their visible bounds.');
        expect(html).toContain('<label for="control-hint-level" class="support-field__label">Control Hints</label>');
        expect(html).toContain('<select id="control-hint-level" class="support-field__control">');
        expect(html).toContain('<option value="detailed">Detailed keyboard reference</option>');
        expect(html).toContain('Detailed mode expands Help with grouped keyboard shortcuts without changing your actual bindings.');
        expect(html).toContain('<label for="auto-loot-enabled" class="support-field__label">Auto-Loot Nearby Items</label>');
        expect(html).toContain('<label for="audio-enabled" class="support-field__label">Audio Cues</label>');
        expect(html).toContain('<label for="audio-volume" class="support-field__label">Audio Volume</label>');
        expect(html).toContain('<input id="audio-volume" class="support-field__range" type="range"');
        expect(html).toContain('<label for="audio-detail-level" class="support-field__label">Audio Detail</label>');
        expect(html).toContain('<select id="audio-detail-level" class="support-field__control">');
        expect(html).toContain('Reduced UI cues keeps gameplay feedback sounds but quiets routine menu click and window sounds.');
        expect(html).toContain('<label for="camera-shake-enabled" class="support-field__label">Camera Shake</label>');
        expect(html).toContain('<label for="fullscreen-enabled" class="support-field__label">Fullscreen</label>');
        expect(html).not.toContain('<label for="graphics-quality" style="color: #ffd700; font-size: 13px;">Graphics Quality</label>');
        expect(html).not.toContain('<input id="graphics-brightness" type="range" min="0" max="100" step="1" value="50" style="width: 100%;" />');

        expect(css).toMatch(/\.support-field\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*8px;[^}]*text-align:\s*left;/s);
        expect(css).toMatch(/\.support-field__row\s*\{[^}]*justify-content:\s*space-between;[^}]*align-items:\s*center;[^}]*gap:\s*12px;/s);
        expect(css).toMatch(/\.support-field__label\s*\{[^}]*color:\s*var\(--color-gold\);[^}]*font-size:\s*13px;/s);
        expect(css).toMatch(/\.support-field__hint\s*\{[^}]*font-size:\s*12px;[^}]*color:\s*var\(--color-text-muted\);[^}]*line-height:\s*1\.4;/s);
        expect(css).toMatch(/\.support-field__control\s*\{[^}]*padding:\s*10px;[^}]*background:\s*var\(--bg-input\);[^}]*border:\s*1px solid var\(--border-light\);/s);
    });

    test('ui scale uses shared css token on the ui layer', () => {
        const variablesCss = readFileSync(variablesCssPath, 'utf8');
        const baseCss = readFileSync(baseCssPath, 'utf8');

        expect(variablesCss).toMatch(/--ui-scale:\s*1;/);
        expect(baseCss).toMatch(/#ui-layer\s*\{[^}]*font-size:\s*calc\(16px \* var\(--ui-scale\)\);/s);
    });

    test('settings asset cache section uses reusable panel classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div class="asset-cache-panel">');
        expect(html).toContain('<div class="asset-cache-panel__header">');
        expect(html).toContain('<div id="asset-download-status" class="asset-cache-panel__status">Not downloaded</div>');
        expect(html).toContain('<div id="asset-download-progress" class="asset-cache-panel__detail">0%</div>');
        expect(html).toContain('<div class="asset-cache-meter">');
        expect(html).toContain('<div id="asset-download-progress-bar" class="asset-cache-meter__bar"></div>');
        expect(html).toContain('<div class="asset-cache-pack-list">');
        expect(html).toContain('<div id="asset-pack-core-badge" class="asset-cache-pack__badge">Current</div>');
        expect(html).toContain('<div class="asset-cache-panel__actions">');
        expect(html).toContain('id="btn-download-recommended-assets" class="menu-btn asset-cache-panel__button--recommended"');
        expect(html).toContain('id="btn-refresh-outdated-assets" class="menu-btn asset-cache-panel__button--refresh"');
        expect(html).toContain('id="btn-update-cached-assets" class="menu-btn asset-cache-panel__button--update"');
        expect(html).toContain('id="btn-clear-cached-assets" class="menu-btn asset-cache-panel__button--clear"');
        expect(html).not.toContain('id="asset-download-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #5bbd6a 0%, #9ad06f 100%); transition: width 0.2s ease;"');
        expect(html).not.toContain('id="asset-pack-core-badge" style="display: inline-flex;');
        expect(html).not.toContain('id="btn-download-recommended-assets" class="menu-btn" type="button" style="border-color: #5f8f5f; color: #d6ffd6;"');
        expect(html).not.toContain('id="btn-clear-cached-assets" class="menu-btn" type="button" style="border-color: #aa6666; color: #ffb7b7;"');

        expect(css).toMatch(/\.asset-cache-panel\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*border-top:\s*1px solid rgba\(255,255,255,0\.08\);/s);
        expect(css).toMatch(/\.asset-cache-panel__header,[\s\S]*\.asset-cache-pack\s*\{[^}]*justify-content:\s*space-between;[^}]*align-items:\s*center;/s);
        expect(css).toMatch(/\.asset-cache-meter__bar\s*\{[^}]*width:\s*0%;[^}]*background:\s*linear-gradient\(90deg, #5bbd6a 0%, #9ad06f 100%\);/s);
        expect(css).toMatch(/\.asset-cache-pack__badge\s*\{[^}]*display:\s*inline-flex;[^}]*border-radius:\s*999px;/s);
        expect(css).toMatch(/\.asset-cache-panel__actions\s*\{[^}]*justify-content:\s*flex-end;[^}]*flex-wrap:\s*wrap;/s);
        expect(css).toMatch(/\.asset-cache-panel__button--recommended\s*\{[^}]*border-color:\s*#5f8f5f;[^}]*color:\s*#d6ffd6;/s);
        expect(css).toMatch(/\.asset-cache-panel__button--clear\s*\{[^}]*border-color:\s*#aa6666;[^}]*color:\s*#ffb7b7;/s);
    });

    test('service and quest windows stay within the viewport and scroll growing content internally', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toMatch(/id="shop-screen"[^>]*class="window shop-window"[^>]*style="display: none;"/);
        expect(html).toMatch(/id="shop-content-main"[^>]*class="shop-content shop-content--main"/);
        expect(html).toMatch(/id="shop-content-buyback"[^>]*class="shop-content shop-content--buyback"[^>]*style="display: none;"/);

        expect(html).toMatch(/id="stash-screen"[^>]*class="window stash-window"[^>]*style="display: none;"/);

        expect(html).toMatch(/id="trading-house-screen"[^>]*width: min\(600px, calc\(100vw - 24px\)\);/);
        expect(html).toMatch(/id="trading-house-screen"[^>]*height: min\(500px, calc\(100vh - 24px\)\);/);

        expect(html).toMatch(/id="quest-window"[^>]*class="window content-aware-window"/);
        expect(html).toMatch(/id="quest-journal"[^>]*class="window content-aware-window"/);

        expect(css).toMatch(/#shop-screen,[\s\S]*#quest-journal\s*\{[^}]*max-width:\s*calc\(100vw - 24px\);[^}]*max-height:\s*calc\(100vh - 24px\);/);
        expect(css).toMatch(/\.shop-window\s*\{[^}]*width:\s*min\(500px, calc\(100vw - 24px\)\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow:\s*hidden;/s);
        expect(css).toMatch(/\.shop-content\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
        expect(css).toMatch(/\.stash-window\s*\{[^}]*width:\s*min\(500px, calc\(100vw - 24px\)\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow-y:\s*auto;/s);
        expect(css).toMatch(/#quest-window,[\s\S]*#quest-journal\s*\{[^}]*width:\s*min\(520px, calc\(100vw - 24px\)\);[^}]*height:\s*fit-content;[^}]*overflow:\s*hidden;/);
        expect(css).toMatch(/#trading-house-screen\s+\.window-body,[\s\S]*#quest-journal\s+\.window-list\s*\{[^}]*min-height:\s*0;/);
    });

    test('managed windows pair character and inventory while enforcing other primary exclusivity', () => {
        buildStaticWindowDom();
        const ui = new UIManager(false);

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

        ui.toggleManagedWindow('inventory');
        expect(document.getElementById('inventory-screen').style.display).toBe('block');

        ui.toggleManagedWindow('character');
        expect(document.getElementById('inventory-screen').style.display).toBe('block');
        expect(document.getElementById('character-sheet').style.display).toBe('block');

        ui.toggleManagedWindow('journal');
        expect(document.getElementById('inventory-screen').style.display).toBe('none');
        expect(document.getElementById('character-sheet').style.display).toBe('none');
        expect(document.getElementById('quest-journal').style.display).toBe('flex');

        ui.toggleManagedWindow('shop', { keepCompanion: true });
        expect(document.getElementById('quest-journal').style.display).toBe('none');
        expect(document.getElementById('shop-screen').style.display).toBe('flex');
        expect(document.getElementById('inventory-screen').style.display).toBe('block');

        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 700 });
        ui.reflowVisibleWindows();
        expect(document.getElementById('shop-screen').style.display).toBe('flex');
        expect(document.getElementById('inventory-screen').style.display).toBe('none');
    });

    test('layout CSS avoids offscreen side transforms and caps objective height', () => {
        const css = readFileSync(windowsCssPath, 'utf8');
        const hudCss = readFileSync(overlaysCssPath.replace('overlays.css', 'hud.css'), 'utf8');
        const responsiveCss = readFileSync(overlaysCssPath.replace('overlays.css', 'responsive.css'), 'utf8');

        expect(css).toMatch(/\.window\s*\{[^}]*position:\s*fixed;[^}]*box-sizing:\s*border-box;/s);
        expect(css).toMatch(/#character-sheet\s*\{[^}]*transform:\s*translate\(-50%, -50%\);/s);
        expect(css).toMatch(/#inventory-screen\s*\{[^}]*transform:\s*translate\(-50%, -50%\);/s);
        expect(css).not.toContain('transform: translate(-150%, -50%);');
        expect(css).not.toContain('transform: translate(100%, -50%);');
        expect(hudCss).toMatch(/#objectives-panel\s*\{[^}]*max-height:[^;]*var\(--chat-panel-height,[^;]*;[^}]*overflow-y:\s*hidden;/s);
        expect(hudCss).toMatch(/\.objectives-panel__list\s*\{[^}]*overflow-y:\s*auto;/s);
        expect(responsiveCss).not.toContain('scale(0.5)');
        expect(responsiveCss).not.toContain('scale(0.6)');
    });

    test('merchant shop shell content and grids use shared classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div id="shop-screen" class="window shop-window" style="display: none;">');
        expect(html).toContain('<div id="shop-content-main" class="shop-content shop-content--main">');
        expect(html).toContain('<p id="shop-service-guidance" class="shop-guidance">');
        expect(html).toContain('<p class="shop-guidance shop-guidance--tip">');
        expect(html).toContain('<h3 id="shop-gamble-title" class="shop-gamble-title">MYSTERY BOXES (500g)</h3>');
        expect(html).toContain('<div id="shop-grid" class="shop-grid">');
        expect(html).toContain('<div id="shop-content-buyback" class="shop-content shop-content--buyback" style="display: none;">');
        expect(html).toContain('<p id="shop-buyback-guidance" class="shop-guidance shop-guidance--buyback">');
        expect(html).toContain('<div id="buyback-grid" class="inventory-grid shop-buyback-grid">');
        expect(html).not.toContain('<div id="shop-screen" class="window" style="display: none; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(500px, calc(100vw - 24px)); max-height: calc(100vh - 24px); z-index: 101; flex-direction: column; overflow: hidden;">');
        expect(html).not.toContain('id="shop-content-main" style="padding: 10px; text-align: center; flex-grow: 1; display: flex; flex-direction: column; min-height: 0; overflow-y: auto;"');
        expect(html).not.toContain('id="shop-service-guidance" style="color: #aaa; font-size: 14px; margin-bottom: 10px;"');
        expect(html).not.toContain('id="shop-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 10px;"');
        expect(html).not.toContain('id="buyback-grid" class="inventory-grid" style="grid-template-columns: repeat(5, 1fr); padding: 10px; max-height: 300px; overflow-y: auto;"');

        expect(css).toMatch(/\.shop-window\s*\{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*transform:\s*translate\(-50%, -50%\);[^}]*z-index:\s*101;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;/s);
        expect(css).toMatch(/\.shop-content\s*\{[^}]*padding:\s*var\(--spacing-md\);[^}]*text-align:\s*center;[^}]*flex-grow:\s*1;[^}]*flex-direction:\s*column;/s);
        expect(css).toMatch(/\.shop-guidance\s*\{[^}]*color:\s*var\(--color-text-muted\);[^}]*font-size:\s*14px;[^}]*margin-bottom:\s*var\(--spacing-md\);/s);
        expect(css).toMatch(/\.shop-guidance--tip\s*\{[^}]*color:\s*#8fb7d9;[^}]*font-size:\s*12px;[^}]*margin:\s*0 0 var\(--spacing-lg\) 0;/s);
        expect(css).toMatch(/\.shop-gamble-title\s*\{[^}]*color:\s*var\(--color-gold\);[^}]*border-bottom:\s*1px solid var\(--border-default\);/s);
        expect(css).toMatch(/\.shop-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3, 1fr\);[^}]*gap:\s*var\(--spacing-md\);/s);
        expect(css).toMatch(/\.shop-buyback-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5, 1fr\);[^}]*max-height:\s*300px;[^}]*overflow-y:\s*auto;/s);
    });

    test('merchant sell all rarity buttons use shared modifier classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('id="btn-sell-common" class="menu-btn shop-sell-button shop-sell-button--common"');
        expect(html).toContain('id="btn-sell-uncommon" class="menu-btn shop-sell-button shop-sell-button--uncommon"');
        expect(html).toContain('id="btn-sell-rare" class="menu-btn shop-sell-button shop-sell-button--rare"');
        expect(html).not.toContain('id="btn-sell-common" class="menu-btn" style="background: #333; color: #fff; border-color: #fff; font-size: 12px; padding: 5px 10px;"');
        expect(html).not.toContain('id="btn-sell-uncommon" class="menu-btn" style="background: #1a331a; color: #1eff00; border-color: #1eff00; font-size: 12px; padding: 5px 10px;"');
        expect(html).not.toContain('id="btn-sell-rare" class="menu-btn" style="background: #1a1a33; color: #0070dd; border-color: #0070dd; font-size: 12px; padding: 5px 10px;"');

        expect(css).toMatch(/\.shop-sell-button\s*\{[^}]*font-size:\s*12px;[^}]*padding:\s*5px 10px;/s);
        expect(css).toMatch(/\.shop-sell-button--common\s*\{[^}]*background:\s*#333;[^}]*color:\s*#fff;[^}]*border-color:\s*#fff;/s);
        expect(css).toMatch(/\.shop-sell-button--uncommon\s*\{[^}]*background:\s*#1a331a;[^}]*color:\s*#1eff00;[^}]*border-color:\s*#1eff00;/s);
        expect(css).toMatch(/\.shop-sell-button--rare\s*\{[^}]*background:\s*#1a1a33;[^}]*color:\s*#0070dd;[^}]*border-color:\s*#0070dd;/s);
    });

    test('stash window grid and guidance use shared classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div id="stash-screen" class="window stash-window" style="display: none;">');
        expect(html).toContain('<div class="inventory-grid stash-grid" id="stash-grid">');
        expect(html).toContain('<div id="stash-guidance" class="stash-guidance">');
        expect(html).not.toContain('<div id="stash-screen" class="window" style="display: none; top: 50%; left: 50%; transform: translate(-50%, -50%); width: min(500px, calc(100vw - 24px)); max-height: calc(100vh - 24px); z-index: 101; flex-direction: column; overflow-y: auto;">');
        expect(html).not.toContain('<div class="inventory-grid" id="stash-grid" style="grid-template-columns: repeat(10, 1fr); padding: 10px;">');
        expect(html).not.toContain('<div id="stash-guidance" style="padding: 10px; color: #aaa; font-size: 12px; text-align: center;">');

        expect(css).toMatch(/\.stash-window\s*\{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*transform:\s*translate\(-50%, -50%\);[^}]*z-index:\s*101;[^}]*flex-direction:\s*column;[^}]*overflow-y:\s*auto;/s);
        expect(css).toMatch(/\.stash-grid\s*\{[^}]*grid-template-columns:\s*repeat\(10, 1fr\);[^}]*padding:\s*var\(--spacing-md\);/s);
        expect(css).toMatch(/\.stash-guidance\s*\{[^}]*padding:\s*var\(--spacing-md\);[^}]*color:\s*var\(--color-text-muted\);[^}]*font-size:\s*12px;[^}]*text-align:\s*center;/s);
    });

    test('hud utility windows stay within the viewport and scroll growing content internally', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toMatch(/id="abilities-menu"[^>]*class="window abilities-menu content-aware-window"[^>]*style="display: none;"/);
        expect(html).toMatch(/id="abilities-content"[^>]*class="abilities-content"/);

        expect(html).toMatch(/id="split-stack-window"[^>]*class="window split-stack-window"[^>]*style="display: none;"/);
        expect(html).toMatch(/class="window-content split-stack-content"/);

        expect(css).toMatch(/#abilities-menu,[\s\S]*#split-stack-window\s*\{[^}]*max-width:\s*calc\(100vw - 24px\);[^}]*max-height:\s*calc\(100vh - 24px\);/);
        expect(css).toMatch(/\.abilities-menu\s*\{[^}]*width:\s*min\(380px, calc\(100vw - 24px\)\);[^}]*height:\s*fit-content;[^}]*min-height:\s*min\(180px, calc\(100vh - 24px\)\);/s);
        expect(css).toMatch(/\.split-stack-window\s*\{[^}]*width:\s*min\(250px, calc\(100vw - 24px\)\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow:\s*hidden;/s);
        expect(css).toMatch(/\.split-stack-content\s*\{[^}]*max-height:\s*calc\(100vh - 110px\);[^}]*overflow-y:\s*auto;/s);
        expect(css).toMatch(/#character-sheet\s*\{[^}]*width:\s*min\(600px, calc\(100vw - 24px\)\);[^}]*height:\s*fit-content;/s);
        expect(css).toMatch(/#inventory-screen\s*\{[^}]*width:\s*min\(360px, calc\(100vw - 24px\)\);[^}]*height:\s*fit-content;/s);
        expect(css).toMatch(/#abilities-content,[\s\S]*#inventory-grid\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/);
        expect(css).toMatch(/\.abilities-content\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(4, 1fr\);/s);
    });

    test('primary menu windows are content-aware and viewport capped', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');
        const socialCss = readFileSync(socialCssPath, 'utf8');
        const skillTreeCss = readFileSync(skillTreeCssPath, 'utf8');

        expect(html).toMatch(/id="character-sheet" class="window content-aware-window"/);
        expect(html).toMatch(/id="inventory-screen" class="window content-aware-window"/);
        expect(html).toMatch(/id="quest-journal" class="window content-aware-window"/);
        expect(html).toMatch(/id="skill-tree-window" class="content-aware-window"/);
        expect(css).toMatch(/\.content-aware-window\s*\{[^}]*max-width:\s*calc\(100vw - 24px\);[^}]*max-height:\s*calc\(100vh - 24px\);/s);
        expect(css).toMatch(/#quest-window,[\s\S]*#quest-journal\s*\{[^}]*height:\s*fit-content;/);
        expect(socialCss).toMatch(/\.social-window\s*\{[^}]*height:\s*fit-content;[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow-y:\s*auto;/s);
        expect(skillTreeCss).toMatch(/#skill-tree-window\s*\{[^}]*height:\s*fit-content;[^}]*max-height:\s*calc\(100vh - 24px\);/s);
    });

    test('chat markup provides resizable Chat and Game logs', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(chatCssPath, 'utf8');

        expect(html).toContain('data-chat-tab="chat"');
        expect(html).toContain('data-chat-tab="party"');
        expect(html).toContain('data-chat-tab="whisper"');
        expect(html).toContain('data-chat-tab="game"');
        expect(html).toContain('id="chat-composer"');
        expect(css).toMatch(/#chat-box\s*\{[^}]*min-width:\s*280px;[^}]*max-width:\s*calc\(100vw - 40px\);[^}]*resize:\s*both;/s);
        expect(css).toMatch(/#chat-messages\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s);
    });

    test('inventory footer gold and guidance chrome use shared classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div class="inventory-footer">');
        expect(html).toContain('id="btn-sort-inventory" class="inventory-sort-button"');
        expect(html).toContain('<div id="gold-display" class="inventory-gold-display">');
        expect(html).toContain('<div id="inventory-guidance" class="inventory-guidance">');
        expect(html).not.toContain('<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; border-top: 1px solid #444;">');
        expect(html).not.toContain('id="btn-sort-inventory" title="Sorts your bag from top-left to bottom-right: Hearts, Shards, Gems, then Equipment and other items." aria-label="Sort inventory: Hearts, Shards, Gems, then other items" style="padding: 6px 12px;');
        expect(html).not.toContain('<div id="gold-display" style="color: #ffd700; font-weight: bold; text-align: right;">');
        expect(html).not.toContain('id="inventory-guidance" style="padding: 0 10px 10px 10px; color: #8fb7d9; font-size: 12px; line-height: 1.5; text-align: center; border-top: 1px solid #2a3340;"');

        expect(css).toMatch(/\.inventory-footer\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*space-between;[^}]*border-top:\s*1px solid var\(--border-default\);/s);
        expect(css).toMatch(/\.inventory-sort-button\s*\{[^}]*padding:\s*6px 12px;[^}]*background:\s*linear-gradient\(180deg, #2b3442 0%, #18212c 100%\);[^}]*letter-spacing:\s*0\.05em;/s);
        expect(css).toMatch(/\.inventory-gold-display\s*\{[^}]*color:\s*var\(--color-gold\);[^}]*font-weight:\s*bold;[^}]*text-align:\s*right;/s);
        expect(css).toMatch(/\.inventory-guidance\s*\{[^}]*color:\s*var\(--color-text-muted\);[^}]*line-height:\s*1\.5;[^}]*border-top:\s*1px solid #2a3340;/s);
    });

    test('split stack dialog chrome uses shared classes', () => {
        const html = readFileSync(indexHtmlPath, 'utf8');
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(html).toContain('<div id="split-stack-window" class="window split-stack-window" style="display: none;">');
        expect(html).toContain('<div class="window-content split-stack-content">');
        expect(html).toContain('<div id="split-item-name" class="split-stack-item-name">Item Name</div>');
        expect(html).toContain('<div class="split-stack-control-row">');
        expect(html).toContain('id="split-amount-range" class="split-stack-range"');
        expect(html).toContain('id="split-amount-input" class="split-stack-amount-input"');
        expect(html).toContain('<div class="split-stack-action-row">');
        expect(html).not.toContain('<div id="split-stack-window" class="window" style="display: none; width: min(250px, calc(100vw - 24px)); max-height: calc(100vh - 24px); top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2000; overflow: hidden;">');
        expect(html).not.toContain('<div class="window-content" style="display: flex; flex-direction: column; gap: 10px; padding: 15px; align-items: center; max-height: calc(100vh - 110px); overflow-y: auto;">');
        expect(html).not.toContain('<div id="split-item-name" style="color: #ffd700; font-weight: bold;">Item Name</div>');
        expect(html).not.toContain('id="split-amount-input" min="1" max="1" value="1" style="width: 50px; background: #222; color: white; border: 1px solid #444; padding: 5px;"');

        expect(css).toMatch(/\.split-stack-item-name\s*\{[^}]*color:\s*var\(--color-gold\);[^}]*font-weight:\s*bold;/s);
        expect(css).toMatch(/\.split-stack-control-row\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*gap:\s*var\(--spacing-md\);/s);
        expect(css).toMatch(/\.split-stack-range\s*\{[^}]*width:\s*100px;/s);
        expect(css).toMatch(/\.split-stack-amount-input\s*\{[^}]*width:\s*50px;[^}]*background:\s*var\(--bg-input\);[^}]*border:\s*1px solid var\(--border-default\);/s);
        expect(css).toMatch(/\.split-stack-action-row\s*\{[^}]*display:\s*flex;[^}]*gap:\s*var\(--spacing-md\);[^}]*margin-top:\s*var\(--spacing-md\);/s);
    });

    test('window chrome disables accidental selection while preserving text selection inside form fields', () => {
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(css).toContain('user-select: none;');
        expect(css).toContain('.window input,');
        expect(css).toContain('user-select: text;');
        expect(css).toContain('.close-btn');
    });

    test('generated modal chrome has shared viewport and action-row classes', () => {
        const css = readFileSync(windowsCssPath, 'utf8');

        expect(css).toMatch(/\.generated-menu-backdrop\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*1090;/s);
        expect(css).toMatch(/\.generated-menu\s*\{[^}]*width:\s*min\(92vw, 540px\);[^}]*max-height:\s*calc\(100vh - 24px\);[^}]*overflow-y:\s*auto;/s);
        expect(css).toMatch(/\.generated-menu--dungeon\s*\{[^}]*rgba\(255, 215, 0, 0\.4\)/s);
        expect(css).toMatch(/\.generated-menu--respec\s*\{[^}]*width:\s*min\(92vw, 460px\);/s);
        expect(css).toMatch(/\.generated-menu__select\s*\{[^}]*width:\s*min\(250px, 100%\);/s);
        expect(css).toMatch(/\.generated-menu__actions\s*\{[^}]*flex-wrap:\s*wrap;/s);
    });
});
