import { expect, test } from '@playwright/test';
import {
    collectBrowserFailures,
    credentialsFromEnvironment,
    loginAndEnterWorld,
    readPlayerState
} from './helpers.js';

const credentials = credentialsFromEnvironment();
const hasCredentials = Boolean(credentials.username && credentials.password);

async function assertHardwareRenderer(page) {
    const renderer = await page.evaluate(() => {
        const context = window.game?.renderSystem?.renderer?.getContext?.();
        if (!context) return null;
        const info = context.getExtension('WEBGL_debug_renderer_info');
        return {
            vendor: info ? context.getParameter(info.UNMASKED_VENDOR_WEBGL) : context.getParameter(context.VENDOR),
            renderer: info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER)
        };
    });
    expect(renderer).not.toBeNull();
    expect(`${renderer.vendor} ${renderer.renderer}`).not.toMatch(/swiftshader|llvmpipe|software/i);
    return renderer;
}

async function projectExactGroundOffset(page, deltaX, deltaZ) {
    return page.evaluate(({ deltaX: dx, deltaZ: dz }) => {
        const game = window.game;
        if (!game?.player?.position || !game.renderSystem?.camera) return null;
        const target = game.player.position.clone();
        target.x += dx;
        target.z += dz;
        const projected = target.clone().project(game.renderSystem.camera);
        const x = (projected.x + 1) * window.innerWidth / 2;
        const y = (-projected.y + 1) * window.innerHeight / 2;
        return {
            x,
            y,
            worldX: target.x,
            worldZ: target.z,
            canvas: projected.z >= -1 && projected.z <= 1 &&
                x >= 0 && x <= window.innerWidth && y >= 0 && y <= window.innerHeight &&
                document.elementFromPoint(x, y)?.tagName === 'CANVAS'
        };
    }, { deltaX, deltaZ });
}

async function findOpenMovementDirection(page, distance, probeDistances = [distance]) {
    return page.evaluate(({ requestedDistance, screenProbeDistances }) => {
        const game = window.game;
        const player = game?.player;
        const camera = game?.renderSystem?.camera;
        if (!player?.position || !camera) return null;

        const entities = (game.activeEntitiesCache || []).filter((entity) =>
            entity !== player && entity?.isActive && entity.state !== 'DEAD' && entity.position
        );
        const boxes = game.collisionManager?.colliders || [];
        const circles = game.collisionManager?.circularColliders || [];
        let best = null;

        for (let index = 0; index < 72; index += 1) {
            const angle = index * Math.PI * 2 / 72;
            const dx = Math.cos(angle) * requestedDistance;
            const dz = Math.sin(angle) * requestedDistance;
            const target = player.position.clone();
            target.x += dx;
            target.z += dz;
            const projected = target.clone().project(camera);
            const x = (projected.x + 1) * window.innerWidth / 2;
            const y = (-projected.y + 1) * window.innerHeight / 2;
            if (projected.z < -1 || projected.z > 1 || x < 0 || x > window.innerWidth ||
                y < 0 || y > window.innerHeight || document.elementFromPoint(x, y)?.tagName !== 'CANVAS') {
                continue;
            }

            const entityMeshes = entities.filter((entity) => entity.mesh).map((entity) => entity.mesh);
            const screenRayClear = screenProbeDistances.every((probeDistance) => {
                const scale = probeDistance / requestedDistance;
                const probe = player.position.clone();
                probe.x += dx * scale;
                probe.z += dz * scale;
                const probeProjected = probe.project(camera);
                game.inputManager.raycaster.setFromCamera(probeProjected, camera);
                return game.inputManager.raycaster.intersectObjects(entityMeshes, true).length === 0;
            });
            if (!screenRayClear) continue;

            let clearance = Number.POSITIVE_INFINITY;
            for (let step = 1; step <= 8; step += 1) {
                const progress = step / 8;
                const sampleX = player.position.x + dx * progress;
                const sampleZ = player.position.z + dz * progress;
                for (const entity of entities) {
                    const radius = Number(entity.radius || 1) + Number(player.radius || 1);
                    clearance = Math.min(
                        clearance,
                        Math.hypot(sampleX - entity.position.x, sampleZ - entity.position.z) - radius
                    );
                }
                for (const box of boxes) {
                    const nearestX = Math.max(box.min.x, Math.min(box.max.x, sampleX));
                    const nearestZ = Math.max(box.min.z, Math.min(box.max.z, sampleZ));
                    clearance = Math.min(clearance, Math.hypot(sampleX - nearestX, sampleZ - nearestZ));
                }
                for (const circle of circles) {
                    clearance = Math.min(
                        clearance,
                        Math.hypot(sampleX - circle.x, sampleZ - circle.z) -
                            Number(circle.radius || 0) - Number(player.radius || 1)
                    );
                }
            }
            if (!best || clearance > best.clearance) best = { dx, dz, clearance };
        }
        return best;
    }, { requestedDistance: distance, screenProbeDistances: probeDistances });
}

