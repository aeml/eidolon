import { expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { moveByGroundClick, readPlayerState } from './helpers.js';

// Explicit post-login visual evidence. These prepared level30 saves are not an
// earned campaign, encounter clear, physical phone or frame-budget certificate.
// Ground clicks use normal client/server movement; no teleport or direct actor
// assignment occurs on the town→gate→Earth→Verdant approach route.
export async function captureEarthMovingRoute(page, testInfo) {
    const folder = testInfo.outputPath('post-login-moving-route');
    await mkdir(folder, { recursive: true, mode: 0o700 });
    const session = await page.context().newCDPSession(page);
    const frames = [], writes = [], observations = [];
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
        await session.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 844, everyNthFrame: 6 });
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
            frames, observations, elapsedMs: performance.now() - started
        }, null, 2));
    }
    expect(frames.length).toBeGreaterThan(20);
}
