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
    engine.effects = [];
    engine.player = {
        id: 'player-1',
        position: new THREE.Vector3(0, 0, 0)
    };
    engine.uiManager = {
        showCombatCallout: jest.fn(),
        addChatMessage: jest.fn(),
        showRoomClearReward: jest.fn()
    };
    engine.activeWorldGenerator = {
        updateDungeonRoomState: jest.fn()
    };
    engine.spawnTransientEffect = jest.fn(() => true);
    return engine;
}

describe('GameEngine telegraph feedback', () => {
    test.each([
        [1000, 10, false],
        [100, 10, true],
        [1000, 1000, true]
    ])('overworld warning at distance %s radius %s is locally relevant=%s', (x, radius, visible) => {
        const engine = createEngineHarness();
        engine.handleServerMessage({ type: 'telegraph', payload: { instanceId: '', x, z: 0, radius, duration: 2 } });
        expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(visible ? 1 : 0);
        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledTimes(visible ? 1 : 0);
    });

    test.each([
        ['dungeon_a', 'dungeon_b', false],
        ['dungeon_a', '', false],
        ['', 'dungeon_a', false],
        ['dungeon_a', 'dungeon_a', true],
        ['', '', true]
    ])('warning from %s while in %s: visible=%s', (sourceInstance, currentInstance, visible) => {
        const engine = createEngineHarness();
        engine.currentInstanceId = currentInstance;
        engine.handleServerMessage({ type: 'telegraph', payload: {
            instanceId: sourceInstance, x: 10, z: 20, radius: 6, duration: 2,
            hint: 'Step sideways out of the fissure line.'
        } });
        expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(visible ? 1 : 0);
        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledTimes(visible ? 1 : 0);
        if (visible) expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(
            expect.objectContaining({ subtitle: 'Step sideways out of the fissure line.' }));
    });

    test('additional pattern circles render without repeating the callout', () => {
        const engine = createEngineHarness();
        engine.currentInstanceId = 'dungeon_a';
        for (const silent of [false, true, true]) engine.handleServerMessage({ type: 'telegraph', payload: {
            instanceId: 'dungeon_a', x: 10, z: 20, radius: 6, duration: 2, silent
        } });
        expect(engine.spawnTransientEffect).toHaveBeenCalledTimes(3);
        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledTimes(1);
    });

    test('renders boss telegraphs with threat tier and warning label', () => {
        const engine = createEngineHarness();
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'telegraph',
            payload: {
                x: 18,
                z: -12,
                radius: 14,
                duration: 2.8,
                threatTier: 'boss',
                label: 'FURNACE RUPTURE',
                theme: 'molten_core',
                attack: 'furnace_rupture'
            }
        });

        expect(engine.spawnTransientEffect).toHaveBeenCalledWith(
            'telegraph',
            expect.any(THREE.Vector3),
            0xff2200,
            expect.objectContaining({
                radius: 14,
                telegraphDuration: 2.8,
                threatTier: 'boss',
                label: 'FURNACE RUPTURE',
                theme: 'molten_core',
                attack: 'furnace_rupture'
            })
        );
    });
});
