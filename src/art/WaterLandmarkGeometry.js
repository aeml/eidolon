import * as THREE from 'three';

export const wreckHullHalfWidth = z => 2.6 * Math.sqrt(Math.max(.04, 1 - (z / 6.6) ** 2));

// A closed, curved timber strip rather than a flat board or a walkable deck.
// Authored gaps between strips leave the wreck's ribs and broken ends visible.
export function createWreckPlank(side, band, start, end, quality = 'high') {
    const segments = quality === 'low' ? 6 : 12, positions = [], uv = [], indices = [];
    const low = .18 + band * .25, high = low + .21;
    for (let i = 0; i <= segments; i++) {
        const z = start + (end - start) * i / segments;
        for (const [t, thickness] of [[low, .055], [high, .055], [high, -.055], [low, -.055]]) {
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
    return geometry;
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
