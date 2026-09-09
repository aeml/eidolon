// No training or resources are created. Below level ten the ordinary primary
// Spirit Guardians and basic-attack inputs remain the entire available kit.
export function selectEarnedClericHeal(state) {
    const slot = state.hotbar?.indexOf('Healing Light') ?? -1;
    if (state.className !== 'Cleric' || state.dead || !Number.isFinite(state.healthRatio) ||
        state.healthRatio >= .65 || slot < 0 || slot > 3 ||
        !state.unlockedSkills?.includes('Healing Light') || !Number.isFinite(state.mana) ||
        !Number.isFinite(state.healCost) || state.mana < state.healCost ||
        (state.cooldowns?.['Healing Light'] || 0) > 0) return null;
    return { key: String(slot + 1), skill: 'Healing Light' };
}
