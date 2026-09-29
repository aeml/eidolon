import * as THREE from 'three';

// A tensioned cloth roof and scalloped hems in one cached geometry. Static
// folds retain stable shadows and do not require a per-frame cloth simulation.
export function createLanternholdCanopy(width = 10.65, depth = 7.65, eave = 5.55, rise = 1.45) {
    const positions = [], uvs = [], colors = [], indices = [];
    const columns = 32, rows = 8;
    const vertex = (x, y, z, u, v) => {
        positions.push(x, y, z); uvs.push(u, v);
        const panel = Math.floor(u * 8), shade = (panel % 2 ? .88 : 1) * (.94 + .06 * Math.sin(u * Math.PI));
        colors.push(shade, shade, shade);
    };
    const strip = (point, rowCount, reverse) => {
        const start = positions.length / 3;
        for (let j = 0; j <= rowCount; j++) for (let i = 0; i <= columns; i++) {
            const u = i / columns, v = j / rowCount;
            vertex(...point(u, v), u, v);
        }
        for (let j = 0; j < rowCount; j++) for (let i = 0; i < columns; i++) {
            const a = start + j * (columns + 1) + i, b = a + 1, c = a + columns + 1, d = c + 1;
            indices.push(...(reverse ? [a, c, b, b, c, d] : [a, b, c, b, d, c]));
        }
    };
    for (const side of [-1, 1]) {
        strip((u, v) => [(u - .5) * width,
            eave + rise * (1 - v) - Math.sin(v * Math.PI) * .42
                - Math.sin(u * Math.PI) * v * .13 + Math.sin(u * Math.PI * 16) * Math.sin(v * Math.PI) * .035,
            side * v * depth / 2], rows, side > 0);
        strip((u, v) => [(u - .5) * width,
            eave - Math.sin(u * Math.PI) * .13 - v * (.22 + .23 * Math.abs(Math.sin(u * Math.PI * 8))),
            side * (depth / 2 - Math.sin(v * Math.PI) * .035)], 3, side < 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
