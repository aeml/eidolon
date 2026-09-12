// Leave the observing player at spawn. Alternate between two open-square
// destinations instead of returning the real cursor to that occupied point.
export function teleportNativeDestination(home, position) {
    const first = { x: home.x + 8, z: home.z };
    return Math.hypot(position.x - first.x, position.z - first.z) < 4
        ? { x: first.x, z: home.z + 8 } : first;
}
