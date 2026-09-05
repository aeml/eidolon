// Test routes cross the center of each shared opening, then each rectangle's
// center. Joining rectangle centers directly can cut diagonally across an L
// bend, which would test an illegal shortcut rather than the intended hallway.
export function buildDungeonTraversalRoutes(layout) {
    return layout.corridors.map(corridor => {
        const rectangles = [layout.rooms[corridor.fromRoomIndex],
            ...corridor.walkRectIndices.map(index => layout.walkRects[index]),
            layout.rooms[corridor.toRoomIndex]];
        const route = [{ x: rectangles[0].x, z: rectangles[0].z }];
        for (let i = 1; i < rectangles.length; i++) {
            const a = rectangles[i - 1];
            const b = rectangles[i];
            const left = Math.max(a.x - a.width / 2, b.x - b.width / 2);
            const right = Math.min(a.x + a.width / 2, b.x + b.width / 2);
            const top = Math.max(a.z - a.height / 2, b.z - b.height / 2);
            const bottom = Math.min(a.z + a.height / 2, b.z + b.height / 2);
            if (left >= right || top >= bottom) throw new Error('Required corridor has no shared opening');
            route.push({ x: (left + right) / 2, z: (top + bottom) / 2 }, { x: b.x, z: b.z });
        }
        return route;
    });
}

export function sampleDungeonTraversalRoute(route, spacing = 2) {
    const samples = [];
    for (let i = 1; i < route.length; i++) {
        const from = route[i - 1];
        const to = route[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / spacing));
        for (let step = 0; step <= steps; step++) {
            samples.push({ x: from.x + (to.x - from.x) * step / steps, z: from.z + (to.z - from.z) * step / steps });
        }
    }
    return samples;
}
