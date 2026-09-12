import { applyOfflineAbilityHit } from '../core/AbilityCritical.js';
import { applyOfflineHealing } from '../core/AbilityHealing.js';
import { getFighterAbilityDamageMultiplier } from './fighterAbilityDamage.js';
import { clipDungeonEffectSegment } from './dungeonEffectGeometry.js';
import { stopWhirlwindPresentation } from './whirlwindPresentation.js';

const offline = actor => actor && !actor.isRemote && !actor.isMultiplayer && !actor.gameEngine?.isMultiplayer;

export function cancelOfflineWhirlwind(source) {
    if (!source.offlineWhirlwind && !source.isWhirlwinding) return;
    source.offlineWhirlwind = null;
    source.isWhirlwinding = false;
    source.whirlwindTimer = source.whirlwindDuration = 0;
    if (source.state === 'ATTACKING' && !source.isCharging) source.state = 'IDLE';
    stopWhirlwindPresentation(source);
}

// Actor already paid mana/cooldown and started the canonical spin presentation.
export function beginOfflineWhirlwind(source, engine, isFriendly, combo = false) {
    if (!offline(source) || engine?.isMultiplayer) return;
    const rune = source.skillRunes?.Whirlwind || '';
    const total = rune === 'whirlwind_extended' ? 4 : 2;
    let budget = Math.trunc((source.stats.damage * .8 + source.stats.strength * 2) * 1.3 *
        getFighterAbilityDamageMultiplier(source, 'Whirlwind'));
    if (combo) budget = Math.trunc(budget * 1.5);
    source.offlineWhirlwind = { rune, total, budget, elapsed: 0, tick: 0, seen: new Set(),
        engine, instance: engine?.currentInstanceId || '', isFriendly };
    source.whirlwindTimer = 0;
    source.whirlwindDuration = total * .5;
    source.isWhirlwinding = true;
    source.state = 'ATTACKING';
    advanceOfflineWhirlwind(source, 0, engine);
}

export function advanceOfflineWhirlwind(source, dt, engine) {
    const cast = source.offlineWhirlwind;
    if (!cast) return;
    if (Number.isFinite(dt)) cast.elapsed += Math.max(0, dt);
    source.whirlwindTimer = cast.elapsed;
    const valid = () => source.offlineWhirlwind === cast && source.isWhirlwinding && offline(source) &&
        !engine?.isMultiplayer && source.isActive !== false && source.state !== 'DEAD' && source.stats.hp > 0 &&
        engine === cast.engine && (engine?.currentInstanceId || '') === cast.instance && cast.elapsed < cast.total * .5;
    if (!valid()) { cancelOfflineWhirlwind(source); return; }
    const rects = engine?.currentInstanceId && engine.currentInstanceType !== 'overworld'
        ? engine.currentDungeonLayout?.walkRects : null;
    while (cast.tick < cast.total && cast.elapsed >= cast.tick * .5) {
        const i = cast.tick++;
        const damage = Math.trunc(cast.budget * (i + 1) / cast.total) - Math.trunc(cast.budget * i / cast.total);
        let newHits = 0;
        for (const target of new Set(engine?.chunkManager?.getActiveEntities?.() || [])) {
            if (!valid()) { cancelOfflineWhirlwind(source); return; }
            if (target === source || !offline(target) || target.isActive === false || target.state === 'DEAD' ||
                !target.position || !(target.stats?.hp > 0) || typeof target.takeDamage !== 'function' ||
                (target.instanceId || cast.instance) !== (source.instanceId || cast.instance)) continue;
            const hostile = engine?.isHostileActorTarget?.(target) ?? !cast.isFriendly(target, engine);
            if (!hostile) continue;
            const radius = Number.isFinite(target.radius) ? Math.max(0, target.radius) : 0;
            const dx = source.position.x - target.position.x, dz = source.position.z - target.position.z;
            const distance = Math.hypot(dx, dz);
            // Same fixed six-unit visible boundary as the authoritative spin.
            if (distance > 6 + radius || clipDungeonEffectSegment(rects, source.position, target.position).blocked) continue;
            applyOfflineAbilityHit(source, target, damage, 'Whirlwind', engine?.floatingTextManager, '#ff8800');
            if (!cast.seen.has(target.id)) {
                cast.seen.add(target.id); newHits++;
                if (cast.rune === 'whirlwind_bladestorm' && target.state !== 'DEAD' && target.stats.hp > 0 &&
                    !target.ccImmune && !target.ironFortressImmovable && distance > 1) {
                    const pull = Math.min(2, distance) / distance;
                    target.position.x += dx * pull; target.position.z += dz * pull;
                    target.mesh?.position.copy(target.position);
                }
            }
        }
        if (!valid()) { cancelOfflineWhirlwind(source); return; }
        if (cast.rune === 'whirlwind_bloodwhirl' && newHits) {
            applyOfflineHealing(source, Math.trunc(source.stats.maxHp * 2 * newHits / 100), engine?.floatingTextManager);
        }
    }
}
