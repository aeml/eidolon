import * as THREE from 'three';

// Closed expedition stores: all fabric stays inside the original walk solid.
// A tensioned ridge and hipped ends replace the box/pyramid silhouette. Panels
// share pinned edges; shallow folds are static geometry, not cloth simulation.
export function createDarkCampShelterGeometry(quality = 'high') {
    const low = quality === 'low', positions = [], colors = [], uvs = [], indices = [];
    const vertex = (point, u, v, roof = false, front = false) => {
        const index = positions.length / 3;
        positions.push(...point); uvs.push(u, v);
        const hem = roof ? Math.max(0, (u - .85) / .15) : (1 - v) ** 3;
        const weather = .07 * Math.sin(u * 7.1 + v * 3.7) * Math.sin(v * 5.3 - u * 2);
        const placket = front ? Math.max(0, 1 - Math.abs(u - .5) * 20) * .1 : 0;
        const seam = roof ? Math.max(0, 1 - Math.min(v, 1 - v) * 18) * .055 : Math.max(0, 1 - v * 12) * .025;
        const tone = .94 + weather - hem * .12 - placket - seam;
        colors.push(tone, tone * .99, tone * .97);
        return index;
    };
    const triangle = (a, b, c, outward) => {
        const ax = positions[b * 3] - positions[a * 3], ay = positions[b * 3 + 1] - positions[a * 3 + 1], az = positions[b * 3 + 2] - positions[a * 3 + 2];
        const bx = positions[c * 3] - positions[a * 3], by = positions[c * 3 + 1] - positions[a * 3 + 1], bz = positions[c * 3 + 2] - positions[a * 3 + 2];
        const dot = (ay * bz - az * by) * outward[0] + (az * bx - ax * bz) * outward[1] + (ax * by - ay * bx) * outward[2];
        indices.push(...(dot > 0 ? [a, b, c] : [a, c, b]));
    };
    const grid = (columns, rows, point, outward, roof = false, front = false) => {
        const start = positions.length / 3;
        for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
            const u = column / columns, v = row / rows;
            vertex(point(u, v), u, v, roof, front);
            if (row < rows && column < columns) {
                const a = start + row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
                // Indices may refer to later vertices; orient after allocation.
                faces.push([a, b, c, outward], [b, d, c, outward]);
            }
        }
    };
    const faces = [];
    for (const side of [-1, 1]) {
        grid(low ? 4 : 6, low ? 6 : 10, (u, v) => [side * u * 3.2,
            4.7 - u * 2.6 - Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * (.2 + .035 * Math.sin(v * Math.PI * 6)),
            (v * 2 - 1) * (1.4 + u * 1.8)], [side, 1, 0], true);
        for (const axis of ['x', 'z']) grid(low ? 6 : 10, low ? 3 : 4, (u, v) => {
            const inset = .12 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * (.65 + .35 * Math.sin(u * Math.PI * 6));
            const along = (u * 2 - 1) * 3.2, at = side * (3.2 - inset), y = .1 + v * 2;
            return axis === 'x' ? [at, y, along] : [along, y, at];
        }, axis === 'x' ? [side, 0, 0] : [0, 0, side], false, axis === 'z' && side > 0);
        const count = low ? 4 : 8, rows = [];
        for (let row = 0; row <= count; row++) {
            rows.push(positions.length / 3);
            for (let column = 0; column <= row; column++) {
                const u = row / count, v = row ? column / row : .5;
                vertex([(2 * column - row) / count * 3.2,
                    4.7 - u * 2.6 - .1 * Math.sin(u * Math.PI) * (1 - (v * 2 - 1) ** 2),
                    side * (1.4 + u * 1.8)], u, v, true);
            }
        }
        for (let row = 0; row < count; row++) for (let column = 0; column <= row; column++) {
            const a = rows[row] + column, b = rows[row + 1] + column, c = b + 1;
            faces.push([a, b, c, [0, 1, side]]);
            if (column < row) faces.push([a, c, a + 1, [0, 1, side]]);
        }
    }
    for (const face of faces) triangle(...face);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
