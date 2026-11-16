import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function carved(points, depth, z) {
    const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
    const part = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
        bevelSize: .08, bevelThickness: .08, bevelSegments: 1, steps: 1 });
    part.translate(0, 0, z);
    return part;
}

// Local +Z faces the approach; the owning architecture turns west. Chamfered
// courses and an open lancet distinguish the Aerie from the other realm gates.
export function createTempestForegate() {
    const parts = [];
    for (const side of [-1, 1]) {
        for (let row = 0; row < 6; row++) {
            const x = side * 7.5, y = 2 + row * 2.1;
            parts.push(carved([[x - 1.35, y], [x + 1.35, y],
                [x + 1.35, y + 1.94], [x - 1.35, y + 1.94]], 2.5, 18.3));
        }
        for (let course = 0; course < 5; course++) {
            const a = course / 5 + .004, b = (course + 1) / 5 - .004;
            const inner = t => [side * 6.1 * (1 - t), 14.4 + 10 * t];
            const outer = t => [side * 8.9 * (1 - t), 14.4 + 13.2 * t];
            parts.push(carved([inner(a), outer(a), outer(b), inner(b)], 2.5, 18.3));
        }
    }
    const result = mergeGeometries(parts, false);
    parts.forEach(p => p.dispose());
    return result;
}

export function createTempestFoundation() {
    const outline = [[-18, -20], [18, -20], [20, -17], [20, 13],
        [13, 20], [-13, 20], [-20, 13], [-20, -17]];
    const part = carved(outline.map(([x, z]) => [x, -z]), 1.3, 0);
    part.rotateX(-Math.PI / 2); part.translate(0, .08, 0);
    return part;
}

export function createTempestNeedle() {
    const courses = [];
    for (let row = 0; row < 14; row++) {
        const bottom = 9.5 - row * .48, top = bottom - .45;
        const stone = new THREE.CylinderGeometry(top, bottom, 4.48, 8).toNonIndexed();
        stone.rotateY(Math.PI / 8);
        stone.translate(0, 2.25 + row * 4.56, 0);
        courses.push(stone);
    }
    const result = mergeGeometries(courses, false);
    courses.forEach(p => p.dispose());
    return result;
}
