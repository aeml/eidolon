import { Vector3 } from 'three';

export const SHADOW_RECEIVER_MIN_HEIGHT = -8;
export const SHADOW_VIEW_PADDING = 12;

// Cover the visible receiver volume, not a fixed 560-unit square. A caster
// anywhere along a sun ray has the same light-plane coordinates as its receiver,
// so off-screen roofs/trees can still cast into this volume. Keep every caster
// in front of the deepest receiver: those behind it cannot shadow the view.
export function getShadowViewBounds(camera, cameraOffset, lightOffset, targetOffset = new Vector3()) {
    const backward = cameraOffset.clone().normalize();
    const right = new Vector3().crossVectors(new Vector3(0, 1, 0), backward).normalize();
    const up = new Vector3().crossVectors(backward, right);
    const sun = lightOffset.clone().normalize();
    const lightRight = new Vector3().crossVectors(new Vector3(0, 1, 0), sun).normalize();
    const lightUp = new Vector3().crossVectors(sun, lightRight);
    // World receivers from below the ground surface to tall roofs/canopies.
    // The fixed camera looks down; avoid an unbounded fit if that ever changes.
    if (backward.y < .1 || lightRight.lengthSq() < .5) return { left: -280, right: 280, bottom: -280, top: 280, far: 1400 };
    let left = Infinity, rightEdge = -Infinity, bottom = Infinity, top = -Infinity;
    const lightDistance = lightOffset.length();
    let far = 1;
    for (const x of [camera.left, camera.right]) for (const y of [camera.bottom, camera.top]) {
        for (const height of [SHADOW_RECEIVER_MIN_HEIGHT, 64]) {
            const point = right.clone().multiplyScalar(x / camera.zoom)
                .addScaledVector(up, y / camera.zoom).add(targetOffset);
            point.addScaledVector(backward, (height - point.y) / backward.y);
            const sx = point.dot(lightRight), sy = point.dot(lightUp);
            left = Math.min(left, sx); rightEdge = Math.max(rightEdge, sx);
            bottom = Math.min(bottom, sy); top = Math.max(top, sy);
            far = Math.max(far, lightDistance - point.dot(sun));
        }
    }
    // Padding covers texel snapping, filtering, small camera punch and motion;
    // quantization keeps the map scale stable while the camera follows a player.
    // Cross-lighting makes the receiver volume strongly asymmetric. A square
    // centred on the player spends most of its area on unseen scenery. Fit
    // each edge instead, retaining the same full receiver/caster guarantee.
    const fit = (min, max) => {
        let low = Math.floor((min - SHADOW_VIEW_PADDING) / 16) * 16, high = Math.ceil((max + SHADOW_VIEW_PADDING) / 16) * 16;
        if (high - low < 64) { const padding = Math.ceil((64 - high + low) / 32) * 16; low -= padding; high += padding; }
        return [low, high];
    };
    const [minX, maxX] = fit(left, rightEdge), [minY, maxY] = fit(bottom, top);
    // Match the light-plane padding/snap; near remains 1 so tall and distant
    // off-screen casters toward the sun are not lost. This is not a radius cap.
    return { left: minX, right: maxX, bottom: minY, top: maxY, far: Math.ceil((far + SHADOW_VIEW_PADDING) / 16) * 16 };
}
