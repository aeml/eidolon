import { Vector3 } from 'three';

// Cover the visible receiver volume, not a fixed 560-unit square. A caster
// anywhere along a sun ray has the same light-plane coordinates as its receiver,
// so off-screen roofs/trees can still cast into this volume. Keep depth coverage
// independent: RenderSystem retains the existing near/far planes.
export function getShadowViewCoverage(camera, cameraOffset, lightOffset, targetOffset = new Vector3()) {
    const backward = cameraOffset.clone().normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), backward).normalize();
    const up = new Vector3().crossVectors(backward, right);
    const sun = lightOffset.clone().normalize();
    const lightRight = new Vector3().crossVectors(new Vector3(0, 1, 0), sun).normalize();
    const lightUp = new Vector3().crossVectors(sun, lightRight);
    // World receivers from below the ground surface to tall roofs/canopies.
    // The fixed camera looks down; avoid an unbounded fit if that ever changes.
    if (backward.y < .1 || lightRight.lengthSq() < .5) return 280;
    let radius = 0;
    for (const x of [camera.left, camera.right]) for (const y of [camera.bottom, camera.top]) {
        for (const height of [-8, 64]) {
            const point = right.clone().multiplyScalar(x / camera.zoom)
                .addScaledVector(up, y / camera.zoom).add(targetOffset);
            point.addScaledVector(backward, (height - point.y) / backward.y);
            radius = Math.max(radius, Math.abs(point.dot(lightRight)), Math.abs(point.dot(lightUp)));
        }
    }
    // Padding covers texel snapping, filtering, small camera punch and motion;
    // quantization keeps the map scale stable while the camera follows a player.
    return Math.max(64, Math.ceil((radius + 12) / 16) * 16);
}
