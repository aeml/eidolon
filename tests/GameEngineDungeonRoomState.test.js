import { jest } from '@jest/globals';

const mockMinimapSetGameEngine = jest.fn();
const mockMinimapUpdate = jest.fn();

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
            const makeGroup = () => ({
                children: [],
                add(child) {
                    this.children.push(child);
                    child.parent = this;
                },
                remove(child) {
                    this.children = this.children.filter(entry => entry !== child);
                    if (child) child.parent = null;
                },
                traverse(callback) {
                    this.children.forEach(callback);
                }
            });
            this.camera = {};
            this.scene = {
                children: [],
                remove() {},
                add() {}
            };
            this.environmentGroup = makeGroup();
            this.entityGroup = makeGroup();
            this.effectGroup = makeGroup();
        }
        add(mesh) {
            this.entityGroup.add(mesh);
        }
        clearInstanceScene() {}
        setupLights() {}
        setCameraTarget() {}
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
        getActiveEntities() { return []; }
        removeEntity() {}
        updateEntityChunk() {}
    }
}));

jest.unstable_mockModule('../src/core/CollisionManager.js', () => ({
    CollisionManager: class CollisionManager {
        clear() {}
        clearDungeonWalkableGeometry() {}
        setDungeonWalkableGeometry() {}
    }
}));

jest.unstable_mockModule('../src/core/NetworkManager.js', () => ({
    NetworkManager: class NetworkManager {
        constructor() {}
        send() {}
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

jest.unstable_mockModule('../src/ui/UIManager.js', () => ({
    UIManager: class UIManager {
        constructor() {}
        getAutoLootEnabled() { return false; }
        updateQuestWindow() {}
        updateJournal() {}
    }
}));

jest.unstable_mockModule('../src/world/WorldGenerator.js', () => ({
    WorldGenerator: class WorldGenerator {
        constructor() {}
        async createVerdantBastionCatacombs() {}
        async createMoltenCore() {}
        async createTempestSpire() {}
        async createAbyssalWell() {}
        async createDungeon() {}
        async createTown() {}
        async createOverworldStructures() {}
    }
}));

jest.unstable_mockModule('../src/ui/Minimap.js', () => ({
    Minimap: class Minimap {
        setGameEngine(engine) {
            mockMinimapSetGameEngine(engine);
        }
        update(...args) {
            mockMinimapUpdate(...args);
        }
    }
}));

jest.unstable_mockModule('../src/ui/WorldMap.js', () => ({
    WorldMap: class WorldMap {
        constructor() {}
        update() {}
    }
}));

jest.unstable_mockModule('../src/ui/FloatingTextManager.js', () => ({
    FloatingTextManager: class FloatingTextManager {
        constructor() {}
    }
}));

const { GameEngine } = await import('../src/core/GameEngine.js');

describe('GameEngine dungeon room state', () => {
    beforeEach(() => {
        mockMinimapSetGameEngine.mockClear();
        mockMinimapUpdate.mockClear();
    });

    test('tracks dungeon room summary from enter_instance and dungeon_room_state messages', () => {
        const engine = new GameEngine('Fighter', false, true, '', 'tester', null);
        engine.player = {
            id: 'player-1',
            position: { x: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
            mesh: { position: { set() {} }, visible: true },
            playAnimation() {},
            quests: [],
            state: 'IDLE'
        };
        engine.uiManager = {
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };

        engine.handleServerMessage({
            type: 'enter_instance',
            payload: {
                instanceId: 'instance-1',
                type: 'verdant_bastion_catacombs',
                layout: { rooms: [] },
                roomState: {
                    currentRoomIndex: 0,
                    objectiveRoomIndex: 2,
                    rooms: []
                }
            }
        });

        expect(engine.getDungeonRoomSummary()).toEqual(expect.objectContaining({
            currentRoomIndex: 0,
            objectiveRoomIndex: 2
        }));

        engine.handleServerMessage({
            type: 'dungeon_room_state',
            payload: {
                currentRoomIndex: 1,
                objectiveRoomIndex: 3,
                rooms: [
                    { index: 1, explored: true, cleared: true, type: 'normal', x: 50, z: 0, width: 40, height: 40 }
                ]
            }
        });

        expect(engine.getDungeonRoomSummary()).toEqual(expect.objectContaining({
            currentRoomIndex: 1,
            objectiveRoomIndex: 3
        }));
    });

    test('updates tracked room progress when room_clear_reward advances the objective', () => {
        const engine = new GameEngine('Fighter', false, true, '', 'tester', null);
        engine.player = {
            id: 'player-1',
            position: { x: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
            mesh: { position: { set() {} }, visible: true },
            playAnimation() {},
            quests: [],
            state: 'IDLE'
        };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.uiManager = {
            showRoomClearReward: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 1,
            objectiveRoomIndex: 1,
            rooms: [
                { index: 0, explored: true, cleared: true, type: 'start', x: 0, z: 0, width: 40, height: 40 },
                { index: 1, explored: true, cleared: false, type: 'normal', x: 50, z: 0, width: 40, height: 40 },
                { index: 2, explored: false, cleared: false, type: 'boss', x: 100, z: 0, width: 40, height: 40 }
            ]
        };

        engine.handleServerMessage({
            type: 'room_clear_reward',
            payload: {
                playerId: 'player-1',
                roomIndex: 1,
                objectiveRoomIndex: 2,
                roomType: 'normal',
                title: 'Room Cleared: Hall 2',
                hint: 'Boss room discovered',
                gold: 50,
                xp: 120
            }
        });

        expect(engine.getDungeonRoomSummary()).toEqual(expect.objectContaining({
            objectiveRoomIndex: 2,
            rooms: expect.arrayContaining([
                expect.objectContaining({ index: 1, explored: true, cleared: true }),
                expect.objectContaining({ index: 2, explored: true, cleared: false, type: 'boss' })
            ])
        }));
    });

    test('tracks a completed dungeon state when boss room clear leaves no next objective', () => {
        const engine = new GameEngine('Fighter', false, true, '', 'tester', null);
        engine.player = {
            id: 'player-1',
            position: { x: 100, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
            mesh: { position: { set() {} }, visible: true },
            playAnimation() {},
            quests: [],
            state: 'IDLE'
        };
        engine.floatingTextManager = { spawn: jest.fn() };
        engine.uiManager = {
            showRoomClearReward: jest.fn(),
            updateQuestWindow: jest.fn(),
            updateJournal: jest.fn()
        };
        engine.currentDungeonRoomState = {
            currentRoomIndex: 2,
            objectiveRoomIndex: 2,
            rooms: [
                { index: 0, explored: true, cleared: true, type: 'start', x: 0, z: 0, width: 40, height: 40 },
                { index: 1, explored: true, cleared: true, type: 'normal', x: 50, z: 0, width: 40, height: 40 },
                { index: 2, explored: true, cleared: false, type: 'boss', x: 100, z: 0, width: 40, height: 40 }
            ]
        };

        engine.handleServerMessage({
            type: 'room_clear_reward',
            payload: {
                playerId: 'player-1',
                roomIndex: 2,
                objectiveRoomIndex: -1,
                roomType: 'boss',
                title: 'Boss Defeated: Zephyrion',
                hint: 'Dungeon cleared — head back to the entrance',
                gold: 0,
                xp: 0
            }
        });

        expect(engine.getDungeonRoomSummary()).toEqual(expect.objectContaining({
            objectiveRoomIndex: -1,
            rooms: expect.arrayContaining([
                expect.objectContaining({ index: 2, explored: true, cleared: true, type: 'boss' })
            ])
        }));
    });
});
