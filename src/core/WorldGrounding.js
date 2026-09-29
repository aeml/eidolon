import { intersectWorldElevationRay } from '../data/worldElevation.js';

export function intersectEngineGround(engine, ray, target, instancePlane) {
    // Read current ownership on every query, including entry/exit and VIP stairs.
    if (!engine.terrainElevation || engine.currentInstanceId) return ray.intersectPlane(instancePlane, target);
    return intersectWorldElevationRay(ray, target, { field: engine.terrainElevation });
}

// An engine supplies an immutable elevation field only after the terrain
// integration is ready. Null leaves legacy worlds and instance-owned Y alone.
export function getOverworldGroundHeight(engine, position) {
    if (!engine?.terrainElevation || engine.currentInstanceId) return null;
    return engine.terrainElevation.sample(position.x, position.z);
}

// Server combat reach is measured on the ground plane. Candidate elevation
// must not shorten attacks or perception by adding vertical separation.
export function getGroundAwareDistance(engine, from, to) {
    return engine?.terrainElevation && !engine.currentInstanceId
        ? Math.hypot(to.x - from.x, to.z - from.z) : from.distanceTo(to);
}

export function getGroundedActorHeight(actor, position = actor.position) {
    const engine = actor.gameEngine;
    // Replicated entity kind, not a guessed mesh/class name: service NPCs and
    // projectiles keep their own offsets. The local player needs no packet tag.
    if (!engine || (actor !== engine.player && actor.terrainGrounded !== true) ||
        actor.state === 'JUMPING' || actor.jumpVisualState || (actor === engine.player && engine.playerJumpState)) return null;
    return getOverworldGroundHeight(engine, position);
}
