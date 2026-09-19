// A selected actor can move after the fight starts. Plan from the current
// replicated position, not the old route snapshot; this emits no game action.
export function dungeonTargetApproach(player, target) {
    if (!player || !target || ![player.x, player.z, target.x, target.z].every(Number.isFinite)) return null;
    const dx = target.x - player.x, dz = target.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .25) return null;
    const scale = Math.min(1, 12 / distance);
    return { dx: dx * scale, dz: dz * scale };
}

// A party's obscured target may already be within attack range. Walking into
// its occupied centre cannot acquire it. Try a short, verified lateral/retreat
// segment; distant approaches stop at attack range rather than inside the body.
// This plans ordinary input only and never changes the selected combat target.
export function dungeonOccludedTargetStep(player, target, canStep, actors = []) {
    if (![player?.x, player?.z, target?.x, target?.z, target?.range].every(Number.isFinite) ||
        target.range <= 0 || typeof canStep !== 'function') return null;
    const dx = target.x - player.x, dz = target.z - player.z, distance = Math.hypot(dx, dz);
    if (distance < .25) return null;
    const nx = dx / distance, nz = dz / distance;
    const radius = player.radius || 1.25;
    const standOff = Math.max(radius + (target.radius || 1.25) + .15, target.range - .5);
    const candidates = [];
    if (distance > standOff + 1) {
        const advance = Math.min(12, distance - standOff);
        candidates.push({ dx: nx * advance, dz: nz * advance });
    }
    candidates.push({ dx: -nz * 3.5, dz: nx * 3.5 }, { dx: nz * 3.5, dz: -nx * 3.5 },
        { dx: -nx * 3.5, dz: -nz * 3.5 });
    const bodies = [...actors, target];
    return candidates.find(step => partyPathAvoidsActors(player, step, bodies, radius) && canStep(step)) || null;
}
import { partyPathAvoidsActors } from './partyDungeonControls.js';
