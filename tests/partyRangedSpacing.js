import { partyPathAvoidsActors } from './partyDungeonControls.js';

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
    if (distance >= desired - 2 && supportDistance < healer.range - .5) return null;
    const angle = Math.atan2(state.z - target.z, state.x - target.x);
    const candidates = [];
    for (const radius of [desired, desired - 1, desired - 2]) {
        for (let index = 0; index < 32; index++) {
            const direction = angle + index * Math.PI / 16;
            const x = target.x + Math.cos(direction) * radius;
            const z = target.z + Math.sin(direction) * radius;
            const step = { dx: x - state.x, dz: z - state.z };
            const travel = Math.hypot(step.dx, step.dz);
            if (travel < 1 || travel > 12 || Math.hypot(x - healer.x, z - healer.z) >= healer.range - .5) continue;
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
            if (separation < distance + 1 || separation > desired ||
                Math.hypot(x - healer.x, z - healer.z) >= healer.range - .5) continue;
            if (!partyPathAvoidsActors(state, step, actors, state.radius || 1.25) || !canStep(step)) continue;
            partial.push({ step, separation, travel });
        }
    }
    partial.sort((a, b) => b.separation - a.separation || a.travel - b.travel);
    return partial[0]?.step || null;
}
