import { partyPathAvoidsActors } from './partyDungeonControls.js';

// An optional spacing input may be invalidated by a body moving into an
// initially clear path. This is NOT movement success or a general error waiver:
// require a fresh collision stop at the requested point and that exact body's
// observed change from clear to obstructing. The encounter/death watchdogs stay.
export function partySpacingActorInterruption(plan, observation) {
    const after = observation?.player, movement = observation?.movement;
    if (!plan?.instanceId || observation?.before?.instanceId !== plan.instanceId ||
        after?.instanceId !== plan.instanceId || after.state !== 'IDLE' || !(after.health > 0) ||
        !Number.isFinite(plan.blockedStops) || !Number.isFinite(movement?.blockedStops) ||
        movement.blockedStops <= plan.blockedStops || !movement.blockedTarget ||
        ![plan.origin?.x, plan.origin?.z, plan.step?.dx, plan.step?.dz,
            observation.before.x, observation.before.z,
            movement.blockedTarget.x, movement.blockedTarget.z].every(Number.isFinite)) return null;
    if (Math.hypot(observation.before.x - plan.origin.x, observation.before.z - plan.origin.z) > .25) return null;
    if (Math.hypot(movement.blockedTarget.x - plan.origin.x - plan.step.dx,
        movement.blockedTarget.z - plan.origin.z - plan.step.dz) > .25) return null;
    const attempts = observation.attempts;
    if (attempts?.length !== 1 || attempts[0].mode !== 'move-only-walk' ||
        attempts[0].clickProbe?.result !== true || attempts[0].clickProbe?.dom !== 'CANVAS') return null;
    for (const body of observation.actors || []) {
        const before = plan.bodies?.find(actor => actor.id === body.id);
        if (!before || ![before.x, before.z, body.x, body.z].every(Number.isFinite) ||
            Math.hypot(before.x - body.x, before.z - body.z) < .25) continue;
        if (partyPathAvoidsActors(plan.origin, plan.step, [before], plan.origin.radius) &&
            !partyPathAvoidsActors(plan.origin, plan.step, [body], plan.origin.radius)) return body.id;
    }
    return null;
}

// Test-driver input planning, never runtime AI or a stat/position assignment.
// Use the actual target-padded basic range and available healer range. Hold a
// useful firing position until the enemy closes or support falls out of reach.
export function planPartyRangedSpacing(state, target, healer, canStep = () => true, actors = []) {
    if (![state?.x, state?.z, target?.x, target?.z, target?.range,
        healer?.x, healer?.z, healer?.range].every(Number.isFinite) ||
        target.range < 10 || healer.range <= 2) return null;
    const distance = Math.hypot(state.x - target.x, state.z - target.z);
    const supportDistance = Math.hypot(state.x - healer.x, state.z - healer.z);
    const desired = target.range - 2;
    // Another member of a pack can reach melee while the selected target is
    // safely distant. Only explicitly hostile living bodies are threats; NPCs
    // and allies remain collision obstacles, not reasons to flee.
    const hostiles = actors.filter(actor => actor.hostile === true && actor.state !== 'DEAD' &&
        [actor.x, actor.z].every(Number.isFinite));
    const clearance = actor => (state.radius || 1.25) + (actor.radius || 1.25) + 3;
    const threats = hostiles.filter(actor => Math.hypot(actor.x - state.x, actor.z - state.z) < clearance(actor));
    const safer = (x, z) => hostiles.every(actor => Math.hypot(x - actor.x, z - actor.z) >
        (threats.includes(actor) ? Math.hypot(state.x - actor.x, state.z - actor.z) + 1 : clearance(actor)));
    if (!threats.length && distance >= desired - 2 && supportDistance < healer.range - .5) return null;
    // A live healer can cross a short optional spacing step between projection
    // and click. Keep firing from a useful position until that ally passes;
    // do not treat the resulting blocked input as a successful retreat. This
    // hold does not apply in melee danger or outside attack/healing reach.
    if (!threats.length && distance >= desired - 3 && distance < target.range - .5 && supportDistance < healer.range - .5 &&
        actors.some(actor => actor.friendly === true && actor.state === 'MOVING' &&
            Math.hypot(actor.x - state.x, actor.z - state.z) < (state.radius || 1.25) + (actor.radius || 1.25) + 3)) return null;
    const angle = Math.atan2(state.z - target.z, state.x - target.x);
    const candidates = [];
    for (const radius of [desired, desired - 1, desired - 2]) {
        for (let index = 0; index < 32; index++) {
            const direction = angle + index * Math.PI / 16;
            const x = target.x + Math.cos(direction) * radius;
            const z = target.z + Math.sin(direction) * radius;
            const step = { dx: x - state.x, dz: z - state.z };
            const travel = Math.hypot(step.dx, step.dz);
            if (travel < 1 || travel > 12 || !safer(x, z) || Math.hypot(x - healer.x, z - healer.z) >= healer.range - .5) continue;
            if (!partyPathAvoidsActors(state, step, actors, state.radius || 1.25) || !canStep(step)) continue;
            candidates.push({ step, travel });
        }
    }
    candidates.sort((a, b) => a.travel - b.travel);
    if (candidates.length) return candidates[0].step;

    // Room edges and the healer's current location can make the ideal rings
    // mutually unreachable. Do not stand in melee just because the whole
    // retreat cannot finish in one input: take verified progress, then reread
    // the moving enemy/support on the next serial role step.
    const partial = [];
    for (const travel of [3, 6, 9, 12]) {
        for (let index = 0; index < 32; index++) {
            const direction = angle + index * Math.PI / 16;
            const step = { dx: Math.cos(direction) * travel, dz: Math.sin(direction) * travel };
            const x = state.x + step.dx, z = state.z + step.dz;
            const separation = Math.hypot(x - target.x, z - target.z);
            if (separation < (threats.length ? Math.min(distance, desired - 2) : distance + 1) || separation > desired || !safer(x, z) ||
                Math.hypot(x - healer.x, z - healer.z) >= healer.range - .5) continue;
            if (!partyPathAvoidsActors(state, step, actors, state.radius || 1.25) || !canStep(step)) continue;
            partial.push({ step, separation, travel });
        }
    }
    partial.sort((a, b) => b.separation - a.separation || a.travel - b.travel);
    return partial[0]?.step || null;
}
