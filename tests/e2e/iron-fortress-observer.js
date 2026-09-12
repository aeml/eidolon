// Serialized into each fresh document. Record only real server receipts for
// this player; never infer trained duration or expiry from a configured value.
export function installIronFortressObserver() {
    const game = window.game;
    window.__fortressNative = { results: [], maxDuration: 0, expired: false, incoming: [] };
    if (game.ironFortressNativeObserver) return;
    game.ironFortressNativeObserver = true;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const result = receive(message);
        const qa = window.__fortressNative;
        if (message.type === 'ability_result' && message.payload?.skillName === 'Iron Fortress') {
            qa.results.push(message.payload);
        }
        if (message.type === 'damage' && message.payload?.targetId === game.player.id) {
            const player = game.player;
            qa.incoming.push({ ...message.payload, at: performance.now(),
                defense: player.stats?.defense, health: player.stats?.hp,
                timer: player.ironFortressTimer || 0,
                effectAttached: player.attachedStatusEffects?.has('iron_fortress') || false });
            if (qa.incoming.length > 256) qa.incoming.shift();
        }
        const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
        for (const state of Object.values(states || {})) {
            if (state.id !== game.player.id) continue;
            if (state.ironFortressActive === true && Number.isFinite(state.ironFortressDuration)) {
                qa.maxDuration = Math.max(qa.maxDuration, state.ironFortressDuration);
            }
            if (state.ironFortressActive === false && qa.maxDuration > 0) qa.expired = true;
        }
        return result;
    };
}
