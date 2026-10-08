import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function finish(geometry, name) {
    // One material per shared part; ExtrudeGeometry's cap/side material groups
    // are not a separate finish and must not become extra draw groups.
    geometry.clearGroups();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    geometry.userData.dungeonVigilGeometry = name;
    return geometry;
}

// Shared kit-local shapes: physical bevels/mouldings, not per-room textures or
// more draw groups. Radial construction is deliberately quiet under witchlight.
function turned(profile, name) {
    return finish(new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(...point)), 12), name);
}

export function createDungeonVigilBase() {
    return turned([[0, -.5], [.48, -.5], [.5, -.42], [.5, -.24], [.46, -.16],
        [.39, -.16], [.39, .06], [.43, .12], [.43, .26], [.39, .34], [.3, .34],
        [.3, .5], [0, .5]], 'stepped-foot');
}

export function createDungeonVigilShaft() {
    return turned([[0, -.5], [.46, -.5], [.5, -.48], [.5, -.43], [.4, -.41],
        [.4, -.35], [.33, -.33], [.29, -.25], [.27, .26], [.33, .32],
        [.4, .34], [.4, .4], [.5, .42], [.5, .48], [.46, .5], [0, .5]], 'moulded-shaft');
}

export function createDungeonVigilCage() {
    const parts = [];
    for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + Math.PI / 4;
        const point = (radius, y) => new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        const curve = new THREE.CatmullRomCurve3([point(.3, -.5), point(.5, -.1), point(.54, .25), point(.3, .78)]);
        parts.push(new THREE.TubeGeometry(curve, 6, .045, 4, false));
    }
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    return finish(geometry, 'forged-cage');
}

export function createDungeonBevelBlock() {
    const shape = new THREE.Shape();
    shape.moveTo(-.46, -.46); shape.lineTo(.46, -.46);
    shape.lineTo(.46, .46); shape.lineTo(-.46, .46); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .92, steps: 1,
        bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 1, curveSegments: 1 });
    geometry.translate(0, 0, -.46);
    return finish(geometry, 'bevel-block');
}

export function createDungeonFontBasin() {
    // Continuous outer foot, bowl, turned rim and inner basin; no opaque top
    // pretending to be a hollow vessel. Bounds retain the former font apron.
    return turned([[0, -.5], [.35, -.5], [.4, -.4], [.43, -.2], [.5, .28],
        [.5, .42], [.45, .5], [.39, .48], [.39, .38], [.36, -.13],
        [.22, -.28], [0, -.28]], 'hollow-font');
}

export function createDungeonCofferLid() {
    // A low barrel vault across the coffer's depth, extruded along its length.
    // Same unit footprint as the bevel block, rather than a broad overhang.
    const shape = new THREE.Shape();
    shape.moveTo(-.48, -.48); shape.lineTo(.48, -.48); shape.lineTo(.48, -.2);
    shape.quadraticCurveTo(.38, .46, 0, .48);
    shape.quadraticCurveTo(-.38, .46, -.48, -.2); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .96, steps: 1,
        bevelEnabled: true, bevelSize: .015, bevelThickness: .02, bevelSegments: 1, curveSegments: 5 });
    geometry.rotateY(Math.PI / 2); geometry.translate(-.48, 0, 0);
    return finish(geometry, 'vaulted-coffer-lid');
}
