// Detached comparison facts for post-combat Recall/re-entry QA. No names or
// account IDs; do not log the instance ID (used only for equality assertions).
export function dungeonRestSnapshot(game) {
    const layout = game.currentDungeonLayout, summary = game.currentDungeonRoomState;
    if (!game.currentInstanceId || !layout?.generationSeed || !summary?.rooms?.length) {
        throw new Error('Dungeon recovery requires an actual active run snapshot');
    }
    const p = game.player;
    const ordered = items => items.filter(Boolean).map(item => JSON.parse(JSON.stringify(item)))
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return {
        instance: game.currentInstanceId, type: game.currentInstanceType,
        seed: layout.generationSeed, generator: layout.generatorVersion,
        difficulty: summary.difficulty, runLevel: summary.runLevel,
        rooms: summary.rooms.map(room => ({ index: room.index, cleared: room.cleared })),
        gold: p.gold, level: p.level, inventory: ordered(p.inventory),
        quests: ordered(p.quests).map(quest => ({ id: quest.id, accepted: quest.accepted,
            completed: quest.completed, count: quest.count, maxCount: quest.maxCount }))
    };
}
