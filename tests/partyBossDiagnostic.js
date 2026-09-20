// Prepared, isolated encounter ONLY. Never applied to a retained earned save.
export function partyBossDiagnostic(env, playthrough) {
    const boss = env.EIDOLON_E2E_DIAGNOSTIC_BOSS;
    if (!boss) return null;
    if (boss !== 'ObsidianGuardian' || playthrough?.dungeonType !== 'molten_core' ||
        playthrough.runLevel !== 70 || playthrough.difficulty !== 'normal' ||
        env.EIDOLON_E2E_EARNED_PARTY === '1' || env.EIDOLON_E2E_EARNED_CHECKPOINT ||
        env.EIDOLON_E2E_EARNED_RESUME === '1') throw new Error('Boss diagnostic requires a prepared Normal70 Molten party, never earned progress');
    return boss;
}

export function preparePartyBossDiagnostic(character, layout, accountPrefix, index, now = new Date()) {
    if (!/^codexqa[a-f0-9]{12}$/.test(accountPrefix) || !Number.isInteger(index) || index < 0 || index > 3 ||
        layout?.generationSeed !== '7811600862583822555' || layout.generatorVersion !== 2 ||
        !layout.walkRects?.length || character.instance_id || character.dungeon_progress) {
        throw new Error('Fresh diagnostic character and recorded canonical layout required');
    }
    const bossRooms = layout.rooms.map((r, i) => r.type === 'boss' ? i : -1).filter(i => i >= 0);
    if (bossRooms.length !== 5) throw new Error('Molten diagnostic requires all five boss rooms');
    const roomIndex = bossRooms[3], room = layout.rooms[roomIndex];
    if (room.width < 120 || room.height < 120) throw new Error('Diagnostic staging needs a safe room edge');
    // Convert the production layout's JSON names to the existing BSON schema.
    const bson = value => Array.isArray(value) ? value.map(bson) : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([key, child]) =>
            [key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`), bson(child)])) : value;
    const instance = `dungeon_diagnostic_${accountPrefix}`;
    const date = { $date: now.toISOString() };
    return { ...character, x: room.x + [-6, -2, 2, 6][index], y: 0, z: room.z + 60,
        instance_id: instance, last_logout: date,
        dungeon_progress: { instance_id: instance, party_id: '', created_at: date,
            difficulty: 'normal', dungeon_type: 'molten_core', run_level: 70,
            layout: bson(layout), current_room_index: roomIndex,
            // Setup skips earlier rooms but never credits these as actual clears.
            rooms: layout.rooms.map((_, i) => ({ explored: i <= roomIndex, cleared: i < roomIndex, rewarded: i < roomIndex })) } };
}
