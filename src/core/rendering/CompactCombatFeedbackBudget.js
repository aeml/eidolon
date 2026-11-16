// These are simultaneous decorative remote-contact budgets, not limits on
// actors, accepted combat events, damage, spell shapes or danger warnings.
export const COMPACT_COMBAT_FEEDBACK_LIMITS = Object.freeze({ high: 64, low: 32 });
const REMOTE_CONTACT_KINDS = new Set([
    'fighter_strike', 'rogue_strike', 'wizard_strike', 'cleric_strike', 'enemy_strike', 'reflect_strike'
]);

export function isCompactCombatFeedback(type, options, localPlayerId) {
    if (type !== 'combat_feedback' || options.feedbackDensity !== 'compact' ||
        !REMOTE_CONTACT_KINDS.has(options.feedbackKind) ||
        options.abilityName || options.projectileType || options.authoritativeShape ||
        Number(options.radius) > 0) return false;
    return !localPlayerId ||
        (options.sourceId !== localPlayerId && options.targetId !== localPlayerId);
}

export function limitCompactCombatFeedback(effects, quality) {
    const limit = quality === 'low' ? COMPACT_COMBAT_FEEDBACK_LIMITS.low : COMPACT_COMBAT_FEEDBACK_LIMITS.high;
    let excess = effects.reduce((count, effect) => count +
        (effect.isCompactCombatFeedback && effect.isActive ? 1 : 0), 0) - limit;
    if (excess <= 0) return;
    // The array is chronological. Retire only older active compact feedback;
    // leave all essential and local effects, plus the latest contacts, intact.
    for (let index = 0; index < effects.length && excess > 0;) {
        const effect = effects[index];
        if (!effect.isCompactCombatFeedback || !effect.isActive) { index++; continue; }
        effects.splice(index, 1);
        effect.dispose();
        excess--;
    }
}
