export function getFireballRunePlan(runeId) {
    return {
        runeId: ['fireball_magma', 'fireball_chain', 'fireball_empowered'].includes(runeId) ? runeId : '',
        speed: runeId === 'fireball_magma' ? 12 : 20,
        damage: runeId === 'fireball_empowered' ? 2 : 1,
        extraCooldown: runeId === 'fireball_empowered' ? 3 : 0,
        bounces: runeId === 'fireball_chain' ? 3 : 0
    };
}
