// Self-contained for Playwright page.evaluate serialization. Instrument only
// this short sample, preserving method behavior and restoring own descriptors.
// Timings are CPU wall time (including preemption), NOT GPU execution time.
export function sampleMovingCastFrames(duration = 650) {
    return new Promise((resolve, reject) => {
        const frames = [], restore = [];
        const game = window.game;
        const startedAt = performance.now();
        let costs = { updateMs: 0, updateCalls: 0, renderMs: 0, renderCalls: 0 };
        const cleanup = () => { for (const undo of restore.reverse()) undo(); };
        try {
            for (const name of ['update', 'render']) {
                if (typeof game?.[name] !== 'function') continue;
                const original = game[name];
                const descriptor = Object.getOwnPropertyDescriptor(game, name);
                game[name] = function (...args) {
                    const start = performance.now();
                    try { return original.apply(this, args); }
                    finally {
                        costs[`${name}Ms`] += performance.now() - start;
                        costs[`${name}Calls`]++;
                    }
                };
                restore.push(() => {
                    if (descriptor) Object.defineProperty(game, name, descriptor);
                    else delete game[name];
                });
            }
            const capture = now => {
                try {
                    const player = window.game?.player;
                    const observedAt = performance.now();
                    const draw = game?.renderSystem?.renderer?.info?.render;
                    if (player?.position) {
                        frames.push({ elapsedMs: now - startedAt,
                            observedElapsedMs: observedAt - startedAt, callbackLagMs: observedAt - now,
                            x: player.position.x, z: player.position.z, state: player.state,
                            targetX: player.targetPosition?.x ?? null, targetZ: player.targetPosition?.z ?? null,
                            ability: player.currentAbilityAnimation?.skillName || null,
                            ...costs, drawCalls: draw?.calls ?? null, triangles: draw?.triangles ?? null });
                    }
                    costs = { updateMs: 0, updateCalls: 0, renderMs: 0, renderCalls: 0 };
                    // Preserve the existing RAF-based deadline and frame count;
                    // do not warm up, extend the window or manufacture frames.
                    if (now - startedAt >= duration) { cleanup(); resolve(frames); }
                    else requestAnimationFrame(capture);
                } catch (error) { cleanup(); reject(error); }
            };
            requestAnimationFrame(capture);
        } catch (error) { cleanup(); reject(error); }
    });
}
