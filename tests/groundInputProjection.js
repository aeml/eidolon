// Serialized directly into page.evaluate; no browser /tests import is needed.
// Project onto the negotiated production ground, not the actor's presentation
// lift or airborne position. Instance floors remain owned by their ground plane.
export function projectGroundOffsetInPage({ deltaX, deltaZ, allowScaling = true, minimumDistance = 0 }) {
    const game = window.game;
    if (!game?.player?.position || !game.renderSystem?.camera || !game.inputManager?.groundPlane) return null;
    if (!Number.isFinite(minimumDistance) || minimumDistance < 0) return null;
    const distance = Math.hypot(deltaX, deltaZ);
    if (minimumDistance > 0 && (!Number.isFinite(distance) || distance < minimumDistance)) return null;
    let scales = allowScaling ? [1, .75, .5, .25, .125] : [1];
    if (allowScaling && minimumDistance > 0) {
        // Planning must sample the valid interval rather than jump from a
        // covered half-step to a visible quarter-step below its minimum.
        // Round inside the bound; never reduce the requested distance.
        const floor = Math.min(1, minimumDistance / distance + Number.EPSILON);
        scales = [...new Set([...scales.filter(scale => scale >= floor),
            ...Array.from({ length: 17 }, (_, index) => 1 - (1 - floor) * index / 16)])].sort((a, b) => b - a);
    }
    let lastProjection = null;
    for (const scale of scales) {
        const target = game.player.position.clone();
        target.x += deltaX * scale;
        target.z += deltaZ * scale;
        if (game.terrainElevation && !game.currentInstanceId) {
            target.y = game.terrainElevation.sample(target.x, target.z);
        } else {
            game.inputManager.groundPlane.projectPoint(target, target);
        }
        const world = { x: target.x, y: target.y, z: target.z };
        const projected = target.project(game.renderSystem.camera);
        lastProjection = {
            x: (projected.x + 1) * window.innerWidth / 2,
            y: (-projected.y + 1) * window.innerHeight / 2, world, scale,
            visible: projected.z >= -1 && projected.z <= 1 &&
                projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1
        };
        const element = lastProjection.visible ? document.elementFromPoint(lastProjection.x, lastProjection.y) : null;
        lastProjection.canvas = lastProjection.visible && element?.tagName === 'CANVAS';
        lastProjection.blockedBy = lastProjection.canvas ? null : { tag: element?.tagName || null, id: element?.id || null };
        if (lastProjection.canvas) return lastProjection;
    }
    return lastProjection;
}

// Planning only: choose a visible prefix before the caller constructs its
// strict arrival contract. Execution must still recheck the chosen whole path;
// never silently shrink a destination after movement has already been planned.
export function planVisibleGroundStepInPage(step, { minimumDistance = 1 } = {}) {
    if (!step || ![step.dx, step.dz, minimumDistance].every(Number.isFinite) || minimumDistance <= 0) return null;
    const point = projectGroundOffsetInPage({ deltaX: step.dx, deltaZ: step.dz });
    if (!point?.canvas || Math.hypot(step.dx, step.dz) * point.scale < minimumDistance) return null;
    return { dx: step.dx * point.scale, dz: step.dz * point.scale };
}
