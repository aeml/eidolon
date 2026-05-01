const DUNGEON_CADENCE_LABELS = Object.freeze({
    onramp: 'Onramp',
    build: 'Build',
    payoff: 'Payoff',
    reset: 'Reset',
    spike: 'Spike',
    pressure: 'Pressure',
    climax: 'Climax'
});

const DUNGEON_DIFFICULTY_PACING_LABELS = Object.freeze({
    standard_route: 'Standard Route',
    heroic_pressure: 'Heroic Pressure',
    mythic_trial: 'Mythic Trial'
});

const DUNGEON_ROOM_IDENTITY_LABELS = Object.freeze({
    entry_gate: 'Entry Gate',
    treasure_cache: 'Treasure Cache',
    restorative_shrine: 'Restorative Shrine',
    ambush_chamber: 'Ambush Chamber',
    boss_approach: 'Boss Approach',
    elite_guard: 'Elite Guard',
    boss_lair: 'Boss Lair',
    route_hall: 'Route Hall'
});

export function getDungeonDifficultyPacingLabel(summary = null) {
    const tag = summary?.difficultyPacing;
    return DUNGEON_DIFFICULTY_PACING_LABELS[tag] || '';
}

export function getDungeonDifficultyPacingHint(summary = null) {
    switch (summary?.difficultyPacing) {
    case 'heroic_pressure':
        return 'Heroic pressure: heavier room checks before the guaranteed boss gem.';
    case 'mythic_trial':
        return 'Mythic trial: every room is a capstone push toward gem and unique-effect boss loot.';
    case 'standard_route':
        return 'Standard route: learn the layout, pacing, and boss kit.';
    default:
        return '';
    }
}

export function getDungeonRoomIdentityTag(room = null) {
    if (!room) return '';
    if (room.identity) return room.identity;
    if (room.roomIdentity) return room.roomIdentity;
    if (room.type === 'start') return 'entry_gate';
    if (room.type === 'boss') return 'boss_lair';
    if (room.hook === 'chest') return 'treasure_cache';
    if (room.hook === 'shrine') return 'restorative_shrine';
    if (room.hook === 'elite_ambush') return 'ambush_chamber';
    if (room.pacing === 'boss_approach') return 'boss_approach';
    if (room.type === 'elite') return 'elite_guard';
    return 'route_hall';
}

export function getDungeonRoomIdentityLabel(room = null) {
    return DUNGEON_ROOM_IDENTITY_LABELS[getDungeonRoomIdentityTag(room)] || '';
}

export function getDungeonRoomIdentityHint(room = null) {
    switch (getDungeonRoomIdentityTag(room)) {
    case 'entry_gate':
        return 'Entry gate: orient before the route starts.';
    case 'treasure_cache':
        return 'Treasure cache: a short payoff beat before route pressure returns.';
    case 'restorative_shrine':
        return 'Restorative shrine: stabilize resources before the next push.';
    case 'ambush_chamber':
        return 'Ambush chamber: expect elite pressure and limited reset time.';
    case 'boss_approach':
        return 'Boss approach: the last traversal check before the arena.';
    case 'elite_guard':
        return 'Elite guard: a heavier combat check on the route.';
    case 'boss_lair':
        return 'Boss lair: commit to the encounter and survive.';
    case 'route_hall':
        return 'Route hall: clear forward and watch for the next named beat.';
    default:
        return '';
    }
}

export function getDungeonRoomRole(room = null) {
    if (!room) return '';
    if (room.roomRole) return room.roomRole;
    if (room.type === 'start') return 'entry';
    if (room.type === 'boss') return 'boss';
    if (room.hook === 'chest') return 'reward';
    if (room.hook === 'shrine') return 'recovery';
    if (room.hook === 'elite_ambush') return 'event';
    if (room.pacing === 'boss_approach') return 'approach';
    if (room.type === 'elite') return 'elite';
    return 'travel';
}