async function sampleMovementFrames(page, durationMs) {
    return page.evaluate((duration) => new Promise((resolve) => {
        const frames = [];
        const startedAt = performance.now();
        const capture = (now) => {
            const game = window.game;
            const player = game?.player;
            if (player?.position && player.mesh?.position) {
                frames.push({
                    t: now - startedAt,
                    x: player.position.x,
                    z: player.position.z,
                    renderX: player.mesh.position.x,
                    renderZ: player.mesh.position.z,
                    cameraX: game.renderSystem?.cameraTarget?.x,
                    cameraZ: game.renderSystem?.cameraTarget?.z,
                    targetX: player.targetPosition?.x ?? null,
                    targetZ: player.targetPosition?.z ?? null,
                    state: player.state,
                    animation: player.currentAnimationName || null,
                    correctionActive: Boolean(game.playerCorrectionVisualState)
                });
            }
            if (now - startedAt >= duration) {
                resolve(frames);
                return;
            }
            requestAnimationFrame(capture);
        };
        requestAnimationFrame(capture);
    }), durationMs);
}

async function holdGroundOffsetAndSample(page, deltaX, deltaZ, options = {}) {
    const projected = await projectExactGroundOffset(page, deltaX, deltaZ);
    expect(projected?.canvas, `Ground offset (${deltaX}, ${deltaZ}) must project onto the game canvas`).toBe(true);

    const framesPromise = sampleMovementFrames(page, options.sampleMs || 1_500);
    await page.waitForTimeout(50);
    const hoveredEntity = await movePointerAndReadHoveredEntity(page, projected);
    expect(hoveredEntity, 'Movement QA requires an unobstructed ground ray').toBeNull();
    await page.mouse.down();
    const pointerObservedDown = await page.evaluate(() => Boolean(
        window.game?.inputManager?.primaryMouseButtonDown &&
        window.game?.inputManager?.isMouseDown
    ));
    await page.waitForTimeout(options.holdMs || 100);
    await page.mouse.up();
    return {
        projected,
        pointerObservedDown,
        frames: await framesPromise
    };
}

async function movePointerAndReadHoveredEntity(page, projected) {
    await page.mouse.move(projected.x, projected.y);
    await expect.poll(() => page.evaluate(() => Boolean(
        window.game?.needsRaycast
    )), { timeout: 2_000 }).toBe(false);
    return page.evaluate(() =>
        window.game?.hoveredEntity?.id || window.game?.hoveredEntity?.name || null
    );
}

async function ensureCurrentGroundRayIsClear(page) {
    let lastHoveredEntity = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const current = await projectExactGroundOffset(page, 0, 0);
        expect(current?.canvas, 'Current player position must project onto the game canvas').toBe(true);
        lastHoveredEntity = await movePointerAndReadHoveredEntity(page, current);
        if (!lastHoveredEntity) return;

        const relocationDistance = 8 + attempt * 2;
        const direction = await findOpenMovementDirection(page, relocationDistance);
        expect(direction, `A ray-clear relocation must exist away from ${lastHoveredEntity}`).not.toBeNull();
        const relocation = await holdGroundOffsetAndSample(
            page,
            direction.dx,
            direction.dz,
            { holdMs: 90, sampleMs: 1_250 }
        );
        expect(relocation.pointerObservedDown).toBe(true);
        await waitForArrival(page);
    }
    throw new Error(`No ray-clear current-position probe after bounded real-input relocation; last hover=${lastHoveredEntity}`);
}

async function findOpenMovementDirectionWithRelocation(page, distance, probeDistances = [distance]) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const direction = await findOpenMovementDirection(page, distance, probeDistances);
        if (direction) return direction;

        let relocationDirection = null;
        for (const relocationDistance of [8, 12, 16].map((value) => value + attempt * 2)) {
            relocationDirection = await findOpenMovementDirection(page, relocationDistance);
            if (relocationDirection) break;
        }
        expect(
            relocationDirection,
            `A ray-clear relocation must expose a ${distance}-unit movement target`
        ).not.toBeNull();
        const relocation = await holdGroundOffsetAndSample(
            page,
            relocationDirection.dx,
            relocationDirection.dz,
            { holdMs: 90, sampleMs: 1_250 }
        );
        expect(relocation.pointerObservedDown).toBe(true);
        await waitForArrival(page);
    }
    throw new Error(`No ray-clear ${distance}-unit movement target after bounded real-input relocation`);
}

