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

function createEngineHarness() {
    const engine = Object.create(GameEngine.prototype);
    engine.frameCount = 1;
    engine.lastRenderHudSignature = '';
    engine.lastRenderXpSignature = '';
    engine.lastRenderHotbarCooldownSignature = '';
    engine.hoveredEntity = null;
    engine.playerJumpState = null;
    engine.playerJumpVisualHeight = 0;
    engine.activeEntitiesCache = [];
    engine.applyPlayerJumpVisuals = jest.fn();
    engine.applyEntityJumpVisuals = jest.fn();
    engine.chunkManager = {
        getActiveEntities: jest.fn(() => [engine.player])
    };
    engine.renderSystem = {
        camera: {},
        render: jest.fn()
    };
    engine.uiManager = {
        updatePlayerStats: jest.fn(),
        updateXP: jest.fn(),
        updateHotbarCooldowns: jest.fn(),
        updateEnemyBars: jest.fn(),
        updateCharacterSheet: jest.fn(),
        isCharacterSheetOpen: false
    };
    engine.inputManager = { keys: { alt: false } };
    engine.minimap = { update: jest.fn() };
    engine.worldMap = { update: jest.fn(), isVisible: jest.fn(() => false) };
    engine.player = {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Quaternion(),
        stats: { hp: 100, maxHp: 100, mana: 50, maxMana: 50 },
        xp: 10,
        xpToNextLevel: 100,
        level: 2,
        abilityName: 'Slash',
        abilityCooldown: 0,
        hotbar: ['Slash', null, null, null],
        cooldowns: {},
        render: jest.fn()
    };
    return engine;
}

describe('GameEngine render-time HUD throttling', () => {
    test('render does not spam stable stats/xp/world map updates every frame', () => {
        const engine = createEngineHarness();

        engine.render(1);
        engine.render(1);

        expect(engine.uiManager.updatePlayerStats).toHaveBeenCalledTimes(1);
        expect(engine.uiManager.updateXP).toHaveBeenCalledTimes(1);
        expect(engine.worldMap.update).not.toHaveBeenCalled();
        expect(engine.uiManager.updateHotbarCooldowns).toHaveBeenCalledTimes(1);
        expect(engine.uiManager.updateEnemyBars).toHaveBeenCalledTimes(2);
    });

    test('render refreshes stats and xp when values change', () => {
        const engine = createEngineHarness();

        engine.render(1);
        engine.player.stats.hp = 80;
        engine.player.xp = 25;
        engine.render(1);

        expect(engine.uiManager.updatePlayerStats).toHaveBeenCalledTimes(2);
        expect(engine.uiManager.updateXP).toHaveBeenCalledTimes(2);
    });

    test('render only updates world map while it is visible', () => {
        const engine = createEngineHarness();
        engine.worldMap.isVisible.mockReturnValue(true);

        engine.render(1);
        engine.render(1);

        expect(engine.worldMap.update).toHaveBeenCalledTimes(2);
    });

    test('render throttles hotbar cooldown updates when displayed values are unchanged', () => {
        const engine = createEngineHarness();
        engine.player.cooldowns = { Slash: 3.2 };

        engine.render(1);
        engine.render(1);

        expect(engine.uiManager.updateHotbarCooldowns).toHaveBeenCalledTimes(1);

        engine.player.cooldowns.Slash = 2.1;
        engine.render(1);

        expect(engine.uiManager.updateHotbarCooldowns).toHaveBeenCalledTimes(2);
    });
});
