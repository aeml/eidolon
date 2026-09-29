import * as THREE from 'three';

export const wreckHullHalfWidth = z => 2.6 * Math.sqrt(Math.max(.04, 1 - (z / 6.6) ** 2));

// Salt-bleached oak above a dark tide stain, with broad plank-to-plank
// variation that survives gameplay zoom. Linear vertex colors, not brickwork.
export function weatherWreckWood(geometry, seed = 0) {
    const p = geometry.attributes.position, colors = [];
    const dry = new THREE.Color(0x97876a), wet = new THREE.Color(0x36453e), color = new THREE.Color();
    const tone = .78 + (.5 + .5 * Math.sin(seed * 19.31)) * .28;
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i), z = p.getZ(i);
        const stain = 1 - THREE.MathUtils.smoothstep(y, .4, 1.35 + Math.sin(z * .7 + seed) * .14);
        color.copy(dry).lerp(wet, stain * .85).multiplyScalar(tone * (.94 + .06 * Math.sin(z * 1.7 + seed)));
        colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
}

// Rectangular ship frames, not round hoses. The path stays inside the old
// collision volume, including both the gunwale and the low keel joint.
export function createWreckRib(along, quality = 'high') {
    const width = wreckHullHalfWidth(along);
    const curve = new THREE.CatmullRomCurve3([[-width, 2.78, along], [-width * .55, 1.08, along],
        [0, .43, along], [width * .55, 1.08, along], [width, 2.78, along]].map(p => new THREE.Vector3(...p)));
    const profile = new THREE.Shape([[-.12, -.14], [.12, -.14], [.12, .14], [-.12, .14]].map(p => new THREE.Vector2(...p)));
    profile.closePath();
    const geometry = new THREE.ExtrudeGeometry(profile, { extrudePath: curve,
        steps: quality === 'low' ? 10 : 18, bevelEnabled: false, curveSegments: 1 });
    geometry.computeBoundingBox();
    return weatherWreckWood(geometry, along + 17);
}

export function createTornWreckSail() {
    // A tied top and alternating long tears at the foot. Interior bands give
    // the folds lighting normals instead of a single flat quad.
    const columns = 12, rows = 10, positions = [], colors = [], uv = [], indices = [];
    const cloth = new THREE.Color(0xbeb49a), patch = new THREE.Color(0x82755f), tone = new THREE.Color();
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
        const u = col / columns, v = row / rows;
        const tornFoot = [-2.2, -1.85, -2.4, -.95, -2.15, -2.3, -1.6, -2.35, -.8, -2.15, -1.65, -2.05, -1.1][col];
        const x = (u - .5) * (3.8 - (1 - v) * .2), y = tornFoot + (2.5 - tornFoot) * v;
        positions.push(x, y, Math.sin(u * Math.PI) * .4 + Math.sin(u * 5 * Math.PI) * .13 * (1 - v));
        uv.push(u, v);
        const repair = col >= 7 && col <= 9 && row >= 4 && row <= 7;
        tone.copy(repair ? patch : cloth).multiplyScalar(.83 + .17 * v);
        colors.push(tone.r, tone.g, tone.b);
        if (row < rows && col < columns) {
            const a = row * (columns + 1) + col, b = a + columns + 1;
            indices.push(a, a + 1, b + 1, a, b + 1, b);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox();
    return geometry;
}

// A closed, curved timber strip rather than a flat board or a walkable deck.
// Authored gaps between strips leave the wreck's ribs and broken ends visible.
export function createWreckPlank(side, band, start, end, quality = 'high') {
    const segments = quality === 'low' ? 6 : 12, positions = [], uv = [], indices = [];
    const low = .18 + band * .25, high = low + .21;
    for (let i = 0; i <= segments; i++) {
        const along = start + (end - start) * i / segments;
        for (const [t, thickness] of [[low, .055], [high, .055], [high, -.055], [low, -.055]]) {
            const breakIn = .07 + (t === high ? .21 : .035) * (1 + .3 * Math.sin(band * 7 + side));
            const z = along + (i === 0 ? breakIn : i === segments ? -breakIn : 0);
            positions.push(side * (wreckHullHalfWidth(z) * t + thickness), .4 + 2.4 * t * t, z);
            uv.push((z - start) / 2, t);
        }
        if (i < segments) for (let edge = 0; edge < 4; edge++) {
            const a = i * 4 + edge, b = i * 4 + (edge + 1) % 4;
            indices.push(a, b, b + 4, a, b + 4, a + 4);
        }
    }
    const tail = segments * 4;
    indices.push(0, 2, 1, 0, 3, 2, tail, tail + 1, tail + 2, tail, tail + 2, tail + 3);
    if (side < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox();
    return weatherWreckWood(geometry, band * 5 + side * 3 + start);
}

// Carved flood-measuring ribs. All geometry stays overhead; the old 3x3 pier
// solids remain the authority. A low elliptical crown fits normal camera views.
export function createTideRibStone(index, count = 15) {
    const start = index / count * Math.PI + .004, end = (index + 1) / count * Math.PI - .004;
    const outer = 10.65, inner = 9.35, shape = new THREE.Shape();
    shape.moveTo(Math.cos(start) * outer, Math.sin(start) * outer);
    shape.absarc(0, 0, outer, start, end, false);
    shape.lineTo(Math.cos(end) * inner, Math.sin(end) * inner);
    shape.absarc(0, 0, inner, end, start, true); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .9, bevelEnabled: true,
        bevelSegments: 1, steps: 1, bevelSize: .055, bevelThickness: .055, curveSegments: 3 });
    geometry.scale(1, .55, 1); geometry.translate(0, 7, -.45);
    geometry.computeBoundingBox();
    return geometry;
}
