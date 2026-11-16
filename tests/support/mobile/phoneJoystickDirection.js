// Inverse of the production isometric joystick mapping. Pure input geometry;
// this never assigns a game position, target, key, or joystick state.
export function phoneJoystickDirection(x, z) {
    if (![x, z].every(Number.isFinite) || Math.hypot(x, z) < .001) {
        throw new Error('Phone joystick movement requires a finite nonzero direction');
    }
    const length = Math.hypot(x - z, x + z);
    return { x: (x - z) / length, y: (x + z) / length };
}
