import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, projectGroundOffset } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('live long jump and walking aura stay aligned in about 1.5 seconds total', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_JUMP_TIMING !== '1', 'Explicit fresh live jump acceptance');
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentialsFromEnvironment());
    await page.waitForFunction(() => Boolean(window.game?.player?.mesh?.parent));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => window.game?.player?.wellRestedSeconds >= 8 && window.game.player.attachedStatusEffects.has('well_rested'));
    await page.screenshot({ path: testInfo.outputPath('before-jump.png') });
    let target;
    const directions = Array.from({ length: 16 }, (_, i) => [Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
    const candidates = [];
    for (const [dx, dz] of directions) {
        const x = 27 * dx, z = 27 * dz;
        const availableDistance = await page.evaluate(({ x, z }) => {
            const game = window.game, start = game.player.position, end = start.clone();
            end.x += x; end.z += z;
            game.collisionManager?.constrainRockMovementDestination?.(start, end, game.player.radius || 0);
            game.collisionManager?.constrainToDungeonWalkableArea?.(end, game.player.radius || 0);
            const corrected = game.collisionManager?.checkCollision?.(end, game.player.radius || 0, start);
            if (corrected && Math.hypot(corrected.x - end.x, corrected.z - end.z) > .05) return 0;
            return Math.hypot(end.x - start.x, end.z - start.z);
        }, { x, z });
        candidates.push({ x, z, availableDistance });
        if (availableDistance < 20.25) continue;
        const candidate = await projectGroundOffset(page, x, z, { allowScaling: false });
        const gameCanvas = candidate?.canvas && await page.evaluate(({ x, y }) =>
            document.elementFromPoint(x, y) === window.game.renderSystem.renderer.domElement, candidate);
        Object.assign(candidates.at(-1), { candidate, gameCanvas });
        if (gameCanvas) { target = candidate; break; }
    }
    await writeFile(testInfo.outputPath('input-candidates.json'), JSON.stringify(candidates, null, 2));
    expect(target, 'A full long-jump destination must be visible on the canvas').toBeTruthy();
    await page.evaluate(() => {
        const record = window.__jumpTiming = { frames: 0, acceptedDuration: null, history: [], auraSamples: 0, maxAuraError: 0, phaseBacksteps: 0, maxRenderedPathError: 0 };
        const canvas = window.game.renderSystem.renderer.domElement;
        const clicked = event => {
            if (!event.isTrusted || !event.ctrlKey || event.button !== 0) return;
            record.clickedAt = performance.now();
            canvas.removeEventListener('pointerdown', clicked, true);
        };
        canvas.addEventListener('pointerdown', clicked, true);
        const sample = () => {
            const game = window.game, jump = game.playerJumpState, now = performance.now();
            if (jump) {
                record.startedAt ??= now;
                record.frames++;
                record.history.push({ elapsedMs: now - record.clickedAt, elapsed: jump.elapsed, progress: jump.progress, serverDriven: jump.serverDriven });
                const aura = game.player.attachedStatusEffects.get('well_rested');
                if (aura) { record.auraSamples++; record.maxAuraError = Math.max(record.maxAuraError, aura.group.position.distanceTo(game.player.mesh.position)); }
                if (record.previousProgress !== undefined && jump.visualProgress < record.previousProgress - 1e-6) record.phaseBacksteps++;
                record.previousProgress = jump.visualProgress;
                const progress = jump.visualProgress;
                const t = Math.max(0, Math.min(1, jump.elapsed / .12));
                const offsetWeight = 1 - t * t * (3 - 2 * t);
                const expectedX = jump.start.x + (jump.end.x - jump.start.x) * progress + (jump.takeoffOffset?.x || 0) * offsetWeight;
                const expectedZ = jump.start.z + (jump.end.z - jump.start.z) * progress + (jump.takeoffOffset?.z || 0) * offsetWeight;
                record.maxRenderedPathError = Math.max(record.maxRenderedPathError,
                    Math.hypot(game.player.mesh.position.x - expectedX, game.player.mesh.position.z - expectedZ));
                record.distance = Math.hypot(jump.end.x - jump.start.x, jump.end.z - jump.start.z);
                record.end = { x: jump.end.x, z: jump.end.z };
                if (jump.serverDriven) record.acceptedDuration = jump.duration;
            } else if (record.startedAt && game.player.state !== 'JUMPING') {
                record.positionError = Math.hypot(game.player.position.x - record.end.x, game.player.position.z - record.end.z);
                record.renderError = Math.hypot(game.player.mesh.position.x - record.end.x, game.player.mesh.position.z - record.end.z);
                record.elapsedMs = now - record.clickedAt;
                record.observedFlightMs = now - record.startedAt;
                canvas.removeEventListener('pointerdown', clicked, true);
                return;
            }
            if (!record.startedAt || now - record.startedAt < 5_000) requestAnimationFrame(sample);
            else canvas.removeEventListener('pointerdown', clicked, true);
        };
        requestAnimationFrame(sample);
    });
    await page.keyboard.down('Control');
    try { await page.mouse.click(target.x, target.y); }
    finally { await page.keyboard.up('Control'); }
    try {
        await expect.poll(() => page.evaluate(() => window.__jumpTiming.elapsedMs), { timeout: 6_000 }).toBeGreaterThan(0);
    } finally {
        const diagnostic = await page.evaluate(() => ({ ...window.__jumpTiming, state: window.game.player.state,
            logical: window.game.player.position.toArray(), rendered: window.game.player.mesh.position.toArray() }));
        await writeFile(testInfo.outputPath('connected-jump-timing.json'), JSON.stringify({ target, ...diagnostic }, null, 2));
    }
    const result = await page.evaluate(() => window.__jumpTiming);
    await testInfo.attach('connected-jump-timing', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(Number.isFinite(result.clickedAt), 'Total time starts at the trusted native Ctrl-click').toBe(true);
    expect(result.distance).toBeGreaterThanOrEqual(20.25);
    expect(result.acceptedDuration).toBeCloseTo(1.3, 6);
    expect(result.elapsedMs).toBeGreaterThan(1_250);
    expect(result.elapsedMs).toBeLessThan(1_600);
    expect(result.auraSamples).toBeGreaterThan(3);
    expect(result.maxAuraError).toBeLessThan(1e-5);
    expect(result.phaseBacksteps).toBe(0);
    expect(result.maxRenderedPathError).toBeLessThan(1e-4);
    expect(result.positionError).toBeLessThan(.1);
    expect(result.renderError).toBeLessThan(.1);
    await page.screenshot({ path: testInfo.outputPath('after-jump.png') });
    const walkStart = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
    let walkTarget;
    for (const [dx, dz] of directions) {
        const x = 12 * dx, z = 12 * dz;
        const clear = await page.evaluate(({ x, z }) => {
            const game = window.game, start = game.player.position, end = start.clone();
            end.x += x; end.z += z;
            game.collisionManager?.constrainRockMovementDestination?.(start, end, game.player.radius || 0);
            game.collisionManager?.constrainToDungeonWalkableArea?.(end, game.player.radius || 0);
            if (Math.hypot(end.x - start.x, end.z - start.z) < 10) return false;
            let previous = start.clone();
            for (let step = 1; step <= 24; step++) {
                const position = start.clone().lerp(end, step / 24);
                const corrected = game.collisionManager?.checkCollision?.(position, game.player.radius || 0, previous);
                if (corrected && Math.hypot(corrected.x - position.x, corrected.z - position.z) > .05) return false;
                previous = position;
            }
            return true;
        }, { x, z });
        if (!clear) continue;
        const candidate = await projectGroundOffset(page, x, z, { allowScaling: false });
        const gameCanvas = candidate?.canvas && await page.evaluate(({ x, y }) =>
            document.elementFromPoint(x, y) === window.game.renderSystem.renderer.domElement, candidate);
        if (gameCanvas) { walkTarget = candidate; break; }
    }
    expect(walkTarget?.canvas, 'A visible clear walking path must provide multiple rendered samples').toBe(true);
    await page.evaluate(() => {
        const started = performance.now();
        const record = window.__walkingAura = { movingSamples: 0, maxAuraError: 0, history: [] };
        let previous = window.game.player.mesh.position.clone();
        const sample = () => {
            const actor = window.game.player, aura = actor.attachedStatusEffects.get('well_rested');
            const renderedStep = actor.mesh.position.distanceTo(previous);
            record.history.push({ elapsedMs: performance.now() - started, state: actor.state, renderedStep, aura: Boolean(aura) });
            // Presentation can continue interpolating between authoritative
            // state changes. Measure visible movement, which the aura follows.
            if (renderedStep > .001 && aura) { record.movingSamples++; record.maxAuraError = Math.max(record.maxAuraError, aura.group.position.distanceTo(actor.mesh.position)); }
            previous.copy(actor.mesh.position);
            if (performance.now() - started >= 1800) { record.elapsedMs = performance.now() - started; return; }
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
    });
    await page.mouse.move(walkTarget.x, walkTarget.y);
    await page.mouse.down();
    try { await page.waitForTimeout(1000); }
    finally { await page.mouse.up(); }
    await expect.poll(() => page.evaluate(() => window.__walkingAura.elapsedMs)).toBeGreaterThanOrEqual(1800);
    const walk = await page.evaluate(() => window.__walkingAura);
    const walkDistance = await page.evaluate(start => Math.hypot(window.game.player.position.x - start.x, window.game.player.position.z - start.z), walkStart);
    await writeFile(testInfo.outputPath('walking-aura.json'), JSON.stringify({ ...walk, walkDistance }, null, 2));
    expect(walk.movingSamples).toBeGreaterThan(3);
    expect(walk.maxAuraError).toBeLessThan(1e-5);
    expect(walkDistance).toBeGreaterThan(1);
    expect(failures, failures.join('\n')).toEqual([]);
});
