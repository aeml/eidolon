// Browser-serialized projection for real mouse input. MouseEvent coordinates
// truncate fractional CSS pixels; choose the nearest integer explicitly so a
// sub-arrival world target cannot be biased a full pixel farther away.
export function projectMovementGroundOffset({ deltaX, deltaZ }) {
    const game = window.game;
    if (!game?.player?.position || !game.renderSystem?.camera) return null;
    const target = game.player.position.clone();
    target.x += deltaX; target.z += deltaZ;
    const projected = target.clone().project(game.renderSystem.camera);
    const x = Math.round((projected.x + 1) * window.innerWidth / 2);
    const y = Math.round((-projected.y + 1) * window.innerHeight / 2);
    return { x, y, worldX: target.x, worldZ: target.z,
        canvas: projected.z >= -1 && projected.z <= 1 &&
            x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight &&
            document.elementFromPoint(x, y)?.tagName === 'CANVAS' };
}
