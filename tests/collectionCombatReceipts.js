// Read-only QA counters. Keep only local combat receipts, never whole payloads.
export function recordCollectionCombatReceipt(receipts, message, playerId) {
    const payload = message.payload;
    if (!playerId || payload?.sourceId !== playerId ||
        !['attack', 'damage'].includes(message.type) || typeof payload.targetId !== 'string') return;
    const target = receipts[payload.targetId] ||= { attacks: 0, hits: 0, damage: 0 };
    if (message.type === 'attack') target.attacks++;
    else if (Number.isFinite(payload.amount) && payload.amount > 0) {
        target.hits++;
        target.damage += payload.amount;
    }
}
