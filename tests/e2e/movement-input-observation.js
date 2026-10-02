import { expect } from '@playwright/test';
import { projectMovementGroundOffset } from '../movementGroundProjection.js';

export async function sampleMovementFrames(page, durationMs) {
    return page.evaluate((duration) => new Promise((resolve) => {
        const frames = [];
        const startedAt = performance.now();
        const capture = (now) => {
            const game = window.game;
            const player = game?.player;
            if (player?.position && player.mesh?.position) {
                const ground = game.inputManager?.getGroundIntersection?.();
                frames.push({
                    t: now - startedAt, speed: player.stats?.speed,
                    wellRestedSeconds: player.wellRestedSeconds,
                    simulationFrame: game.frameCount, simulationTime: game.lastTime,
                    simulationAccumulator: game.accumulator,
                    x: player.position.x, z: player.position.z,
                    renderX: player.mesh.position.x, renderZ: player.mesh.position.z,
                    cameraX: game.renderSystem?.cameraTarget?.x,
                    cameraZ: game.renderSystem?.cameraTarget?.z,
                    targetX: player.targetPosition?.x ?? null,
                    targetZ: player.targetPosition?.z ?? null,
                    state: player.state, animation: player.currentAnimationName || null,
                    correctionActive: Boolean(game.playerCorrectionVisualState),
                    groundX: ground?.x ?? null, groundZ: ground?.z ?? null,
                    playerY: player.position.y, pointerX: game.inputManager?.mouse?.x,
                    pointerY: game.inputManager?.mouse?.y,
                    cameraPosition: game.renderSystem?.camera?.position?.toArray(),
                    cameraTarget: game.renderSystem?.cameraTarget?.toArray(),
                    accepted: player.movementMetrics?.accepted,
                    nearbyNoops: player.movementMetrics?.nearbyNoops
                });
            }
            if (now - startedAt >= duration) return resolve(frames);
            requestAnimationFrame(capture);
        };
        // Include the pre-input baseline, rather than waiting a render frame
        // and potentially missing the first simulation ticks at maximum speed.
        capture(startedAt);
    }), durationMs);
}

export async function movePointerAndReadHoveredEntity(page, projected) {
    await page.mouse.move(projected.x, projected.y);
    await expect.poll(() => page.evaluate(() => Boolean(
        window.game?.needsRaycast
    )), { timeout: 2_000 }).toBe(false);
    return page.evaluate(() =>
        window.game?.hoveredEntity?.id || window.game?.hoveredEntity?.name || null
    );
}

export async function holdGroundOffsetAndSample(page, deltaX, deltaZ, options = {}) {
    const projected = await page.evaluate(projectMovementGroundOffset, { deltaX, deltaZ });
    expect(projected?.canvas, `Ground offset (${deltaX}, ${deltaZ}) must project onto the game canvas`).toBe(true);
    const hoveredEntity = await movePointerAndReadHoveredEntity(page, projected);
    // A roaming hostile can cross a previously clear ray. Reselect only before
    // pressing the mouse; an actual failed movement is never retried here.
    if (hoveredEntity && options.reselectBlocked) return null;
    expect(hoveredEntity, 'Movement QA requires an unobstructed ground ray').toBeNull();
    const aimed = await page.evaluate(() => {
        const game = window.game, p = game.player, input = game.inputManager;
        const ground = input.getGroundIntersection();
        return { player: p.position.toArray(), rendered: p.mesh.position.toArray(),
            ground: ground?.toArray(), pointer: input.mouse.toArray(),
            groundDistance: ground ? Math.hypot(ground.x - p.position.x, ground.z - p.position.z) : null,
            camera: game.renderSystem.camera.position.toArray(),
            cameraTarget: game.renderSystem.cameraTarget?.toArray() };
    });
    // Do not launch a sampler until all no-input preconditions have passed.
    const framesPromise = sampleMovementFrames(page, options.sampleMs || 1_500);
    let pointerObservedDown;
    try {
        await page.mouse.down();
        pointerObservedDown = await page.evaluate(() => Boolean(
            window.game?.inputManager?.primaryMouseButtonDown &&
            window.game?.inputManager?.isMouseDown
        ));
        await page.waitForTimeout(options.holdMs || 100);
    } finally {
        await page.mouse.up();
        await framesPromise;
    }
    return { projected, aimed, pointerObservedDown, frames: await framesPromise };
}

export async function waitForArrival(page) {
    await expect.poll(() => page.evaluate(() => ({
        state: window.game?.player?.state,
        hasTarget: Boolean(window.game?.player?.targetPosition),
        animation: window.game?.player?.currentAnimationName
    })), { timeout: 8_000 }).toEqual({ state: 'IDLE', hasTarget: false, animation: 'Idle' });
}
