import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, openGame } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const enabled = process.env.EIDOLON_E2E_GAMEPLAY_INTERACTIONS === '1';
const accounts = JSON.parse(process.env.EIDOLON_GAMEPLAY_BROWSER_ACCOUNTS || '[]');

test.afterEach(async ({ page }, testInfo) => {
    if (!enabled || page.isClosed()) return;
    let observations;
    try {
        observations = await page.evaluate(() => {
            const o = window.__gameplayInteractions;
            if (!o) return null;
            o.restore();
            return { samples: o.samples, casts: o.casts, timings: o.timings, authority: o.authority };
        });
    } catch { /* A failed startup may never create an observable game context. */ }
    if (observations) await testInfo.attach('terminal-input-observations', {
        body: JSON.stringify(observations), contentType: 'application/json'
    });
});

async function enterPreparedCharacter(page, account, quality) {
    await page.addInitScript(quality => {
        localStorage.setItem('eidolon.graphicsQuality', quality);
        localStorage.setItem('eidolon.cameraZoom', '30');
        localStorage.setItem('eidolon.phoneCameraZoom', '30');
    }, quality);
    await openGame(page, { attempts: 1 });
    await page.locator('#auth-username').fill(account.username);
    await page.locator('#auth-password').fill(account.password);
    await page.locator('#btn-login').click();
    await expect(page.locator('#auth-status')).toHaveCSS('color', 'rgb(76, 175, 80)');
    await page.locator('#btn-play-character').click();
    await expect(page.locator('#loading-screen')).toBeHidden({ timeout: 120_000 });
    await expect.poll(() => page.evaluate(({ characterClass, quality }) => {
        const game = window.game, root = game?.player?.mesh;
        return Boolean(game?._firstStateReceived && root?.userData.authoredClass === characterClass &&
            root.userData.authoredQuality === quality && root.userData.equipmentVisualItemCount === 14 &&
            !root.userData.assetFallback && !root.userData.equipmentVisualFallback?.length &&
            !root.userData.equipmentVisualMissing?.length);
    }, { characterClass: account.characterClass, quality })).toBe(true);
    expect(process.env.EIDOLON_E2E_STATIC_ROOT, 'Native gameplay qualification requires a copied publication').toBeTruthy();
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name));
    expect(resources.some(url => /\/core\/GameEngine\.bundle\.js\?release=/.test(url)),
        'Native inputs must exercise the published engine').toBe(true);
    expect(resources.some(url => /\/core\/GameEngine\.js(?:\?|$)/.test(url))).toBe(false);
    return page.evaluate(() => {
        const game = window.game, renderer = game.renderSystem.renderer, gl = renderer.getContext();
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const observations = { authority: {}, casts: [], samples: [], timings: {}, destinations: {}, phase: '', active: true };
        const receive = game.handleServerMessage;
        game.handleServerMessage = function (message) {
            const updates = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
            const own = updates?.[game.player.id];
            if (own) observations.authority = { ...observations.authority, ...own,
                x: own.x, y: own.y, z: own.z, state: own.state, supportSurface: own.supportSurface };
            if (message.type === 'interaction_cast') observations.casts.push({ ...message.payload, at: performance.now() });
            return receive.call(this, message);
        };
        const clicked = event => {
            if (event.button === 0 && event.ctrlKey && observations.destinations[observations.phase]) {
                observations.timings[observations.phase] = { started: performance.now() };
            }
        };
        document.addEventListener('mousedown', clicked, true);
        const sample = () => {
            if (!observations.active) return;
            const player = game.player, jump = game.playerJumpState, root = player?.mesh;
            const timing = observations.timings[observations.phase], destination = observations.destinations[observations.phase];
            if (root && timing && !timing.ended && !jump && observations.authority.state !== 'JUMPING' &&
                Math.hypot(root.position.x - destination.x, root.position.y - destination.y, root.position.z - destination.z) < .05 &&
                Math.hypot(observations.authority.x - destination.x, observations.authority.z - destination.z) < .05) timing.ended = performance.now();
            if (root && observations.samples.length < 5000 && (jump || player.supportSurface || observations.phase === 'edge')) {
                const progress = jump?.visualProgress ?? jump?.progress ?? 0;
                const roof = player.supportSurface && game.townRoofField.sample(root.position.x, root.position.z, player.supportSurface);
                const expected = jump ? jump.start.y + (jump.end.y - jump.start.y) * progress + (jump.visualHeight || 0)
                    : roof?.y;
                observations.samples.push({ phase: observations.phase, at: performance.now(), jump: Boolean(jump),
                    quality: game.renderSystem.graphicsQuality,
                    y: player.position.y, meshY: root.position.y, floor: player.supportSurface || '',
                    progress, error: Number.isFinite(expected) ? Math.abs(root.position.y - expected) : null,
                    visible: document.visibilityState === 'visible' });
            }
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        observations.restore = () => { observations.active = false; game.handleServerMessage = receive; document.removeEventListener('mousedown', clicked, true); };
        window.__gameplayInteractions = observations;
        return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            quality: game.renderSystem.graphicsQuality, class: playerClass(game), items: game.player.mesh.userData.equipmentVisualItemCount };
        function playerClass(game) { return game.player.mesh.userData.authoredClass; }
    });
}

