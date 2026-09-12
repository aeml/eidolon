// Serialized into each fresh document. Record only real server receipts for
// this player; never infer trained duration or expiry from a configured value.
export function installIronFortressObserver(config = {
    skill: 'Iron Fortress', timer: 'ironFortressTimer', effect: 'iron_fortress',
    active: 'ironFortressActive', duration: 'ironFortressDuration'
}) {
    const game = window.game;
    window.__fortressNative = { config, results: [], maxDuration: 0, expired: false, incoming: [] };
    if (game.ironFortressNativeObserver) return;
    game.ironFortressNativeObserver = true;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const result = receive(message);
        const qa = window.__fortressNative;
        const cfg = qa.config;
        if (message.type === 'ability_result' && message.payload?.skillName === cfg.skill) {
            qa.results.push(message.payload);
        }
        if (message.type === 'damage' && message.payload?.targetId === game.player.id) {
            const player = game.player;
            qa.incoming.push({ ...message.payload, at: performance.now(),
                defense: player.stats?.defense, health: player.stats?.hp,
                timer: player[cfg.timer] || 0,
                effectAttached: player.attachedStatusEffects?.has(cfg.effect) || false });
            if (qa.incoming.length > 256) qa.incoming.shift();
        }
        const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
        for (const state of Object.values(states || {})) {
            if (state.id !== game.player.id) continue;
            if (state[cfg.active] === true && Number.isFinite(state[cfg.duration])) {
                qa.maxDuration = Math.max(qa.maxDuration, state[cfg.duration]);
            }
            if (state[cfg.active] === false && qa.maxDuration > 0) qa.expired = true;
        }
        return result;
    };
}
