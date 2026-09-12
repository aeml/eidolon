// Keep receipts from the real server separate from net HP snapshots. A heal
// and a near-simultaneous hit can otherwise look like a lost heal. This never
// modifies the message, game state, input policy or health/resource values.
export function recordPartyCombatReceipt(receipts, message, playerId, observedAtMs) {
    const payload = message?.payload;
    if (!Number.isFinite(observedAtMs) || !payload ||
        !['damage', 'heal', 'ability'].includes(message.type) ||
        (payload.sourceId !== playerId && payload.targetId !== playerId)) return;
    if (typeof payload.sourceId !== 'string' || typeof payload.targetId !== 'string') return;
    const receipt = { type: message.type, observedAtMs, sourceId: payload.sourceId, targetId: payload.targetId };
    if (message.type === 'ability') {
        if (typeof payload.skillName !== 'string' || !payload.skillName) return;
        receipt.skillName = payload.skillName;
    } else {
        if (!Number.isFinite(payload.amount) || payload.amount <= 0) return;
        receipt.amount = payload.amount;
    }
    receipts.push(receipt);
    if (receipts.length > 64) receipts.splice(0, receipts.length - 64);
}