async function projectPoint(page, point) {
    return page.evaluate(({ x, y, z }) => {
        const game = window.game, canvas = game.renderSystem.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        const p = game.player.position.clone().set(x, y, z).project(game.renderSystem.camera);
        const px = rect.left + (p.x + 1) * rect.width / 2, py = rect.top + (1 - p.y) * rect.height / 2;
        return { x: px, y: py, canvas: document.elementFromPoint(px, py) === canvas };
    }, point);
}

async function zoomThroughWheel(page, target) {
    const current = await page.evaluate(() => window.game.renderSystem.currentZoom);
    const viewport = page.viewportSize(); await page.mouse.move(viewport.width / 2, viewport.height / 2);
    for (let step = 0; step < Math.abs(target - current) / 2; step++) await page.mouse.wheel(0, Math.sign(target - current) * 100);
    await expect.poll(() => page.evaluate(() => window.game.renderSystem.currentZoom)).toBe(target);
}

async function jumpTo(page, x, z, phase) {
    const y = await page.evaluate(({ x, z, phase }) => {
        window.__gameplayInteractions.phase = phase;
        const y = window.game.townRoofField.sample(x, z)?.y || 0;
        window.__gameplayInteractions.destinations[phase] = { x, y, z };
        return y;
    }, { x, z, phase });
    const point = await projectPoint(page, { x, y, z });
    expect(point.canvas, 'The intended roof/ground point must be exposed to real input').toBe(true);
    await page.keyboard.down('Control');
    try { await page.mouse.click(point.x, point.y); } finally { await page.keyboard.up('Control'); }
    await expect.poll(() => page.evaluate(() => window.__gameplayInteractions.authority.state)).toBe('JUMPING');
    await expect.poll(() => page.evaluate(({ x, z, y }) => {
        const game = window.game, own = window.__gameplayInteractions.authority;
        return own.state !== 'JUMPING' && !game.playerJumpState &&
            Math.hypot(own.x - x, own.z - z) < .2 && Math.abs(own.y - y) < .01 &&
            Math.abs(game.player.position.y - y) < .03 && Math.abs(game.player.mesh.position.y - y) < .03;
    }, { x, z, y })).toBe(true);
}

async function moveTo(page, x, z, phase) {
    const y = await page.evaluate(({ x, z, phase }) => {
        window.__gameplayInteractions.phase = phase;
        return window.game.townRoofField.sample(x, z)?.y || 0;
    }, { x, z, phase });
    const point = await projectPoint(page, { x, y, z });
    expect(point.canvas).toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect.poll(() => page.evaluate(({ x, z }) => {
        const game = window.game, own = window.__gameplayInteractions.authority;
        return Math.hypot(game.player.position.x - x, game.player.position.z - z) < .5 &&
            Math.hypot(own.x - x, own.z - z) < .6;
    }, { x, z })).toBe(true);
}

