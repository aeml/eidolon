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

jest.unstable_mockModule('../src/ui/UIManager.js', () => ({
    UIManager: class UIManager {
        constructor() {
            this.onAutoLootChange = null;
        }

        getAutoLootEnabled() {
            return mockGetAutoLootEnabled();
        }

        setAutoLootEnabled(enabled) {
            mockSetAutoLootEnabled(enabled);
            this.onAutoLootChange?.(enabled);
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

describe('GameEngine auto-loot persistence', () => {
    beforeEach(() => {
        mockGetAutoLootEnabled.mockClear();
        mockSetAutoLootEnabled.mockClear();
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
});
