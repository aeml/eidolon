// Serialized into a fresh browser document. Forward production handlers once;
// collect raw receipts and actual effect frames without changing game state.
export function installWhirlwindAreaObserver() {
    const game = window.game;
    window.__whirlwindArea = { results: [], casts: [], states: [], effects: [], expired: false };
    if (!game.handleServerMessage.whirlwindAreaObserver) {
        const receive = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            const result = receive(message), qa = window.__whirlwindArea;
            if (message.type === 'ability_result' && message.payload?.skillName === 'Whirlwind') qa.results.push(message.payload);
            if (message.type === 'ability' && message.payload?.sourceId === game.player.id && message.payload.skillName === 'Whirlwind') qa.casts.push(message.payload);
            const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
            for (const state of Object.values(states || {})) {
                if (state.id !== game.player.id) continue;
                if (state.whirlwindActive === true && qa.states.length < 64) {
                    qa.states.push({ radius: state.whirlwindRadius, duration: state.whirlwindDuration });
                }
                if (state.whirlwindActive === false && qa.states.length > 0) qa.expired = true;
            }
            return result;
        };
        game.handleServerMessage.whirlwindAreaObserver = true;
    }
    if (!game.spawnTransientEffect.whirlwindAreaObserver) {
        const spawn = game.spawnTransientEffect.bind(game);
        game.spawnTransientEffect = (...args) => {
            const previous = game.player.whirlwindCastEffect;
            const result = spawn(...args), effect = game.player.whirlwindCastEffect;
            if (effect && effect !== previous && !effect.whirlwindAreaObserver) {
                effect.whirlwindAreaObserver = true;
                const record = { duration: effect.duration, frames: [] };
                window.__whirlwindArea.effects.push(record);
                const update = effect.update.bind(effect);
                effect.update = dt => {
                    const result = update(dt);
                    const boundary = effect.root.children.find(child => child.userData.normalizedGameplayRadius === 1);
                    effect.root.updateMatrixWorld(true);
                    const matrix = boundary?.matrixWorld.elements;
                    if (record.frames.length < 512) record.frames.push({
                        elapsed: effect.elapsed, active: effect.isActive, acknowledged: effect.authoritativeSeen,
                        radius: matrix ? Math.hypot(matrix[0], matrix[1], matrix[2]) : null,
                        quality: effect.root.userData.quality, visible: boundary?.visible === true && effect.root.visible,
                        attached: effect.root.parent === game.renderSystem.effectGroup,
                        sourceX: game.player.position.x, sourceZ: game.player.position.z,
                        x: effect.root.position.x, z: effect.root.position.z
                    });
                    return result;
                };
            }
            return result;
        };
        game.spawnTransientEffect.whirlwindAreaObserver = true;
    }
}
