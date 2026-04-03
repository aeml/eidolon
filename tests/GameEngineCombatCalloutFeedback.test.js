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

describe('GameEngine encounter callouts', () => {
    test('notifies UI when a boss telegraph arrives', () => {
        const engine = Object.create(GameEngine.prototype);
        engine.effects = [];
        engine.player = { id: 'player-1', position: new THREE.Vector3(0, 0, 0) };
        engine.spawnTransientEffect = jest.fn(() => true);
        engine.uiManager = {
            showCombatCallout: jest.fn()
        };
        engine.handleServerMessage = GameEngine.prototype.handleServerMessage;

        engine.handleServerMessage({
            type: 'telegraph',
            payload: {
                x: 3,
                z: 9,
                radius: 12,
                duration: 2,
                threatTier: 'boss',
                label: 'MAELSTROM SLAM'
            }
        });

        expect(engine.uiManager.showCombatCallout).toHaveBeenCalledWith(expect.objectContaining({
            title: 'MAELSTROM SLAM',
            tone: 'boss',
            duration: 2,
            subtitle: 'Brace for impact'
        }));
    });
});
