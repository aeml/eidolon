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

const { UIManager } = await import('../src/ui/UIManager.js');
const { GameEngine } = await import('../src/core/GameEngine.js');

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
        <div id="dungeon-entrance-hint" style="display:none">
            <div id="dungeon-entrance-hint-name"></div>
            <div id="dungeon-entrance-hint-status"></div>
            <div id="dungeon-entrance-hint-prompt"></div>
        </div>
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

function createEntrance(overrides = {}) {
    return {
        name: 'DungeonEntrance',
        position: new THREE.Vector3(0, 0, 0),
        isActive: true,
        userData: {
            dungeonType: 'tempest_spire',
            interactionRadius: 40,
            ...overrides.userData
        },
        ...overrides
    };
}

function createTownInteractable(overrides = {}) {
    return {
        constructor: { name: 'QuestNPC' },
        position: new THREE.Vector3(0, 0, 0),
        isActive: true,
        ...overrides
    };
}

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.player = {
        position: new THREE.Vector3(0, 0, 0)
    };
    engine.hoveredEntity = null;
    engine.pendingInteraction = null;
    engine.currentInstanceId = 'overworld';
    engine.uiManager = {
        updateDungeonEntranceHint: jest.fn(),
        clearDungeonEntranceHint: jest.fn(),
        clearCombatIntent: jest.fn()
    };
    engine.abilityController = {
        getAbilityCastRange: jest.fn(() => 4),
        pendingAbilityTarget: null,
        pendingAbilitySkill: null
    };
    engine.getInteractionRangeForEntity = GameEngine.prototype.getInteractionRangeForEntity;
    engine.isHostileActorTarget = jest.fn(() => false);
    engine.isInteractableEntity = GameEngine.prototype.isInteractableEntity;
    engine.getDungeonEntranceName = GameEngine.prototype.getDungeonEntranceName;
    engine.getInteractableEntityLabel = GameEngine.prototype.getInteractableEntityLabel;
    engine.buildDungeonEntranceHint = GameEngine.prototype.buildDungeonEntranceHint;
    engine.refreshDungeonEntranceHint = GameEngine.prototype.refreshDungeonEntranceHint;
    engine.clearCombatIntentState = GameEngine.prototype.clearCombatIntentState;
    return engine;
}

