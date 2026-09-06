// Read-only strategy for earned-route QA. It chooses ordinary inputs, never
// grants progress, changes positions or relaxes the hunt's death bound.
export function planWizardHuntStep(state) {
    if (state.className !== 'Wizard' || state.dead || !state.threats?.length) return null;
    const threats = state.threats.map(enemy => ({ ...enemy,
        distance: Math.hypot(state.x - enemy.x, state.z - enemy.z) })).sort((a, b) => a.distance - b.distance);
    const nearest = threats[0];
    const shieldIndex = (state.hotbar || []).indexOf('Arcane Shield');
    if (nearest.distance < 9 && state.healthRatio < 0.8 && state.shieldHP <= 0 &&
        shieldIndex >= 0 && shieldIndex < 4 && state.mana >= state.shieldCost &&
        (state.cooldowns?.['Arcane Shield'] || 0) <= 0 && state.sinceCastMs >= 550) {
        return { action: 'shield', key: String(shieldIndex + 1) };
    }
    if (nearest.distance >= 6) return null;
    const angle = Math.atan2(state.z - nearest.z, state.x - nearest.x);
    const options = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2].map(offset => {
        const x = Math.cos(angle + offset) * 9, z = Math.sin(angle + offset) * 9;
        const clearance = Math.min(...threats.map(enemy => Math.hypot(state.x + x - enemy.x, state.z + z - enemy.z)));
        return { x, z, clearance };
    }).sort((a, b) => b.clearance - a.clearance);
    return { action: 'retreat', x: options[0].x, z: options[0].z };
}
