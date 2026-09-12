import * as THREE from 'three';
import { InputManager } from '../src/core/InputManager.js';
import { phoneJoystickDirection } from './phoneJoystickDirection.js';

test.each([[1, 0], [-1, 0], [0, 1], [0, -1], [3, -7], [-3, 7]])(
    'touch direction maps through actual production input to requested world direction (%s,%s)', (x, z) => {
        const stick = phoneJoystickDirection(x, z);
        const world = InputManager.prototype.getMovementDirection.call({ keys: {}, joystickVector: new THREE.Vector2(stick.x, stick.y) });
        const desired = new THREE.Vector3(x, 0, z).normalize();
        expect(world.distanceTo(desired)).toBeLessThan(1e-12);
    });
test.each([[0, 0], [NaN, 1], [1, Infinity], [null, 1]])('invalid directions fail before input (%s,%s)', (x, z) => {
    expect(() => phoneJoystickDirection(x, z)).toThrow('finite nonzero');
});
