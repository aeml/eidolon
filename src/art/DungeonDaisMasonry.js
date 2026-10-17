import * as THREE from 'three';

// Shallow laid stone inside the former radius17.4 octagonal dais. The real
// walk surface stays at server Y0; grout reveals that surface rather than a void.
export function createDungeonDaisMasonry() {
    const radius = 17.4, cell = 5;
    const outline = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4) * radius, Math.sin(i * Math.PI / 4) * radius]);
    const positions = [], uvs = [], colors = [];
    let stones = 0;
    const clip = (polygon, axis, edge, sign) => {
        const result = [];
        let a = polygon.at(-1);
        if (!a) return result;
        for (const b of polygon) {
            const da = (a[axis] - edge) * sign, db = (b[axis] - edge) * sign;
            if ((da <= 0) !== (db <= 0)) {
                const t = (edge - a[axis]) / (b[axis] - a[axis]);
                result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
            }
            if (db <= 0) result.push(b);
            a = b;
        }
        return result;
    };
    const triangle = (a, b, c, shade) => {
        for (const point of [a, b, c]) {
            positions.push(...point); uvs.push(point[0] / 4, point[2] / 4);
            colors.push(shade, shade, shade);
        }
    };
    for (let row = -3; row <= 3; row++) {
        for (let column = -4; column <= 4; column++) {
            const x = column * cell + (Math.abs(row) % 2 ? 1.7 : 0), z = row * cell;
            let polygon = outline;
            for (const [axis, edge, sign] of [[0, x - cell / 2, -1], [0, x + cell / 2, 1],
                [1, z - cell / 2, -1], [1, z + cell / 2, 1]]) polygon = clip(polygon, axis, edge, sign);
            if (polygon.length < 3) continue;
            const area = Math.abs(polygon.reduce((sum, p, i) => {
                const next = polygon[(i + 1) % polygon.length]; return sum + p[0] * next[1] - next[0] * p[1];
            }, 0)) / 2;
            if (area < .08) continue;
            const center = polygon.reduce((sum, p) => [sum[0] + p[0] / polygon.length, sum[1] + p[1] / polygon.length], [0, 0]);
            // Contract convex polygons toward their centroid: stable mortar
            // joints and inward bevels even at clipped diagonal outer corners.
            const bottom = polygon.map(([px, pz]) => [center[0] + (px - center[0]) * .986, .004,
                center[1] + (pz - center[1]) * .986]);
            const height = .021 + (stones % 4) * .001;
            const top = bottom.map(([px, , pz]) => [center[0] + (px - center[0]) * .97, height,
                center[1] + (pz - center[1]) * .97]);
            const shade = .82 + ((stones * 7) % 11) * .016;
            for (let i = 1; i < top.length - 1; i++) triangle(top[0], top[i + 1], top[i], shade);
            for (let i = 0; i < top.length; i++) {
                const next = (i + 1) % top.length;
                triangle(top[i], top[next], bottom[next], shade);
                triangle(top[i], bottom[next], bottom[i], shade);
            }
            stones++;
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.dungeonDaisMasonry = { stones, triangles: positions.length / 9, outerRadius: radius, visualOnly: true };
    return geometry;
}
