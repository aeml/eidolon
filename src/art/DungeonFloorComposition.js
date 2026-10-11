import * as THREE from 'three';

// Room-scale masonry borders, not navigation arrows or combat telegraphs.
// The middle stays bare for the objective seal and encounter readability.
// Coordinates use radius24; the caller fits X/Z to the existing room.
export function getDungeonFloorCompositionPlan(identity) {
    if (identity === 'entry_gate') return 'nave';
    if (identity === 'boss_approach') return 'procession';
    if (identity === 'boss_lair') return 'arena';
    return 'court';
}

export function createDungeonFloorComposition(plan) {
    if (!['nave', 'court', 'procession', 'arena'].includes(plan)) throw new TypeError(`Unknown dungeon floor composition: ${plan}`);
    const positions = [], uvs = [], colors = [];
    let stones = 0;
    const triangle = (a, b, c, shade) => {
        for (const point of [a, b, c]) {
            positions.push(...point); uvs.push(point[0] / 4, point[2] / 4);
            colors.push(shade, shade, shade);
        }
    };
    const stone = outline => {
        const center = outline.reduce((a, b) => [a[0] + b[0] / 4, a[1] + b[1] / 4], [0, 0]);
        const height = .119 + (stones % 3) * .002;
        // Contract toward the polygon centroid. An axis-aligned inset can
        // cross a diagonal ring edge and turn its bevel normal downward.
        const top = outline.map(([x, z]) => [center[0] + (x - center[0]) * .94, height,
            center[1] + (z - center[1]) * .94]);
        const bottom = outline.map(([x, z]) => [x, .104, z]);
        const shade = .78 + ((stones * 7) % 11) * .017;
        triangle(top[0], top[2], top[1], shade); triangle(top[0], top[3], top[2], shade);
        for (let i = 0; i < 4; i++) {
            const next = (i + 1) % 4;
            triangle(top[i], top[next], bottom[next], shade);
            triangle(top[i], bottom[next], bottom[i], shade);
        }
        stones++;
    };
    const run = (x0, z0, x1, z1, width, count) => {
        const dx = x1 - x0, dz = z1 - z0, length = Math.hypot(dx, dz);
        const along = [dx / length, dz / length], across = [-along[1], along[0]];
        for (let i = 0; i < count; i++) {
            const a = length * i / count + .045, b = length * (i + 1) / count - .045;
            stone([[a, -width / 2], [b, -width / 2], [b, width / 2], [a, width / 2]]
                .map(([s, t]) => [x0 + along[0] * s + across[0] * t, z0 + along[1] * s + across[1] * t]));
        }
    };
    const circuit = (radius, width, segments) => {
        for (let i = 0; i < segments; i++) {
            const a = (i + .035) * Math.PI * 2 / segments, b = (i + .965) * Math.PI * 2 / segments;
            stone([[radius, a], [radius + width, a], [radius + width, b], [radius, b]]
                .map(([r, angle]) => [Math.cos(angle) * r, Math.sin(angle) * r]));
        }
    };
    if (plan === 'arena') {
        // Outside the existing radius17.4 buried dais, never over its surface.
        circuit(20.7, .8, 16);
    } else if (plan === 'nave') {
        // Frame the entry vigils and their original crosswise paving without
        // overlapping it or implying an exit in a randomly oriented layout.
        for (const side of [-1, 1]) run(side * 20.3, -20, side * 20.3, 20, 1.15, 8);
        run(-19.5, 20.3, 19.5, 20.3, 1.15, 8);
        run(-19.5, -20.3, 19.5, -20.3, 1.15, 8);
    } else if (plan === 'procession') {
        for (const side of [-1, 1]) {
            run(side * 6.5, -23, side * 6.5, -8.5, 1, 4);
            run(side * 6.5, 8.5, side * 6.5, 23, 1, 4);
            run(-5.5, side * 20.3, 5.5, side * 20.3, .75, 3);
        }
    } else {
        circuit(13, 1.05, 12);
        for (const side of [-1, 1]) {
            run(side * 19.8, -19.8, side * 19.8, 19.8, .9, 8);
            run(-18.8, side * 19.8, 18.8, side * 19.8, .9, 8);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.dungeonFloorComposition = { plan, stones, visualOnly: true };
    return geometry;
}
