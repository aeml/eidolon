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
