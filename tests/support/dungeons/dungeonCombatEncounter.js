// Fixed boss-room identity, not the enemy's moving position. A kited boss must
// not drag the QA encounter boundary through previously cleared corridors.
export function dungeonCombatTargetType(entity, bosses) {
    // Some raid guardians reuse a different creature's rendering class. Their
    // server-generated ID retains the encounter identity; the mesh class does not.
    return bosses.find(boss => entity.id?.startsWith(`${boss}-`)) ||
        entity.subType || entity.constructor.name;
}

export function dungeonBossEncounter(layout, bosses, targetType) {
    const index = bosses.indexOf(targetType);
    if (index < 0) return undefined;
    const room = layout.rooms.filter(room => room.type === 'boss')[index];
    if (!room || ![room.x, room.z, room.width, room.height].every(Number.isFinite) ||
        room.width <= 0 || room.height <= 0) throw new Error(`Missing valid boss room for ${targetType}`);
    return { x: room.x, z: room.z, width: room.width, height: room.height };
}