async function outsideWindowMove(page, selector, key) {
    await page.keyboard.press(key);
    const window = page.locator(selector);
    await expect(window).toBeVisible();
    const header = await window.locator('.window-header').boundingBox();
    await page.mouse.move(header.x + 60, header.y + 14);
    await page.mouse.down(); await page.mouse.move(header.x + 120, header.y + 54, { steps: 5 }); await page.mouse.up();
    const remembered = await window.boundingBox();
    const point = await page.evaluate(() => {
        const game = window.game, canvas = game.renderSystem.renderer.domElement, rect = canvas.getBoundingClientRect();
        for (const [dx, dz] of [[-24, 20], [24, 20], [-28, -15], [28, -15]]) {
            const p = game.player.position.clone().add({ x: dx, y: 0, z: dz }); p.y = 0;
            const projected = p.clone().project(game.renderSystem.camera);
            const x = rect.left + (projected.x + 1) * rect.width / 2, y = rect.top + (1 - projected.y) * rect.height / 2;
            if (document.elementFromPoint(x, y) === canvas) return { x, y, before: game.player.position.toArray() };
        }
        return null;
    });
    expect(point).not.toBeNull();
    await page.mouse.click(point.x, point.y);
    await expect(window).toBeHidden();
    await expect.poll(() => page.evaluate(before => Math.hypot(window.game.player.position.x - before[0],
        window.game.player.position.z - before[2]), point.before)).toBeGreaterThan(.5);
    await expect.poll(() => page.evaluate(() => window.game.player.targetPosition === null)).toBe(true);
    await page.keyboard.press(key); await expect(window).toBeVisible();
    const restored = await window.boundingBox();
    expect(restored.x).toBeCloseTo(remembered.x, 0); expect(restored.y).toBeCloseTo(remembered.y, 0);
    await window.locator('.close-btn').first().click();
}

