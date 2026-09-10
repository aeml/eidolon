// Serialized directly into page.evaluate; no browser /tests import is needed.
// Project onto the same plane used by production click resolution, not the
// actor's0.5m presentation lift or airborne position.
export function projectGroundOffsetInPage({ deltaX, deltaZ, allowScaling = true }) {
    const game = window.game;
    if (!game?.player?.position || !game.renderSystem?.camera || !game.inputManager?.groundPlane) return null;
    let lastProjection = null;
    for (const scale of allowScaling ? [1, .75, .5, .25, .125] : [1]) {
        const target = game.player.position.clone();
        target.x += deltaX * scale;
        target.z += deltaZ * scale;
        game.inputManager.groundPlane.projectPoint(target, target);
        const world = { x: target.x, y: target.y, z: target.z };
        const projected = target.project(game.renderSystem.camera);
        lastProjection = {
            x: (projected.x + 1) * window.innerWidth / 2,
            y: (-projected.y + 1) * window.innerHeight / 2, world, scale,
            visible: projected.z >= -1 && projected.z <= 1 &&
                projected.x >= -1 && projected.x <= 1 && projected.y >= -1 && projected.y <= 1
        };
        lastProjection.canvas = lastProjection.visible &&
            document.elementFromPoint(lastProjection.x, lastProjection.y)?.tagName === 'CANVAS';
        if (lastProjection.canvas) return lastProjection;
    }
    return lastProjection;
}
