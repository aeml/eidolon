const playerClasses = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);

export const usesPlayerAttackCadence = className => playerClasses.has(className);

// Seconds per basic attack. Preserve the one-second floor and its 200-Dex
// threshold, but make an untrained hero's fallback attack responsive.
export function basicAttackInterval(dexterity, className) {
    const dex = Number.isFinite(dexterity) ? Math.max(0, dexterity) : 0;
    return usesPlayerAttackCadence(className)
        ? Math.max(1, 2 / (1 + dex * 0.005))
        : Math.max(1, 5 / (1 + dex * 0.02));
}
