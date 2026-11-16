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
            // Branches grow at different heights and lengths around the stem.
            // Keep all five whorls and seven living boughs, but avoid identical
            // horizontal shelves and a repeated seven-point star silhouette.
            const growth = Math.sin(branch * 2.17 + tier * 1.83);
            const angle = branch * Math.PI * 2 / 7 + tier * 1.17 + growth * .13;
            const branchLength = length * (.88 + .12 * Math.sin(branch * 1.79 + tier * 2.31));
            const branchHeight = y + .11 * Math.sin(branch * 2.73 + tier * .91);
            const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
            const side = new Vector3(-forward.z, 0, forward.x);
            for (let fan = 0; fan < 6; fan++) {
                const t = (fan + .4) / 6, reach = branchLength * t;
                const center = forward.clone().multiplyScalar(reach)
                    .addScaledVector(side, growth * .13 * Math.sin(t * Math.PI))
                    .setY(branchHeight - .28 * t * t + .05 * Math.sin(fan * 1.7 + branch * .7 + tier));
                // Coherent new growth toward the tips replaces alternating
                // light/dark tiles on every branch. Lighting supplies folds.
                const shade = .69 + tier * .045 + .075 * t + growth * .035;
                // Paired narrow sprays replace the broad triangular arrowhead.
                // Sweep each tip outward/down, with a raised folded midrib.
                for (const sign of [-1, 1]) {
                    const root = center.clone().addScaledVector(forward, -.05);
                    // Overlapping needle sprays read as a living bough rather
                    // than disconnected fine triangles at the gameplay zoom.
                    // Keep every tier/fan and the existing Low detail policy.
                    const spray = .88 + .12 * Math.sin(fan * 2.1 + branch * 1.3 + tier + sign);
                    const tip = center.clone().addScaledVector(forward, .41 * spray)
                        .addScaledVector(side, sign * .31 * (1 - t * .45) * spray);
                    // Broaden the existing fan, not the branch's reach, and
                    // curve its hanging tip. Flat, narrow sprays read as rows
                    // of sticks when the entire crown is viewed at play zoom.
                    tip.y -= .06 + .09 * t;
                    const ridge = root.clone().lerp(tip, .48); ridge.y += .085;
                    const edge = ridge.clone().addScaledVector(side, sign * .22); edge.y -= .075;
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
