// Experimental coordinated-balance candidate. Keep aligned with the server and
// the exhaustive shared fixture; do not release without source/campaign tuning.
export const PROGRESSION_VERSION = 2;
export const PLAYER_LEVEL_CAP = 100;
export const RESONANCE_XP_PER_LEVEL = 5_000_000;

export function experienceRequiredForLevel(level) {
    const bounded = Math.max(1, Math.min(PLAYER_LEVEL_CAP, Math.trunc(level) || 1));
    return 100 + 25 * (bounded - 1) ** 2;
}

function addResonance(actor, amount) {
    const total = (actor.resonanceXP || 0) + amount;
    const ranks = Math.floor(total / RESONANCE_XP_PER_LEVEL);
    actor.resonanceXP = total % RESONANCE_XP_PER_LEVEL;
    actor.resonanceLevel = (actor.resonanceLevel || 0) + ranks;
    actor.resonancePoints = (actor.resonancePoints || 0) + ranks;
}

export function awardOfflineExperience(actor, amount) {
    if (actor.isMultiplayer || actor.isRemote || !Number.isSafeInteger(amount) || amount <= 0) return false;
    if (actor.level >= PLAYER_LEVEL_CAP) {
        if (!Number.isSafeInteger((actor.resonanceXP || 0) + amount)) return false;
        actor.level = PLAYER_LEVEL_CAP;
        actor.xpToNextLevel = experienceRequiredForLevel(PLAYER_LEVEL_CAP);
        actor.xp = actor.xpToNextLevel;
        addResonance(actor, amount);
        return true;
    }
    if (!Number.isSafeInteger(actor.xp + amount)) return false;
    actor.xp += amount;
    while (actor.level < PLAYER_LEVEL_CAP && actor.xp >= actor.xpToNextLevel) actor.levelUp();
    if (actor.level === PLAYER_LEVEL_CAP) {
        const overflow = actor.xp;
        actor.xp = actor.xpToNextLevel;
        addResonance(actor, overflow);
    }
    return true;
}
