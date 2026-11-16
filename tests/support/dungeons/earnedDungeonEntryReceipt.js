// Serialized into page.evaluate, like the ground-input probes. This is a
// detached observation, never a database save or permission to restore progress.
export function readEarnedDungeonEntryInPage(metadata) {
    const game = window.game, p = game?.player;
    if (!p || !Number.isFinite(p.level) || !Array.isArray(p.inventory) || !p.equipment) {
        throw new Error('An entered character is required for a dungeon entry receipt');
    }
    return JSON.parse(JSON.stringify({
        schemaVersion: 1,
        sourceCommit: metadata?.sourceCommit ?? null,
        sourceDirty: metadata?.sourceDirty ?? null,
        capturedAt: new Date().toISOString(),
        note: 'Observed after earned equipment swaps, before dungeon traversal; not an exact database save.',
        className: p.constructor.name, level: p.level, xp: p.xp, gold: p.gold,
        statPoints: p.statPoints ?? null, talentPoints: p.talentPoints ?? null,
        baseStats: p.baseStats, derivedStats: p.stats,
        equipment: p.equipment, inventory: p.inventory,
        stash: Array.isArray(p.stash) ? p.stash : null,
        talentRanks: p.talentRanks, selectedBranch: p.selectedBranch,
        skillRunes: p.skillRunes, unlockedSkills: p.unlockedSkills, hotbar: p.hotbar,
        quests: p.quests,
        health: p.stats?.hp, mana: p.stats?.mana,
        wellRestedSeconds: p.wellRestedSeconds, safeZone: p.safeZoneId,
        position: { x: p.position?.x, y: p.position?.y, z: p.position?.z },
        instanceType: game.currentInstanceType || 'overworld'
    }));
}
