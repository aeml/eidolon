import * as THREE from 'three';

function archOutline(width = 1, height = 1, Path = THREE.Shape) {
    const shape = new Path();
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height * .1);
    shape.quadraticCurveTo(width * .49, height * .35, 0, height / 2);
    shape.quadraticCurveTo(-width * .49, height * .35, -width / 2, height * .1);
    shape.closePath();
    return shape;
}

// Unit profiles shared by every window and closed service doorway. Geometry
// gives the frame real inner walls; the pane/door sits behind its projecting lip.
// These do not cut traversable openings or change the building's solid walls.
export function createLanternholdArchPanel() {
    const geometry = new THREE.ExtrudeGeometry(archOutline(), { depth: 1, bevelEnabled: false, curveSegments: 5 });
    geometry.translate(0, 0, -.5);
    return geometry;
}

export function createLanternholdArchFrame() {
    const shape = archOutline();
    shape.holes.push(archOutline(.78, .84, THREE.Path));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: true,
        bevelThickness: .035, bevelSize: .018, bevelSegments: 1, curveSegments: 5 });
    geometry.translate(0, 0, -.5);
    return geometry;
}
