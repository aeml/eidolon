import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The upper spine stays on the original tilted tree's axis: existing crown
// and conductor sockets remain attached. Curved lower timber, overlapping
// forks and shallow buttresses replace the cylinder and separate root cone.
function timber(points, radii, sides) {
    const centers = points.map(point => new THREE.Vector3(...point));
    const positions = [], uvs = [], indices = [];
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
    // Circular bark UVs meet without a duplicated-edge normal stripe.
    for (let ring = 0; ring < centers.length; ring++) {
        const a = ring * (sides + 1), b = a + sides;
        const normal = new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, a)
            .add(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal, b)).normalize();
        geometry.attributes.normal.setXYZ(a, ...normal.toArray());
        geometry.attributes.normal.setXYZ(b, ...normal.toArray());
    }
    const result = geometry.toNonIndexed(); geometry.dispose(); return result;
}

export function createGaleCypressGeometry() {
    const pieces = [
        timber([[0, -3.1, 0], [-.10, -2.45, .02], [-.18, -1.55, -.06],
            [-.10, -.55, -.02], [0, .65, 0], [0, 1.65, 0], [0, 2.7, 0], [0, 3.9, 0]],
        [.42, .34, .28, .24, .20, .16, .095, .018], 8),
        timber([[0, .65, 0], [.34, 1.1, .12], [.70, 1.8, .18], [.77, 2.35, .18]],
            [.14, .095, .05, .012], 6),
        timber([[0, 1.65, 0], [-.25, 2.05, -.12], [-.43, 2.75, -.18], [-.32, 3.15, -.18]],
            [.11, .075, .045, .012], 6)
    ];
    for (const angle of [.4, 2.5, 4.6]) {
        pieces.push(timber([[0, -2.70, 0], [Math.cos(angle) * .36, -2.96, Math.sin(angle) * .36],
            [Math.cos(angle) * .73, -3.06, Math.sin(angle) * .73]], [.18, .10, .015], 5));
    }
    const geometry = mergeGeometries(pieces, false); pieces.forEach(piece => piece.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.galeCypress = true;
    return geometry;
}
