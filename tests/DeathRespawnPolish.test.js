import { jest } from '@jest/globals';
import * as THREE from 'three';
import { UIManager } from '../src/ui/UIManager.js';

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
        <div id="xp-bar-container"></div>
    `;
}

describe('Death and respawn polish', () => {
    test('UIManager death screen includes recovery guidance text', () => {
        buildDom();
        const ui = new UIManager(false);
        ui.showDeathScreen({
            title: 'You Died',
            hint: 'Respawn in town, recover at the Stash, then hit Vendor / Repair or Forge before heading back out.'
        });

        const deathScreen = document.getElementById('death-screen');
        expect(deathScreen.style.display).toBe('flex');
        expect(deathScreen.textContent).toContain('Respawn in town, recover at the Stash, then hit Vendor / Repair or Forge before heading back out.');
        expect(deathScreen.textContent).toContain('Stash');
        expect(deathScreen.textContent).toContain('Vendor / Repair');
        expect(deathScreen.textContent).toContain('Forge');
        expect(deathScreen.textContent).toContain('Respawn in Town');
    });

    test('GameEngine syncDeathScreen forwards richer death guidance to the UI', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            state: 'DEAD',
            timeSinceDeath: 4.2,
            position: new THREE.Vector3(0, 0, 0)
        };
        engine.uiManager = {
            showDeathScreen: jest.fn(),
            hideDeathScreen: jest.fn()
        };
        engine.isPlayerDead = GameEngine.prototype.isPlayerDead;
        engine.getDeathScreenDetails = GameEngine.prototype.getDeathScreenDetails;
        engine.syncDeathScreen = GameEngine.prototype.syncDeathScreen;

        engine.syncDeathScreen();

        expect(engine.uiManager.showDeathScreen).toHaveBeenCalledWith(expect.objectContaining({
            title: 'You Died',
            hint: 'Respawn in town, recover at the Stash, then hit Vendor / Repair or Forge before heading back out.',
            elapsedSeconds: 4.2
        }));
    });

    test('GameEngine announces recovery guidance when a respawn is detected from delta updates', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            id: 'player-1',
            state: 'DEAD',
            quests: [
                {
                    id: 'q1',
                    accepted: true,
                    completed: false,
                    count: 0,
                    maxCount: 1,
                    target: 'DungeonBoss'
                }
            ],
            stats: { hp: 0, maxHp: 100, mana: 0, maxMana: 100 },
            position: new THREE.Vector3(50, 0, 50),
            targetPosition: new THREE.Vector3(5, 0, 5),
            respawn: jest.fn(function respawn(x, z) {
                this.position.set(x, 0, z);
                this.state = 'IDLE';
                this.targetPosition = null;
                this.stats.hp = this.stats.maxHp;
            })
        };
        engine.chunkManager = {
            updateEntityChunk: jest.fn(),
            update: jest.fn()
        };
        engine.collisionManager = {};
        engine.renderSystem = {
            setCameraTarget: jest.fn()
        };
        engine.uiManager = {
            addChatMessage: jest.fn(),
            showDeathScreen: jest.fn(),
            hideDeathScreen: jest.fn(),
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
            skillTree: { isOpen: false, skillTreeMode: 'skills', renderSkillTree: jest.fn() },
            forge: { isOpen: false, forgeScreen: { style: { display: 'none' } } },
            trading: { isOpen: false },
            inventory: { inventoryScreen: { style: { display: 'none' } }, shopScreen: { style: { display: 'none' } }, stashScreen: { style: { display: 'none' } } }
        };
        engine.remotePlayers = new Map();
        engine.recentlyPickedUpLoot = new Set();
        engine.pendingEntityIds = new Set();
        engine.entityCreationQueue = [];
        engine.frameCount = 1;
        engine.effects = [];
        engine.username = 'tester';
        engine.playerType = 'Fighter';
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.hydrateItem = jest.fn((item) => item);
        engine.syncDeathScreen = jest.fn();
        engine.handlePlayerDeathTransition = jest.fn();
        engine.clearAuthoritativeJumpState = jest.fn();
        engine.syncAuthoritativeJumpState = jest.fn();
        engine.announceRespawnRecovery = GameEngine.prototype.announceRespawnRecovery;
        engine.getOnboardingRecoveryContext = GameEngine.prototype.getOnboardingRecoveryContext;
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

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

        expect(engine.uiManager.addChatMessage).toHaveBeenCalledWith('System', expect.stringContaining('Recovered in town'));
        expect(engine.uiManager.addChatMessage).toHaveBeenCalledWith('System', expect.stringContaining('Vendor / Repair'));
        expect(engine.uiManager.addChatMessage).toHaveBeenCalledWith('System', expect.stringContaining('Forge'));
        expect(engine.uiManager.updateJournal).toHaveBeenCalledWith(engine.player.quests);
        expect(engine.getOnboardingRecoveryContext()).toEqual(expect.objectContaining({ reason: 'respawn' }));
    });

    test('GameEngine marks recall recovery context and refreshes onboarding guidance on town return', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.player = {
            quests: [
                {
                    id: 'q1',
                    accepted: true,
                    completed: false,
                    count: 0,
                    maxCount: 1,
                    target: 'DungeonBoss'
                }
            ],
            position: new THREE.Vector3(0, 0, 200)
        };
        engine.uiManager = {
            updateJournal: jest.fn()
        };
        engine.currentInstanceType = 'overworld';
        engine.onboardingRecoveryContext = null;
        engine.syncTownRecoveryGuidance(320, 40, 0, 200, 'recall');

        expect(engine.uiManager.updateJournal).toHaveBeenCalledWith(engine.player.quests);
        expect(engine.getOnboardingRecoveryContext()).toEqual(expect.objectContaining({ reason: 'recall' }));
    });
});
