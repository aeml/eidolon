// Passed directly to page.evaluate: install for each fresh document, without
// changing game state, synthesizing packets or wrapping the same handler twice.
export function installTimeWarpObserver() {
    const g = window.game;
    window.__timeWarpNative = { casts: [], results: [], maxDuration: 0 };
    if (g.handleServerMessage.timeWarpNativeObserver) return;
    const receive = g.handleServerMessage.bind(g);
    g.handleServerMessage = message => {
        const result = receive(message);
        if (message.type === 'ability' && message.payload?.skillName === 'Time Warp') {
            const shape = g.effects?.findLast(effect => effect.abilityShape?.skillName === 'Time Warp' &&
                effect.abilityShape.sourceId === message.payload.sourceId);
            const boundary = shape?.meshes?.[0]?.children.find(part => part.userData.normalizedGameplayRadius === 1);
            window.__timeWarpNative.casts.push({ ...message.payload, visibleRadius: boundary?.scale.x });
        }
        if (message.type === 'ability_result' && message.payload?.skillName === 'Time Warp') window.__timeWarpNative.results.push(message.payload);
        if (message.type === 'state' || message.type === 'delta') window.__timeWarpNative.maxDuration =
            Math.max(window.__timeWarpNative.maxDuration, g.player.hasteTimer || 0);
        return result;
    };
    g.handleServerMessage.timeWarpNativeObserver = true;
}
