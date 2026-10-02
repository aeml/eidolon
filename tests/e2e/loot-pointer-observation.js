// Read the real pointer result; never assign hover or send a pickup request.
export async function armManualLootClickObservation(page, aimedId) {
    await page.evaluate(aimedId => {
        const game = window.game;
        window.__qaManualLootClick = null;
        const observe = () => {
            const selected = game.hoveredEntity, hits = game.raycastHitEntities || [];
            const isLoot = entity => entity?.isActive && entity.item?.id && entity.constructor?.name === 'LootDrop';
            const selectedId = isLoot(selected) ? selected.id : null;
            window.__qaManualLootClick = {
                aimedId, selectedId, selectedItem: selectedId ? { ...selected.item } : null,
                sameLootPile: Boolean(selectedId && game.needsRaycast === false &&
                    game.inputManager.pointerOverCanvas === true && hits[0] === selected &&
                    (selectedId === aimedId || isLoot(hits.find(entity => entity.id === aimedId)))),
                selectedPending: Boolean(selectedId && game.pendingInteraction?.id === selectedId),
                hoveredType: selected?.constructor?.name, pendingType: game.pendingInteraction?.constructor?.name,
                playerPosition: game.player.position?.toArray(), playerState: game.player.state,
                targetPosition: game.player.targetPosition?.toArray(),
                dropPosition: selected?.position?.toArray(),
                cameraPosition: game.renderSystem.camera.position.toArray(),
                hits: hits.map(entity => ({ type: entity.constructor?.name, aimed: entity.id === aimedId,
                    selected: entity.id === selectedId }))
            };
            const callbacks = game.inputManager.callbacks.onClick;
            const index = callbacks.indexOf(observe);
            if (index >= 0) callbacks.splice(index, 1);
        };
        game.inputManager.callbacks.onClick.push(observe);
    }, aimedId);
}

export async function readLootBlockingHostile(page, id) {
    return page.evaluate(id => {
        const game = window.game, hovered = game?.hoveredEntity;
        const hits = game?.raycastHitEntities || [];
        const drop = hits.find(entity => entity.id === id);
        if (game?.needsRaycast !== false || game.inputManager?.pointerOverCanvas !== true ||
            !drop?.isActive || !drop.item?.id || drop.constructor?.name !== 'LootDrop' ||
            !hovered?.isActive || hovered.state === 'DEAD' || !hits.includes(hovered) ||
            !game.isHostileActorTarget?.(hovered)) return null;
        return hovered.id;
    }, id);
}

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
