const DUNGEON_CADENCE_LABELS = Object.freeze({
    onramp: 'Onramp',
    build: 'Build',
    payoff: 'Payoff',
    reset: 'Reset',
    spike: 'Spike',
    pressure: 'Pressure',
    climax: 'Climax'
});

export function getDungeonRoomRole(room = null) {
    if (!room) return '';
    if (room.roomRole) return room.roomRole;
    if (room.type === 'start') return 'entry';
    if (room.type === 'boss') return 'boss';
    if (room.hook === 'chest') return 'reward';
    if (room.hook === 'shrine') return 'recovery';
    if (room.hook === 'elite_ambush') return 'event';
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
        nextBeatRole: nextMeaningfulRoom?.roomRole || '',
        nextBeatCadenceTag: nextMeaningfulRoom?.cadenceTag || ''
    };
}
