// This function is also serialized into the browser by page.evaluate. Keep it
// self-contained and read-only; fixtures may supply a detached game in units.
export function dungeonSpatialSnapshot({ targetId, game = window.game } = {}) {
    const p = game.player, layout = game.currentDungeonLayout;
    const position = actor => actor?.position ? { x: actor.position.x, y: actor.position.y, z: actor.position.z } : null;
    const active = new Set(game.activeEntitiesCache || []);
    const actors = [...(game.remotePlayers?.values() || [])].filter(actor =>
        actor.id === targetId || (game.isHostileActorTarget(actor) && actor.position.distanceTo(p.position) < 30));
    return {
        instanceType: game.currentInstanceType,
        player: { position: position(p), state: p.state, radius: p.radius, scale: p.scale },
        layout: layout ? { seed: layout.generationSeed, version: layout.generatorVersion,
            rooms: layout.rooms?.map(room => ({ x: room.x, z: room.z, width: room.width, height: room.height, type: room.type })),
            walkRects: layout.walkRects?.map(rect => ({ ...rect })) } : null,
        actors: actors.map(actor => ({ target: actor.id === targetId,
            type: actor.subType || actor.constructor.name, position: position(actor),
            radius: actor.radius, scale: actor.scale, state: actor.state, active: actor.isActive,
            inActiveCache: active.has(actor), hostile: game.isHostileActorTarget(actor),
            health: actor.health ?? actor.stats?.hp,
            distance: actor.position.distanceTo(p.position), basicRange: game.getBasicAttackRangeForEntity(actor) }))
    };
}
