export async function installStoryHuntCombatObserver(page) {
    await page.evaluate(async () => {
        const { createEarnedCombatEvidence, recordEarnedCombatMessage } = await import('/tests/earnedCombatEvidence.js');
        window.__storyHuntCombatEvidence = createEarnedCombatEvidence();
        if (window.__storyHuntCombatObserverInstalled) return;
        window.__storyHuntCombatObserverInstalled = true;
        const game = window.game, original = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            if (game.player?.id) recordEarnedCombatMessage(window.__storyHuntCombatEvidence, message, game.player.id, Date.now());
            return original(message);
        };
    });
}

export async function readStoryHuntCombatEvidence(page) {
    return page.evaluate(() => window.__storyHuntCombatEvidence || null);
}

export async function readStoryHuntFailureEvidence(page) {
    return page.evaluate(() => {
        const game = window.game, p = game?.player;
        if (!p) return null;
        const describe = target => target ? { id: target.id, level: target.level,
            type: target.subType || target.constructor.name, state: target.state,
            hp: target.health ?? target.stats?.hp, position: target.position?.toArray(),
            distance: p.position.distanceTo(target.position) } : null;
        return { player: { level: p.level, hp: p.stats.hp, mana: p.stats.mana,
            stats: { ...p.stats }, baseStats: { ...p.baseStats }, statPoints: p.statPoints,
            talentPoints: p.talentPoints, talents: p.talentRanks, branch: p.selectedBranch,
            position: p.position.toArray(), safeZone: p.safeZoneId, rest: p.wellRestedSeconds,
            quests: (p.quests || []).map(q => ({ id: q.id, accepted: q.accepted,
                completed: q.completed, count: q.count, maxCount: q.maxCount })),
            inventoryCapacity: p.inventory.length, freeSlots: p.inventory.filter(item => !item?.id).length,
            inventory: p.inventory.filter(item => item?.id).map(item => ({ id: item.id, name: item.name,
                type: item.type, slot: item.slot, level: item.level, stack: item.stack, rarity: item.rarity, value: item.value })) },
        selected: describe(game.pendingInteraction), hovered: describe(game.hoveredEntity),
        nearby: [...game.remotePlayers.values()].filter(e => game.isHostileActorTarget(e) &&
            p.position.distanceTo(e.position) < 50).map(describe),
        visibleQuestDrops: [...game.remotePlayers.values()].filter(e => e.item?.id?.startsWith('chronicle-item-'))
            .map(e => ({ id: e.id, itemId: e.item.id, name: e.item.name, stack: e.item.stack,
                active: e.isActive, position: e.position?.toArray(), distance: p.position.distanceTo(e.position),
                inPickupRange: game.canAttemptLootPickup?.(e), pending: game.pendingLootPickups?.has(e.id) || false })),
        autoLootEnabled: game.autoLootEnabled,
        pendingPickups: game.pendingLootPickups?.size || 0,
        combat: window.__storyHuntCombatEvidence || null };
    });
}