describe('Dungeon entrance hints', () => {
    test('UIManager renders and clears dungeon entrance hint content', () => {
        buildDom();
        const ui = new UIManager(false);

        ui.updateDungeonEntranceHint({
            dungeonName: 'Tempest Spire',
            statusLabel: 'Dungeon Portal • In range',
            promptLabel: 'Click to open the dungeon portal.'
        });

        expect(document.getElementById('dungeon-entrance-hint').style.display).toBe('block');
        expect(document.getElementById('dungeon-entrance-hint-name').textContent).toBe('Tempest Spire');
        expect(document.getElementById('dungeon-entrance-hint-status').textContent).toContain('In range');
        expect(document.getElementById('dungeon-entrance-hint-prompt').textContent).toContain('Click to open');

        ui.clearDungeonEntranceHint();

        expect(document.getElementById('dungeon-entrance-hint').style.display).toBe('none');
        expect(document.getElementById('dungeon-entrance-hint-name').textContent).toBe('');
    });

    test('GameEngine builds move-closer hint for hovered dungeon entrance out of range', () => {
        const engine = createEngineHarness();
        engine.player.position = new THREE.Vector3(0, 0, 0);
        engine.hoveredEntity = createEntrance({ position: new THREE.Vector3(80, 0, 0) });

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.updateDungeonEntranceHint).toHaveBeenCalledWith(expect.objectContaining({
            dungeonName: 'Tempest Spire',
            inRange: false,
            statusLabel: expect.stringContaining('Move closer'),
            promptLabel: expect.stringContaining('Move closer')
        }));
    });

    test('GameEngine builds interact hint for hovered dungeon entrance in range', () => {
        const engine = createEngineHarness();
        engine.player.position = new THREE.Vector3(0, 0, 0);
        engine.hoveredEntity = createEntrance({ position: new THREE.Vector3(20, 0, 0) });

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.updateDungeonEntranceHint).toHaveBeenCalledWith(expect.objectContaining({
            dungeonName: 'Tempest Spire',
            inRange: true,
            statusLabel: expect.stringContaining('In range'),
            promptLabel: expect.stringContaining('Click to open')
        }));
    });

    test('GameEngine clears hint when hover is removed', () => {
        const engine = createEngineHarness();
        engine.hoveredEntity = null;

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.clearDungeonEntranceHint).toHaveBeenCalled();
    });

    test('GameEngine ignores non-entrance hovered entities', () => {
        const engine = createEngineHarness();
        engine.hoveredEntity = {
            name: 'Skeleton Archer',
            position: new THREE.Vector3(4, 0, 0),
            isActive: true
        };

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.updateDungeonEntranceHint).not.toHaveBeenCalled();
        expect(engine.uiManager.clearDungeonEntranceHint).toHaveBeenCalled();
    });

    test('GameEngine builds onboarding talk hint for hovered quest giver in range', () => {
        const engine = createEngineHarness();
        engine.player.position = new THREE.Vector3(0, 0, 0);
        engine.hoveredEntity = createTownInteractable({
            constructor: { name: 'QuestNPC' },
            position: new THREE.Vector3(3, 0, 0)
        });

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.updateDungeonEntranceHint).toHaveBeenCalledWith(expect.objectContaining({
            dungeonName: 'Quest Giver',
            inRange: true,
            statusLabel: expect.stringContaining('In range'),
            promptLabel: expect.stringContaining('pick up your first quest')
        }));
    });

    test('GameEngine builds named interact hint for hovered forge in range', () => {
        const engine = createEngineHarness();
        engine.player.position = new THREE.Vector3(0, 0, 0);
        engine.hoveredEntity = createTownInteractable({
            constructor: { name: 'Forge' },
            position: new THREE.Vector3(3, 0, 0)
        });

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.updateDungeonEntranceHint).toHaveBeenCalledWith(expect.objectContaining({
            dungeonName: 'Forge',
            inRange: true,
            statusLabel: expect.stringContaining('In range'),
            promptLabel: expect.stringContaining('upgrade or socket gear')
        }));
    });

    test('GameEngine builds trading-house hint for hovered auction house out of range', () => {
        const engine = createEngineHarness();
        engine.player.position = new THREE.Vector3(0, 0, 0);
        engine.hoveredEntity = createTownInteractable({
            constructor: { name: 'TradingHouse' },
            position: new THREE.Vector3(12, 0, 0)
        });

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.updateDungeonEntranceHint).toHaveBeenCalledWith(expect.objectContaining({
            dungeonName: 'Trading House',
            inRange: false,
            statusLabel: expect.stringContaining('Move closer'),
            promptLabel: expect.stringContaining('buy or sell items with other players')
        }));
    });

    test('GameEngine builds first-dungeon hint for hovered dungeon guide in range', () => {
        const engine = createEngineHarness();
        engine.player.position = new THREE.Vector3(0, 0, 0);
        engine.hoveredEntity = createTownInteractable({
            constructor: { name: 'DungeonNPC' },
            position: new THREE.Vector3(3, 0, 0)
        });

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.updateDungeonEntranceHint).toHaveBeenCalledWith(expect.objectContaining({
            dungeonName: 'Dungeon Guide',
            inRange: true,
            statusLabel: expect.stringContaining('In range'),
            promptLabel: expect.stringContaining('start your first dungeon run')
        }));
    });

    test('GameEngine builds vendor hint for hovered merchant out of range', () => {
        const engine = createEngineHarness();
        engine.player.position = new THREE.Vector3(0, 0, 0);
        engine.hoveredEntity = createTownInteractable({
            constructor: { name: 'DwarfSalesman' },
            position: new THREE.Vector3(12, 0, 0)
        });

        engine.refreshDungeonEntranceHint();

        expect(engine.uiManager.updateDungeonEntranceHint).toHaveBeenCalledWith(expect.objectContaining({
            dungeonName: 'Vendor / Repair',
            inRange: false,
            statusLabel: expect.stringContaining('Move closer'),
            promptLabel: expect.stringContaining('gamble or sell unwanted gear')
        }));
    });

    test('GameEngine maps town interactables to the same labels used by map guidance', () => {
        const engine = createEngineHarness();

        expect(engine.getInteractableEntityLabel(createTownInteractable({ constructor: { name: 'QuestNPC' } }))).toBe('Quest Giver');
        expect(engine.getInteractableEntityLabel(createTownInteractable({ constructor: { name: 'Stash' } }))).toBe('Stash');
        expect(engine.getInteractableEntityLabel(createTownInteractable({ constructor: { name: 'Forge' } }))).toBe('Forge');
        expect(engine.getInteractableEntityLabel(createTownInteractable({ constructor: { name: 'TradingHouse' } }))).toBe('Trading House');
        expect(engine.getInteractableEntityLabel(createTownInteractable({ constructor: { name: 'DwarfSalesman' } }))).toBe('Vendor / Repair');
        expect(engine.getInteractableEntityLabel(createTownInteractable({ constructor: { name: 'DungeonNPC' } }))).toBe('Dungeon Guide');
    });
});
