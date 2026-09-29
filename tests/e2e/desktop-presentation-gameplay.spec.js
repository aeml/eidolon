import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    moveByGroundClick, projectNearestHostile, readPlayerState } from './helpers.js';

test.use({ viewport: { width: 1440, height: 900 }, trace: 'off', screenshot: 'off', video: 'off' });

test.afterEach(async ({ page }, testInfo) => {
    if (page.isClosed()) return;
    const video = await page.evaluate(async () => {
        const recording = window.__routeCanvasRecording;
        if (!recording) return null;
        if (recording.recorder.state !== 'inactive') recording.recorder.stop();
        try { return await recording.finished; }
        finally {
            clearTimeout(recording.timeout);
            recording.stream.getTracks().forEach(track => track.stop());
            if (window.game.player.nameTag) window.game.player.nameTag.layers.mask = recording.mask;
            delete window.__routeCanvasRecording;
        }
    });
    if (video) await testInfo.attach('town-to-fight-motion', {
        body: Buffer.from(video, 'base64'), contentType: 'video/webm'
    });
});

test('desktop presentation walks from town to a starter fight with the real HUD', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_DESKTOP_PRESENTATION !== '1', 'Explicit disposable presentation check');
    test.setTimeout(120_000);
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    expect(process.env.EIDOLON_E2E_WS_URL).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/ws$/);
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL), views = [];
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.isMobile)).toBe(false);
    async function capture(stage) {
        await expect(page.locator('#start-screen')).toBeHidden();
        await expect(page.locator('#auth-password')).toBeHidden();
        const state = await page.evaluate(() => {
            const g = window.game, tag = g.player.nameTag;
            const mask = tag?.layers.mask;
            if (tag) tag.layers.mask = 0;
            return { mask, position: g.player.position.toArray(), zoom: g.renderSystem.currentZoom,
                quality: g.renderSystem.graphicsQuality, hp: g.player.stats.hp,
                attackClip: g.player.currentAction?.getClip().name };
        });
        try {
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.screenshot({ path: testInfo.outputPath(stage + '.png'),
                style: '#perf-overlay, #chat-messages > * { visibility: hidden !important; }',
                mask: [page.getByText(credentials.username, { exact: false })] });
            const { mask: _private, ...view } = state;
            views.push({ stage, ...view });
        } finally {
            await page.evaluate(mask => {
                if (mask !== undefined && window.game.player.nameTag) window.game.player.nameTag.layers.mask = mask;
            }, state.mask);
        }
    }
    await expect(page.locator('#chat-box')).toBeVisible();
    await expect(page.locator('#hotbar-container')).toBeVisible();
    await capture('town-hud');
    // Opt-in recording captures only the world canvas after login, never DOM
    // credentials/chat/account UI. Hide the generated character's name too.
    if (process.env.EIDOLON_E2E_PRESENTATION_VIDEO === '1') await page.evaluate(() => {
        const g = window.game, tag = g.player.nameTag, mask = tag?.layers.mask;
        if (tag) tag.layers.mask = 0;
        const stream = g.renderSystem.renderer.domElement.captureStream(12);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 1_500_000 });
        const chunks = [];
        recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
        const finished = new Promise(resolve => {
            recorder.onstop = () => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(new Blob(chunks, { type: 'video/webm' }));
            };
        });
        recorder.start(1000);
        window.__routeCanvasRecording = { recorder, stream, mask, finished,
            timeout: setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 90_000) };
    });
    // Walk the connected first route. No waypoint, level/gear grant, protection,
    // direct position assignment or injected combat outcome substitutes for it.
    const journey = [];
    // Follow the paved route around the Votive Market, not a straight line
    // through its building. These segments also clear exported town solids.
    for (const [x, z] of [[8, 219], [40, 222], [51, 209], [100, 200], [120, 200]]) {
        for (let step = 0; step < 10; step++) {
            const before = await readPlayerState(page);
            expect(before.state).not.toBe('DEAD');
            const dx = x - before.x, dz = z - before.z, distance = Math.hypot(dx, dz);
            if (distance < 2) break;
            const scale = Math.min(1, 10 / distance);
            await moveByGroundClick(page, dx * scale, dz * scale,
                { requireClearPath: true, allowAlternatePaths: false, allowJumpFallback: false, moveOnly: true });
            // The shared helper witnesses initial movement, not arrival. Let
            // the real click finish before projecting the next ground point.
            await expect.poll(async () => (await readPlayerState(page)).state,
                { timeout: 8000, intervals: [100, 200] }).toBe('IDLE');
            const after = await readPlayerState(page);
            journey.push({ x: after.x, z: after.z, state: after.state });
        }
        const reached = await readPlayerState(page);
        expect(Math.hypot(reached.x - x, reached.z - z)).toBeLessThan(2);
        if (x === 100) {
            const fences = await page.evaluate(() => [...window.game.remotePlayers.values()]
                .filter(e => e.constructor.name === 'Fence' && e.position.x === 100 && Math.abs(e.position.z - 200) < 30)
                .map(e => ({ owned: e.environmentOwned, hasMesh: Boolean(e.mesh) })));
            expect(fences.length).toBeGreaterThan(0);
            expect(fences.every(f => f.owned && !f.hasMesh)).toBe(true);
            await capture('east-gate-hud');
        }
    }
    const outside = await readPlayerState(page);
    expect(outside.x).toBeGreaterThanOrEqual(118);
    expect(Math.abs(outside.z - 200)).toBeLessThan(5);
    await testInfo.attach('ordinary-route', { body: JSON.stringify(journey), contentType: 'application/json' });
    await capture('encounter-hud');
    let target;
    await expect.poll(async () => { target = await projectNearestHostile(page); return Boolean(target); }).toBe(true);
    await page.evaluate(() => {
        const network = window.game.network, send = network.send.bind(network);
        window.__presentationAttacks = [];
        network.send = (type, payload) => {
            if (type === 'attack') window.__presentationAttacks.push(payload.targetId);
            return send(type, payload);
        };
    });
    await page.mouse.click(target.x, target.y);
    await expect.poll(() => page.evaluate(id => window.__presentationAttacks.includes(id), target.id)).toBe(true);
    await expect.poll(() => page.evaluate(id => {
        const g = window.game;
        const enemy = g.activeEntitiesCache.find(e => e.id === id) || g.remotePlayers.get(id);
        return enemy?.state === 'DEAD' ? 0 : enemy?.stats.hp ?? Infinity;
    }, target.id), { timeout: 20_000 }).toBeLessThan(target.health);
    await capture('attack-hud');
    await expect.poll(() => page.evaluate(id => {
        const g = window.game, enemy = g.remotePlayers.get(id);
        return enemy?.state === 'DEAD';
    }, target.id), { timeout: 35_000, intervals: [100, 200] }).toBe(true);
    expect((await readPlayerState(page)).state).not.toBe('DEAD');
    await capture('defeated-hud');
    await testInfo.attach('presentation-views', { body: JSON.stringify(views), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
