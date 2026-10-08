import * as THREE from 'three';

// Low silhouettes that read as ground-cover masses at gameplay distance.
// Opaque folded leaves avoid alpha-card sorting and overdraw; the world uses
// just two shared instanced geometries, not a mesh/material for every blade.
export function createWoodlandUnderstoryGeometry(kind) {
    if (!['bracken', 'sedge'].includes(kind)) throw new Error(`Unknown woodland cover: ${kind}`);
    const positions = [], colors = [];
    let seed = kind === 'bracken' ? 8927 : 3149;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const base = new THREE.Color(kind === 'bracken' ? 0x253822 : 0x263727);
    const tip = new THREE.Color(kind === 'bracken' ? 0x657546 : 0x607346);
    const triangle = (a, b, c, tone = 1) => {
        for (const point of [a, b, c]) {
            positions.push(...point);
            const color = base.clone().lerp(tip, Math.min(1, .2 + point[1] * 1.1)).multiplyScalar(tone);
            colors.push(color.r, color.g, color.b);
        }
    };
    const offset = (p, dx, dz, width, lift = 0) => [p[0] + dx * width, Math.max(0, p[1] + lift), p[2] + dz * width];
    const count = kind === 'bracken' ? 7 : 16;
    for (let blade = 0; blade < count; blade++) {
        const angle = blade * 2.39996323 + random() * .5;
        const dx = Math.cos(angle), dz = Math.sin(angle), sx = -dz, sz = dx;
        const height = .38 + random() * .34;
        const reach = kind === 'bracken' ? .95 + random() * .37 : .45 + random() * .55;
        const originRadius = kind === 'bracken' ? .07 : Math.sqrt(random()) * .43;
        const originAngle = random() * Math.PI * 2;
        const ox = Math.cos(originAngle) * originRadius, oz = Math.sin(originAngle) * originRadius;
        const curve = t => [ox + dx * reach * t,
            Math.sin(t * Math.PI * (kind === 'sedge' ? .96 : .86)) * height, oz + dz * reach * t];
        // Three bent sections retain the silhouette at gameplay scale.
        const tone = .85 + random() * .25;
        // Woodland sedge has a narrow rooted base, a broad arching leaf and
        // a hanging tip, not sixteen identical thin upright grass strips.
        // Vary width without consuming extra random values (fern geometry
        // and the existing leaf directions/lengths remain unchanged).
        const width = kind === 'bracken' ? .012 : .035 + .055 * (.5 + .5 * Math.sin(blade * 2.39996323 + .7));
        const halfWidth = t => t === 1 ? 0 : width * (kind === 'bracken' ? 1 - t : Math.sin(Math.PI * (.12 + .88 * t)));
        // Twist the broad sheet gently through the arch so all sixteen leaves
        // do not present the same flat lit face. The rooted base and terminal
        // tip stay fixed; keep the existing triangles and clearance envelope.
        const edge = (point, t, signedWidth) => offset(point, sx, sz, signedWidth,
            kind === 'sedge' ? signedWidth * Math.sin(t * Math.PI) * Math.sin(blade * 1.7 + t * 2.2) * .7 : 0);
        for (let segment = 0; segment < 3; segment++) {
            const t = segment / 3, next = (segment + 1) / 3;
            const a = curve(t), b = curve(next);
            const wa = halfWidth(t), wb = halfWidth(next);
            triangle(edge(a, t, -wa), edge(a, t, wa), edge(b, next, -wb), tone);
            if (wb) triangle(edge(a, t, wa), edge(b, next, wb), edge(b, next, -wb), tone);
        }
        if (kind !== 'bracken') continue;
        for (let leaf = 1; leaf <= 7; leaf++) {
            const t = leaf / 8, origin = curve(t);
            const length = Math.sin(t * Math.PI) * .32;
            for (const side of [-1, 1]) {
                const end = offset(origin, sx * side, sz * side, length, -.025);
                end[0] += dx * .14; end[2] += dz * .14;
                const mid = origin.map((value, i) => (value + end[i]) / 2);
                const left = offset(mid, dx, dz, -.065, -.02);
                const right = offset(mid, dx, dz, .065, -.02);
                triangle(origin, left, end, tone);
                triangle(origin, end, right, tone * .85);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
