import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { moveByGroundClick, readPlayerState } from './helpers.js';
import { profileGameplayScene } from './scene-performance.js';
import { capturePartySubmissionFrames } from './party-submission-frames.js';
import { compareDemonOrcScene } from './demon-orc-scene-comparison.js';

// Explicit post-login visual evidence. These prepared level30 saves are not an
// earned campaign, encounter clear, physical phone or frame-budget certificate.
// Ground clicks use normal client/server movement; no teleport or direct actor
// assignment occurs on the town→gate→Earth→Verdant approach route.
export async function captureEarthMovingRoute(page, testInfo) {
    const folder = testInfo.outputPath('post-login-moving-route');
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const session = await page.context().newCDPSession(page);
    const frames = [], writes = [], observations = [], profiles = [];
    const captureOptions = { format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 844, everyNthFrame: 6 };
    const started = performance.now();
    let recording = false;
    const observe = () => page.evaluate(() => {
        const game = window.game, player = game?.player, render = game?.renderSystem;
        if (!player || game.isDestroyed || document.querySelector('#login-panel')?.getClientRects().length)
            throw new Error('Visual route must stay inside actual post-login gameplay');
        return { x: player.position.x, y: player.position.y, z: player.position.z,
            state: player.state, meshY: player.mesh.position.y, hp: player.stats.hp,
            terrain: game.terrainElevation?.sample(player.position.x, player.position.z) ?? 0,
            calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
            equippedItems: player.mesh.userData.equipmentVisualItemCount,
            profile: game.terrainProfile, visibility: document.visibilityState };
    });
    const screenshot = async label => {
        const snapshot = await observe();
        expect(snapshot.equippedItems).toBe(14); expect(snapshot.hp).toBeGreaterThan(0);
        expect(snapshot.profile).toBe('earth-elevation-rocks-v1');
        expect(Math.abs(snapshot.y - snapshot.terrain)).toBeLessThan(.1);
        expect(Math.abs(snapshot.meshY - snapshot.terrain)).toBeLessThan(.15);
        observations.push({ label, elapsedMs: performance.now() - started, ...snapshot });
        await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
        if (process.env.EIDOLON_E2E_DEMON_ORC_COMPARE === '1' && label === 'woodland-cut') {
            await compareDemonOrcScene(page, testInfo);
        }
        if (process.env.EIDOLON_E2E_ROUTE_SUBMISSIONS === '1' &&
            ['town-start', 'woodland-cut'].includes(label)) {
            await capturePartySubmissionFrames(page, testInfo, `${label}-submission-frames.json`);
        }
        if (process.env.EIDOLON_E2E_ROUTE_BUDGETS === '1' &&
            ['town-start', 'earth-road', 'woodland-cut', 'bastion-approach'].includes(label)) {
            // Keep capture work outside the ordinary real-frame budget sample.
            const resume = recording;
            if (resume) { recording = false; await session.send('Page.stopScreencast'); }
            try {
                const report = await profileGameplayScene(page, `ordinary-moving-route-${label}`);
                const quality = await page.evaluate(() => window.game.renderSystem.graphicsQuality);
                expect(['high', 'low']).toContain(quality);
                const budget = { draws: quality === 'high' ? 350 : 200,
                    triangles: quality === 'high' ? 250000 : 85000, frameMedianMs: 20, frameP95Ms: 33.4 };
                profiles.push({ label, quality, budget, report });
                await writeFile(testInfo.outputPath(`route-profile-${label}.json`), JSON.stringify(profiles.at(-1), null, 2));
            } finally {
                if (resume) { await session.send('Page.startScreencast', captureOptions); recording = true; }
            }
        }
    };
    session.on('Page.screencastFrame', event => {
        if (recording && frames.length < 900) {
            const name = `frame-${String(frames.length).padStart(4, '0')}.jpg`;
            frames.push({ name, timestamp: event.metadata.timestamp });
            writes.push(writeFile(`${folder}/${name}`, Buffer.from(event.data, 'base64'), { mode: 0o600 }));
        }
        session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
    });
    try {
        await expect.poll(() => page.evaluate(() => window.game?.player?.mesh?.userData.equipmentVisualItemCount)).toBe(14);
        const initial = await readPlayerState(page);
        expect(Math.hypot(initial.x + 1.25, initial.z - 200)).toBeLessThan(1);
        await screenshot('town-start');
        recording = true;
        await session.send('Page.startScreencast', captureOptions);
        // Votive Market at(30,200) occupies the direct line from the plaza.
        // Walk its northern side, then return to the real east gate road.
        for (const [label, x, z] of [['north-court', 0, 186], ['market-pass', 60, 186], ['east-street', 60, 200],
            ['east-gate', 120, 200], ['earth-road', 240, 200], ['woodland-cut', 470, 200], ['bastion-approach', 760, 200]]) {
            while (true) {
                const before = await readPlayerState(page), distance = Math.hypot(x - before.x, z - before.z);
                if (distance < .6) break;
                expect(performance.now() - started, 'Bounded ordinary-input visual route').toBeLessThan(140000);
                const step = Math.min(20, distance) / distance;
                const targetX = before.x + (x - before.x) * step, targetZ = before.z + (z - before.z) * step;
                await moveByGroundClick(page, targetX - before.x, targetZ - before.z, {
                    moveOnly: true, requireClearPath: true, allowAlternatePaths: false, allowJumpFallback: false,
                    minimumDistance: .1, timeout: 7000,
                    arrival: { x: targetX, z: targetZ, radius: .6, instanceId: before.instanceId }
                });
                // The shared helper proves progress, including with an arrival
                // target. This route separately requires actual settlement.
                await expect.poll(async () => {
                    const state = await readPlayerState(page);
                    return state.state === 'IDLE' && Math.hypot(state.x - targetX, state.z - targetZ) < .6;
                }, { timeout: 7000, message: 'Normal input must reach each route step before another click' }).toBe(true);
                const state = await observe();
                observations.push({ label: 'normal-input-step', elapsedMs: performance.now() - started, ...state });
            }
            await screenshot(label);
        }

    } finally {
        recording = false;
        try { await session.send('Page.stopScreencast'); }
        finally { await session.detach(); await Promise.all(writes); }
        await writeFile(testInfo.outputPath('moving-route.json'), JSON.stringify({
            scope: 'Prepared level30 Fighter, normal ground-input continuous town→gate→Earth road→Verdant approach, actual HUD and native render. Explicit post-login screencast; excluded from subsequent party frame timings. No campaign/encounter clear/mobile/final-art approval.',
            frames, observations, profiles, elapsedMs: performance.now() - started
        }, null, 2));
    }
    expect(frames.length).toBeGreaterThan(20);
    if (process.env.EIDOLON_E2E_ROUTE_BUDGETS === '1') {
        expect(profiles.map(profile => profile.label)).toEqual(['town-start', 'earth-road', 'woodland-cut', 'bastion-approach']);
        for (const { label, budget, report } of profiles) {
            expect(report.frames, label).toBe(180); expect(report.visibleFrames, label).toBe(180);
            expect(report.restored, label).toBe(true);
            expect(report.renderer, label).not.toMatch(/swiftshader|llvmpipe|software/i);
            expect(report.drawCallsMedian, label).toBeLessThanOrEqual(budget.draws);
            expect(report.trianglesMedian, label).toBeLessThanOrEqual(budget.triangles);
            expect(report.frameMedianMs, label).toBeLessThanOrEqual(budget.frameMedianMs);
            expect(report.frameP95Ms, label).toBeLessThanOrEqual(budget.frameP95Ms);
        }
    }
}
