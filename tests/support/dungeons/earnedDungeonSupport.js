// Baseline earned-build choices, not an optimal build or a balance verdict.
// Select inputs only; never grant a skill, resources, damage or status effects.
export function selectEarnedDungeonSupport(state) {
    if (!state || state.dead || !state.targetValid || !Number.isFinite(state.healthRatio) || state.healthRatio <= 0 ||
        !Number.isFinite(state.distance) || !Number.isFinite(state.attackRange) ||
        state.distance < 0 || state.attackRange <= 0 || state.distance > state.attackRange ||
        !Number.isFinite(state.sinceCastMs) || state.sinceCastMs < 550) return null;
    let skill;
    if (state.className === 'Rogue' && !state.poisonCoatingActive && !(state.poisonCoatingTimer > 0)) {
        skill = 'Poison Coating';
    } else if (state.className === 'Cleric' && state.healthRatio < .85 &&
        !state.guardianEmbraceActive && !(state.guardianEmbraceTimer > 0)) {
        skill = 'Guardian Embrace';
    } else return null;
    const slot = state.hotbar?.indexOf(skill) ?? -1;
    const cost = state.skillCosts?.[skill], cooldown = state.cooldowns?.[skill] ?? 0;
    if (slot < 0 || slot > 3 || !state.unlockedSkills?.includes(skill) ||
        !Number.isFinite(cost) || cost < 0 || !Number.isFinite(state.mana) || state.mana < cost ||
        !Number.isFinite(cooldown) || cooldown > 0) return null;
    return { skill, key: String(slot + 1) };
}
