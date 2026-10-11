import * as THREE from 'three';

// Average only connected faces of one bent leaf ribbon. Keep distinct leaves
// and each folded fern leaflet separate even where rooted vertices meet.
// Positions, colors and triangle count stay intact; work happens at creation.
function smoothRibbonNormals(geometry, ranges) {
    const { position, normal } = geometry.attributes;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const [start, end] of ranges) {
        const joined = new Map();
        for (let i = start; i < end; i += 3) {
            a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
            const face = b.sub(a).cross(c.sub(a));
            for (let vertex = i; vertex < i + 3; vertex++) {
                const key = `${position.getX(vertex)},${position.getY(vertex)},${position.getZ(vertex)}`;
                if (!joined.has(key)) joined.set(key, { sum: new THREE.Vector3(), vertices: [] });
                const entry = joined.get(key); entry.sum.add(face); entry.vertices.push(vertex);
            }
        }
        for (const { sum, vertices } of joined.values()) {
            sum.normalize();
            for (const vertex of vertices) normal.setXYZ(vertex, sum.x, sum.y, sum.z);
        }
    }
}

// Low silhouettes that read as ground-cover masses at gameplay distance.
// Opaque folded leaves avoid alpha-card sorting and overdraw; the world uses
// just two shared instanced geometries, not a mesh/material for every blade.
export function createWoodlandUnderstoryGeometry(kind, { quality = 'high' } = {}) {
    if (!['bracken', 'sedge'].includes(kind)) throw new Error(`Unknown woodland cover: ${kind}`);
    if (!['high', 'low'].includes(quality)) throw new Error(`Unknown woodland quality: ${quality}`);
    const sections = quality === 'low' ? 2 : 3;
    const positions = [], colors = [], ribbons = [];
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
        const height = kind === 'bracken' ? .38 + random() * .34 : .20 + random() * .24;
        const reach = kind === 'bracken' ? .95 + random() * .37 : .68 + random() * .32;
        const originRadius = kind === 'bracken' ? .07 : Math.sqrt(random()) * .30;
        const originAngle = random() * Math.PI * 2;
        const ox = Math.cos(originAngle) * originRadius, oz = Math.sin(originAngle) * originRadius;
        // Sedge spreads into low arching fans. The old tall, short leaves
        // read as repeated corn-like tufts, disconnected from the ground bed.
        // Side curvature breaks radial spokes without another leaf or mesh.
        const bend = kind === 'sedge' ? Math.sin(blade * 1.91) * .18 : 0;
        const curve = t => [ox + dx * reach * t + sx * bend * Math.sin(Math.PI * t),
            Math.sin(t * Math.PI * (kind === 'sedge' ? .96 : .86)) * height,
            oz + dz * reach * t + sz * bend * Math.sin(Math.PI * t)];
        // Low keeps every leaf, root, tip and fern leaflet, with one fewer
        // interior ribbon subdivision. High's authored recipe stays intact.
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
        const ribbonStart = positions.length / 3;
        for (let segment = 0; segment < sections; segment++) {
            const t = segment / sections, next = (segment + 1) / sections;
            const a = curve(t), b = curve(next);
            const wa = halfWidth(t), wb = halfWidth(next);
            triangle(edge(a, t, -wa), edge(a, t, wa), edge(b, next, -wb), tone);
            if (wb) triangle(edge(a, t, wa), edge(b, next, wb), edge(b, next, -wb), tone);
        }
        ribbons.push([ribbonStart, positions.length / 3]);
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
                // One continuous folded pinna, rather than two flat triangles
                // with different baked colors along their shared spine.
                const pinnaStart = positions.length / 3;
                triangle(origin, left, end, tone);
                triangle(origin, end, right, tone);
                ribbons.push([pinnaStart, positions.length / 3]);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); smoothRibbonNormals(geometry, ribbons);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
}
