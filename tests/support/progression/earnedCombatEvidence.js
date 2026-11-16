export function createEarnedCombatEvidence() {
    return { requestedId: null, outgoing: { hits: 0, amount: 0 }, incoming: { hits: 0, amount: 0 }, samples: [] };
}

// Diagnostic receipt only: accepted casts do not imply that a projectile hit
// the requested target. Keep the server's actual source/target/amount separate.
export function recordEarnedCombatMessage(state, message, playerId, at) {
    const payload = message.payload || {};
    let sample;
    if (message.type === 'damage') {
        const outgoing = payload.sourceId === playerId, incoming = payload.targetId === playerId;
        if ((!outgoing && !incoming) || !Number.isFinite(payload.amount) || payload.amount < 0) return;
        for (const [matches, key] of [[outgoing, 'outgoing'], [incoming, 'incoming']]) {
            if (matches) { state[key].hits++; state[key].amount += payload.amount; }
        }
        sample = { type: 'damage', sourceId: payload.sourceId, targetId: payload.targetId,
            amount: payload.amount, kind: payload.kind };
    } else if (message.type === 'ability_result') {
        sample = { type: 'ability_result', skillName: payload.skillName, accepted: payload.accepted,
            reason: payload.reason };
    } else return;
    state.samples.push({ ...sample, requestedId: state.requestedId, at });
    if (state.samples.length > 100) state.samples.shift();
}
