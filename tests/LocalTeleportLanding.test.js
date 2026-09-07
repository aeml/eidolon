import { jest } from '@jest/globals';
import * as THREE from 'three';
import { GameEngine } from '../src/core/GameEngine.js';

function fixture() {
    const engine = Object.create(GameEngine.prototype);
    engine.player = { id: 'local', position: new THREE.Vector3(20000, .5, 20000),
        velocity: new THREE.Vector3(0, 0, 5), targetPosition: new THREE.Vector3(20000, .5, 20020) };
    engine.abilityController = { reconcileLocalAbilityShape: jest.fn() };
    engine.chunkManager = { updateEntityChunk: jest.fn() };
    engine.renderSystem = { setCameraTarget: jest.fn() };
    engine.beginPlayerCorrectionVisual = jest.fn();
    engine.clearCombatIntentState = jest.fn();
    return engine;
}

test.each([.5, 2.83, 12])('accepted local Teleport commits a %s-unit landing without a prediction deadband', distance => {
    const engine = fixture();
    engine.handleServerMessage({ type: 'ability', payload: {
        sourceId: 'local', skillName: 'Teleport', targetX: 20000, targetZ: 20000 + distance
    } });
    expect(engine.player.position.z).toBe(20000 + distance);
    expect(engine.player.position.y).toBe(.5);
    expect(engine.player.targetPosition).toBeNull();
    expect(engine.player.velocity.length()).toBe(0);
    expect(engine.chunkManager.updateEntityChunk).toHaveBeenCalledWith(engine.player);
    expect(engine.renderSystem.setCameraTarget).toHaveBeenCalledWith(engine.player.position);
});

test.each([
    { skillName: 'Fireball', targetX: 20000, targetZ: 20002 },
    { skillName: 'Charge', targetX: 20000, targetZ: 20002 },
    { skillName: 'Teleport', targetX: null, targetZ: 20002 },
    { skillName: 'Teleport', targetX: 20000, targetZ: NaN }
])('non-landing or malformed events do not reposition the local player: %j', data => {
    const engine = fixture();
    engine.handleServerMessage({ type: 'ability', payload: { sourceId: 'local', ...data } });
    expect(engine.player.position.z).toBe(20000);
    expect(engine.chunkManager.updateEntityChunk).not.toHaveBeenCalled();
});
