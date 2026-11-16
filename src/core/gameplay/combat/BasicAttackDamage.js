const PRIMARY_STAT = Object.freeze({
    Fighter: 'strength', Rogue: 'dexterity', Wizard: 'intelligence', Cleric: 'wisdom'
});

// Match Entity.RecalculateStats on the authoritative server. Non-hero actors
// retain their enemy/NPC formula; weapon damage is added after stat scaling.
export function getBasicAttackDamage(className, stats, flatDamage = 0) {
    const primary = PRIMARY_STAT[className];
    return (primary ? Math.trunc(stats[primary] / 4) : stats.strength * 2) + flatDamage;
}
