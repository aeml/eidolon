import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createLanternholdTentFrame() {
    const parts = [new THREE.BoxGeometry(.16, .16, 2.9).translate(0, 2.43, 0),
        ...[-1.35, 1.35].map(z => new THREE.BoxGeometry(.12, 2.41, .12).translate(0, 1.225, z))];
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}

// Static canvas in the original3m tent footprint. Real folds and an open front,
// not a solid cone or simulated cloth. Both pieces are immutable cached meshes.
export function createLanternholdTentCanvas({ entrance = false } = {}) {
    const positions = [], colors = [], uvs = [], indices = [];
    const columns = 12, rows = entrance ? 5 : 8;
    const vertex = (x, y, z, u, v) => {
        positions.push(x, y, z); uvs.push(u, v);
        const seam = Math.abs(u * 6 - Math.round(u * 6)) < .03 ? .88 : 1;
        const wear = (.94 + .06 * Math.sin(u * Math.PI)) * (.86 + .14 * (1 - v));
        colors.push(seam * wear, seam * wear, seam * wear);
    };
    const strip = (point, reverse) => {
        const start = positions.length / 3;
        for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
            const u = i / columns, v = j / rows;
            vertex(...point(u, v), u, v);
        }
        for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
            const a = start + j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
            indices.push(...(reverse ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
        }
    };
    for (const side of [-1, 1]) {
        if (entrance) strip((u, v) => {
            const inner = .12 * (1 - v) + .45 * v, outer = .18 * (1 - v) + 1.45 * v;
            return [side * (inner + (outer - inner) * u), .02 + 2.32 * (1 - v),
                1.47 - Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 3) * .06 - .06];
        }, side > 0);
        else strip((u, v) => [side * v * 1.47,
            .02 + 2.5 * (1 - v) - Math.sin(u * Math.PI) * ((1 - v) * .06 + Math.sin(v * Math.PI) * .18)
                + Math.sin(u * Math.PI * 8) * Math.sin(v * Math.PI) * .025,
            (u - .5) * 2.94], side < 0);
    }
    if (!entrance) {
        // Closed back, one shared apex and no zero-area triangles at the peak.
        const start = positions.length / 3;
        for (let j = 0; j < rows; j++) for (let i = 0; i <= columns; i++) {
            const u = i / columns, v = j / rows;
            vertex((u * 2 - 1) * 1.47 * (1 - v), .02 + v * 2.5,
                -1.47 + Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * .06, u, v);
        }
        for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns; i++) {
            const a = start + j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
            indices.push(a, c, b, b, c, d);
        }
        const apex = positions.length / 3;
        vertex(0, 2.52, -1.47, .5, 1);
        for (let i = 0; i < columns; i++) {
            const a = start + (rows - 1) * (columns + 1) + i;
            indices.push(a, apex, a + 1);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
