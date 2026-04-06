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

jest.unstable_mockModule('../src/core/RenderSystem.js', () => ({
    RenderSystem: class RenderSystem {
        constructor() {
            this.camera = {};
            this.scene = {};
        }
    }
}));

jest.unstable_mockModule('../src/core/InputManager.js', () => ({
    InputManager: class InputManager {
        constructor() {
            this.keys = {};
        }
    }
}));

jest.unstable_mockModule('../src/core/ChunkManager.js', () => ({
    ChunkManager: class ChunkManager {
        constructor() {}
    }
}));

jest.unstable_mockModule('../src/core/CollisionManager.js', () => ({
    CollisionManager: class CollisionManager {}
}));

jest.unstable_mockModule('../src/core/NetworkManager.js', () => ({
    NetworkManager: class NetworkManager {
        constructor() {}
    }
}));

jest.unstable_mockModule('../src/core/AbilityController.js', () => ({
    AbilityController: class AbilityController {
        constructor() {}
    }
}));

jest.unstable_mockModule('../src/core/UIBindings.js', () => ({
    UIBindings: class UIBindings {
        constructor() {}
        bindConstructorCallbacks() {}
    }
}));

const mockGetAutoLootEnabled = jest.fn(() => true);
const mockSetAutoLootEnabled = jest.fn();
const mockGetCameraShakeEnabled = jest.fn(() => false);
const mockSetCameraShakeEnabled = jest.fn();

jest.unstable_mockModule('../src/ui/UIManager.js', () => ({
    UIManager: class UIManager {
        constructor() {
            this.onAutoLootChange = null;
            this.onCameraShakeChange = null;
        }

        getAutoLootEnabled() {
            return mockGetAutoLootEnabled();
        }

        setAutoLootEnabled(enabled) {
            mockSetAutoLootEnabled(enabled);
            this.onAutoLootChange?.(enabled);
        }

        getCameraShakeEnabled() {
            return mockGetCameraShakeEnabled();
        }

        setCameraShakeEnabled(enabled) {
            mockSetCameraShakeEnabled(enabled);
            this.onCameraShakeChange?.(enabled);
        }
    }
}));

jest.unstable_mockModule('../src/world/WorldGenerator.js', () => ({
    WorldGenerator: class WorldGenerator {
        constructor() {}
    }
}));

jest.unstable_mockModule('../src/ui/Minimap.js', () => ({
    Minimap: class Minimap {
        setGameEngine() {}
    }
}));

jest.unstable_mockModule('../src/ui/WorldMap.js', () => ({
    WorldMap: class WorldMap {
        constructor() {}
    }
}));

jest.unstable_mockModule('../src/ui/FloatingTextManager.js', () => ({
    FloatingTextManager: class FloatingTextManager {
        constructor() {}
    }
}));

const { GameEngine } = await import('../src/core/GameEngine.js');

describe('GameEngine settings persistence', () => {
    beforeEach(() => {
        mockGetAutoLootEnabled.mockClear();
        mockSetAutoLootEnabled.mockClear();
        mockGetCameraShakeEnabled.mockClear();
        mockSetCameraShakeEnabled.mockClear();
    });

    test('constructor keeps persisted auto-loot enabled state after relog', () => {
        const engine = new GameEngine('Fighter', false, true, '', 'tester', null);

        expect(mockGetAutoLootEnabled).toHaveBeenCalledTimes(1);
        expect(engine.autoLootEnabled).toBe(true);
    });

    test('auto-loot runtime state still follows later UI toggles', () => {
        const engine = new GameEngine('Fighter', false, true, '', 'tester', null);

        engine.uiManager.setAutoLootEnabled(false);

        expect(mockSetAutoLootEnabled).toHaveBeenCalledWith(false);
        expect(engine.autoLootEnabled).toBe(false);
    });

    test('constructor keeps camera shake disabled by default after relog', () => {
        const engine = new GameEngine('Fighter', false, true, '', 'tester', null);

        expect(mockGetCameraShakeEnabled).toHaveBeenCalledTimes(1);
        expect(engine.cameraShakeEnabled).toBe(false);
    });

    test('camera shake runtime state still follows later UI toggles', () => {
        const engine = new GameEngine('Fighter', false, true, '', 'tester', null);

        engine.uiManager.setCameraShakeEnabled(true);

        expect(mockSetCameraShakeEnabled).toHaveBeenCalledWith(true);
        expect(engine.cameraShakeEnabled).toBe(true);
    });

    test('delta self inventory sync pads server updates so auto-loot keeps empty slots', () => {
        const engine = new GameEngine('Fighter', false, true, '', 'tester', null);
        engine.player = {
            id: 'player-1',
            inventory: new Array(25).fill(null),
            stats: { hp: 100, maxHp: 100, mana: 50, maxMana: 50, strength: 10 },
            xp: 0,
            xpToNextLevel: 100,
            level: 1
        };
        engine.uiManager.updateXP = jest.fn();
        engine.uiManager.updateCharacterSheet = jest.fn();
        engine.uiManager.updatePlayerStats = jest.fn();
        engine.uiManager.updateInventory = jest.fn();
        engine.syncDeathScreen = jest.fn();

        engine.handleServerMessage({
            type: 'delta',
            payload: {
                u: {
                    'player-1': {
                        id: 'player-1',
                        inventory: [{ id: 'loot-1', name: 'Iron Sword', stack: 1, maxStack: 1 }]
                    }
                },
                r: []
            }
        });

        expect(engine.player.inventory).toHaveLength(25);
        expect(engine.player.inventory[0]).toMatchObject({ id: 'loot-1', name: 'Iron Sword' });
        expect(engine.player.inventory[24]).toBeNull();
    });
});
