// Read-only failure evidence. No target selection, raycasts, movement or grants.
export async function readSanctuaryHoverEvidence(page, attempt) {
    return page.evaluate(attempt => {
        const game = window.game, player = game?.player;
        if (!player) return null;
        const position = value => value?.toArray?.() || null;
        const describe = entity => entity ? {
            id: entity.id, type: entity.subType || entity.constructor?.name,
            active: entity.isActive, state: entity.state,
            health: entity.health ?? entity.stats?.hp,
            position: position(entity.position),
            distance: entity.position ? player.position.distanceTo(entity.position) : null,
            inActiveCache: game.activeEntitiesCache?.includes(entity) || false,
            meshAttached: Boolean(entity.mesh?.parent), meshVisible: entity.mesh?.visible
        } : null;
        // If the last poll found no exposed candidate, retain the most recent
        // attempted screen point so an intervening HUD overlay is observable.
        const point = attempt?.point || attempt?.lastProjection?.point;
        const overlay = Number.isFinite(point?.x) && Number.isFinite(point?.y)
            ? document.elementFromPoint(point.x, point.y) : null;
        const nearby = [...(game.remotePlayers?.values() || [])]
            .filter(entity => (entity.subType || entity.constructor?.name) === 'Skeleton')
            .map(describe).sort((a, b) => a.distance - b.distance).slice(0, 20);
        return {
            attempt, player: { position: position(player.position), state: player.state,
                safeZone: player.safeZoneId, health: player.health ?? player.stats?.hp },
            hovered: describe(game.hoveredEntity),
            intent: game.combatIntent ? { entityId: game.combatIntent.entityId,
                status: game.combatIntent.status } : null,
            needsRaycast: game.needsRaycast,
            pointerOverCanvas: game.inputManager?.pointerOverCanvas,
            camera: position(game.renderSystem?.camera?.position),
            cameraTarget: position(game.renderSystem?.cameraTarget),
            viewport: { width: innerWidth, height: innerHeight },
            visibility: document.visibilityState,
            overlay: overlay ? { tag: overlay.tagName, id: overlay.id } : null,
            nearby
        };
    }, attempt);
}
