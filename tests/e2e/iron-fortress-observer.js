// Serialized into each fresh document. Record only real server receipts for
// this player; never infer trained duration or expiry from a configured value.
export function installIronFortressObserver() {
    const game = window.game;
    window.__fortressNative = { results: [], maxDuration: 0, expired: false };
    if (game.handleServerMessage.ironFortressNativeObserver) return;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const result = receive(message);
        const qa = window.__fortressNative;
        if (message.type === 'ability_result' && message.payload?.skillName === 'Iron Fortress') {
            qa.results.push(message.payload);
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
    game.handleServerMessage.ironFortressNativeObserver = true;
}
