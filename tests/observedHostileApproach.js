// Read-only encounter selection for tests that approach, rather than click,
// an enemy. Screen projection is not a prerequisite for ordinary travel.
export function nearestObservedHostile(player, enemies, subtype) {
    return enemies.filter(enemy => enemy.active && enemy.alive && enemy.subtype === subtype &&
        Number.isFinite(enemy.x) && Number.isFinite(enemy.z))
        .map(enemy => ({ ...enemy, distance: Math.hypot(enemy.x - player.x, enemy.z - player.z) }))
        .sort((a, b) => a.distance - b.distance)[0] || null;
}
