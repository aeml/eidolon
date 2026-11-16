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

// A thin forged weathercock: a broad split tail balances its spear-shaped
// pointer. Rolled edges catch the light without turning the instrument into
// a solid cone. Its envelope fits the original overhead crossbar and arrow.
export function createWindVaneNeedle() {
    const shape = new THREE.Shape();
    const outline = [[-2.15, -.48], [-1.2, -.25], [.8, -.13], [.8, -.5],
        [2.65, 0], [.8, .5], [.8, .13], [-1.2, .25], [-2.15, .48], [-1.85, 0]];
    shape.moveTo(...outline[0]);
    for (const point of outline.slice(1)) shape.lineTo(...point);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .09,
        bevelEnabled: true, bevelSize: .02, bevelThickness: .02,
        bevelSegments: 1, steps: 1, curveSegments: 1 });
    geometry.translate(0, 0, -.045);
    geometry.computeBoundingBox();
    return geometry;
}
