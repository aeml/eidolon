// Serialized into a fresh document. Forward every message exactly once; only
// actual wire states can prove a purchase, trained duration or natural expiry.
export function installRogueUtilityObserver(config = null) {
    const game = window.game;
    window.__rogueUtility = { config, results: [], casts: [], maxDuration: 0,
        expired: false, ranks: null, points: null };
    if (game.handleServerMessage.rogueUtilityObserver) return;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const result = receive(message), qa = window.__rogueUtility, cfg = qa.config;
        if (cfg && message.type === 'ability_result' && message.payload?.skillName === cfg.skill) qa.results.push(message.payload);
        if (cfg && message.type === 'ability' && message.payload?.skillName === cfg.skill &&
            message.payload.sourceId === game.player.id) qa.casts.push(message.payload);
        const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
        for (const state of Object.values(states || {})) {
            if (state.id === game.player.id) {
                if (state.talentRanks) qa.ranks = { ...state.talentRanks };
                if (Number.isFinite(state.talentPoints)) qa.points = state.talentPoints;
            }
            if (!cfg || state.id !== cfg.targetId) continue;
            if (state[cfg.active] === true && Number.isFinite(state[cfg.duration])) {
                qa.maxDuration = Math.max(qa.maxDuration, state[cfg.duration]);
            }
            if (state[cfg.active] === false && qa.maxDuration > 0) qa.expired = true;
        }
        return result;
    };
    game.handleServerMessage.rogueUtilityObserver = true;
}
