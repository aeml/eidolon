import * as THREE from 'three';

// Flat forged webs and edge flanges distinguish the kiln frame from Water's
// carved stone ribs. The low crown fits the normal camera and stays overhead.
export function createKilnArchBeam(flange = false) {
    const outer = flange ? 10.6 : 10.42, inner = flange ? 9.4 : 9.58;
    const depth = flange ? .12 : 1, shape = new THREE.Shape();
    shape.moveTo(outer, 0); shape.absarc(0, 0, outer, 0, Math.PI, false);
    shape.lineTo(-inner, 0); shape.absarc(0, 0, inner, Math.PI, 0, true); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true,
        bevelSize: .035, bevelThickness: .035, bevelSegments: 1, steps: 1, curveSegments: 18 });
    geometry.scale(1, .55, 1); geometry.translate(0, 7, -depth / 2);
    geometry.computeBoundingBox();
    return geometry;
}
