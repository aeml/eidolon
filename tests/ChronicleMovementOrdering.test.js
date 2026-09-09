import { jest } from '@jest/globals';
import * as THREE from 'three';
import { GameEngine } from '../src/core/GameEngine.js';
import { requestChronicleInspection } from '../src/core/ChronicleInspection.js';

test.each(['MOVING', 'IDLE'])('inspection flushes its newest validated movement before the request (%s)', state => {
    const engine = Object.create(GameEngine.prototype);
    let serverZ = 5.05;
    const accepted = [];
    engine.isMultiplayer = true;
    engine.currentInstanceId = '';
    engine.player = { id: 'reader', position: new THREE.Vector3(0, 0, serverZ),
        rotation: new THREE.Quaternion(), state: 'MOVING' };
    engine.network = { send: jest.fn((type, payload) => {
        if (type === 'move') serverZ = payload.z;
        if (type === 'chronicle_inspect') accepted.push(Math.abs(serverZ) <= 5);
    }) };
    engine.sendPlayerMovementIfNeeded(0);
    engine.network.send.mockClear();
    engine.player.position.z = 4.95;
    engine.player.state = state;
    const site = { id: 'chronicle-site-mara_diary', type: 'ChronicleSite', isActive: true, position: new THREE.Vector3() };
    expect(requestChronicleInspection(engine, site)).toBe(true);
    expect(engine.network.send.mock.calls.map(([type]) => type)).toEqual(['move', 'chronicle_inspect']);
    expect(accepted).toEqual([true]);
    expect(engine.network.send.mock.calls[0][1]).toMatchObject({ z: 4.95, sequence: 2, state });
    // A reread does not flood unchanged movement packets or forge new credit.
    engine.network.send.mockClear();
    requestChronicleInspection(engine, site);
    expect(engine.network.send.mock.calls.map(([type]) => type)).toEqual(['chronicle_inspect']);
});

test('out-of-range inspection neither flushes movement nor sends a request', () => {
    const engine = { isMultiplayer: true, currentInstanceId: '',
        player: { id: 'reader', state: 'IDLE', position: new THREE.Vector3(0, 0, 5.01) },
        sendPlayerMovementIfNeeded: jest.fn(), network: { send: jest.fn() } };
    expect(requestChronicleInspection(engine, { type: 'ChronicleSite', isActive: true, position: new THREE.Vector3() })).toBe(false);
    expect(engine.sendPlayerMovementIfNeeded).not.toHaveBeenCalled();
    expect(engine.network.send).not.toHaveBeenCalled();
});
