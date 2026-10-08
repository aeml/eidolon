import * as THREE from 'three';

// Six wind-swept shoots with paired, folded oval leaves. Both settings retain
// all48 leaves and their exact tips/edges; Low removes each leaf's central fold
// and halves stem subdivisions, not the shrub's silhouette or placement.
export function createAirHeathGeometry(variant, quality = 'high') {
    const low = quality === 'low', positions = [], colors = [];
    const base = new THREE.Color(0x3b5148), tip = new THREE.Color(variant % 2 ? 0x71866e : 0x81907c);
    const triangle = (a, b, c, shade = 1) => {
        for (const point of [a, b, c]) {
            positions.push(...point);
            const color = base.clone().lerp(tip, Math.min(1, point[1] * 1.3)).multiplyScalar(shade);
            colors.push(color.r, color.g, color.b);
        }
    };
    for (let shoot = 0; shoot < 6; shoot++) {
        const angle = shoot * 2.399963229728653 + variant * .61;
        const dx = Math.cos(angle), dz = Math.sin(angle), sx = -dz, sz = dx;
        const height = .38 + (shoot + variant) % 3 * .07;
        const reach = .22 + shoot % 3 * .065;
        const curve = t => [dx * reach * t + .24 * t * t, height * t - .04 * t * t,
            dz * reach * t - .08 * t * t];
        for (let segment = 0; segment < (low ? 1 : 2); segment++) {
            const a = curve(segment / (low ? 1 : 2)), b = curve((segment + 1) / (low ? 1 : 2));
            const edge = point => [point[0] + sx * .012, point[1], point[2] + sz * .012];
            triangle(a, edge(a), b, .75); triangle(edge(a), edge(b), b, .75);
        }
        for (let level = 0; level < 4; level++) for (const side of [-1, 1]) {
            const root = curve(.22 + level * .2), leafAngle = angle + side * 1.05;
            const lx = Math.cos(leafAngle), lz = Math.sin(leafAngle);
            const length = .18 - level * .018, width = .065 - level * .006;
            const left = [root[0] - lz * width, root[1], root[2] + lx * width];
            const right = [root[0] + lz * width, root[1], root[2] - lx * width];
            const end = [root[0] + lx * length, root[1] + .035, root[2] + lz * length];
            const fold = [root[0] + lx * .025, root[1] + .02, root[2] + lz * .025];
            if (low) triangle(left, right, end);
            else { triangle(left, fold, end); triangle(fold, right, end, .88); }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
