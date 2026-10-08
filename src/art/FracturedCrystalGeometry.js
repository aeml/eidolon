import * as THREE from 'three';

// Unequal prismatic faces and an offset termination replace perfect cones.
// Keep the old shard's .34m radius/2.2m height, so every existing transform,
// buried base and reserved sightline apron still applies.
export function createFracturedCrystalGeometry() {
    const positions = [], uvs = [];
    const radii = [1, .91, .97, .87, 1, .93];
    const rings = [-1.1, 0, .7].map((height, ring) => Array.from({ length: 6 }, (_, side) => {
        const angle = side * Math.PI / 3;
        const radius = .34 * radii[side] * [1, .96, .74][ring];
        return [Math.cos(angle) * radius + (ring === 2 ? .025 : 0),
            height + (ring === 2 ? [0, .04, -.04, .07, -.02, -.1][side] : 0),
            Math.sin(angle) * radius];
    }));
    const triangle = (a, b, c) => {
        for (const point of [a, b, c]) {
            positions.push(...point); uvs.push((point[0] / .34 + 1) * .5, (point[1] + 1.1) / 2.2);
        }
    };
    for (let ring = 0; ring < 2; ring++) for (let side = 0; side < 6; side++) {
        const next = (side + 1) % 6;
        triangle(rings[ring][side], rings[ring + 1][side], rings[ring][next]);
        triangle(rings[ring][next], rings[ring + 1][side], rings[ring + 1][next]);
    }
    for (let side = 0; side < 6; side++) triangle(rings[2][side], [.05, 1.1, -.02], rings[2][(side + 1) % 6]);
    for (let side = 1; side < 5; side++) triangle(rings[0][0], rings[0][side], rings[0][side + 1]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.fracturedCrystal = true;
    return geometry;
}