function movementAnalysis(frames, directionX, directionZ) {
    expect(frames.length).toBeGreaterThan(10);
    const magnitude = Math.hypot(directionX, directionZ) || 1;
    const unitX = directionX / magnitude;
    const unitZ = directionZ / magnitude;
    const first = frames[0];
    let priorLogicalProgress = 0;
    let priorRenderProgress = 0;
    let largestLogicalBacktrack = 0;
    let largestRenderBacktrack = 0;
    let largestRenderStep = 0;
    let maxCameraError = 0;
    let maxRenderLogicalGap = 0;
    const animations = new Set();
    const states = new Set();

    for (const [index, frame] of frames.entries()) {
        const logicalProgress = (frame.x - first.x) * unitX + (frame.z - first.z) * unitZ;
        const renderProgress = (frame.renderX - first.renderX) * unitX +
            (frame.renderZ - first.renderZ) * unitZ;
        if (index > 0) {
            largestLogicalBacktrack = Math.min(largestLogicalBacktrack, logicalProgress - priorLogicalProgress);
            largestRenderBacktrack = Math.min(largestRenderBacktrack, renderProgress - priorRenderProgress);
            largestRenderStep = Math.max(
                largestRenderStep,
                Math.hypot(frame.renderX - frames[index - 1].renderX, frame.renderZ - frames[index - 1].renderZ)
            );
        }
        priorLogicalProgress = logicalProgress;
        priorRenderProgress = renderProgress;
        maxCameraError = Math.max(
            maxCameraError,
            Math.hypot(frame.cameraX - frame.renderX, frame.cameraZ - frame.renderZ)
        );
        maxRenderLogicalGap = Math.max(
            maxRenderLogicalGap,
            Math.hypot(frame.renderX - frame.x, frame.renderZ - frame.z)
        );
        if (frame.animation) animations.add(frame.animation);
        if (frame.state) states.add(frame.state);
    }

    return {
        logicalTravel: Math.hypot(frames.at(-1).x - first.x, frames.at(-1).z - first.z),
        renderTravel: Math.hypot(
            frames.at(-1).renderX - first.renderX,
            frames.at(-1).renderZ - first.renderZ
        ),
        largestLogicalBacktrack,
        largestRenderBacktrack,
        largestRenderStep,
        maxCameraError,
        maxRenderLogicalGap,
        animations: [...animations],
        states: [...states],
        correctionFrames: frames.filter((frame) => frame.correctionActive).length,
        sampledFrames: frames.length
    };
}

async function movementMetrics(page) {
    return page.evaluate(() => window.game?.getMovementMetrics?.() || null);
}

async function waitForArrival(page) {
    await expect.poll(() => page.evaluate(() => ({
        state: window.game?.player?.state,
        hasTarget: Boolean(window.game?.player?.targetPosition)
    })), { timeout: 8_000 }).toEqual({ state: 'IDLE', hasTarget: false });
}

