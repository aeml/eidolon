import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// Compact, opaque boughs for distant Moonfrost/gale trees. Their old cone's
// radius/height envelope remains; twenty-four staggered boughs replace a solid
// seven-sided shell. Two triangles per spray on High, one on Low, no alpha
// cards, texture maps, per-frame deformation or draw call per branch.
export function createElementalConiferGeometry(quality = 'high') {
    const positions = [], colors = [];
    const triangle = (a, b, c, shade) => {
        for (const point of [a, b, c]) {
            positions.push(point.x, point.y, point.z);
            colors.push(shade * .97, shade, shade * 1.02);
        }
    };
    for (let tier = 0; tier < 4; tier++) {
        const y = -1.15 + tier * .78, reach = 1.38 - tier * .30;
        for (let bough = 0; bough < 6; bough++) {
            const angle = bough * Math.PI / 3 + tier * 1.13;
            const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
            const side = new Vector3(-forward.z, 0, forward.x);
            for (let spray = 0; spray < 5; spray++) {
                const t = (spray + .35) / 5, sign = (bough + spray) % 2 ? 1 : -1;
                const center = forward.clone().multiplyScalar(reach * t);
                center.y = y - .20 * t + .055 * Math.sin(bough * 2.3 + tier);
                const root = center.clone().addScaledVector(forward, -.16);
                // Overlap the existing sprays: sparse separated arrowheads
                // disappeared at normal zoom and read as detached confetti.
                const tip = center.clone().addScaledVector(forward, .32)
                    .addScaledVector(side, sign * .25 * (1 - t * .35));
                tip.y -= .08 + t * .08;
                const edge = center.clone().addScaledVector(forward, .12)
                    .addScaledVector(side, sign * (.40 - t * .08));
                edge.y -= .045;
                const ridge = root.clone().lerp(tip, .5); ridge.y += .11;
                const shade = .72 + tier * .05 + (spray % 3) * .04;
                triangle(root, edge, tip, shade);
                if (quality !== 'low') triangle(root, tip, ridge, shade * 1.04);
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.userData.woodlandCrown = 'elemental-needle';
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
