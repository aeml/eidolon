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
        <div id="conn-indicator"></div>
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
        <input id="camera-shake-enabled" type="checkbox" />
        <input id="fullscreen-enabled" type="checkbox" />
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

function createPlayer(overrides = {}) {
    return {
        stats: {
            hp: 100,
            maxHp: 100,
            mana: 50,
            maxMana: 100,
            manaCostReduction: 0,
            ...(overrides.stats || {})
        },
        abilityName: 'Slash',
        abilityDescription: 'A clean strike.',
        abilityCooldown: 0,
        abilityManaCost: 10,
        subType: 'Fighter',
        ...overrides
    };
}

describe('UIManager HUD diffing', () => {
    test('resetDisplaySignatures clears all UI-level diff caches', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.lastCombatIntentSignature = 'combat';
        ui.lastDungeonEntranceHintSignature = 'dungeon-hint';
        ui.lastPlayerStatsSignature = 'stats';
        ui.lastXpSignature = 'xp';
        ui.lastHotbarCooldownSignature = 'hotbar';
        ui.lastCharacterSheetSignature = 'character';

        ui.resetDisplaySignatures();

        expect(ui.lastCombatIntentSignature).toBe('');
        expect(ui.lastDungeonEntranceHintSignature).toBe('');
        expect(ui.lastPlayerStatsSignature).toBe('');
        expect(ui.lastXpSignature).toBe('');
        expect(ui.lastHotbarCooldownSignature).toBe('');
        expect(ui.lastCharacterSheetSignature).toBe('');
    });

    test('updatePlayerStats skips identical HUD payloads and refreshes when displayed values change', () => {
        buildDom();
        const ui = new UIManager(false);
        const updateAbilityIcon = jest.spyOn(ui, 'updateAbilityIcon');
        const player = createPlayer();

        ui.updatePlayerStats(player);
        ui.updatePlayerStats(player);

        expect(updateAbilityIcon).toHaveBeenCalledTimes(1);
        expect(document.getElementById('player-hp-text').textContent).toBe('100 / 100');

        player.stats.hp = 80;
        ui.updatePlayerStats(player);

        expect(updateAbilityIcon).toHaveBeenCalledTimes(2);
        expect(document.getElementById('player-hp-text').textContent).toBe('80 / 100');
    });

    test('updateXP skips identical XP payloads and refreshes when displayed XP changes', () => {
        buildDom();
        const ui = new UIManager(false);
        const player = createPlayer({
            level: 4,
            xp: 25,
            xpToNextLevel: 100
        });
        const xpBar = document.getElementById('xp-bar-fill');

        ui.updateXP(player);
        expect(xpBar.style.width).toBe('25%');
        expect(document.getElementById('xp-text').textContent).toBe('LVL 4');

        xpBar.style.width = '77%';
        ui.updateXP(player);
        expect(xpBar.style.width).toBe('77%');

        player.xp = 50;
        ui.updateXP(player);
        expect(xpBar.style.width).toBe('50%');
    });

    test('serializeXP uses the displayed level and XP payload', () => {
        buildDom();
        const ui = new UIManager(false);
        const player = createPlayer({
            level: 4,
            xp: 25,
            xpToNextLevel: 100
        });

        expect(ui.serializeXP(player)).toBe('4|25|100|0|0|0');
    });

    test('updateHotbarCooldowns skips identical displayed cooldowns and refreshes when they change', () => {
        buildDom();
        const ui = new UIManager(false);
        const slot = document.querySelector('.hotbar-slot');
        const overlay = document.createElement('div');
        overlay.className = 'cooldown-overlay';
        slot.appendChild(overlay);
        const player = createPlayer({
            hotbar: ['Slash'],
            cooldowns: { Slash: 3.2 }
        });

        ui.updateHotbarCooldowns(player);
        expect(overlay.style.display).toBe('flex');
        expect(overlay.textContent).toBe('4');

        overlay.textContent = 'stale';
        ui.updateHotbarCooldowns(player);
        expect(overlay.textContent).toBe('stale');

        player.cooldowns.Slash = 2.1;
        ui.updateHotbarCooldowns(player);
        expect(overlay.textContent).toBe('3');
    });

    test('assignSkillToSlot invalidates hotbar cooldown diffing when overlay DOM is recreated', () => {
        buildDom();
        const slot = document.querySelector('.hotbar-slot');
        const icon = document.createElement('div');
        icon.className = 'hotbar-icon';
        slot.appendChild(icon);
        const overlay = document.createElement('div');
        overlay.className = 'cooldown-overlay';
        slot.appendChild(overlay);
        const ui = new UIManager(false);
        const player = createPlayer({
            hotbar: ['Slash'],
            cooldowns: { Slash: 3.2 }
        });

        ui.updateHotbarCooldowns(player);
        expect(overlay.textContent).toBe('4');

        overlay.remove();
        ui.assignSkillToSlot(0, 'Slash');
        const recreatedOverlay = slot.querySelector('.cooldown-overlay');
        expect(recreatedOverlay.style.display).toBe('none');

        ui.updateHotbarCooldowns(player);
        expect(recreatedOverlay.style.display).toBe('flex');
        expect(recreatedOverlay.textContent).toBe('4');
    });

    test('updateCharacterSheet skips identical visible character payloads and refreshes when stats change', () => {
        buildDom();
        const ui = new UIManager(false);
        const updateEquipSlot = jest.spyOn(ui.inventory, 'updateEquipSlot');
        const player = createPlayer({
            level: 7,
            xp: 35,
            xpToNextLevel: 100,
            statPoints: 2,
            stats: {
                hp: 95,
                maxHp: 120,
                mana: 40,
                maxMana: 80,
                strength: 12,
                dexterity: 9,
                intelligence: 8,
                vitality: 11,
                wisdom: 7,
                damage: 14,
                defense: 6
            },
            baseStats: {
                strength: 10,
                dexterity: 9,
                intelligence: 8,
                vitality: 10,
                wisdom: 7
            },
            equipment: {
                head: { id: 'helm-1', name: 'Iron Helm', type: 'HEAD', rarity: 'COMMON', potency: 1 }
            }
        });

        ui.updateCharacterSheet(player);
        expect(updateEquipSlot).toHaveBeenCalledTimes(14);
        expect(document.getElementById('stats-content').textContent).toContain('14');

        document.getElementById('stats-content').textContent = 'stale';
        ui.updateCharacterSheet(player);
        expect(updateEquipSlot).toHaveBeenCalledTimes(14);
        expect(document.getElementById('stats-content').textContent).toBe('stale');

        player.stats.damage = 18;
        ui.updateCharacterSheet(player);
        expect(updateEquipSlot).toHaveBeenCalledTimes(28);
        expect(document.getElementById('stats-content').textContent).toContain('18');
    });

    test('reflows managed windows when rendered contents resize and replaces the old observer safely', () => {
        const original = globalThis.ResizeObserver;
        globalThis.ResizeObserver = class {
            constructor(callback) { this.callback = callback; }
            observe = jest.fn();
            disconnect = jest.fn();
        };
        try {
            buildDom();
            const ui = new UIManager(false);
            const observer = ui.windowLayoutObserver;
            const reflow = jest.spyOn(ui, 'reflowVisibleWindows');
            observer.callback();
            expect(reflow).toHaveBeenCalledTimes(1);
            expect(observer.observe).toHaveBeenCalledWith(ui.characterSheet);
            ui.registerWindowLayouts();
            expect(observer.disconnect).toHaveBeenCalledTimes(1);
            expect(ui.windowLayoutObserver).not.toBe(observer);
            ui.windowLayoutObserver.disconnect();
        } finally {
            if (original === undefined) delete globalThis.ResizeObserver;
            else globalThis.ResizeObserver = original;
        }
    });

    test('character diff includes resonance spending and equipment appearance changes', () => {
        buildDom();
        const ui = new UIManager(false);
        const player = createPlayer({ level: 100, resonancePoints: 1, resonanceRanks: { power: 0 }, equipment: { head: { id: 'same-helm', name: 'Iron Helm', level: 1 } } });
        const initial = ui.serializeCharacterSheet(player);
        player.resonanceRanks.power = 1;
        player.resonancePoints = 0;
        expect(ui.serializeCharacterSheet(player)).not.toBe(initial);
        const spent = ui.serializeCharacterSheet(player);
        player.equipment.head.level = 50;
        expect(ui.serializeCharacterSheet(player)).not.toBe(spent);
    });

    test('toggleCharacterSheet refreshes visible contents each time the panel opens', () => {
        buildDom();
        const ui = new UIManager(false);
        const updateEquipSlot = jest.spyOn(ui.inventory, 'updateEquipSlot');
        const player = createPlayer({
            level: 7,
            xp: 35,
            xpToNextLevel: 100,
            statPoints: 2,
            stats: {
                hp: 95,
                maxHp: 120,
                mana: 40,
                maxMana: 80,
                strength: 12,
                dexterity: 9,
                intelligence: 8,
                vitality: 11,
                wisdom: 7,
                damage: 14,
                defense: 6
            },
            baseStats: {
                strength: 10,
                dexterity: 9,
                intelligence: 8,
                vitality: 10,
                wisdom: 7
            },
            equipment: {
                head: { id: 'helm-1', name: 'Iron Helm', type: 'HEAD', rarity: 'COMMON', potency: 1 }
            }
        });
        ui.lastPlayerRef = player;

        ui.toggleCharacterSheet();
        expect(updateEquipSlot).toHaveBeenCalledTimes(14);

        ui.toggleCharacterSheet();
        document.getElementById('stats-content').textContent = 'stale';
        ui.toggleCharacterSheet();

        expect(updateEquipSlot).toHaveBeenCalledTimes(28);
        expect(document.getElementById('stats-content').textContent).toContain('14');
    });
});

