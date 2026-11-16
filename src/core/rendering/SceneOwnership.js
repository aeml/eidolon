// A session owns actors in dormant chunks too, not just objects currently
// attached to the render scene. Invalidate all owners before disposing any of
// them so a late model load cannot attach to a scene which is being retired.
export function clearEngineSceneOwnership(engine, { preservePlayer = false, advanceGeneration = true } = {}) {
    const transient = new Set([
        ...(engine.remotePlayers?.values() || []), ...(engine.enemies || []), ...(engine.lootDrops || []),
        ...(engine.effects || []), ...(engine.hazards?.values() || [])
    ]);
    const owned = new Set([engine.player]);
    for (const entity of transient) owned.add(entity);
    for (const entity of engine.remotePlayers?.values() || []) owned.add(entity);
    for (const chunk of engine.chunkManager?.chunks?.values() || []) {
        for (const entity of chunk) owned.add(entity);
    }
    for (const entity of engine.chunkManager?._cachedActiveEntities || []) owned.add(entity);
    for (const effect of engine.effects || []) owned.add(effect);
    for (const hazard of engine.hazards?.values() || []) owned.add(hazard);
    owned.delete(undefined); owned.delete(null);
    // Offline town residents were historically held in dormant chunks across
    // transitions. Preserve that behavior; authoritative scenes retire all
    // prior owners and receive their new actor roster from the server.
    const offlineResidents = new Set();
    if (preservePlayer && engine.isMultiplayer === false) {
        for (const entity of owned) {
            if (entity !== engine.player && !transient.has(entity) && entity.isActive !== false &&
                !['Projectile', 'Loot', 'Enemy'].includes(entity.type) && entity.serverEntityType !== 'Enemy') {
                offlineResidents.add(entity); owned.delete(entity);
            }
        }
    }
    if (preservePlayer) {
        owned.delete(engine.player);
        if (engine.player) engine.player._chunkKey = null;
    }
    // Seated bones/cutaway roots are borrowed from actor models. Restore and
    // forget them before retirement can return those models to a reusable pool.
    engine.casino?.clearActorPresentation?.();
    for (const object of owned) object.isActive = false;

    engine.remotePlayers?.clear(); engine.hazards?.clear();
    engine.pendingEntityIds?.clear();
    for (const pending of engine.pendingLootPickups?.values() || []) clearTimeout(pending.expiryTimer);
    engine.pendingLootPickups?.clear();
    // Recent-pickup suppression belongs to the session, not one instance.
    // Keep its existing five-second lifetime across zone transitions, but
    // release all suppression callbacks immediately at terminal teardown.
    if (!preservePlayer) {
        for (const timer of engine.recentLootExpiryTimers?.values() || []) clearTimeout(timer);
        engine.recentLootExpiryTimers?.clear(); engine.recentlyPickedUpLoot?.clear();
    }
    if (offlineResidents.size) {
        for (const [key, chunk] of engine.chunkManager?.chunks || []) {
            for (const entity of chunk) if (!offlineResidents.has(entity)) chunk.delete(entity);
            if (!chunk.size) engine.chunkManager.chunks.delete(key);
        }
    } else engine.chunkManager?.chunks?.clear();
    engine.chunkManager?.activeChunkKeys?.clear();
    for (const list of [engine.effects, engine.entityCreationQueue, engine.activeEntitiesCache,
        engine.raycastHitEntities, engine.chunkManager?._cachedActiveEntities, engine.enemies, engine.lootDrops]) {
        if (list) list.length = 0;
    }
    if (engine.chunkManager) {
        engine.chunkManager._cachedActiveEntitiesFrame = -1;
        engine.chunkManager._activeChunksChanged = true;
        engine.chunkManager.lastPlayerChunkKey = null;
    }
    engine.hoveredEntity = null; engine.pendingInteraction = null;
    if (advanceGeneration) engine.overworldSceneGeneration = (engine.overworldSceneGeneration || 0) + 1;
    for (const timer of engine.pendingAttackTimers || []) clearTimeout(timer);
    engine.pendingAttackTimers?.clear();
    for (const object of owned) {
        try {
            object.healthBar?.remove?.();
            if (object.dispose) object.dispose();
            else object.mesh?.removeFromParent?.();
        } catch (error) {
            // A single broken entity must not retain every other actor/timer.
            console.error('GameEngine: Failed to release scene object', error);
        }
    }
    engine.collisionManager?.clear();
}
