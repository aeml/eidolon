import { intersectWorldElevationRay } from '../data/worldElevation.js';
import { Vector3 } from 'three';

const groundHit = new Vector3();

export function intersectEngineGround(engine, ray, target, instancePlane) {
    // Read current ownership on every query, including entry/exit and VIP stairs.
    const ground = !engine.terrainElevation || engine.currentInstanceId
        ? ray.intersectPlane(instancePlane, groundHit)
        : intersectWorldElevationRay(ray, groundHit, { field: engine.terrainElevation });
    const distance = ground ? ray.origin.distanceTo(groundHit) : Infinity;
    if (!engine.currentInstanceId && engine.townRoofField?.intersectRay(ray, target, distance)) return target;
    return ground ? target.copy(groundHit) : null;
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

export function getActorCombatDistance(engine, attacker, target) {
    const className = attacker?.constructor?.name || attacker?.subType;
    if (['Wizard', 'Rogue'].includes(className) || (!attacker?.supportSurface && !target?.supportSurface)) return getGroundAwareDistance(engine, attacker.position, target.position);
    const attackerY = attacker.position.y + 1.5 * Math.max(1, Number(attacker.scale) || 1);
    const targetY = target.position.y + 1.5 * Math.max(1, Number(target.scale) || 1);
    return Math.hypot(attacker.position.x - target.position.x, attacker.position.z - target.position.z, attackerY - targetY);
}

export function getFloorInteractionDistance(from, to) {
    const dx = from.position.x - to.position.x, dz = from.position.z - to.position.z;
    const dy = from.supportSurface || to.supportSurface ? from.position.y - to.position.y : 0;
    return Math.hypot(dx, dy, dz);
}

export function getGroundedActorHeight(actor, position = actor.position) {
    const engine = actor.gameEngine;
    // Replicated entity kind, not a guessed mesh/class name: service NPCs and
    // projectiles keep their own offsets. The local player needs no packet tag.
    if (!engine || (actor !== engine.player && actor.terrainGrounded !== true) ||
        actor.state === 'JUMPING' || actor.jumpVisualState || (actor === engine.player && engine.playerJumpState)) return null;
    if (!engine.currentInstanceId && engine.townRoofField) {
        if (actor.supportSurface) {
            const roof = engine.townRoofField.sample(position.x, position.z, actor.supportSurface);
            if (roof) return roof.y;
            return null;
        }
        const ground = getOverworldGroundHeight(engine, position) ?? 0;
        if (position.y > ground + .5) return null;
    }
    return getOverworldGroundHeight(engine, position);
}
