import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// Opaque, folded needle fans on staggered boughs. One reusable crown replaces
// the solid cone silhouette without alpha sorting or a draw call per needle.
export function createConiferBoughGeometry(quality = 'high') {
    const positions = [], colors = [];
    const triangle = (a, b, c, shade) => {
        for (const point of [a, b, c]) {
            positions.push(point.x, point.y, point.z);
            colors.push(shade * .87, shade, shade * .88);
        }
    };
    for (let tier = 0; tier < 5; tier++) {
        // Make room for the fuller hanging fans inside the original crown's
        // vertical envelope. Lift lower tiers; keep the top tier unchanged.
        const y = -1.27 + tier * .60, length = 1.65 - tier * .27;
        for (let branch = 0; branch < 7; branch++) {
            const angle = branch * Math.PI * 2 / 7 + tier * 1.17;
            const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
            const side = new Vector3(-forward.z, 0, forward.x);
            for (let fan = 0; fan < 6; fan++) {
                const t = (fan + .4) / 6, reach = length * t;
                const center = forward.clone().multiplyScalar(reach).setY(y - .28 * t + .13 * Math.sin(branch * 3 + tier)
                    + .05 * Math.sin(fan * 1.7 + branch * .7 + tier));
                const shade = .68 + tier * .055 + ((branch + fan) % 3) * .07;
                // Paired narrow sprays replace the broad triangular arrowhead.
                // Sweep each tip outward/down, with a raised folded midrib.
                for (const sign of [-1, 1]) {
                    const root = center.clone().addScaledVector(forward, -.05);
                    // Overlapping needle sprays read as a living bough rather
                    // than disconnected fine triangles at the gameplay zoom.
                    // Keep every tier/fan and the existing Low detail policy.
                    const tip = center.clone().addScaledVector(forward, .41)
                        .addScaledVector(side, sign * .31 * (1 - t * .45));
                    // Broaden the existing fan, not the branch's reach, and
                    // curve its hanging tip. Flat, narrow sprays read as rows
                    // of sticks when the entire crown is viewed at play zoom.
                    tip.y -= .06 + .09 * t;
                    const ridge = root.clone().lerp(tip, .48); ridge.y += .085;
                    const edge = ridge.clone().addScaledVector(side, sign * .2); edge.y -= .075;
                    triangle(root, edge, tip, shade * (sign < 0 ? .91 : 1));
                    if (quality !== 'low') triangle(root, tip, ridge, shade * 1.04);
                }
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.userData.woodlandCrown = 'needle';
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
