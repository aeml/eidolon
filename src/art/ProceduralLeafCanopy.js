import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// One cached, opaque mesh per crown: folded leaves supply actual silhouette and
// shadows without alpha cards, transparent sorting or a draw call per leaf.
export function createLeafCanopyGeometry(quality = 'high') {
    const positions = [], colors = [];
    let seed = 7419;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const up = new Vector3(0, 1, 0);
    const lobes = [
        [-.62, -.22, .12], [.64, -.12, .04], [-.18, .22, .62],
        [.24, .34, -.56], [0, .6, -.05], [.1, -.48, .24], [-.58, .13, -.57]
    ].map(point => new Vector3(...point));
    for (let index = 0; index < 256; index++) {
        const angle = index * 2.399963229728653;
        const y = 1 - 2 * (index + .5) / 256;
        const radial = Math.sqrt(1 - y * y);
        const direction = new Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
        // Leaves grow in overlapping branch-tip clusters, not a uniformly
        // packed spherical shell. Compact overlapping sprays supply canopy
        // mass at gameplay distance; gaps between lobes retain the branching
        // silhouette. Thin isolated blades made mature trees read as saplings.
        const center = lobes[index % lobes.length].clone().addScaledVector(direction, .22 + random() * .24);
        const leafNormal = direction.clone().addScaledVector(up, .65).normalize();
        const side = new Vector3().crossVectors(leafNormal, up).normalize();
        const forward = new Vector3().crossVectors(side, leafNormal).normalize();
        // Tilt each folded leaf rather than giving the crown a regular shell.
        const tilt = random() * Math.PI * 2;
        side.applyAxisAngle(leafNormal, tilt); forward.applyAxisAngle(leafNormal, tilt);
        const length = .17 + random() * .10, width = length * .5;
        const points = [
            center.clone().addScaledVector(forward, length),
            center.clone().addScaledVector(forward, length * .3).addScaledVector(side, width),
            center.clone().addScaledVector(forward, -length * .45).addScaledVector(side, width * .75),
            center.clone().addScaledVector(forward, -length),
            center.clone().addScaledVector(forward, -length * .45).addScaledVector(side, -width * .75),
            center.clone().addScaledVector(forward, length * .3).addScaledVector(side, -width)
        ];
        // A tapered six-point blade avoids the large diamond-confetti edges.
        // Tip/spine curvature supplies a shallow fold, not a pyramidal leaf.
        points[0].addScaledVector(leafNormal, .026);
        points[3].addScaledVector(leafNormal, .012);
        const shade = .7 + random() * .36 + (center.y + 1) * .06;
        // Low keeps every leaf and its position, simplifying only the small
        // blade's outline to two triangles rather than thinning the whole crown.
        const faces = quality === 'low' ? [[0, 1, 3], [0, 3, 5]] : [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5]];
        for (const indices of faces) {
            for (const index of indices) {
                const point = points[index];
                positions.push(point.x, point.y, point.z);
                colors.push(shade * .91, shade, shade * .82);
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.userData.woodlandCrown = 'leaf';
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
