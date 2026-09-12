// Serialized into a fresh browser document. Observe actual owner receipts;
// never synthesize duration, strength, expiry, acceptance or gameplay state.
export function installFighterBuffObserver(config) {
    const game = window.game;
    window.__fighterBuffNative = { config, results: [], states: [], maxDuration: 0, expired: false };
    if (game.handleServerMessage.fighterBuffNativeObserver) return;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const result = receive(message), qa = window.__fighterBuffNative;
        const { skill, active, duration, multiplier } = qa.config;
        if (message.type === 'ability_result' && message.payload?.skillName === skill) qa.results.push(message.payload);
        const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
        for (const state of Object.values(states || {})) {
            if (state.id !== game.player.id) continue;
            if (state[active] === true) {
                if (Number.isFinite(state[duration])) qa.maxDuration = Math.max(qa.maxDuration, state[duration]);
                qa.states.push({ multiplier: state[multiplier], duration: state[duration],
                    damage: state.damage, defense: state.defense });
                if (qa.states.length > 64) qa.states.shift();
            }
            if (state[active] === false && qa.maxDuration > 0) qa.expired = true;
        }
        return result;
    };
    game.handleServerMessage.fighterBuffNativeObserver = true;
}