async function recallToTownForMovementQA(page) {
    await page.bringToFront();
    await page.keyboard.press('b');
    await expect.poll(async () => {
        const state = await readPlayerState(page);
        return Math.hypot(state.x + 1.25, state.z - 200);
    }, { timeout: 10_000 }).toBeLessThan(0.5);
    await waitForArrival(page);
    await page.waitForTimeout(250);
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('real-input movement smoothness', () => {
    test.skip(!hasCredentials, 'Set EIDOLON_E2E_USERNAME and EIDOLON_E2E_PASSWORD for movement QA');

    test('nearby and sustained movement stays monotonic, acknowledged, and camera-coherent', async ({ page, baseURL }, testInfo) => {
        test.setTimeout(180_000);
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        const renderer = await assertHardwareRenderer(page);
        await recallToTownForMovementQA(page);
        await ensureCurrentGroundRayIsClear(page);

        const beforeNearby = await movementMetrics(page);
        const start = await readPlayerState(page);
        const exact = await holdGroundOffsetAndSample(page, 0, 0, { holdMs: 650, sampleMs: 1_000 });
        await waitForArrival(page);
        const afterExact = await movementMetrics(page);
        const exactEnd = await readPlayerState(page);

        expect(exact.pointerObservedDown).toBe(true);
        expect(Math.hypot(exactEnd.x - start.x, exactEnd.z - start.z)).toBeLessThan(0.1);
        expect(afterExact.local.actor.accepted - beforeNearby.local.actor.accepted).toBe(0);
        expect(afterExact.local.actor.animationTransitions - beforeNearby.local.actor.animationTransitions).toBe(0);
        expect(new Set(exact.frames.map((frame) => frame.state))).toEqual(new Set(['IDLE']));

        const nearbyDirection = await findOpenMovementDirectionWithRelocation(page, 1.5, [0.05, 1.5]);
        const nearbyMagnitude = Math.hypot(nearbyDirection.dx, nearbyDirection.dz);
        const nearbyUnitX = nearbyDirection.dx / nearbyMagnitude;
        const nearbyUnitZ = nearbyDirection.dz / nearbyMagnitude;
        const beforeSubArrival = await movementMetrics(page);
        const subArrival = await holdGroundOffsetAndSample(
            page,
            nearbyUnitX * 0.05,
            nearbyUnitZ * 0.05,
            { holdMs: 350, sampleMs: 750 }
        );
        await waitForArrival(page);
        const afterSubArrival = await movementMetrics(page);
        expect(subArrival.pointerObservedDown).toBe(true);
        expect(afterSubArrival.local.actor.accepted - beforeSubArrival.local.actor.accepted).toBe(0);
        expect(movementAnalysis(subArrival.frames, nearbyUnitX, nearbyUnitZ).logicalTravel).toBeLessThan(0.1);

        const beforeShort = await movementMetrics(page);
        const short = await holdGroundOffsetAndSample(
            page,
            nearbyDirection.dx,
            nearbyDirection.dz,
            { holdMs: 90, sampleMs: 1_250 }
        );
        await waitForArrival(page);
        const afterShort = await movementMetrics(page);
        const shortAnalysis = movementAnalysis(short.frames, nearbyDirection.dx, nearbyDirection.dz);
        expect(shortAnalysis.logicalTravel).toBeGreaterThan(0.75);
        expect(shortAnalysis.largestLogicalBacktrack).toBeGreaterThanOrEqual(-0.02);
        expect(shortAnalysis.largestRenderBacktrack).toBeGreaterThanOrEqual(-0.02);
        expect(shortAnalysis.maxCameraError).toBeLessThan(0.05);
        expect(afterShort.local.actor.arrivals - beforeShort.local.actor.arrivals).toBe(1);

        const sustainedDirection = await findOpenMovementDirectionWithRelocation(page, 8);
        const beforeLong = await movementMetrics(page);
        const sustained = await holdGroundOffsetAndSample(
            page,
            sustainedDirection.dx,
            sustainedDirection.dz,
            { holdMs: 90, sampleMs: 2_500 }
        );
        await waitForArrival(page);
        await page.waitForTimeout(500);
        const afterLong = await movementMetrics(page);
        const sustainedAnalysis = movementAnalysis(
            sustained.frames,
            sustainedDirection.dx,
            sustainedDirection.dz
        );

        expect(sustainedAnalysis.logicalTravel).toBeGreaterThan(6);
        expect(sustainedAnalysis.renderTravel).toBeGreaterThan(6);
        expect(sustainedAnalysis.largestLogicalBacktrack).toBeGreaterThanOrEqual(-0.02);
        expect(sustainedAnalysis.largestRenderBacktrack).toBeGreaterThanOrEqual(-0.02);
        expect(sustainedAnalysis.largestRenderStep).toBeLessThan(1);
        expect(sustainedAnalysis.maxCameraError).toBeLessThan(0.05);
        expect(sustainedAnalysis.maxRenderLogicalGap).toBeLessThan(0.75);
        expect(sustainedAnalysis.states).toContain('MOVING');
        expect(sustainedAnalysis.states).toContain('IDLE');
        expect(sustainedAnalysis.animations).toContain('Run');
        expect(sustainedAnalysis.correctionFrames).toBe(0);
        expect(afterLong.local.serverAdjustments - beforeLong.local.serverAdjustments).toBe(0);
        expect(afterLong.local.hardCorrections - beforeLong.local.hardCorrections).toBe(0);
        expect(afterLong.local.actor.arrivals - beforeLong.local.actor.arrivals).toBe(1);
        expect(afterLong.local.actor.animationTransitions - beforeLong.local.actor.animationTransitions).toBeLessThanOrEqual(3);
        expect(afterLong.local.lastAcknowledgedSequence).toBeGreaterThanOrEqual(
            afterLong.local.lastSentSequence - 2
        );
        expect(afterLong.local.pendingAcknowledgements).toBeLessThanOrEqual(2);

        const beforeIdle = await movementMetrics(page);
        await page.waitForTimeout(1_250);
        const afterIdle = await movementMetrics(page);
        expect(afterIdle.local.packetsSent - beforeIdle.local.packetsSent).toBeLessThanOrEqual(2);
        expect(failures, failures.join('\n')).toEqual([]);

        await testInfo.attach('movement-smoothness-evidence', {
            body: Buffer.from(JSON.stringify({
                renderer,
                exactCurrentFrames: exact.frames.length,
                subArrivalFrames: subArrival.frames.length,
                short: shortAnalysis,
                sustained: sustainedAnalysis,
                transport: afterLong.local
            }, null, 2)),
            contentType: 'application/json'
        });
    });
});