export function getDungeonRoomCadenceTag(room = null) {
    if (!room) return '';
    if (room.cadenceTag) return room.cadenceTag;

    switch (getDungeonRoomRole(room)) {
    case 'entry':
        return 'onramp';
    case 'reward':
        return 'payoff';
    case 'recovery':
        return 'reset';
    case 'event':
        return 'spike';
    case 'elite':
        return 'pressure';
    case 'approach':
        return 'pressure';
    case 'boss':
        return 'climax';
    case 'travel':
    default:
        return 'build';
    }
}

export function getDungeonCadenceLabel(roomOrTag = null) {
    const tag = typeof roomOrTag === 'string'
        ? roomOrTag
        : getDungeonRoomCadenceTag(roomOrTag);
    return DUNGEON_CADENCE_LABELS[tag] || '';
}

export function isLiveDungeonBossRoom(room = null, summary = null) {
    if (!room || getDungeonRoomRole(room) !== 'boss') {
        return false;
    }
    return typeof summary?.currentRoomIndex === 'number'
        && typeof summary?.objectiveRoomIndex === 'number'
        && summary.currentRoomIndex === room.index
        && summary.objectiveRoomIndex === room.index;
}

export function getDungeonBeatLabel(room = null, summary = null) {
    if (!room) return '';
    if (isLiveDungeonBossRoom(room, summary)) return 'Boss Now';

    const identityLabel = getDungeonRoomIdentityLabel(room);
    if (identityLabel) return identityLabel;

    switch (getDungeonRoomRole(room)) {
    case 'reward':
        return 'Chest';
    case 'event':
        return 'Ambush';
    case 'recovery':
        return 'Shrine';
    case 'boss':
        return 'Boss';
    case 'elite':
        return 'Elite';
    case 'approach':
        return 'Approach';
    case 'travel':
        return 'Travel';
    case 'entry':
        return 'Entry';
    default:
        return 'Objective';
    }
}

export function isDungeonMeaningfulRoom(room = null) {
    const role = getDungeonRoomRole(room);
    return role !== '' && role !== 'entry' && role !== 'travel';
}

export function findNextDungeonMeaningfulRoom(summary = null, afterIndex = -1) {
    if (!summary || !Array.isArray(summary.rooms)) {
        return null;
    }

    return summary.rooms.find((room) => room
        && typeof room.index === 'number'
        && room.index > afterIndex
        && !room.cleared
        && isDungeonMeaningfulRoom(room)) || null;
}

export function decorateDungeonRoom(room = null) {
    if (!room) return room;
    return {
        ...room,
        identityTag: getDungeonRoomIdentityTag(room),
        identityLabel: getDungeonRoomIdentityLabel(room),
        identityHint: getDungeonRoomIdentityHint(room),
        roomRole: getDungeonRoomRole(room),
        cadenceTag: getDungeonRoomCadenceTag(room)
    };
}

export function decorateDungeonRoomState(summary = null) {
    if (!summary) {
        return summary;
    }

    const rooms = Array.isArray(summary.rooms)
        ? summary.rooms.map((room) => decorateDungeonRoom(room))
        : [];
    const objectiveRoom = typeof summary.objectiveRoomIndex === 'number'
        ? rooms.find((room) => room && room.index === summary.objectiveRoomIndex) || null
        : null;
    const nextMeaningfulRoom = objectiveRoom
        ? findNextDungeonMeaningfulRoom({ ...summary, rooms }, objectiveRoom.index)
        : null;

    return {
        ...summary,
        rooms,
        objectiveRoomRole: objectiveRoom?.roomRole || '',
        objectiveCadenceTag: objectiveRoom?.cadenceTag || '',
        objectiveIdentityTag: objectiveRoom?.identityTag || '',
        objectiveIdentityLabel: objectiveRoom?.identityLabel || '',
        nextBeatRole: nextMeaningfulRoom?.roomRole || '',
        nextBeatCadenceTag: nextMeaningfulRoom?.cadenceTag || '',
        nextBeatIdentityTag: nextMeaningfulRoom?.identityTag || '',
        nextBeatIdentityLabel: nextMeaningfulRoom?.identityLabel || '',
        difficultyPacingLabel: getDungeonDifficultyPacingLabel(summary),
        difficultyPacingHint: getDungeonDifficultyPacingHint(summary)
    };
}
