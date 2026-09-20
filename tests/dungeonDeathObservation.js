// Read-only observations after ordinary message application. Never infer a kill
// from disappearance alone, or carry a death into another instance/respawn.
// These functions are serialized into the browser and have no external imports.
export function installDungeonObservationInPage() {
    const game = window.game;
    const original = game.handleServerMessage.bind(game);
    window.__verdantLastState = performance.now();
    window.__dungeonObservedSkills = [];
    window.__dungeonConfirmedDeaths = new Map();
    window.__dungeonSurvivalEvents = [];
    game.handleServerMessage = message => {
        if (message.type === 'state' || message.type === 'delta') window.__verdantLastState = performance.now();
        if (['damage', 'heal'].includes(message.type) && message.payload?.targetId === game.player.id) {
            const data = message.payload;
            const source = game.remotePlayers.get(data.sourceId);
            window.__dungeonSurvivalEvents.push({ time: Math.round(performance.now()), event: message.type,
                amount: data.amount, kind: data.kind, sourceType: source?.subType || source?.constructor.name ||
                    (String(data.sourceId || '').startsWith('hazard-') ? 'hazard' : 'unresolved'),
                playerPosition: { x: game.player.position.x, z: game.player.position.z },
                sourcePosition: source?.position ? { x: source.position.x, z: source.position.z } : null,
                hpBeforePresentation: game.player.stats.hp });
            if (window.__dungeonSurvivalEvents.length > 80) window.__dungeonSurvivalEvents.shift();
        }
        if (message.type === 'ability' && message.payload?.sourceId === game.player.id &&
            !window.__dungeonObservedSkills.includes(message.payload.skillName)) {
            window.__dungeonObservedSkills.push(message.payload.skillName);
        }
        const result = original(message);
        if (message.type === 'state' || message.type === 'delta') {
            const deaths = window.__dungeonConfirmedDeaths;
            for (const [id, entity] of game.remotePlayers) {
                const health = entity.health ?? entity.stats?.hp;
                if (entity.state === 'DEAD' || Number.isFinite(health) && health <= 0) {
                    deaths.set(id, { instance: game.currentInstanceId || '', health: 0, state: 'DEAD' });
                } else deaths.delete(id);
            }
            while (deaths.size > 256) deaths.delete(deaths.keys().next().value);
        }
        return result;
    };
}

export function readDungeonTargetStateInPage(id) {
    const game = window.game, entity = game.remotePlayers.get(id);
    if (entity) return { health: entity.health ?? entity.stats?.hp, state: entity.state };
    const death = window.__dungeonConfirmedDeaths?.get(id);
    return death?.instance === (game.currentInstanceId || '') ? { health: death.health, state: death.state } : null;
}

