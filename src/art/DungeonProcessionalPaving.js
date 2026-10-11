import * as THREE from 'three';

// Shallow, walkable masonry joins the existing props into an architectural
// composition. Coordinates are for radius24; the kit scales only X/Z. These
// stones never own collision, interaction targets or authoritative floor height.
const PLANS = Object.freeze({
    entry_gate: [
        [-17.1, 17.1, -13.6, -7.3, 3, 7],
        [-5.1, 5.1, -7.3, 2.2, 4, 3]
    ],
    treasure_cache: [[-5.8, 5.8, -.6, 10.2, 5, 4]],
    restorative_shrine: [[-5.5, 5.5, -2.4, 8.2, 5, 4]]
});

function noise(seed) {
    let value = Math.imul(seed ^ 0x5bd1e995, 0x27d4eb2d);
    value ^= value >>> 15;
    return (value >>> 0) / 4294967295;
}

export function createDungeonProcessionalPaving(identity) {
    const plan = Object.hasOwn(PLANS, identity) ? PLANS[identity] : null;
    if (!plan) throw new Error(`Unknown dungeon paving identity: ${identity}`);
    const positions = [], uvs = [], colors = [];
    let stones = 0;
    let shade = 1;
    const triangle = (a, b, c) => {
        for (const point of [a, b, c]) {
            positions.push(...point);
            colors.push(shade, shade, shade);
            // Mineral grain stays at a physical world scale across joints,
            // rather than stretching a whole texture over each narrow stone.
            uvs.push(point[0] / 4, point[2] / 4);
        }
    };
    for (let section = 0; section < plan.length; section++) {
        const [left, right, near, far, rows, columns] = plan[section];
        const depth = (far - near) / rows;
        for (let row = 0; row < rows; row++) {
            const z0 = near + row * depth + .05, z1 = near + (row + 1) * depth - .05;
            // Staggered joints and clipped outside corners, with a continuous
            // center route. No random holes that suggest an impassable floor.
            const clipped = (row === 0 || row === rows - 1) ? .7 : 0;
            const lo = left + clipped, hi = right - clipped;
            const cuts = [lo];
            for (let column = 1; column < columns; column++)
                cuts.push(lo + (hi - lo) * column / columns
                    + ((row % 2) ? .65 : -.25) + (noise(section * 1000 + row * 100 + column) - .5) * .4);
            cuts.push(hi);
            for (let column = 0; column < columns; column++) {
                const seed = section * 1000 + row * 100 + column * 7;
                const x0 = cuts[column] + .05, x1 = cuts[column + 1] - .05;
                const chip = .14 + noise(seed + 3) * .18;
                const outline = [[x0 + chip, z0], [x1 - chip, z0], [x1, z0 + chip],
                    [x1, z1 - chip], [x1 - chip, z1], [x0 + chip, z1], [x0, z1 - chip], [x0, z0 + chip]];
                const center = [(x0 + x1) / 2, (z0 + z1) / 2];
                // Production dungeon floors sit at Y=.1. Keep the entire
                // relief above that surface and below the ward/room-state seals.
                const height = .12 + noise(seed + 5) * .01;
                shade = .82 + noise(seed + 9) * .18;
                const top = outline.map(([x, z]) => [x + Math.sign(center[0] - x) * .055,
                    height, z + Math.sign(center[1] - z) * .055]);
                const bottom = outline.map(([x, z]) => [x, .104, z]);
                for (let i = 0; i < outline.length; i++) {
                    const next = (i + 1) % outline.length;
                    // X/Z outlines run clockwise as viewed from above. Reverse
                    // top winding for +Y normals; bevels face up and outward.
                    triangle([center[0], height, center[1]], top[next], top[i]);
                    triangle(top[i], top[next], bottom[next]);
                    triangle(top[i], bottom[next], bottom[i]);
                }
                stones++;
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.dungeonProcessionalPaving = { identity, stones, visualOnly: true };
    return geometry;
}
