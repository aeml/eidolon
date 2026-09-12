// Observe server damage receipts only. A click, movement or accepted defensive
// buff does not establish threat on an enemy and must not release the DPS opener.
export function recordPartyOutgoingDamage(evidence, damage, playerId) {
    if (damage?.sourceId !== playerId || typeof damage.targetId !== 'string' || !damage.targetId ||
        !Number.isFinite(damage.amount) || damage.amount <= 0) return;
    evidence.damageDone += damage.amount;
    const previous = Object.hasOwn(evidence.damageByTarget, damage.targetId)
        ? evidence.damageByTarget[damage.targetId] : 0;
    Object.defineProperty(evidence.damageByTarget, damage.targetId, {
        value: previous + damage.amount, enumerable: true, writable: true, configurable: true
    });
}

export function partyTankHasEngaged(evidence, targetId) {
    const amount = Object.hasOwn(evidence.damageByTarget, targetId) ? evidence.damageByTarget[targetId] : 0;
    return Number.isFinite(amount) && amount > 0;
}
