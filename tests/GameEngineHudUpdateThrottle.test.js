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
    engine.lastRenderEnemyBarSignature = '';
    engine.lastRenderCharacterSheetSignature = '';
    engine.lastRenderWorldMapSignature = '';
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
        isCharacterSheetOpen: false,
        floatingBars: new Map()
    };
    engine.inputManager = { keys: { alt: false } };
    engine.minimap = { update: jest.fn() };
    engine.worldMap = { update: jest.fn(), isVisible: jest.fn(() => false) };
    engine.player = {
        id: 'player-local',
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
        expect(engine.uiManager.updateEnemyBars).toHaveBeenCalledTimes(1);
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

    test('render uses the UIManager player stats serializer when available', () => {
        const engine = createEngineHarness();
        engine.uiManager.serializePlayerStats = jest.fn(() => 'ui-stats-1');

        engine.render(1);
        engine.render(1);

        expect(engine.uiManager.serializePlayerStats).toHaveBeenCalledWith(engine.player);
        expect(engine.uiManager.updatePlayerStats).toHaveBeenCalledTimes(1);

        engine.uiManager.serializePlayerStats.mockReturnValue('ui-stats-2');
        engine.render(1);

        expect(engine.uiManager.updatePlayerStats).toHaveBeenCalledTimes(2);
    });

    test('render only updates world map while it is visible', () => {
        const engine = createEngineHarness();
        engine.worldMap.isVisible.mockReturnValue(true);

        engine.render(1);
        engine.render(1);

        expect(engine.worldMap.update).toHaveBeenCalledTimes(1);

        engine.player.position.x = 75;
        engine.render(1);

        expect(engine.worldMap.update).toHaveBeenCalledTimes(2);
    });

    test('render refreshes visible world map when dungeon beat state changes without movement', () => {
        const engine = createEngineHarness();
        engine.worldMap.isVisible.mockReturnValue(true);
        engine.currentInstanceId = 'tempest-instance';
        engine.currentInstanceType = 'tempest_spire';
        engine.currentDungeonRoomState = {
            currentRoomIndex: 0,
            objectiveRoomIndex: 1,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: false },
                { index: 2, type: 'elite', hook: 'elite_ambush', explored: false, cleared: false },
                { index: 3, type: 'boss', explored: false, cleared: false }
            ]
        };

        engine.render(1);
        engine.render(1);

        expect(engine.worldMap.update).toHaveBeenCalledTimes(1);

        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 2,
            rooms: [
                { index: 0, type: 'start', explored: true, cleared: true },
                { index: 1, type: 'normal', hook: 'chest', explored: true, cleared: true },
                { index: 2, type: 'elite', hook: 'elite_ambush', explored: true, cleared: false },
                { index: 3, type: 'boss', explored: false, cleared: false }
            ]
        };
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

    test('render uses the UIManager hotbar cooldown serializer when available', () => {
        const engine = createEngineHarness();
        engine.uiManager.serializeHotbarCooldowns = jest.fn(() => 'ui-hotbar-1');

        engine.render(1);
        engine.render(1);

        expect(engine.uiManager.serializeHotbarCooldowns).toHaveBeenCalledWith(engine.player);
        expect(engine.uiManager.updateHotbarCooldowns).toHaveBeenCalledTimes(1);

        engine.uiManager.serializeHotbarCooldowns.mockReturnValue('ui-hotbar-2');
        engine.render(1);

        expect(engine.uiManager.updateHotbarCooldowns).toHaveBeenCalledTimes(2);
    });

    test('render does not spam enemy bar updates when hover, alt state, and tracked enemies are unchanged', () => {
        const engine = createEngineHarness();
        const enemy = {
            id: 'enemy-1',
            stats: { hp: 100, maxHp: 100 },
            position: new THREE.Vector3(5, 0, 0),
            mesh: {},
            render: jest.fn()
        };
        engine.activeEntitiesCache = [enemy];
        engine.chunkManager.getActiveEntities.mockReturnValue([engine.player, enemy]);
        engine.hoveredEntity = enemy;
        engine.uiManager.floatingBars.set(enemy.id, { style: { display: 'block' } });

        engine.render(1);
        engine.render(1);

        expect(engine.uiManager.updateEnemyBars).toHaveBeenCalledTimes(1);

        engine.inputManager.keys.alt = true;
        engine.render(1);

        expect(engine.uiManager.updateEnemyBars).toHaveBeenCalledTimes(2);
    });

    test('render does not spam open character sheet updates when tracked sheet data is unchanged', () => {
        const engine = createEngineHarness();
        engine.frameCount = 10;
        engine.uiManager.isCharacterSheetOpen = true;
        engine.player.stats = {
            ...engine.player.stats,
            strength: 12,
            dexterity: 9,
            intelligence: 7,
            vitality: 11,
            wisdom: 6,
            damage: 18,
            defense: 9
        };
        engine.player.baseStats = {
            strength: 10,
            dexterity: 8,
            intelligence: 7,
            vitality: 10,
            wisdom: 6
        };
        engine.player.equipment = {
            head: null,
            shoulders: null,
            chest: null,
            belt: null,
            legs: null,
            feet: null,
            gloves: null,
            neck: null,
            mainHand: null,
            offHand: null,
            ring1: null,
            ring2: null,
            trinket1: null,
            trinket2: null
        };
        engine.player.statPoints = 0;
        engine.player.isMultiplayer = false;

        engine.render(1);
        engine.render(1);

        expect(engine.uiManager.updateCharacterSheet).toHaveBeenCalledTimes(1);

        engine.player.stats.damage = 21;
        engine.render(1);

        expect(engine.uiManager.updateCharacterSheet).toHaveBeenCalledTimes(2);
    });

    test('render uses the UIManager character sheet serializer when available', () => {
        const engine = createEngineHarness();
        engine.frameCount = 10;
        engine.uiManager.isCharacterSheetOpen = true;
        engine.uiManager.serializeCharacterSheet = jest.fn(() => 'ui-character-1');

        engine.render(1);
        engine.render(1);

        expect(engine.uiManager.serializeCharacterSheet).toHaveBeenCalledWith(engine.player);
        expect(engine.uiManager.updateCharacterSheet).toHaveBeenCalledTimes(1);

        engine.uiManager.serializeCharacterSheet.mockReturnValue('ui-character-2');
        engine.render(1);

        expect(engine.uiManager.updateCharacterSheet).toHaveBeenCalledTimes(2);
    });
});
