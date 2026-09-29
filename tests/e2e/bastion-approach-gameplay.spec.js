import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, trace: 'off', screenshot: 'off', video: 'off' });

test('town to Bastion uses the authored road and a real entrance interaction', async ({ page, context, baseURL }, testInfo) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password || process.env.EIDOLON_E2E_REGISTER !== '1',
        'Requires a fresh disposable QA character');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    const expectGroundContact = async () => {
        await expect.poll(() => page.evaluate(() => {
            const g = window.game, contacts = g.renderSystem.actorContactShadows?.mesh;
            if (g.renderSystem.renderer.shadowMap.enabled || !contacts?.visible) return false;
            const values = contacts.instanceMatrix.array, p = g.player.mesh.position;
            for (let i = 0; i < contacts.count; i++) {
                const offset = i * 16;
                if (Math.hypot(values[offset + 12] - p.x, values[offset + 14] - p.z) < .1) return true;
            }
            return false;
        })).toBe(true);
    };
    await expectGroundContact();
    const review = process.env.EIDOLON_E2E_ROUTE_REVIEW === '1';
    const views = [];
    const captureReview = async stage => {
        if (!review) return;
        await expect(page.locator('#start-screen')).toBeHidden();
        await expect(page.locator('#auth-password')).toBeHidden();
        const state = await page.evaluate(() => {
            const g = window.game, r = g.renderSystem, tag = g.player.nameTag;
            const nameLayers = tag?.layers.mask;
            // Redact the disposable account's in-world label, not scenery/HUD.
            if (tag) tag.layers.mask = 0;
            return { nameLayers, position: g.player.position.toArray(), zoom: r.currentZoom,
                quality: r.graphicsQuality, instance: g.currentInstanceType || 'overworld' };
        });
        try {
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await page.screenshot({ path: testInfo.outputPath(stage + '.png'),
                style: '#perf-overlay { visibility: hidden !important; }',
                mask: [page.getByText(credentials.username, { exact: false })] });
            const { nameLayers: _redacted, ...view } = state;
            views.push({ stage, ...view });
        } finally {
            await page.evaluate(mask => {
                if (mask !== undefined && window.game.player.nameTag) window.game.player.nameTag.layers.mask = mask;
            }, state.nameLayers);
        }
    };
    await captureReview('town-start');
    // Level preparation only: this is route/input coverage, not earned pacing,
    // survival balance or dungeon-clear evidence. No waypoint or position writes.
    await page.locator('#chat-mobile-toggle').tap();
    await page.locator('#chat-input').fill('/level 100');
    await page.locator('#chat-input').press('Enter');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.locator('#chat-mobile-toggle').tap();
    const route = await page.evaluate(async () => {
        const { EARTH_PATHS } = await import('/src/data/worldPopulation.js');
        const game = window.game;
        if (Math.hypot(game.player.position.x, game.player.position.z - 200) > 15) throw new Error('Expected a town start');
        // Follow the open town lanes around the trading post at (30,200),
        // then join the authored road at the eastern gate.
        return [[12, 200], [12, 215], [47, 215], [70, 200], ...EARTH_PATHS.find(path => path.id === 'bastion-road').points];
    });
    const elevated = process.env.EIDOLON_ISOLATED_QA_TERRAIN_ELEVATION === 'true';
    if (elevated) {
        expect(await page.evaluate(() => window.game.network.expectedTerrainProfile)).toBe('earth-elevation-rocks-v1');
    }
    const terrainReceipt = { samples: 0, maxHeight: 0, maxClientError: 0, maxServerError: 0 };
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('#joystick-zone').boundingBox();
    const receipts = [];
    const roadViews = review ? [250, 400, 600, 710] : [];
    let touching = false;
    try {
        for (const [x, z] of route) {
            const clear = await page.evaluate(([x, z]) => {
                const game = window.game, start = game.player.position.clone();
                const steps = Math.ceil(Math.hypot(x - start.x, z - start.z) / .5);
                let previous = start;
                for (let step = 1; step <= steps; step++) {
                    const point = start.clone();
                    point.x += (x - start.x) * step / steps;
                    point.z += (z - start.z) * step / steps;
                    const corrected = game.collisionManager.checkCollision(point, game.player.radius || 1.25, previous);
                    if (corrected && Math.hypot(corrected.x - point.x, corrected.z - point.z) > .001) return false;
                    previous = point;
                }
                return true;
            }, [x, z]);
            expect(clear, `authored segment to ${x},${z} must be walkable`).toBe(true);
            let bestDistance = Infinity, lastProgress = Date.now();
            await expect.poll(async () => {
                const current = await page.evaluate(elevated => {
                    const g = window.game, p = g.player.position;
                    const server = g.movementNetworkState?.lastAcknowledgedServerPosition;
                    return { x: window.game.player.position.x,
                    z: window.game.player.position.z, hp: window.game.player.stats.hp,
                    instance: window.game.currentInstanceId,
                    joystick: window.game.inputManager.joystickVector.toArray(),
                    acknowledged: window.game.movementNetworkState?.lastAcknowledgedServerPosition,
                    state: window.game.player.state, activeElement: document.activeElement?.id,
                    paused: window.game.uiManager.isEscMenuOpen,
                    ground: elevated ? { height: p.y, clientError: Math.abs(p.y - g.terrainElevation.sample(p.x, p.z)),
                        serverError: server ? Math.abs(server.y - g.terrainElevation.sample(server.x, server.z)) : null } : null };
                }, elevated);
                if (current.hp <= 0 || current.instance) throw new Error('Route interrupted by death or a scene change');
                if (elevated) {
                    const ground = current.ground;
                    terrainReceipt.samples++;
                    terrainReceipt.maxHeight = Math.max(terrainReceipt.maxHeight, ground.height);
                    terrainReceipt.maxClientError = Math.max(terrainReceipt.maxClientError, ground.clientError);
                    if (ground.serverError !== null) terrainReceipt.maxServerError = Math.max(terrainReceipt.maxServerError, ground.serverError);
                    expect(ground.clientError).toBeLessThan(.001);
                    if (ground.serverError !== null) expect(ground.serverError).toBeLessThan(.001);
                }
                if (roadViews.length && current.x > roadViews[0]) {
                    await captureReview(`earth-road-${roadViews.shift()}`);
                }
                const dx = x - current.x, dz = z - current.z, distance = Math.hypot(dx, dz);
                if (distance < 1.8) return true;
                if (distance < bestDistance - .2) { bestDistance = distance; lastProgress = Date.now(); }
                if (Date.now() - lastProgress > 5000) {
                    throw new Error(`Stalled route: ${JSON.stringify({ target: [x, z], reached: receipts, current })}`);
                }
                const jx = dx - dz, jy = dx + dz, length = Math.hypot(jx, jy);
                const deflection = 32;
                await cdp.send('Input.dispatchTouchEvent', { type: touching ? 'touchMove' : 'touchStart', touchPoints: [
                    { id: 91, x: box.x + box.width / 2 + deflection * jx / length,
                        y: box.y + box.height / 2 + deflection * jy / length }
                ] });
                touching = true;
                return false;
            }, { timeout: 100_000, intervals: [100] }).toBe(true);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            touching = false;
            await expect.poll(() => page.evaluate(([x, z]) => {
                const p = window.game.movementNetworkState?.lastAcknowledgedServerPosition;
                return p ? Math.hypot(p.x - x, p.z - z) : Infinity;
            }, [x, z]), { timeout: 5000 }).toBeLessThan(3);
            receipts.push({ x, z });
            console.log(`[bastion-route] server-confirmed checkpoint ${x},${z}`);
        }
    } finally {
        if (!page.isClosed()) {
            if (touching) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await cdp.detach();
        }
    }
    const gate = await page.evaluate(async () => {
        const THREE = await import('three'), game = window.game;
        const p = new THREE.Vector3(800, 6, 232.19).project(game.renderSystem.camera);
        const rect = game.renderSystem.renderer.domElement.getBoundingClientRect();
        return { visible: Math.abs(p.x) < .95 && Math.abs(p.y) < .95,
            x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 };
    });
    await captureReview('bastion-arrival');
    if (elevated) {
        expect(terrainReceipt.samples).toBeGreaterThan(20);
        expect(terrainReceipt.maxHeight).toBeGreaterThan(2);
        await testInfo.attach('terrain-route-receipt', { body: JSON.stringify(terrainReceipt), contentType: 'application/json' });
    }
    expect(gate.visible).toBe(true);
    await page.touchscreen.tap(gate.x, gate.y);
    await expect(page.locator('#dungeon-menu')).toBeVisible();
    await expect(page.locator('#btn-enter-dungeon')).toBeEnabled();
    await page.locator('#btn-enter-dungeon').tap();
    await expect.poll(() => page.evaluate(() => {
        const g = window.game;
        return g.currentInstanceType === 'verdant_bastion_catacombs' && Boolean(g.currentInstanceId && g.currentDungeonLayout)
            && g.collisionManager.dungeonWalkableRects.length > 0;
    }), { timeout: 30_000 }).toBe(true);
    await expectGroundContact();
    await captureReview('dungeon-entry');
    if (review) await testInfo.attach('route-views', { body: JSON.stringify(views), contentType: 'application/json' });
    await testInfo.attach('route-receipt', { body: JSON.stringify({ checkpoints: receipts, enteredVerdant: true }), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
