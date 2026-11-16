// Read-only, same-instant evidence. A historical wire shield must not be paired
// with a later actor state or a detached/hidden status effect.
export function readShieldAbsorptionEvidence(game, state, capacity, at) {
    const player = game.player;
    if (!player || !state || !Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(at) ||
        state.id !== player.id || state.arcaneShieldActive !== true ||
        !Number.isFinite(state.arcaneShieldHp) || state.arcaneShieldHp <= 0 || state.arcaneShieldHp >= capacity ||
        !player.arcaneShieldActive || player.shieldHP !== state.arcaneShieldHp ||
        !Number.isFinite(player.stats?.hp) || player.stats.hp <= 0) return null;
    const effect = player.attachedStatusEffects?.get('arcane_shield');
    if (!effect?.isActive || effect.disposed || effect.group?.userData?.ownerId !== player.id) return null;
    let inScene = false;
    for (let node = effect.group; node; node = node.parent) {
        if (node.visible === false) return null;
        if (node === game.renderSystem?.scene) inScene = true;
    }
    if (!inScene) return null;
    return { at, active: true, visual: true, remaining: player.shieldHP,
        absorbed: capacity - player.shieldHP, health: player.stats.hp };
}

export function observeShieldAbsorption(game, capacity, now = () => performance.now()) {
    if (!Number.isFinite(capacity) || capacity <= 0) throw new Error('Positive shield capacity required');
    const original = game.handleServerMessage;
    let stopped = false;
    const evidence = { sample: null, stop() {
        stopped = true;
        if (game.handleServerMessage === receive) game.handleServerMessage = original;
    } };
    function receive(message) {
        const result = original.call(game, message);
        if (stopped || evidence.sample) return result;
        const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
        for (const state of Object.values(states || {})) {
            const sample = readShieldAbsorptionEvidence(game, state, capacity, now());
            if (sample) { evidence.sample = sample; break; }
        }
        return result;
    }
    game.handleServerMessage = receive;
    return evidence;
}
