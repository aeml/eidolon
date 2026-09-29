import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

// One cached, opaque mesh per crown: folded leaves supply actual silhouette and
// shadows without alpha cards, transparent sorting or a draw call per leaf.
export function createLeafCanopyGeometry() {
    const positions = [], colors = [];
    let seed = 7419;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const up = new Vector3(0, 1, 0);
    for (let index = 0; index < 256; index++) {
        const angle = index * 2.399963229728653;
        const y = 1 - 2 * (index + .5) / 256;
        const radial = Math.sqrt(1 - y * y);
        const direction = new Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
        const center = direction.clone().multiplyScalar(.65 + random() * .56);
        const side = new Vector3().crossVectors(direction, up).normalize();
        const forward = new Vector3().crossVectors(side, direction).normalize();
        // Tilt each folded leaf rather than giving the crown a regular shell.
        const tilt = random() * Math.PI * 2;
        side.applyAxisAngle(direction, tilt); forward.applyAxisAngle(direction, tilt);
        const length = .19 + random() * .13, width = length * .65;
        const points = [
            center.clone().addScaledVector(forward, length),
            center.clone().addScaledVector(side, width),
            center.clone().addScaledVector(forward, -length),
            center.clone().addScaledVector(side, -width)
        ];
        // Fold along the tip-to-tip spine: two faces retain every leaf and
        // its silhouette without the old four-triangle center pyramid.
        points[0].addScaledVector(direction, .055);
        points[2].addScaledVector(direction, .055);
        const shade = .68 + random() * .52;
        for (const indices of [[0, 1, 2], [0, 2, 3]]) {
            for (const index of indices) {
                const point = points[index];
                positions.push(point.x, point.y, point.z);
                colors.push(shade * .91, shade, shade * .82);
            }
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
