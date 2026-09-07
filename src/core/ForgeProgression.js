// Mirrors server/internal/forging. The server remains authoritative; this only
// previews the same accumulated progress and per-level prices in the Forge.
export function forgeUpgradeCost(level, amount) {
    level = Math.trunc(Number(level));
    if (!Number.isFinite(level) || level < 1 || level >= 100) return { target: level, cost: 0 };
    amount = Math.max(1, Math.min(100 - level, Math.trunc(Number(amount)) || 1));
    const target = level + amount;
    let cost = 0;
    for (let current = level; current < target; current++) {
        cost += current >= 90 ? 2 : Math.max(1, Math.floor(2 ** Math.floor(current / 10) / 100));
    }
    return { target, cost };
}

export function forgePreview(item, level = item.level, potency = item.potency || 0) {
    const saved = item.forgeBasis;
    const savedPotency = saved?.potency ?? 0; // proto3 may omit the zero field in JSON.
    const valid = saved && Number.isInteger(saved.level) && saved.level >= 1 && saved.level <= 100
        && Number.isInteger(savedPotency) && savedPotency >= 0 && savedPotency <= 20;
    const basis = valid ? { ...saved, potency: savedPotency } : { level: Math.max(1, item.level || 1), potency: Math.max(0, item.potency || 0), stats: item.stats, value: item.value || 0 };
    level = Math.max(1, Math.min(100, level || 1));
    potency = Math.max(0, Math.min(20, potency || 0));
    const ratio = ((20 + 3 * level) * (10 + potency)) / ((20 + 3 * basis.level) * (10 + basis.potency));
    const scale = value => {
        const scaled = value * ratio;
        return Math.trunc(scaled + (scaled < 0 ? -1e-9 : 1e-9));
    };
    return { stats: Object.fromEntries(Object.entries(basis.stats || {}).map(([key, value]) => [key, scale(value)])), value: scale(basis.value || 0) };
}
