import { getAbilityAoeRadius } from './abilityRadii.js';

export function getWhirlwindCastDuration(actor) {
    return actor?.skillRunes?.Whirlwind === 'whirlwind_extended' ? 2 : 1;
}

export function stopWhirlwindPresentation(actor, { predictedOnly = false } = {}) {
    const effect = actor?.whirlwindCastEffect;
    if (predictedOnly && effect?.authoritativeSeen) return false;
    effect?.dispose();
    if (!actor) return false;
    actor.whirlwindActive = false;
    actor.whirlwindRemaining = 0;
    if (actor.currentAbilityAnimation?.skillName === 'Whirlwind') {
        actor.currentAbilityAnimation = null;
        if (actor.state !== 'DEAD') {
            const clip = actor.state === 'MOVING'
                ? (actor.getMovementAnimationName?.(actor.isRunning) || 'Run') : 'Idle';
            actor.playAnimation?.(clip, true, true);
        }
    }
    return true;
}

// Called for both self and remote authoritative snapshots. A predicted cast
// survives older inactive snapshots until it is acknowledged or rejected; an
// acknowledged spin ends immediately on an explicit authoritative clear.
export function syncWhirlwindPresentation(engine, actor, payload) {
    if (payload.whirlwindActive === undefined && payload.whirlwindDuration === undefined) return;
    const value = Number(payload.whirlwindDuration);
    const remaining = Number.isFinite(value) ? Math.max(0, Math.min(2, value)) : 0;
    const active = payload.whirlwindActive === true && remaining > 0 && actor.state !== 'DEAD';
    const previousRemaining = actor.whirlwindLastSnapshotRemaining || 0;
    actor.whirlwindLastSnapshotRemaining = active ? remaining : 0;
    if (!active) {
        if (actor.state === 'DEAD' || actor.whirlwindCastEffect?.authoritativeSeen || !actor.whirlwindCastEffect?.isActive) {
            stopWhirlwindPresentation(actor);
        }
        return;
    }
    // A locally expired mesh may be followed by one last positive snapshot
    // already in flight. Do not flash a new mesh for the tail of the same cast.
    // A later cast starts after a clear or with a newly increased duration.
    if (!actor.whirlwindCastEffect?.isActive && previousRemaining > 0 && remaining <= previousRemaining) return;
    actor.whirlwindActive = true;
    actor.whirlwindRemaining = remaining;
    if (!actor.whirlwindCastEffect?.isActive) {
        engine.spawnTransientEffect?.('spin', actor.position, 0xd7dbe0, {
            source: actor, abilityName: 'Whirlwind', abilityLayer: 0,
            radius: getAbilityAoeRadius('Fighter', 'Whirlwind', actor),
            whirlwindDuration: remaining
        });
        actor.playAbilityAnimation?.('Whirlwind', { duration: remaining });
    }
    if (actor.whirlwindCastEffect) {
        actor.whirlwindCastEffect.authoritativeSeen = true;
        actor.whirlwindCastEffect.setRemaining(remaining);
    }
}
