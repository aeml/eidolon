import { expect, test } from '@playwright/test';

// Native frame-loop/render proof with the supplied Fighter, without a server
// or populated world. Authoritative packet handling is covered separately.
test('slow native frames preserve 1.5-second jump travel', async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        document.getElementById('start-screen').style.display = 'none';
        const socket = { readyState: WebSocket.OPEN, send() {}, close() {} };
        const game = new GameEngine('Fighter', false, true, '', '', socket);
        const errors = [];
        const originalError = console.error;
        console.error = (...args) => { errors.push(args.map(String).join(' ')); originalError(...args); };
        try {
            game.renderSystem.setGraphicsQuality('low');
            game.player = new Fighter('jump-clock-fixture');
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
    });
    await testInfo.attach('jump-wall-clock', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.errors).toEqual([]);
    for (const sample of result.samples) {
        expect(sample.elapsedMs).toBeGreaterThanOrEqual(1500);
        expect(sample.elapsedMs).toBeLessThan(1750);
        expect(sample.positionError).toBeLessThan(0.01);
        expect(sample.renderError).toBeLessThan(0.01);
    }
});
