// Runs in the browser with either source modules or the actual published bundle.
export async function measureJumpWallClock({ publishedRelease = null } = {}) {
    const THREE = await import('three');
    const { GameEngine } = await import(publishedRelease
        ? `/src/core/GameEngine.bundle.js?release=${publishedRelease}`
        : '/src/core/GameEngine.js');
    document.getElementById('start-screen').style.display = 'none';
    const socket = { readyState: WebSocket.OPEN, send() {}, close() {} };
    const game = new GameEngine('Fighter', false, true, '', '', socket);
    const errors = [];
    const originalError = console.error;
    console.error = (...args) => { errors.push(args.map(String).join(' ')); originalError(...args); };
    try {
        game.renderSystem.setGraphicsQuality('low');
        game.player = game.createRemotePlayer('Player', 'jump-clock-fixture', 'Fighter');
        game.player.gameEngine = game;
        await game.player.ensureMesh();
        game.chunkManager.addEntity(game.player);
        game.renderSystem.add(game.player.mesh);
        game.cameraLocked = true;
        // The fixture drives real browser RAF timestamps at a chosen cadence.
        game.isDestroyed = true;
        const samples = [];
        for (const fps of [15, 60]) {
            game.player.position.set(0, 0, 0);
            game.playerJumpLandingVisual = null;
            game.accumulator = 0;
            game.renderSystem.setCameraTarget(game.player.position);
            game.render(1);
            await new Promise(resolve => requestAnimationFrame(resolve));
            const start = performance.now();
            game.lastTime = start / 1000;
            if (!game.startPlayerJump(new THREE.Vector3(27, 0, 0))) throw Error('Jump did not start');
            let frames = 0, previous = start, maxFrameGapMs = 0;
            await new Promise((resolve, reject) => {
                const sample = now => {
                    if (now - start > 5000) { reject(Error('Jump did not finish')); return; }
                    if (now - previous >= 1000 / fps - 0.5) {
                        maxFrameGapMs = Math.max(maxFrameGapMs, now - previous);
                        previous = now;
                        game.loop(now);
                        frames++;
                        if (!game.playerJumpState) { resolve(); return; }
                    }
                    requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
            });
            samples.push({ fps, frames, elapsedMs: performance.now() - start, maxFrameGapMs,
                positionError: game.player.position.distanceTo(new THREE.Vector3(27, 0, 0)),
                renderError: game.player.mesh.position.distanceTo(new THREE.Vector3(27, 0, 0)) });
        }
        return { samples, errors };
    } finally {
        console.error = originalError;
        game.isDestroyed = false;
        game.destroy();
    }
}
