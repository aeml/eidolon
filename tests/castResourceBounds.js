// A real regen tick can land between the browser's pre-input snapshot and the
// server's cast receipt. Bound only that recovery; do not require a full bar.
export function castResourceBounds(before, cost, elapsedMs) {
    if (![before.mana, before.maxMana, before.manaRegen, cost, elapsedMs].every(Number.isFinite) ||
        cost < 0 || before.mana < cost || before.mana > before.maxMana || before.manaRegen < 0 || elapsedMs < 0) {
        throw new Error('Invalid cast resource observation');
    }
    const minimum = before.mana - cost;
    const recovery = Math.ceil(before.manaRegen * (Math.floor(elapsedMs / 1000) + 1));
    return { minimum, maximum: Math.min(before.maxMana - cost, minimum + recovery) };
}
