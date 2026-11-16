// Serialized into the browser. Observe raw receipts and actual rendered mesh
// matrices; never replace gameplay values, create effects, or reset cooldowns.
export function installEarthshakerAreaObserver() {
    const game = window.game;
    window.__earthshakerArea = { results: [], casts: [], effects: [] };
    if (!game.handleServerMessage.earthshakerAreaObserver) {
        const receive = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            const result = receive(message), qa = window.__earthshakerArea;
            if (message.type === 'ability_result' && message.payload?.skillName === 'Earthshaker') qa.results.push(message.payload);
            if (message.type === 'ability' && message.payload?.sourceId === game.player.id && message.payload.skillName === 'Earthshaker') qa.casts.push(message.payload);
            return result;
        };
        game.handleServerMessage.earthshakerAreaObserver = true;
    }
    if (!game.spawnTransientEffect.earthshakerAreaObserver) {
        const spawn = game.spawnTransientEffect.bind(game);
        game.spawnTransientEffect = (...args) => {
            const before = new Set(game.effects), result = spawn(...args);
            for (const effect of game.effects) {
                if (before.has(effect) || effect.abilityShape?.sourceId !== game.player.id || effect.abilityShape.skillName !== 'Earthshaker') continue;
                const record = { phase: effect.abilityShape.phase, frames: [] };
                window.__earthshakerArea.effects.push(record);
                const update = effect.update.bind(effect);
                effect.update = dt => {
                    const result = update(dt);
                    effect.root.updateMatrixWorld(true);
                    const boundaries = effect.root.children.filter(child => child.userData.gameplayBoundary);
                    const ends = boundaries.filter(child => child.name.includes('FissureEnd'));
                    const sides = boundaries.filter(child => child.name.includes('FissureSide'));
                    const xyz = child => child?.matrixWorld.elements.slice(12, 15);
                    const distance = (a, b) => a && b ? Math.hypot(a[0]-b[0], a[2]-b[2]) : null;
                    const ring = boundaries.find(child => child.userData.normalizedGameplayRadius === 1)?.matrixWorld.elements;
                    if (record.frames.length < 256) record.frames.push({
                        active: effect.isActive, acknowledged: effect.abilityShape.authoritative,
                        kind: effect.abilityShape.shapeKind, quality: effect.root.userData.quality,
                        attached: effect.root.parent === game.renderSystem.effectGroup,
                        visible: effect.root.visible && boundaries.length > 0 && boundaries.every(child => child.visible),
                        boundaryCount: boundaries.length,
                        origin: xyz(effect.root), ends: ends.map(xyz),
                        radius: ring ? Math.hypot(ring[0], ring[1], ring[2]) : distance(xyz(ends[0]), xyz(ends[1])),
                        halfWidth: sides.length === 2 ? distance(xyz(sides[0]), xyz(sides[1])) / 2 : null
                    });
                    return result;
                };
            }
            return result;
        };
        game.spawnTransientEffect.earthshakerAreaObserver = true;
    }
}
