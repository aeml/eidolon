// Observe paid server casts and the mesh produced by the ordinary receiver.
// Reinstallation resets receipts without adding another wrapper or mutating play.
export function installSmokeAreaObserver() {
    const game = window.game;
    window.__smokeAreaNative = { casts: [], results: [] };
    if (game.handleServerMessage.smokeAreaObserver) return;
    const receive = game.handleServerMessage.bind(game);
    game.handleServerMessage = message => {
        const result = receive(message), payload = message.payload;
        if (payload?.skillName !== 'Smoke Bomb') return result;
        const observation = window.__smokeAreaNative;
        if (message.type === 'ability_result') observation.results.push({ accepted: payload.accepted, mana: payload.mana });
        if (message.type === 'ability' && payload.sourceId === game.player.id) {
            const effect = game.effects.find(effect => effect.isActive &&
                effect.abilityShape?.sourceId === game.player.id && effect.abilityShape?.skillName === 'Smoke Bomb');
            const root = effect?.meshes?.[0];
            const boundary = root?.children.find(child => child.userData.normalizedGameplayRadius === 1);
            observation.casts.push({ radius: payload.radius, arc: payload.arc,
                x: payload.targetX, z: payload.targetZ, meshX: root?.position.x, meshZ: root?.position.z,
                meshRadius: boundary?.scale.x, authoritative: effect?.abilityShape.authoritative,
                attached: Boolean(root && root.parent === game.renderSystem.effectGroup), quality: game.uiManager.getGraphicsQuality() });
        }
        return result;
    };
    game.handleServerMessage.smokeAreaObserver = true;
}
