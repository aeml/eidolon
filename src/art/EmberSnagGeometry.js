import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A single connected, fire-stripped tree. Fork roots overlap the trunk;
// ember sockets are shared with the recipe rather than guessed independently.
export const EMBER_SNAG_SOCKETS = Object.freeze([
    Object.freeze([-1.38, 5.45, .05]),
    Object.freeze([1.38, 4.65, .35])
]);

function timber(points, radii, sides) {
    const positions = [], uvs = [], indices = [];
    const centers = points.map(point => new THREE.Vector3(...point));
    for (let ring = 0; ring < centers.length; ring++) {
        const tangent = centers[Math.min(ring + 1, centers.length - 1)].clone()
            .sub(centers[Math.max(0, ring - 1)]).normalize();
        const axis = new THREE.Vector3(0, 0, 1).cross(tangent).normalize();
        const across = tangent.clone().cross(axis).normalize();
        for (let side = 0; side <= sides; side++) {
            const angle = side / sides * Math.PI * 2;
            const radius = radii[ring] * (.94 + .05 * Math.sin(angle * 3 + ring * .3));
            const vertex = centers[ring].clone().addScaledVector(axis, Math.cos(angle) * radius)
                .addScaledVector(across, Math.sin(angle) * radius);
            positions.push(...vertex.toArray()); uvs.push(side / sides, ring / (centers.length - 1));
            if (ring && side < sides) {
                const a = (ring - 1) * (sides + 1) + side, b = a + sides + 1;
                indices.push(a, a + 1, b, a + 1, b + 1, b);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    for (let ring = 0; ring < centers.length; ring++) {
        const a = ring * (sides + 1), b = a + sides;
        const normal = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, a)
            .add(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, b)).normalize();
        geometry.attributes.normal.setXYZ(a, ...normal.toArray());
        geometry.attributes.normal.setXYZ(b, ...normal.toArray());
    }
    const result = geometry.toNonIndexed(); geometry.dispose(); return result;
}

export function createEmberSnagGeometry() {
    const pieces = [
        timber([[0, -.1, 0], [.04, .75, .02], [-.09, 1.7, -.04], [.08, 2.7, 0],
            [-.18, 3.65, .05], [-.3, 4.55, -.04], [-.15, 5.25, .08], [-.38, 5.95, .04]],
        [.42, .36, .31, .27, .22, .16, .095, .018], 8),
        timber([[-.18, 3.65, .05], [-.72, 4.15, .02], [-1.02, 4.85, .13], EMBER_SNAG_SOCKETS[0]],
            [.17, .115, .07, .025], 6),
        timber([[.08, 2.7, 0], [.65, 3.25, .1], [.85, 4.02, .22], EMBER_SNAG_SOCKETS[1]],
            [.18, .125, .065, .025], 6),
        timber([[-.09, 1.7, -.04], [-.48, 2.15, -.32], [-.86, 2.3, -.5]], [.12, .065, .012], 5)
    ];
    const geometry = mergeGeometries(pieces, false); pieces.forEach(piece => piece.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.emberSnag = true;
    return geometry;
}
