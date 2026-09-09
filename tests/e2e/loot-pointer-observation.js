// Read the real pointer result; never assign hover or send a pickup request.
export async function readLootPointerTarget(page, id, options = {}) {
    return page.evaluate(({ id, allowOverlappingLoot }) => {
        const game = window.game;
        if (game?.needsRaycast !== false || game.inputManager?.pointerOverCanvas !== true) return null;
        const isLoot = entity => Boolean(entity?.id && entity.isActive && entity.item?.id &&
            entity.constructor?.name === 'LootDrop');
        const hovered = game.hoveredEntity;
        if (!isLoot(hovered)) return null;
        if (hovered.id === id) return id;
        if (!allowOverlappingLoot) return null;
        const hits = game.raycastHitEntities || [];
        // Only an actual front drop sharing the intended drop's ray qualifies.
        // An unrelated nearby item is not evidence of acquiring this pile.
        return hits.includes(hovered) && isLoot(hits.find(entity => entity.id === id))
            ? hovered.id : null;
    }, { id, allowOverlappingLoot: options.allowOverlappingLoot === true });
}
