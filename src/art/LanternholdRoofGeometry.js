import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Local slope coordinates match the old slab's bounds. Physical overlaps and
// broken lower edges provide silhouette/lighting, not a second painted tile grid.
export function createLappedSlateRoof(width, length) {
    const positions = [], colors = [], uvs = [];
    const triangle = (a, b, c, tone) => {
        for (const point of [a, b, c]) {
            positions.push(...point); colors.push(tone, tone * 1.015, tone * 1.035);
            uvs.push(point[0] / width + .5, point[2] / length + .5);
        }
    };
    const rows = Math.ceil(length / .72), rowDepth = length / rows;
    const columns = Math.ceil(width / .85), tileWidth = width / columns;
    for (let row = 0; row < rows; row++) for (let column = -1; column < columns; column++) {
        const shift = row % 2 ? .5 : 0;
        const left = Math.max(-width / 2, -width / 2 + (column + shift) * tileWidth + .012);
        const right = Math.min(width / 2, -width / 2 + (column + shift + 1) * tileWidth - .012);
        if (right - left < .06) continue;
        const seed = ((Math.imul(row + 31, 73856093) ^ Math.imul(column + 71, 19349663)) >>> 0) / 4294967296;
        const near = -length / 2 + row * rowDepth;
        const far = Math.min(length / 2, near + rowDepth + .07);
        const chip = Math.min((right - left) * .22, .025 + seed * .07);
        const backY = .025, frontY = .105 + seed * .035;
        const points = [[left, backY, near], [left, frontY, far - chip], [left + chip, frontY, far],
            [right - chip * .5, frontY, far], [right, frontY, far - chip * .5], [right, backY, near]];
        const tone = .74 + seed * .3;
        for (let i = 1; i < points.length - 1; i++) triangle(points[0], points[i], points[i + 1], tone);
        for (let i = 1; i < 4; i++) {
            const a = points[i], b = points[i + 1], bottomA = [a[0], a[1] - .07, a[2]], bottomB = [b[0], b[1] - .07, b[2]];
            triangle(a, bottomA, bottomB, tone * .72); triangle(a, bottomB, b, tone * .72);
        }
    }
    const slates = new THREE.BufferGeometry();
    slates.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    slates.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    slates.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    slates.computeVertexNormals();
    const backing = new THREE.BoxGeometry(width, .14, length).toNonIndexed();
    backing.translate(0, -.12, 0);
    backing.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(backing.attributes.position.count * 3).fill(.55), 3));
    const result = mergeGeometries([backing, slates], false);
    backing.dispose(); slates.dispose();
    result.computeBoundingBox(); result.computeBoundingSphere();
    return result;
}

export function createDormerGable() {
    const shape = new THREE.Shape();
    shape.moveTo(-1.05, 0); shape.lineTo(1.05, 0); shape.lineTo(0, .78); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: false, curveSegments: 1 });
}
