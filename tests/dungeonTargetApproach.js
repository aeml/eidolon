// A selected actor can move after the fight starts. Plan from the current
// replicated position, not the old route snapshot; this emits no game action.
export function dungeonTargetApproach(player, target) {
    if (!player || !target || ![player.x, player.z, target.x, target.z].every(Number.isFinite)) return null;
    const dx = target.x - player.x, dz = target.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .25) return null;
    const scale = Math.min(1, 12 / distance);
    return { dx: dx * scale, dz: dz * scale };
}
