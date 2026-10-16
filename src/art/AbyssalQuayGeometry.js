import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBastionFoundation } from './BastionArchitectureGeometry.js';

// The Well retains its inherited drowned-shelf contour and height. This is
// visual construction inside that envelope, not new walkable architecture.
const OUTLINE = [[-33, -26], [-22, -28], [9, -27], [31, -24], [33, -13],
    [31, 8], [33, 21], [25, 25], [13, 23], [-12, 24], [-29, 23], [-33, 15]];

function clippedSlab(left, right, back, front) {
    let points = OUTLINE.map(point => [...point]);
    for (const [axis, edge, direction] of [[0, left, 1], [0, right, -1], [1, back, 1], [1, front, -1]]) {
        const next = [];
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            const insideA = (a[axis] - edge) * direction >= 0;
            const insideB = (b[axis] - edge) * direction >= 0;
            if (insideA) next.push(a);
            if (insideA !== insideB) {
                const t = (edge - a[axis]) / (b[axis] - a[axis]);
                next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
        }
        points = next;
    }
    return points;
}

export function createAbyssalQuay() {
    const base = createBastionFoundation();
    base.scale(1, 2.8 / 3.1, 1);
    const parts = [base], pitchX = 4.7, pitchZ = 4.2, joint = .15;
    for (let row = 0; row < 13; row++) for (let column = 0; column < 16; column++) {
        const left = -33 + (column - (row % 2) / 2) * pitchX, back = -28 + row * pitchZ;
        const points = clippedSlab(left + joint, left + pitchX - joint, back + joint, back + pitchZ - joint);
        const area = Math.abs(points.reduce((sum, p, i) => {
            const q = points[(i + 1) % points.length];
            return sum + p[0] * q[1] - q[0] * p[1];
        }, 0)) / 2;
        if (points.length < 3 || area < .45) continue;
        const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
        const stone = new THREE.ExtrudeGeometry(shape, { depth: .16 + ((row * 7 + column * 3) % 3) * .01,
            steps: 1, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 1, curveSegments: 1 });
        stone.rotateX(-Math.PI / 2); stone.translate(0, 2.86, 0); parts.push(stone);
    }
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

export function createAbyssalMooring(start, end) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const middle = a.clone().lerp(b, .5); middle.y = Math.min(a.y, b.y);
    const curve = new THREE.QuadraticBezierCurve3(a, middle, b);
    const count = Math.ceil(curve.getLength() / 1.05), parts = [], up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= count; i++) {
        const t = i / count, center = curve.getPoint(t);
        const link = new THREE.TorusGeometry(.38, .115, 4, 8);
        link.scale(1, 1.5, 1);
        if (i % 2) link.rotateY(Math.PI / 2);
        link.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, curve.getTangent(t)));
        link.translate(center.x, center.y, center.z);
        const unpacked = link.toNonIndexed(); link.dispose(); parts.push(unpacked);
    }
    // An actual bolted pad eye terminates the line on the quay. The former
    // low, outboard endpoint left a floating link and buried the chain in stone.
    const outboard = Math.sign(b.x - a.x), anchorX = b.x + outboard * .35;
    const eye = new THREE.TorusGeometry(.5, .14, 4, 8);
    eye.rotateY(Math.PI / 2); eye.translate(anchorX, b.y, b.z);
    const plate = new THREE.BoxGeometry(1.4, .22, 1.4);
    plate.translate(anchorX, b.y - .57, b.z);
    for (const part of [eye, plate]) {
        parts.push(part.toNonIndexed()); part.dispose();
    }
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
