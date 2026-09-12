// Serialized into a fresh document. Forward every message exactly once; only
// actual wire states can prove a purchase, trained duration or natural expiry.
export function installRogueUtilityObserver(config = null) {
    const game = window.game;
    window.__rogueUtility = { config, results: [], casts: [], maxDuration: 0,
        expired: false, ranks: null, points: null, localSamples: [], localPeak: null, resourceSamples: [] };
    // Other input probes wrap the receiver without preserving function
    // properties. Keep installation ownership on this game/document instead.
    if (game.rogueUtilityObserverInstalled) return;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const resources = () => ({ mana: game.player.stats?.mana ?? null, maxMana: game.player.stats?.maxMana ?? null,
            rest: game.player.wellRestedSeconds ?? null, safeZone: game.player.safeZoneId ?? null });
        const beforeResources = resources();
        const result = receive(message), qa = window.__rogueUtility, cfg = qa.config;
        const recordResources = (wire, kind) => {
            qa.resourceSamples.push({ at: performance.now(), kind, wire, before: beforeResources, after: resources() });
            if (qa.resourceSamples.length > 64) qa.resourceSamples.shift();
        };
        if (cfg && message.type === 'ability_result' && message.payload?.skillName === cfg.skill) {
            qa.results.push(message.payload);
            recordResources({ mana: message.payload.mana ?? null }, 'ability_result');
        }
        if (message.type === 'qa_animation_ready') recordResources(null, message.type);
        if (cfg && message.type === 'ability' && message.payload?.skillName === cfg.skill &&
            message.payload.sourceId === game.player.id) qa.casts.push(message.payload);
        const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
        for (const state of Object.values(states || {})) {
            if (state.id === game.player.id) {
                if (['mana', 'maxMana', 'wellRestedSeconds', 'safeZoneId'].some(key => state[key] !== undefined)) {
                    recordResources({ mana: state.mana ?? null, maxMana: state.maxMana ?? null,
                        rest: state.wellRestedSeconds ?? null, safeZone: state.safeZoneId ?? null }, message.type);
                }
                if (state.talentRanks) qa.ranks = { ...state.talentRanks };
                if (Number.isFinite(state.talentPoints)) qa.points = state.talentPoints;
            }
            if (!cfg || state.id !== cfg.targetId) continue;
            if (cfg.timer && (state[cfg.active] !== undefined || state[cfg.duration] !== undefined)) {
                const actor = cfg.self ? game.player : game.remotePlayers?.get(cfg.targetId);
                const effect = actor?.attachedStatusEffects?.get(cfg.visual);
                const sample = { at: performance.now(), wireActive: state[cfg.active] ?? null,
                    wireDuration: state[cfg.duration] ?? null, loaded: Boolean(actor),
                    localTimer: actor?.[cfg.timer] ?? null, actorState: actor?.state ?? null,
                    effectAttached: Boolean(effect?.isActive && effect.group?.parent && effect.group.visible) };
                qa.localSamples.push(sample);
                if (qa.localSamples.length > 32) qa.localSamples.shift();
                if (Number.isFinite(sample.localTimer) && (!qa.localPeak || sample.localTimer > qa.localPeak.localTimer)) qa.localPeak = sample;
            }
            if (state[cfg.active] === true && Number.isFinite(state[cfg.duration])) {
                qa.maxDuration = Math.max(qa.maxDuration, state[cfg.duration]);
            }
            if (state[cfg.active] === false && qa.maxDuration > 0) qa.expired = true;
        }
        return result;
    };
    game.rogueUtilityObserverInstalled = true;
}
