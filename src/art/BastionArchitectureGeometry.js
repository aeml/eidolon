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

const FOUNDATION_OUTLINE = [[-33, -26], [-22, -28], [9, -27], [31, -24], [33, -13],
    [31, 8], [33, 21], [25, 25], [13, 23], [-12, 24], [-29, 23], [-33, 15]];

export function createBastionFoundation() {
    // Preserve the shared drowned-shelf geometry byte for byte.
    return horizontalStone(FOUNDATION_OUTLINE, 2.5, .3);
}

function clipFoundationStone(left, right, back, front) {
    let points = FOUNDATION_OUTLINE.map(point => [...point]);
    for (const [axis, boundary, direction] of [[0, left, 1], [0, right, -1], [1, back, 1], [1, front, -1]]) {
        const next = [];
        for (let i = 0; i < points.length; i++) {
            const a = points[i], b = points[(i + 1) % points.length];
            const aInside = (a[axis] - boundary) * direction >= 0;
            const bInside = (b[axis] - boundary) * direction >= 0;
            if (aInside) next.push(a);
            if (aInside !== bInside) {
                const t = (boundary - a[axis]) / (b[axis] - a[axis]);
                next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
        }
        points = next;
    }
    return points;
}

// A bonded top over the existing footing, rather than a single broad slab.
// Keep the old XZ outline and 3.1m top envelope. Every course joins the same
// geometry/material batch; bevels and recessed mortar provide actual relief.
export function createBondedBastionFoundation() {
    const parts = [horizontalStone(FOUNDATION_OUTLINE, 2.25, .3)];
    const pitchX = 4.4, pitchZ = 3.2, joint = .12;
    for (let row = 0; row < 17; row++) {
        const back = -28 + row * pitchZ;
        const origin = -33 - (row % 2) * pitchX / 2;
        for (let column = 0; column < 16; column++) {
            const left = origin + column * pitchX;
            const points = clipFoundationStone(left + joint, left + pitchX - joint,
                back + joint, back + pitchZ - joint);
            const area = Math.abs(points.reduce((sum, p, i) => {
                const q = points[(i + 1) % points.length];
                return sum + p[0] * q[1] - q[0] * p[1];
            }, 0)) / 2;
            if (points.length < 3 || area < .4) continue;
            const height = .14 + ((row * 11 + column * 7) % 4) * .02;
            const stone = horizontalStone(points, height, .055);
            stone.translate(0, 2.79, 0); parts.push(stone);
        }
    }
    const result = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    result.computeBoundingBox(); result.computeBoundingSphere();
    return result;
}

export function createBastionRamp() {
    const parts = [];
    // Retain the old 22 x 2 x 23 envelope. Recessed mortar and bevels make
    // the joints physical; one merged mesh keeps individual stones off the
    // draw list. Stagger the courses without extending the ramp's footprint.
    const base = new THREE.BoxGeometry(22, 1.85, 23).toNonIndexed();
    base.translate(0, -.075, 0); parts.push(base);
    for (let row = 0; row < 8; row++) {
        for (let column = 0; column < (row % 2 ? 9 : 8); column++) {
            const left = Math.max(-11, -11 + (column - (row % 2) * .5) * 2.75) + .08;
            const right = Math.min(11, -11 + (column + 1 - (row % 2) * .5) * 2.75) - .08;
            const back = -11.5 + row * 2.875 + .08, front = back + 2.715;
            const chip = .055 + ((row * 13 + column * 7) % 6) * .017;
            const stone = horizontalStone([
                [left + chip, back], [right - chip, back], [right, back + chip],
                [right, front - chip], [right - chip, front], [left + chip, front],
                [left, front - chip], [left, back + chip]
            ], .1, .05);
            stone.translate(0, .8, 0);
            parts.push(stone);
        }
    }
    const result = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    return result;
}

function fitWall(geometry, width, height, depth) {
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox, size = bounds.getSize(new THREE.Vector3());
    geometry.translate(-bounds.min.x, -bounds.min.y, -bounds.min.z);
    geometry.scale(width / size.x, height / size.y, depth / size.z);
    geometry.translate(-width / 2, -height / 2, -depth / 2);
    return geometry;
}

function ruinedWall(width, height, depth) {
    const w = width / 2, h = height / 2;
    const shape = new THREE.Shape([
        [-w, -h], [w, -h], [w, h - .9], [w * .66, h - .9],
        [w * .6, h], [w * .4, h - .3], [0, h - .6],
        [-w * .3, h - .4], [-w * .36, h], [-w, h - .2]
    ].map(([x, y]) => new THREE.Vector2(x, y)));
    return fitWall(new THREE.ExtrudeGeometry(shape, { depth, steps: 1,
        bevelEnabled: true, bevelSize: .18, bevelThickness: .18,
        bevelSegments: 1, curveSegments: 1 }), width, height, depth);
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
    fitWall(front, 42, 24, 3).translate(0, 15, 5.5);
    parts.push(front);
    // Weathered edges catch the existing lighting instead of leaving the rear
    // and side walls as broad square boxes. Keep their exact old envelopes.
    parts.push(ruinedWall(42, 22, 3).translate(0, 14, -15.5));
    for (const [x, height, y] of [[-19.5, 23, 14.5], [19.5, 21, 13.5]]) {
        const side = ruinedWall(21, height, 3);
        side.rotateY(Math.PI / 2); side.translate(x, y, -5); parts.push(side);
    }
    const floor = new THREE.BoxGeometry(39, 1, 21).toNonIndexed();
    floor.translate(0, 3.5, -5); parts.push(floor);
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
