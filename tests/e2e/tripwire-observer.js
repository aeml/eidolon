// Observe actual server delivery only. No ranks, damage, roots or traps are
// manufactured; installation survives other diagnostic receiver wrappers.
export function installTripwireObserver(targetId = null) {
    const game = window.game;
    window.__tripwire = { targetId, results: [], traps: [], damage: [], ranks: null, points: null, maxRoot: 0, expired: false };
    if (game.tripwireObserverInstalled) return;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const result = receive(message), p = message.payload, qa = window.__tripwire;
        if (message.type === 'ability_result' && p?.skillName === 'Tripwire') qa.results.push(p);
        if (message.type === 'damage' && p?.sourceId === game.player.id && p.targetId === qa.targetId) qa.damage.push(p);
        const states = message.type === 'state' ? p : message.type === 'delta' ? p?.u : null;
        for (const state of Object.values(states || {})) {
            if (state.id === game.player.id) {
                if (state.talentRanks) qa.ranks = { ...state.talentRanks };
                if (Number.isFinite(state.talentPoints)) qa.points = state.talentPoints;
            }
            if (state.type === 'Projectile' && state.subType === 'Tripwire' && state.ownerId === game.player.id &&
                !qa.traps.some(trap => trap.id === state.id)) {
                qa.traps.push({ id: state.id, x: state.x, z: state.z, damage: state.damage });
            }
            if (state.id !== qa.targetId) continue;
            if (state.rooted === true && Number.isFinite(state.rootDuration)) qa.maxRoot = Math.max(qa.maxRoot, state.rootDuration);
            if (state.rooted === false && qa.maxRoot > 0) qa.expired = true;
        }
        return result;
    };
    game.tripwireObserverInstalled = true;
}
