import { getFighterEffectDuration } from './fighterEffectDuration.js';

const offline = actor => actor && !actor.isRemote && !actor.isMultiplayer && !actor.gameEngine?.isMultiplayer;
const heroes = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);

export function getFighterDamageBuffMultiplier(source, skill) {
    const base = skill === 'Berserker Edge' ? 1.5 : skill === 'Last Stand Rampage' ? 3 : 1;
    if (base === 1) return 1;
    const raw = Number(source?.talentRanks?.[base === 1.5 ? 'FTR_19' : 'FTR_25'] || 0);
    const rank = Number.isFinite(raw) ? Math.max(0, Math.min(5, Math.floor(raw))) : 0;
    // Same integer-ratio expression as the server; capture only named Mastery.
    return base * (25 + rank) / 25;
}

export function applyOfflineFighterDamageBuff(source, skill, engine) {
    if (!offline(source) || engine?.isMultiplayer || source.state === 'DEAD') return;
    const multiplier = getFighterDamageBuffMultiplier(source, skill);
    if (multiplier === 1) return;
    if (skill === 'Last Stand Rampage') {
        source.lastStandTimer = getFighterEffectDuration(source, 10);
        source.lastStandMultiplier = multiplier;
        source.lastStandDamageBoost = multiplier - 1;
        source.recalculateStats();
        return;
    }
    const duration = getFighterEffectDuration(source, 15);
    const recipients = new Set([source]);
    if (source.partyId) {
        for (const actor of engine?.chunkManager?.getActiveEntities?.() || []) {
            if (!offline(actor) || !heroes.has(actor.meshType || actor.constructor?.name) ||
                actor.isActive === false || actor.state === 'DEAD' || actor.partyId !== source.partyId ||
                (actor.instanceId || '') !== (source.instanceId || '')) continue;
            const radius = Number.isFinite(actor.radius) ? Math.max(0, actor.radius) : 0;
            if (Math.hypot(actor.position.x - source.position.x, actor.position.z - source.position.z) <= 15 + radius) recipients.add(actor);
        }
    }
    for (const actor of recipients) {
        actor.berserkerEdgeActive = true;
        actor.berserkerEdgeTimer = duration;
        actor.berserkerEdgeMultiplier = multiplier;
        actor.recalculateStats();
    }
}

// Called after rebuilding unbuffed stats. Never multiply a replicated stat.
export function applyOfflineFighterDamageBuffStats(actor) {
    if (!offline(actor)) return;
    if (actor.berserkerEdgeActive) {
        const value = actor.berserkerEdgeMultiplier;
        actor.stats.damage = Math.trunc(actor.stats.damage * (value >= 1.5 && value <= 1.8 ? value : 1.5));
        actor.stats.defense = Math.trunc(actor.stats.defense * .8);
    }
    if (actor.lastStandTimer > 0) {
        const value = actor.lastStandMultiplier;
        actor.stats.damage = Math.trunc(actor.stats.damage * (value >= 3 && value <= 3.6 ? value : 3));
    }
}

export function advanceFighterDamageBuffs(actor, dt) {
    let expired = false;
    if (actor.berserkerEdgeTimer > 0) {
        actor.berserkerEdgeTimer = Math.max(0, actor.berserkerEdgeTimer - dt);
        if (!actor.berserkerEdgeTimer) {
            actor.berserkerEdgeActive = false;
            actor.berserkerEdgeMultiplier = 1;
            expired = true;
        }
    }
    if (actor.lastStandTimer > 0) {
        actor.lastStandTimer = Math.max(0, actor.lastStandTimer - dt);
        if (!actor.lastStandTimer) {
            actor.lastStandMultiplier = 1;
            actor.lastStandDamageBoost = 0;
            expired = true;
        }
    }
    if (expired && offline(actor)) actor.recalculateStats();
}

export function clearOfflineFighterDamageBuffs(actor) {
    if (!offline(actor)) return;
    const changed = actor.berserkerEdgeActive || actor.lastStandTimer > 0;
    actor.berserkerEdgeActive = false;
    actor.berserkerEdgeTimer = actor.lastStandTimer = 0;
    actor.berserkerEdgeMultiplier = actor.lastStandMultiplier = 1;
    actor.lastStandDamageBoost = 0;
    if (changed) actor.recalculateStats();
}
