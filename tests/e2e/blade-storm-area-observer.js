// Serialized into the page. Observe normal receiver delivery and real meshes;
// never create daggers, grant ranks, change clocks or alter resource values.
export function installBladeStormAreaObserver() {
    const game = window.game;
    window.__bladeStormArea = { results: [], casts: [], terminals: [], ranks: null, points: null };
    if (game.bladeStormAreaObserverInstalled) return;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const result = receive(message), p = message.payload, qa = window.__bladeStormArea;
        const states = message.type === 'state' ? p : message.type === 'delta' ? p?.u : null;
        for (const state of Object.values(states || {})) if (state.id === game.player.id) {
            if (state.talentRanks) qa.ranks = { ...state.talentRanks };
            if (Number.isFinite(state.talentPoints)) qa.points = state.talentPoints;
        }
        if (p?.skillName !== 'Blade Storm') return result;
        if (message.type === 'ability_result') qa.results.push(p);
        if (p.sourceId !== game.player.id) return result;
        if (message.type === 'projectile_impact' && p.terminal) qa.terminals.push(p);
        if (message.type === 'ability') {
            const effect = game.effects.find(effect => effect.isActive &&
                effect.abilityShape?.sourceId === game.player.id && effect.abilityShape?.skillName === 'Blade Storm');
            const root = effect?.meshes?.[0];
            const boundary = root?.children.find(part => part.userData.normalizedGameplayRadius === 1);
            qa.casts.push({ ...p, meshRadius: boundary?.scale.x, meshX: root?.position.x, meshZ: root?.position.z,
                authoritative: effect?.abilityShape.authoritative,
                attached: Boolean(root && root.parent === game.renderSystem.effectGroup),
                visible: Boolean(root?.visible && boundary?.visible), quality: game.uiManager.getGraphicsQuality() });
        }
        return result;
    };
    game.bladeStormAreaObserverInstalled = true;
}