// ---------------------------------------------------------------------------
// setConnectionState — connection-state HUD indicator
// ---------------------------------------------------------------------------

describe('UIManager — setConnectionState', () => {
    function buildMinimalDom() {
        // Minimal DOM: only the elements UIManager strictly requires + conn-indicator.
        document.body.innerHTML = `
            <div id="player-hud"></div>
            <div id="player-hp-bar"></div>
            <div id="player-hp-text"></div>
            <div id="player-mana-bar"></div>
            <div id="player-mana-text"></div>
            <div id="ui-layer"></div>
            <div id="game-timer"></div>
            <div id="conn-indicator"></div>
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
            <input id="camera-shake-enabled" type="checkbox" />
            <input id="fullscreen-enabled" type="checkbox" />
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

    test('setConnectionState reconnecting — adds reconnecting class and sets text', () => {
        buildMinimalDom();
        const ui = new UIManager(false);
        ui.setConnectionState('reconnecting');
        const el = document.getElementById('conn-indicator');
        expect(el.classList.contains('conn-indicator--reconnecting')).toBe(true);
        expect(el.classList.contains('conn-indicator--lost')).toBe(false);
        expect(el.textContent).toMatch(/reconnect/i);
    });

    test('setConnectionState lost — adds lost class and sets text', () => {
        buildMinimalDom();
        const ui = new UIManager(false);
        ui.setConnectionState('lost');
        const el = document.getElementById('conn-indicator');
        expect(el.classList.contains('conn-indicator--lost')).toBe(true);
        expect(el.classList.contains('conn-indicator--reconnecting')).toBe(false);
        expect(el.textContent).toMatch(/connection lost/i);
    });

    test('setConnectionState connected — hides indicator and clears classes', () => {
        buildMinimalDom();
        const ui = new UIManager(false);
        ui.setConnectionState('reconnecting');
        ui.setConnectionState('connected');
        const el = document.getElementById('conn-indicator');
        expect(el.classList.contains('conn-indicator--reconnecting')).toBe(false);
        expect(el.classList.contains('conn-indicator--lost')).toBe(false);
        expect(el.style.display).toBe('none');
        expect(el.textContent).toBe('');
    });

    test('setConnectionState cycles reconnecting → connected → lost correctly', () => {
        buildMinimalDom();
        const ui = new UIManager(false);

        ui.setConnectionState('reconnecting');
        expect(document.getElementById('conn-indicator').classList.contains('conn-indicator--reconnecting')).toBe(true);

        ui.setConnectionState('connected');
        expect(document.getElementById('conn-indicator').style.display).toBe('none');

        ui.setConnectionState('lost');
        expect(document.getElementById('conn-indicator').classList.contains('conn-indicator--lost')).toBe(true);
    });

    test('setConnectionState is a no-op when conn-indicator element is absent', () => {
        buildMinimalDom();
        document.getElementById('conn-indicator').remove();
        const ui = new UIManager(false);
        // Should not throw
        expect(() => ui.setConnectionState('reconnecting')).not.toThrow();
        expect(() => ui.setConnectionState('lost')).not.toThrow();
        expect(() => ui.setConnectionState('connected')).not.toThrow();
    });
});
