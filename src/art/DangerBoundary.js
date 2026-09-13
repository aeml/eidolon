import * as THREE from 'three';

// Additive warning colors can wash out on snow, sand and bright Air terrain.
// A fixed dark backing keeps the edge legible without enlarging the danger area.
export function addDangerContrastUnderlay(boundary, radius, segments = 48) {
    const underlay = new THREE.Mesh(
        new THREE.RingGeometry(radius * 0.84, radius, segments),
        new THREE.MeshBasicMaterial({
            color: 0x100d18, opacity: 0.85, transparent: true,
            side: THREE.DoubleSide, depthWrite: false, blending: THREE.NormalBlending
        })
    );
    underlay.name = 'DangerContrastUnderlay';
    underlay.position.z = -0.015;
    underlay.renderOrder = 3;
    underlay.userData.gameplayRadius = radius;
    boundary.renderOrder = 4;
    boundary.add(underlay);
    return underlay;
}
