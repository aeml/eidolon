import { teleportNativeDestination } from './e2e/teleport-native-route.js';

test('all four real casts avoid the observer at spawn, including after saved login', () => {
    const home = { x: -1.25, z: 200 };
    let current = { ...home };
    for (const z of [200, 208, 200, 208]) {
        const next = teleportNativeDestination(home, current);
        expect(next).toEqual({ x: 6.75, z });
        expect(Math.hypot(next.x - home.x, next.z - home.z)).toBeGreaterThanOrEqual(8);
        expect(Math.hypot(next.x - current.x, next.z - current.z)).toBe(8);
        current = { ...next }; // Fresh-login position is still observed, not injected.
    }
    expect(home).toEqual({ x: -1.25, z: 200 });
});

test('ordinary small landing variation still selects the other open point', () => {
    const home = { x: -1.25, z: 200 };
    expect(teleportNativeDestination(home, { x: 6.7, z: 200.1 })).toEqual({ x: 6.75, z: 208 });
    expect(teleportNativeDestination(home, { x: 6.8, z: 207.9 })).toEqual({ x: 6.75, z: 200 });
});
