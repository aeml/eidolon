// Read-only observations after ordinary packet delivery. Reinstall after every
// fresh login; resetting evidence never clears gameplay effects or timers.
export function installTeleportNativeObserver(sourceId) {
    const g = window.game;
    window.__teleportNative = { sourceId, casts: [], results: [], protection: [], bestProtection: null };
    if (g.handleServerMessage.teleportNativeObserver) return;
    const receive = g.handleServerMessage.bind(g);
    g.handleServerMessage = message => {
        const result = receive(message), qa = window.__teleportNative;
        const p = g.player.id === qa.sourceId ? g.player : g.remotePlayers.get(qa.sourceId);
        if (message.type === 'ability' && message.payload?.skillName === 'Teleport' &&
            message.payload.sourceId === qa.sourceId) {
            const boundaries = (g.effects || []).filter(e => e.isActive &&
                e.abilityShape?.skillName === 'Teleport' && e.abilityShape.sourceId === qa.sourceId)
                .map(e => {
                    const root = e.meshes?.[0];
                    const ring = root?.children.find(part => part.userData.normalizedGameplayRadius === 1);
                    return { x: e.abilityShape.x, z: e.abilityShape.z, radius: e.abilityShape.radius,
                        visibleRadius: ring?.scale.x, attached: Boolean(root?.parent), y: root?.position.y };
                });
            qa.casts.push({ ...message.payload, boundaries });
            qa.casts = qa.casts.slice(-8);
        }
        if (message.type === 'ability_result' && message.payload?.skillName === 'Teleport') {
            qa.results.push(message.payload); qa.results = qa.results.slice(-8);
        }
        if (p && (message.type === 'state' || message.type === 'delta')) {
            const effect = p.attachedStatusEffects?.get('invulnerable');
            let solidShells = 0;
            effect?.group.traverse(part => {
                if (part.isMesh && ['BoxGeometry', 'SphereGeometry', 'IcosahedronGeometry'].includes(part.geometry.type)) solidShells++;
            });
            const sample = { active: Boolean(p.invulnerableActive), duration: p.invulnerabilityTimer || 0,
                attached: Boolean(effect?.isActive && effect.group?.parent), solidShells,
                quality: effect?.quality, buff: p === g.player ? g.getActiveBuffs().find(b => b.id === 'invulnerable')?.name : null };
            // Keep the actual activation even if screenshots/peer inspection
            // take longer than this short buff and the rolling tail expires.
            if (sample.active && sample.attached && sample.duration > (qa.bestProtection?.duration || 0)) qa.bestProtection = sample;
            qa.protection.push(sample);
            qa.protection = qa.protection.slice(-32);
        }
        return result;
    };
    g.handleServerMessage.teleportNativeObserver = true;
}
