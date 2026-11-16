// The recovery route deliberately lets an encounter kill the character.
// Once inside the room and near a live hostile, continuing to click around
// its occupied center kites slow melee enemies instead of testing recovery.
export function reachedRecoveryEncounter(room, player, enemies) {
    if (!room || !player || player.state === 'DEAD') return false;
    if (Math.abs(player.x - room.x) > room.width / 2 - 3 ||
        Math.abs(player.z - room.z) > room.height / 2 - 3) return false;
    return enemies.some(enemy => enemy.hostile && enemy.health > 0 && enemy.state !== 'DEAD' &&
        Math.hypot(enemy.x - player.x, enemy.z - player.z) <= 12);
}
