import * as THREE from 'three';

// Flat, bevelled instrument bands rather than rope-like torus tubes. The
// caller supplies orientation; rings share a low centre and stay overhead.
export function createHorizonRing(radius = 4.5, quality = 'high') {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, radius - .24, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .14,
        bevelEnabled: true, bevelSize: .025, bevelThickness: .025,
        bevelSegments: 1, steps: 1, curveSegments: quality === 'low' ? 18 : 28 });
    geometry.translate(0, 0, -.07);
    geometry.computeBoundingBox();
    return geometry;
}
