import { jest } from '@jest/globals';
import * as THREE from 'three';
import { GameEngine } from '../src/core/GameEngine.js';
import { MeshFactory } from '../src/utils/MeshFactory.js';

// Mock MeshFactory to avoid loading external assets
MeshFactory.createMeshForType = jest.fn().mockImplementation(async (type) => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = { entityId: 'mock-id' };
    return mesh;
});

MeshFactory.loadModel = jest.fn().mockResolvedValue({
    scene: new THREE.Group(),
    animations: []
});

// Mock WebSocket
global.WebSocket = class {
    constructor(url) {
        this.readyState = 1; // OPEN
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
    }
    send(data) {}
    close() {}
};
global.WebSocket.OPEN = 1;

// Mock Alert
global.alert = jest.fn();

describe('GameEngine Simulation', () => {
    let game;
    let mockSocket;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create a fresh mock socket for each test
        mockSocket = new WebSocket('ws://localhost:8080');
        
        // Setup DOM elements required by GameEngine/UIManager
        document.body.innerHTML = `
            <div id="ui-layer">
                <div id="start-screen"></div>
                <div id="loading-screen"></div>
                <div id="hud" style="display:none">
                    <div id="player-hud">
                        <div id="player-hp-bar"></div>
                        <div id="player-hp-text"></div>
                        <div id="player-mana-bar"></div>
                        <div id="player-mana-text"></div>
                        <div id="xp-bar-fill"></div>
                        <div id="xp-text"></div>
                        <div id="level-text"></div>
                        <div id="gold-display"></div>
                    </div>
                    <div id="ability-container">
                        <div id="ability-icon"></div>
                        <div id="ability-cooldown"></div>
                        <div id="ability-tooltip" style="display:none">
                            <div id="ability-name"></div>
                            <div id="ability-desc"></div>
                            <div id="ability-cost"></div>
                        </div>
                    </div>
                </div>
                <div id="inventory-screen">
                    <div id="inventory-grid"></div>
                </div>
                <div id="character-sheet">
                    <div id="stats-content">
                        <div id="stat-strength"></div>
                        <div id="stat-intelligence"></div>
                        <div id="stat-dexterity"></div>
                        <div id="stat-wisdom"></div>
                        <div id="stat-stamina"></div>
                    </div>
                    <div class="equipment-slots">
                        <div id="slot-head"></div>
                        <div id="slot-chest"></div>
                        <div id="slot-mainhand"></div>
                        <div id="slot-offhand"></div>
                        <div id="slot-legs"></div>
                        <div id="slot-feet"></div>
                    </div>
                </div>
                <div id="patch-notes-screen">
                    <button id="btn-close-patch-notes"></button>
                </div>
                <div id="help-screen">
                    <button id="btn-close-help"></button>
                </div>
                <div id="game-timer"></div>
                
                <!-- Tooltips -->
                <div id="stat-tooltip">
                    <div id="stat-tooltip-title"></div>
                    <div id="stat-tooltip-desc"></div>
                </div>
                <div id="compare-tooltip">
                    <div id="compare-tooltip-title"></div>
                    <div id="compare-tooltip-desc"></div>
                </div>

                <!-- World Map -->
                <div id="world-map">
                    <canvas id="world-map-canvas"></canvas>
                </div>

                <!-- Escape Menu Buttons -->
                <div id="esc-menu">
                    <button id="btn-resume"></button>
                    <button id="btn-help"></button>
                    <button id="btn-patch-notes"></button>
                    <button id="btn-menu"></button>
                    <button id="btn-respawn"></button>
                </div>
                
                <!-- Other UI elements -->
                <div id="shop-screen">
                    <div id="shop-grid"></div>
                    <button id="btn-close-shop"></button>
                </div>
                <div id="notification-area"></div>
                <div id="chat-box" style="display:none">
                    <div id="chat-messages"></div>
                    <input id="chat-input" type="text">
                </div>
                <div id="xp-bar-container" style="display:none"></div>
            </div>
            <canvas id="minimap-canvas"></canvas>
        `;
    });

    test('initializes and loads game', async () => {
        game = new GameEngine('Fighter', false, true, 'ws://test', 'testuser', mockSocket);
        
        // Mock onProgress callback
        const onProgress = jest.fn();
        
        // Run loadGame
        await game.loadGame(onProgress);
        
        expect(game.player).toBeDefined();
        expect(game.player.meshType).toBe('Fighter');
        expect(onProgress).toHaveBeenCalledWith(100, "Ready!");
    });

    test('runs game loop and updates entities', async () => {
        game = new GameEngine('Fighter', false, true, 'ws://test', 'testuser', mockSocket);
        await game.loadGame();

        // Simulate 1 second of gameplay
        const dt = 1 / 60;
        for (let i = 0; i < 60; i++) {
            game.update(dt);
        }

        expect(game.gameTime).toBeGreaterThan(0);
    });

    test('spawns enemy via server message', async () => {
        game = new GameEngine('Fighter', false, true, 'ws://test', 'testuser', mockSocket);
        await game.loadGame();

        // Simulate server state message spawning an enemy
        const enemyId = 'enemy-123';
        const stateMsg = {
            type: 'state',
            payload: {
                [enemyId]: {
                    id: enemyId,
                    type: 'Enemy',
                    subType: 'Skeleton',
                    x: 10,
                    y: 0,
                    z: 10,
                    state: 'IDLE',
                    health: 100,
                    maxHealth: 100
                }
            }
        };

        game.handleServerMessage(stateMsg);
        
        // Process creation queue
        game.update(0.016);

        const enemy = game.remotePlayers.get(enemyId);
        expect(enemy).toBeDefined();
        expect(enemy.constructor.name).toBe('Skeleton');
        expect(enemy.position.x).toBe(10);
    });

    test('player sends attack message', async () => {
        game = new GameEngine('Fighter', false, true, 'ws://test', 'testuser', mockSocket);
        await game.loadGame();

        // Mock socket send
        const sendSpy = jest.spyOn(game.socket, 'send');

        // Spawn an enemy
        const enemyId = 'enemy-target';
        const stateMsg = {
            type: 'state',
            payload: {
                [enemyId]: {
                    id: enemyId,
                    type: 'Enemy',
                    subType: 'Skeleton',
                    x: 2, // Close enough to attack
                    y: 0,
                    z: 2,
                    state: 'IDLE',
                    health: 100,
                    maxHealth: 100
                }
            }
        };
        game.handleServerMessage(stateMsg);
        game.update(0.016);
        
        const enemy = game.remotePlayers.get(enemyId);
        expect(enemy).toBeDefined();

        // Set hovered entity to simulate mouse over
        game.hoveredEntity = enemy;
        
        // Simulate click (which triggers attack if close enough)
        game.inputManager.isMouseDown = true;
        game.inputManager.keys = { alt: false }; // Ensure no modifier that might change behavior
        
        // Force update to trigger attack logic
        game.update(0.016);

        // Check if attack message was sent
        expect(sendSpy).toHaveBeenCalled();
        const calls = sendSpy.mock.calls;
        const attackCall = calls.find(call => call[0].includes('"type":"attack"'));
        expect(attackCall).toBeDefined();
        expect(attackCall[0]).toContain(enemyId);
    });
});