for (const [index, characterClass] of ['Fighter', 'Cleric', 'Rogue', 'Wizard'].entries()) {
    test(`${characterClass} uses real inputs to jump onto a roof, walk, fall, jump down and recall`, async ({ page, baseURL }, testInfo) => {
        test.skip(!enabled, 'Explicit disposable actual-server/native-GPU preparation required');
        expect(accounts[index]?.characterClass).toBe(characterClass);
        const failures = collectBrowserFailures(page, baseURL);
        const identity = await enterPreparedCharacter(page, accounts[index], 'high');
        let beforeReload = { samples: [], casts: [], timings: {} }, lowIdentity;
        expect(identity.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        expect(identity.items).toBe(14);
        await jumpTo(page, -74, 130, 'up');
        await moveTo(page, -73, 130, 'roof-walk');
        await page.screenshot({ path: testInfo.outputPath(`${characterClass}-pitched-roof.png`) });
        if (index === 0) {
            await zoomThroughWheel(page, 10);
            await page.screenshot({ path: testInfo.outputPath('Fighter-high-close-roof.png') });
            beforeReload = await page.evaluate(() => {
                const o = window.__gameplayInteractions; o.restore();
                return { samples: o.samples, casts: o.casts, timings: o.timings, authority: o.authority };
            });
            await testInfo.attach('before-quality-reload-observations', {
                body: JSON.stringify(beforeReload), contentType: 'application/json'
            });
            await page.keyboard.press('Escape'); await page.locator('#btn-settings').click();
            let prompt = '';
            page.once('dialog', async dialog => { prompt = dialog.message(); await dialog.dismiss(); });
            await page.locator('#graphics-quality').selectOption('low');
            expect(prompt).toContain('need a reload');
            await page.locator('#btn-close-settings-header').click(); await page.locator('#btn-resume').click();
            await expect.poll(() => page.evaluate(() => window.game.renderSystem.graphicsQuality)).toBe('low');
            // Supported Settings deliberately retains owned actors until reload.
            // Ordinary navigation/login must restore the saved pitched roof.
            lowIdentity = await enterPreparedCharacter(page, accounts[index], 'low');
            expect(lowIdentity.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
            await expect.poll(() => page.evaluate(before => {
                const player = window.game.player;
                return player.supportSurface === before.supportSurface &&
                    Math.hypot(player.position.x - before.x, player.position.z - before.z) < .1 &&
                    Math.abs(player.position.y - before.y) < .03;
            }, beforeReload.authority)).toBe(true);
            await page.evaluate(() => { window.__gameplayInteractions.phase = 'roof-walk'; });
            await zoomThroughWheel(page, 10);
            expect(await page.evaluate(() => window.game.player.mesh.userData.equipmentVisualItemCount)).toBe(14);
            await page.screenshot({ path: testInfo.outputPath('Fighter-low-close-roof.png') });
            await zoomThroughWheel(page, 30);
        }
        await moveTo(page, -73, 143.5, 'edge');
        await expect.poll(() => page.evaluate(() => {
            const game = window.game, own = window.__gameplayInteractions.authority;
            return own.supportSurface === '' && own.y === 0 && game.player.position.y === 0 && Math.abs(game.player.mesh.position.y) < .03;
        })).toBe(true);
        await jumpTo(page, -74, 130, 'return-up');
        await jumpTo(page, -106, 130, 'down');
        await page.keyboard.press('b');
        await expect(page.locator('#interaction-cast')).toBeVisible();
        // Desktop WASD pans; an ordinary ground click actually moves the body.
        await moveTo(page, -112, 130, 'recall-cancel');
        await expect(page.locator('#interaction-cast')).toBeHidden();
        await expect.poll(() => page.evaluate(() => window.__gameplayInteractions.casts.at(-1)?.state)).toBe('cancelled');
        const started = Date.now();
        await page.keyboard.press('b');
        await expect(page.locator('#interaction-cast')).toContainText('Move to cancel');
        await expect(page.locator('#interaction-cast progress')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`${characterClass}-recall-cast.png`) });
        await expect.poll(() => page.evaluate(() => Math.hypot(window.game.player.position.x + 1.25, window.game.player.position.z - 200))).toBeLessThan(.1);
        expect(Date.now() - started).toBeGreaterThanOrEqual(3000);
        await expect(page.locator('#interaction-cast')).toBeHidden();
        if (index === 0) {
            await outsideWindowMove(page, '#character-sheet', 'c');
            await outsideWindowMove(page, '#inventory-screen', 'i');
        }
        const observations = await page.evaluate(() => {
            const o = window.__gameplayInteractions; o.restore();
            return { samples: o.samples, casts: o.casts, authority: o.authority, timings: o.timings };
        });
        observations.samples = [...beforeReload.samples, ...observations.samples];
        observations.casts = [...beforeReload.casts, ...observations.casts];
        observations.timings = { ...beforeReload.timings, ...observations.timings };
        for (const phase of ['up', 'return-up', 'down']) {
            const moving = observations.samples.filter(s => s.phase === phase && s.jump && s.progress > .05 && s.progress < .95);
            expect(moving.length, `${phase} must contain genuine moving native frames`).toBeGreaterThanOrEqual(10);
            expect(moving.every(s => s.visible && s.error < .08)).toBe(true);
            const clock = observations.timings[phase];
            expect(clock?.ended - clock?.started, `${phase} retains the existing1.5second input-to-landing requirement`).toBeLessThanOrEqual(1500);
            expect(clock.ended - clock.started).toBeGreaterThan(400);
        }
        const supported = observations.samples.filter(s => s.phase === 'roof-walk' && s.floor && !s.jump);
        expect(supported.length).toBeGreaterThan(0); expect(supported.every(s => s.error < .08)).toBe(true);
        if (index === 0) expect(supported.some(s => s.quality === 'low')).toBe(true);
        const falling = observations.samples.filter(s => s.phase === 'edge' && !s.floor && s.y > .2);
        expect(falling.length).toBeGreaterThanOrEqual(5);
        expect(falling.some(s => s.meshY < 6)).toBe(true);
        await testInfo.attach('roof-input-observations', { body: JSON.stringify({ identity, lowIdentity, ...observations,
            scope: 'Prepared saved14slot character, actual password login/input/replication/native draws. No performance, natural progression, stress or physical-device claim.' }), contentType: 'application/json' });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

test.describe('touch quest objects', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: devices['Pixel 7'].userAgent });
    test('phone Use casts, joystick cancellation grants no discovery, and retry opens saved story evidence', async ({ page, context, baseURL }, testInfo) => {
        test.skip(!enabled, 'Explicit disposable actual-server/native-GPU preparation required');
        expect(accounts[4]?.characterClass).toBe('Wizard');
        const failures = collectBrowserFailures(page, baseURL);
        const identity = await enterPreparedCharacter(page, accounts[4], 'low');
        expect(identity.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        const quest = () => page.evaluate(() => window.game.player.quests.find(q => q.id === 'chronicle_earth_keepers_house'));
        expect((await quest()).investigationMask).toBe(0);
        await page.locator('#btn-mobile-interact').tap();
        await expect(page.locator('#interaction-cast')).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('phone-quest-cast.png') });
        const move = async () => {
            const box = await page.locator('#joystick-zone').boundingBox();
            const cdp = await context.newCDPSession(page);
            try {
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 83, x: box.x + box.width / 2 + 8, y: box.y + box.height / 2 }] });
                await page.waitForTimeout(150);
            } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); }
        };
        await move();
        await expect(page.locator('#interaction-cast')).toBeHidden();
        await expect.poll(() => page.evaluate(() => window.__gameplayInteractions.casts.at(-1)?.state)).toBe('cancelled');
        expect((await quest()).investigationMask).toBe(0);
        const started = Date.now();
        await page.locator('#btn-mobile-interact').tap();
        await expect(page.locator('#interaction-cast')).toBeVisible();
        const record = page.locator('#journal-list details[data-discovery-id="mara_diary"]');
        await expect(record).toHaveAttribute('open', '');
        expect(Date.now() - started).toBeGreaterThanOrEqual(3000);
        expect((await quest()).investigationMask).toBe(1); expect((await quest()).completed).toBe(false);
        await page.screenshot({ path: testInfo.outputPath('phone-saved-discovery.png') });
        await move(); await expect(page.locator('#journal-screen')).toBeHidden();
        await page.evaluate(() => window.__gameplayInteractions.restore());
        expect(failures, failures.join('\n')).toEqual([]);
    });
});

