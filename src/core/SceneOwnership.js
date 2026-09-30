// A session owns actors in dormant chunks too, not just objects currently
// attached to the render scene. Invalidate all owners before disposing any of
// them so a late model load cannot attach to a scene which is being retired.
export function clearEngineSceneOwnership(engine) {
    const owned = new Set([engine.player]);
    for (const entity of engine.remotePlayers?.values() || []) owned.add(entity);
    for (const chunk of engine.chunkManager?.chunks?.values() || []) {
        for (const entity of chunk) owned.add(entity);
    }
    for (const entity of engine.chunkManager?._cachedActiveEntities || []) owned.add(entity);
    for (const effect of engine.effects || []) owned.add(effect);
    for (const hazard of engine.hazards?.values() || []) owned.add(hazard);
    owned.delete(undefined); owned.delete(null);
    for (const object of owned) object.isActive = false;

    engine.remotePlayers?.clear(); engine.hazards?.clear();
    engine.pendingEntityIds?.clear(); engine.pendingLootPickups?.clear();
    engine.chunkManager?.chunks?.clear(); engine.chunkManager?.activeChunkKeys?.clear();
    for (const list of [engine.effects, engine.entityCreationQueue, engine.activeEntitiesCache,
        engine.raycastHitEntities, engine.chunkManager?._cachedActiveEntities]) {
        if (list) list.length = 0;
    }
    if (engine.chunkManager) {
        engine.chunkManager._cachedActiveEntitiesFrame = -1;
        engine.chunkManager._activeChunksChanged = true;
        engine.chunkManager.lastPlayerChunkKey = null;
    }
    engine.hoveredEntity = null; engine.pendingInteraction = null;
    engine.overworldSceneGeneration = (engine.overworldSceneGeneration || 0) + 1;
    for (const object of owned) {
        try {
            if (object.dispose) object.dispose();
            else object.mesh?.removeFromParent?.();
        } catch (error) {
            // A single broken entity must not retain every other actor/timer.
            console.error('GameEngine: Failed to release scene object', error);
        }
    }
    engine.collisionManager?.clear();
}
