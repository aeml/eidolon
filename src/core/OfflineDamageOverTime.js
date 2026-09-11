import { CONSTANTS } from './Constants.js';
import { rollOfflineCriticalDamage } from './AbilityCritical.js';

const authoritative = actor => actor?.isMultiplayer || actor?.isRemote || actor?.gameEngine?.isMultiplayer;

// Match server application snapshots. Derived wounds inherit the primary hit's
// generic/equipment/critical modifiers and add only the wound skill's Mastery.
export function getStatusTrainingDamage(source, skill, amount, inheritedHit = false) {
    if (!(amount > 0) || !Number.isFinite(amount)) return 0;
    let bonus = 0;
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    for (const talent of CONSTANTS.PASSIVE_TALENTS[className] || []) {
        const effect = talent.statusTraining;
        if (!effect || effect.skill !== skill && (inheritedHit || effect.skill)) continue;
        const [prefix, number] = talent.id.split('_');
        let rank = 0;
        for (const id of new Set([talent.id, `${prefix}_${Number(number)}`])) {
            const raw = Number(source?.talentRanks?.[id] || 0);
            if (Number.isFinite(raw)) rank = Math.max(rank, Math.min(talent.maxRank, Math.floor(raw)));
        }
        bonus += effect.damage * rank;
    }
    return Math.floor(Math.floor(amount)*(1+bonus)+1e-9);
}

export function clearOfflineStatus(target, kind) {
    target[`${kind}Timer`] = 0;
    target[`${kind}Stacks`] = 0;
    target[`${kind}TickDamage`] = 0;
    target[`${kind}TickTimer`] = 0;
    target[`${kind}Source`] = null;
}

export function applyOfflineStatus(source, target, kind, amount, duration, skill, inheritedHit = false) {
    if (!['bleed', 'poison'].includes(kind) || !source || authoritative(source) || !target || authoritative(target) ||
        target.isActive === false || target.state === 'DEAD' || !(duration > 0) || !Number.isFinite(duration)) return false;
    let damage = getStatusTrainingDamage(source, skill, amount, inheritedHit);
    if (!inheritedHit && damage > 0) {
        // Raw wounds have their own outgoing application. Derived wounds have
        // already inherited these modifiers from their hit and must not reroll.
        if (source.hasLuckyEffect && Math.random() < .1) damage *= 2;
        damage = rollOfflineCriticalDamage(source, damage, skill).amount;
        if (source.hasExecutionerEffect && target.stats?.maxHp > 0 && target.stats.hp <= target.stats.maxHp/4) {
            damage = Math.floor(damage*1.25);
        }
        if (source.ironFortressTimer > 0 && Object.values(source.activeSetBonuses || {}).some(set => set.specials?.ironFortressDamage > 0)) {
            damage *= 2;
        }
        const poisonBonus = Number(source.stats?.poisonDamageBonus || 0);
        if (kind === 'poison' && poisonBonus > 0 && Number.isFinite(poisonBonus)) damage = Math.floor(damage*(1+poisonBonus));
    }
    if (!damage) return false;
    // Refresh the wound without postponing an already-running tick cadence.
    if (!(target[`${kind}Timer`] > 0)) target[`${kind}TickTimer`] = 0;
    target[`${kind}Timer`] = duration;
    target[`${kind}TickDamage`] = damage;
    target[`${kind}Stacks`] = (target[`${kind}Stacks`] || 0)+1;
    target[`${kind}Source`] = source;
    if (kind === 'poison') {
        target.healingReductionTimer = duration;
        target.healingReductionFactor = .5;
    }
    return true;
}

// Recipient-owned periodic work must continue during stun. Consume only time
// inside the wound's lifetime, retain its source, and never simulate replicas.
export function updateOfflineDamageOverTime(target, dt) {
    if (authoritative(target) || !(dt > 0) || !Number.isFinite(dt)) return;
    for (const kind of ['bleed', 'poison']) {
        const remaining = Number(target[`${kind}Timer`] || 0);
        if (target.state === 'DEAD' || target.isActive === false || !(remaining > 0) || !Number.isFinite(remaining)) {
            clearOfflineStatus(target, kind);
            continue;
        }
        const accrued = Number(target[`${kind}TickTimer`] || 0);
        const elapsed = (Number.isFinite(accrued) && accrued >= 0 ? accrued : 0)+Math.min(dt, remaining);
        target[`${kind}Timer`] = Math.max(0, remaining-dt);
        target[`${kind}TickTimer`] = elapsed;
        // Phase counts down after periodic work in Actor.update. Place each
        // accrued tick within this frame so a slow frame cannot extend immunity
        // or retroactively remove protection from an earlier tick.
        let tickOffset = 1 - (Number.isFinite(accrued) && accrued >= 0 ? accrued : 0);
        while (target[`${kind}TickTimer`] >= 1 && target.state !== 'DEAD' && target.isActive !== false) {
            target[`${kind}TickTimer`] -= 1;
            const source = target[`${kind}Source`] || null;
            const damage = target[`${kind}TickDamage`] > 0 ? target[`${kind}TickDamage`]
                : (kind === 'bleed' ? 5 : 3)*(target[`${kind}Stacks`] || 0);
            if (damage > 0 && !authoritative(source)) {
                if (target.teleportPhaseTimer > 0) target.takeDamage(damage, source, Math.max(0, tickOffset));
                else target.takeDamage(damage, source);
            }
            tickOffset += 1;
        }
        if (target[`${kind}Timer`] <= 0 || target.state === 'DEAD') clearOfflineStatus(target, kind);
    }
}