test('Earth boundary draws timber, iron and lanterns in High/Low without legacy actor rectangles', async ({ page, baseURL }, testInfo) => {
    test.skip(!enabled, 'Explicit disposable actual-server/native-GPU preparation required');
    expect(accounts[5]?.characterClass).toBe('Fighter');
    const failures = collectBrowserFailures(page, baseURL);
    const identity = await enterPreparedCharacter(page, accounts[5], 'high');
    expect(identity.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        const actors = [...game.remotePlayers.values()].filter(e => e.constructor.name === 'Fence' && Math.abs(e.position.x) >= 999);
        return actors.length > 0 && actors.every(e => e.environmentOwned && !e.mesh);
    })).toBe(true);
    const capture = () => page.evaluate(async () => {
        const render = window.game.renderSystem, renderer = render.renderer;
        const root = render.instanceEnvironmentGroup.getObjectByName('EarthFence');
        if (!root) throw Error('Actual Earth fence owner is missing');
        const names = new Map(root.children.map(mesh => [mesh, mesh.material.name]));
        const counts = Object.fromEntries([...names.values()].map(name => [name, 0]));
        const before = renderer.renderBufferDirect;
        const observed = function (...args) {
            const name = names.get(args[4]); if (name) counts[name]++;
            return before.apply(this, args);
        };
        renderer.renderBufferDirect = observed;
        let owned;
        try { for (let frame = 0; frame < 3; frame++) await new Promise(requestAnimationFrame); }
        finally {
            owned = renderer.renderBufferDirect === observed;
            if (owned) renderer.renderBufferDirect = before;
        }
        if (!owned) throw Error('Native fence observation lost its renderer owner');
        return { quality: render.graphicsQuality, counts, restored: renderer.renderBufferDirect === before,
            owner: root.uuid, materialNames: [...names.values()].sort() };
    });
    const high = await capture();
    await page.screenshot({ path: testInfo.outputPath('earth-timber-fence-high.png') });
    await page.keyboard.press('Escape'); await page.locator('#btn-settings').click();
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#graphics-quality').selectOption('low');
    await page.locator('#btn-close-settings-header').click(); await page.locator('#btn-resume').click();
    await expect.poll(() => page.evaluate(() => window.game.renderSystem.graphicsQuality)).toBe('low');
    const low = await capture();
    await page.screenshot({ path: testInfo.outputPath('earth-timber-fence-low.png') });
    for (const sample of [high, low]) {
        expect(sample.materialNames).toEqual(['lanternhold-perimeter:amber', 'lanternhold-perimeter:iron', 'lanternhold-perimeter:timber']);
        expect(sample.restored).toBe(true); expect(Object.values(sample.counts).every(count => count > 0)).toBe(true);
    }
    await page.keyboard.press('b');
    await expect.poll(() => page.evaluate(() => Math.hypot(window.game.player.position.x + 1.25, window.game.player.position.z - 200))).toBeLessThan(.1);
    expect(await page.evaluate(() => window.game.renderSystem.instanceEnvironmentGroup.getObjectByName('EarthFence')?.uuid)).toBe(high.owner);
    await page.evaluate(() => window.__gameplayInteractions.restore());
    await testInfo.attach('native-earth-fence', { body: JSON.stringify({ identity, high, low,
        scope: 'Actual prepared Earth gate entry and overworld recall; six normal game frames across High/Low, original render calls restored. No instance-return, physical-device or performance-budget claim.' }), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
