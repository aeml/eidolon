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
    // The source shelf is scaled from 3.1m to 3m in the entrance. Seat the
    // plate slightly into those actual stones, not above their source height.
    plate.translate(anchorX, b.y - .67, b.z);
    const outward = Math.sign(b.z - a.z), wallZ = a.z - outward * .35;
    const wallEye = new THREE.TorusGeometry(.5, .14, 4, 8);
    wallEye.translate(a.x, a.y, wallZ);
    const wallPlate = new THREE.BoxGeometry(1.4, 1.4, .22);
    wallPlate.translate(a.x, a.y, wallZ - outward * .75);
    const bracket = new THREE.BoxGeometry(.5, .3, .75);
    bracket.translate(a.x, a.y - .5, wallZ - outward * .375);
    for (const part of [eye, plate, wallEye, wallPlate, bracket]) {
        parts.push(part.toNonIndexed()); part.dispose();
    }
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

export function createAbyssalShellCrown() {
    const positions = [], uvs = [], indices = [], slices = 36, courses = 5;
    const stride = slices + 1, faceSize = stride * (courses + 1);
    for (const sign of [1, -1]) for (let course = 0; course <= courses; course++) {
        const r = course / courses;
        for (let slice = 0; slice <= slices; slice++) {
            const angle = -Math.PI / 2 + slice / slices * Math.PI;
            const x = .5 * r * Math.sin(angle), y = -.5 + r * Math.cos(angle);
            const relief = .035 + .07 * Math.sin(r * Math.PI / 2) + .025 * r * Math.cos(angle * 12);
            positions.push(x, y, sign * relief); uvs.push(x + .5, y + .5);
        }
    }
    for (let face = 0; face < 2; face++) for (let course = 0; course < courses; course++) {
        for (let slice = 0; slice < slices; slice++) {
            const a = face * faceSize + course * stride + slice;
            const b = a + stride, c = b + 1, d = a + 1;
            indices.push(...(face === 0 ? [a, c, b] : [a, b, c]));
            if (course > 0) indices.push(...(face === 0 ? [a, d, c] : [a, c, d]));
        }
    }
    // Join the curved outer edge and both lower edges. The two faces form a
    // solid sculpted stone fan, with physical radial flutes and a rolled lip.
    for (let slice = 0; slice < slices; slice++) {
        const a = courses * stride + slice, b = a + 1;
        indices.push(a, b, b + faceSize, a, b + faceSize, a + faceSize);
    }
    for (const slice of [0, slices]) for (let course = 0; course < courses; course++) {
        const a = course * stride + slice, b = a + stride;
        indices.push(...(slice === 0
            ? [a, b, b + faceSize, a, b + faceSize, a + faceSize]
            : [a, a + faceSize, b + faceSize, a, b + faceSize, b]));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
