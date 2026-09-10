// Acceptance of read-only native scene observations, not prepared actor state.
const budgets = Object.freeze({ high: { meshes: 5, sparks: 16 }, low: { meshes: 4, sparks: 8 } });

export function restedAuraMeetsBudget(aura, quality) {
    const budget = budgets[quality];
    return Boolean(budget && aura && Number.isFinite(aura.bank) && aura.bank > 0 &&
        aura.attached && aura.quality === quality && aura.meshes === budget.meshes &&
        aura.batches === 2 && aura.sparks === budget.sparks && aura.ownerGroups === 1 &&
        aura.invalid === 0 && aura.ownerMatches && Number.isFinite(aura.distance) &&
        aura.distance >= 0 && aura.distance < .2);
}
