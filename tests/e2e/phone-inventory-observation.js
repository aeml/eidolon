// Read-only gameplay evidence: never select a target, move an actor or grant loot.
export async function readPhoneInventoryState(page) {
    return page.evaluate(() => {
        const game = window.game;
        if (!game?.player) return null;
        const describe = entity => entity ? {
            id: entity.id, type: entity.type, state: entity.state,
            position: entity.position?.toArray(), hp: entity.stats?.hp,
            item: entity.item ? { id: entity.item.id, type: entity.item.type, level: entity.item.level } : null
        } : null;
        return {
            player: describe(game.player), autoLoot: game.autoLootEnabled,
            inventory: game.player.inventory.filter(Boolean).map(item => ({ id: item.id, type: item.type, level: item.level })),
            loot: [...game.remotePlayers.values()].filter(entity => game.isLootEntity(entity)).map(describe),
            hovered: describe(game.hoveredEntity), pending: describe(game.pendingInteraction),
            stack: (game.raycastHitEntities || []).map(describe),
            stash: describe(game.remotePlayers.get('stash-1')),
            target: game.player.targetPosition?.toArray(),
            pointer: game.inputManager.mouse.toArray(), needsRaycast: game.needsRaycast
        };
    });
}
