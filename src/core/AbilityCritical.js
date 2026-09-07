import { CONSTANTS } from './Constants.js';

// Equipment and applicable talents share one capped ordinary critical roll.
// Generic talents cover basic attacks; Technique ranks require a skill identity.
export function getCriticalChance(source, skillName = '') {
    const className = source?.meshType || source?.subType || source?.constructor?.name;
    const equipment = Number(source?.stats?.critChanceBonus || 0);
    let chance = Number.isFinite(equipment) ? Math.max(0, equipment) : 0;
    for (const talent of CONSTANTS.PASSIVE_TALENTS[className] || []) {
        const bonus = talent.criticalChance;
        if (!bonus || bonus.skill && bonus.skill !== skillName) continue;
        // Match server legacy-ID normalization without mutating saved ranks or
        // counting both padded and unpadded forms of the same talent twice.
        const [prefix, number] = talent.id.split('_');
        let rank = 0;
        for (const id of new Set([talent.id, `${prefix}_${Number(number)}`])) {
            const raw = Number(source?.talentRanks?.[id] || 0);
            if (Number.isFinite(raw)) rank = Math.max(rank, Math.min(talent.maxRank, Math.floor(raw)));
        }
        chance += bonus.chance * rank;
    }
    return Math.min(1, chance);
}

// Apply only to outgoing offline damage. Existing Lucky is an independent proc;
// receiving shields/debuffs remain owned by the target's normal damage method.
export function rollOfflineCriticalDamage(source, amount, skillName = '', guaranteed = false) {
    if (!(amount > 0) || !Number.isFinite(amount)) return { amount: 0, critical: false };
    if (!source || source.isMultiplayer || source.isRemote || source.gameEngine?.isMultiplayer) {
        return { amount, critical: false };
    }
    const chance = getCriticalChance(source, skillName);
    const rolled = chance > 0 && Math.random() < chance;
    const critical = guaranteed || rolled;
    return { amount: critical ? amount * 2 : amount, critical };
}

// Offline ability consumers keep their own base/rune/area rules. This shared
// hit step applies one ordinary critical, preserves Lucky's independent proc,
// and sends the resulting amount through the real recipient damage handler.
export function applyOfflineAbilityHit(source, target, amount, skillName, feedback = null, color = '#ffffff', guaranteed = false) {
    if (!source || source.isMultiplayer || source.isRemote || source.gameEngine?.isMultiplayer ||
        !target || target.isMultiplayer || target.isRemote || target.gameEngine?.isMultiplayer ||
        target.state === 'DEAD' || target.isActive === false || typeof target.takeDamage !== 'function' || !(amount > 0) || !Number.isFinite(amount)) return 0;
    if (source.hasLuckyEffect && Math.random() < .1) amount *= 2;
    const hit = rollOfflineCriticalDamage(source, amount, skillName, guaranteed);
    target.takeDamage(hit.amount, source);
    feedback?.spawn(Math.floor(hit.amount), target.position, hit.critical ? '#ffd166' : color);
    if (hit.critical) feedback?.spawn('CRITICAL!', target.position, '#ffd166');
    return hit.amount;
}
