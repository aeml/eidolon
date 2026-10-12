import * as THREE from 'three';

// The original readable face and footprint stay fixed. Local stonework gives
// each realm a different crown without moving the inscription or approach.
export function createInscribedWaystoneGeometry(realm) {
    const shape = new THREE.Shape();
    shape.moveTo(-.5, .05);
    shape.lineTo(.5, .05);
    shape.lineTo(.5, 1.82);
    if (realm === 'water') {
        shape.quadraticCurveTo(.5, 2.15, 0, 2.15);
        shape.quadraticCurveTo(-.5, 2.15, -.5, 1.82);
    } else if (realm === 'fire') {
        shape.lineTo(.27, 2.15);
        shape.lineTo(.08, 2.03);
        shape.lineTo(-.12, 2.15);
        shape.lineTo(-.5, 1.95);
    } else {
        shape.lineTo(.24, 2.15);
        shape.lineTo(-.25, 2.15);
        shape.lineTo(-.5, 1.88);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: .6, bevelEnabled: true, bevelSize: .05,
        bevelThickness: .05, bevelSegments: 1, steps: 1, curveSegments: 4
    });
    geometry.translate(0, 0, -.3);
    geometry.computeBoundingBox();
    // A bevel miter can extend a sharp crown beyond its drawn profile. Keep
    // the original 2.2 m body envelope, including those outward-facing edges.
    if (geometry.boundingBox.max.y > 2.2) {
        geometry.scale(1, 2.2 / geometry.boundingBox.max.y, 1);
        geometry.computeBoundingBox();
    }
    geometry.computeBoundingSphere();
    return geometry;
}
