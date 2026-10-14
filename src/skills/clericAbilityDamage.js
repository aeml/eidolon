// Named damage Masteries use the same bounded rank and rounding as the server.
const mastery = { 'Spirit Guardians': 1, 'Radiant Strike': 11, 'Consecrated Ground': 13,
    'Spirit Guardians Boost': 15, 'Avenging Seraph': 17, "Heaven's Trumpet": 25 };
export function getClericAbilityDamage(source, skill, base) {
    const id = mastery[skill];
    if (!id) return Math.floor(base);
    let rank = 0;
    for (const key of new Set([`CLR_${id}`, `CLR_${String(id).padStart(2, '0')}`])) {
        const value = Number(source.talentRanks?.[key] || 0);
        if (Number.isFinite(value)) rank = Math.max(rank, Math.min(5, Math.max(0, Math.floor(value))));
    }
    return Math.floor(base * (1 + .04 * rank) + 1e-9);
}
