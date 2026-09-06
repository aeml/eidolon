import { jest } from '@jest/globals';
import * as THREE from 'three';
import { Imp } from '../src/entities/Imp.js';
import { Actor } from '../src/entities/Actor.js';

afterEach(() => jest.restoreAllMocks());

function roamingImp() {
    const imp = new Imp('roaming-imp');
    imp.roamTimer = imp.roamInterval + 1;
    const player = { state: 'IDLE', position: new THREE.Vector3(100, 0, 0) };
    return { imp, player };
}

test('a roam destination at the current position survives Actor.move clearing it', () => {
    const { imp, player } = roamingImp();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(() => imp.update(0, null, player, null)).not.toThrow();
    expect(imp.targetPosition).toBeNull();
    expect(imp.state).toBe('IDLE');
    expect(imp.movementMetrics.nearbyNoops).toBe(1);
    expect(imp.velocity.lengthSq()).toBe(0);
});

test('a short roam destination inside the arrival threshold is safe', () => {
    const { imp, player } = roamingImp();
    jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.001);
    expect(() => imp.update(0, null, player, null)).not.toThrow();
    expect(imp.targetPosition).toBeNull();
    expect(imp.state).toBe('IDLE');
});

test('an ordinary roam destination still starts movement', () => {
    const { imp, player } = roamingImp();
    jest.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5);
    imp.update(0, null, player, null);
    expect(imp.targetPosition).toEqual(new THREE.Vector3(6, 0, 0));
    expect(imp.state).toBe('MOVING');
});

test.each([1, 10, 100])('remote Imps only run the base replicated update at player distance %s', (distance) => {
    const { imp, player } = roamingImp();
    imp.isRemote = true;
    player.position.x = distance;
    const baseUpdate = jest.spyOn(Actor.prototype, 'update');
    const attack = jest.spyOn(imp, 'attack');
    const move = jest.spyOn(imp, 'move');
    const roamTimer = imp.roamTimer;
    imp.update(0, null, player, null);
    expect(baseUpdate).toHaveBeenCalledWith(0, null, player, null);
    expect(attack).not.toHaveBeenCalled();
    expect(move).not.toHaveBeenCalled();
    expect(imp.roamTimer).toBe(roamTimer);
    expect(imp.targetPosition).toBeNull();
});

test('a local Imp still chases a visible living player', () => {
    const { imp, player } = roamingImp();
    player.position.set(10, 0, 0);
    imp.update(0, null, player, null);
    expect(imp.targetPosition).toEqual(player.position);
    expect(imp.targetPosition).not.toBe(player.position);
    expect(imp.state).toBe('MOVING');
});

test('dead Imps do not start a new roam', () => {
    const { imp, player } = roamingImp();
    imp.state = 'DEAD';
    const move = jest.spyOn(imp, 'move');
    imp.update(0, null, player, null);
    expect(move).not.toHaveBeenCalled();
});
