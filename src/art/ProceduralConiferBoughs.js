import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// Opaque, folded needle fans on staggered boughs. One reusable crown replaces
// the solid cone silhouette without alpha sorting or a draw call per needle.
export function createConiferBoughGeometry() {
    const positions = [], colors = [];
    const triangle = (a, b, c, shade) => {
        for (const point of [a, b, c]) {
            positions.push(point.x, point.y, point.z);
            colors.push(shade * .87, shade, shade * .88);
        }
    };
    for (let tier = 0; tier < 5; tier++) {
        const y = -1.35 + tier * .62, length = 1.65 - tier * .27;
        for (let branch = 0; branch < 7; branch++) {
            const angle = branch * Math.PI * 2 / 7 + tier * 1.17;
            const forward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
            const side = new Vector3(-forward.z, 0, forward.x);
            for (let fan = 0; fan < 6; fan++) {
                const t = (fan + .4) / 6, reach = length * t;
                const center = forward.clone().multiplyScalar(reach).setY(y - .28 * t + .13 * Math.sin(branch * 3 + tier));
                const tip = center.clone().addScaledVector(forward, .33).add(new Vector3(0, .09, 0));
                const left = center.clone().addScaledVector(side, .30 * (1 - t * .6));
                const right = center.clone().addScaledVector(side, -.30 * (1 - t * .6));
                center.y += .06;
                const shade = .68 + tier * .055 + ((branch + fan) % 3) * .07;
                triangle(center, left, tip, shade);
                triangle(tip, right, center, shade * .9);
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
