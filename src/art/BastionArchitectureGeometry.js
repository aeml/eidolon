import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function horizontalStone(points, height, bevel = .15) {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, steps: 1,
        bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
        bevelSegments: 1, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, bevel, 0);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) position.setY(i, Math.max(0, position.getY(i)));
    return geometry;
}

export function createBastionFoundation() {
    return horizontalStone([[-33, -26], [-22, -28], [9, -27], [31, -24], [33, -13],
        [31, 8], [33, 21], [25, 25], [13, 23], [-12, 24], [-29, 23], [-33, 15]], 2.5, .3);
}

export function createBastionGatehouse() {
    const parts = [];
    // A real pointed doorway with a three-metre throat. The former dark panel
    // sat on a solid wall; viewing it from the approach exposed the flat face.
    // Chamfer the carved edge within the exact old front-wall envelope.
    const opening = new THREE.Shape([
        [-21, 3], [-5.5, 3], [-5.5, 12], [-3.8, 17], [0, 21],
        [3.8, 17], [5.5, 12], [5.5, 3], [21, 3], [21, 27], [-21, 27]
    ].map(([x, y]) => new THREE.Vector2(x, y)));
    const front = new THREE.ExtrudeGeometry(opening, { depth: 3, steps: 1,
        bevelEnabled: true, bevelSize: .18, bevelThickness: .18,
        bevelSegments: 1, curveSegments: 1 });
    front.computeBoundingBox();
    const bounds = front.boundingBox, size = bounds.getSize(new THREE.Vector3());
    front.translate(-bounds.min.x, -bounds.min.y, -bounds.min.z);
    front.scale(42 / size.x, 24 / size.y, 3 / size.z);
    front.translate(-21, 3, 4);
    parts.push(front);
    // Open ruined hall, not a solid box with an enormous flat roof cap.
    for (const [width, height, depth, x, y, z] of [
        [42, 22, 3, 0, 14, -15.5],
        [3, 23, 21, -19.5, 14.5, -5], [3, 21, 21, 19.5, 13.5, -5],
        [39, 1, 21, 0, 3.5, -5]
    ]) {
        const part = new THREE.BoxGeometry(width, height, depth).toNonIndexed();
        part.translate(x, y, z); parts.push(part);
    }
    const result = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    return result;
}

export function createBastionTowerParapet() {
    const parts = [];
    const heights = [3.3, 2, 4.6, 1.2, 3.9, 2.6, 1.6, 4.1];
    for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + .025, b = (i + 1) * Math.PI / 4 - .025;
        parts.push(horizontalStone([
            [Math.cos(a) * 6.3, Math.sin(a) * 6.3],
            [Math.cos(a) * 8.9, Math.sin(a) * 8.9],
            [Math.cos(b) * 8.9, Math.sin(b) * 8.9],
            [Math.cos(b) * 6.3, Math.sin(b) * 6.3]
        ], heights[i], .1));
    }
    const result = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    return result;
}

export function createBastionRecess() {
    return new THREE.ShapeGeometry(new THREE.Shape([
        [-5.5, 0], [5.5, 0], [5.5, 9], [3.8, 14], [0, 18], [-3.8, 14], [-5.5, 9]
    ].map(([x, y]) => new THREE.Vector2(x, y))));
}
