import { expect, test, firefox } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
const isGameDependency = url => url.includes('/src/core/GameEngine.js')
    || url.includes('/vendor/three/') || url.includes('/src/utils/MeshCatalog.js')
    || url.includes('/src/assets/authoredEquipment.generated.js');

test.describe('startup failure diagnostic phases', () => {
    // Synthetic authentication only; no real account or credentials.
    for (const [phase, kind] of [['engine-module', 'module-download'],
        ['engine-construction', 'graphics-unavailable'], ['world-load', 'unknown']]) {
        test(`startup reports ${phase} without exposing raw errors`, async ({ page }) => {
            await page.route('**/src/core/GameEngine.js*', route => phase === 'engine-module'
                ? route.abort('connectionfailed')
                : route.fulfill({ contentType: 'text/javascript', body: `
                    export class GameEngine {
                        constructor() {
                            ${phase === 'engine-construction' ? "const e = new Error('private fixture detail'); e.code = 'WEBGL2_UNAVAILABLE'; throw e;" : 'this.network = {};'}
                        }
                        async loadGame() { throw new Error('private fixture detail'); }
                    }
                ` }));
            await page.routeWebSocket(/\/ws(?:\?|$)/, socket => socket.onMessage(data => {
                if (JSON.parse(data).type === 'login') socket.send(JSON.stringify({
                    type: 'login_success', payload: { hasCharacter: true, characterType: 'Fighter' }
                }));
            }));
            await page.goto('/', { waitUntil: 'domcontentloaded' });
            await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady)).toBe('true');
            await page.locator('#auth-username').fill('startup-diagnostic-fixture');
            await page.locator('#auth-password').fill('synthetic-only');
            await page.locator('#btn-login').click();
            await page.locator('#btn-play-character').click();
            const status = page.locator('#game-startup-status');
            await expect(status).toBeVisible();
            await expect(status).toHaveAttribute('data-startup-phase', phase);
            await expect(status).toHaveAttribute('data-failure-kind', kind);
            await expect(status).not.toContainText('private fixture detail');
            await expect(page.locator('#start-screen')).toBeVisible();
            await expect(page.locator('#loading-screen')).toBeHidden();
        });
    }
});

test('login loads ten notes without the game engine; older pages load only on demand and retry cleanly', async ({ page }) => {
    const archives = [], engines = [];
    page.on('request', request => {
        if (request.url().includes('/assets/patch-notes/')) archives.push(request.url());
        if (isGameDependency(request.url())) engines.push(request.url());
    });
    await page.goto('/', { waitUntil: 'load' });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady)).toBe('true');
    await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(10);
    expect(archives).toHaveLength(0); expect(engines).toHaveLength(0);
    await page.locator('#login-patch-notes-link').click();
    const more = page.getByRole('button', { name: 'Load more notes', exact: true });
    await more.click();
    await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(20);
    expect(archives).toHaveLength(1);
    let failed = false;
    await page.route('**/assets/patch-notes/**/page-002.json', route => {
        if (!failed) { failed = true; return route.abort('internetdisconnected'); }
        return route.continue();
    });
    await more.click();
    await expect(page.locator('#patch-notes-load-status')).toContainText('Please try again');
    await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(20);
    await more.click();
    await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(30);
    await page.locator('#btn-close-patch-notes-header').click();
    await expect(page.locator('#patch-notes-screen')).toBeHidden();
});

test('real Firefox reaches interactive login and loads the next ten notes', async ({ baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_FIREFOX_PATH, 'Requires an explicitly provided local Firefox');
    // 4190 is a restricted non-HTTP port in Firefox. Use ordinary 4173/4192
    // for local checks; do not override browser security to make QA pass.
    if (new URL(baseURL).port === '4190') throw new Error('Use a Firefox-safe web port such as 4192, not restricted port 4190');
    const browser = await firefox.launch({ executablePath: process.env.EIDOLON_E2E_FIREFOX_PATH,
        headless: process.env.EIDOLON_E2E_FIREFOX_HEADLESS !== '0', args: [] });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 844 }, serviceWorkers: 'block' });
        const page = await context.newPage(), errors = [], archives = [], engines = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
            if (request.url().includes('/assets/patch-notes/')) archives.push(request.url());
            if (isGameDependency(request.url())) engines.push(request.url());
        });
        await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady)).toBe('true');
        await expect(page.locator('#btn-login')).toBeEnabled();
        expect(archives).toHaveLength(0); expect(engines).toHaveLength(0);
        await page.locator('#login-patch-notes-link').click();
        await expect(page.locator('#patch-notes-screen')).toBeVisible();
        await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(10);
        await page.getByRole('button', { name: 'Load more notes', exact: true }).click();
        await expect(page.locator('#patch-notes-history .patch-note-entry')).toHaveCount(20);
        expect(archives).toHaveLength(1);
        expect(errors).toEqual([]);
        await page.locator('#btn-close-patch-notes-header').click();
        await page.screenshot({ path: testInfo.outputPath('firefox-login.png') });
    } finally { await browser.close(); }
});

test('real Firefox constructs the production renderer and draws all four supplied class rigs', async ({ baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_FIREFOX_PATH, 'Requires an explicitly provided local Firefox');
    test.skip(process.env.EIDOLON_E2E_FIREFOX_RENDERER !== '1', 'Explicit renderer qualification; local headless Firefox currently cannot create WebGL');
    if (new URL(baseURL).port === '4190') throw new Error('Use a Firefox-safe HTTP port');
    // Functional compatibility only: no FPS, device or connected-party claim.
    // Do not force WebGL, change browser preferences or ignore TLS failures.
    const browser = await firefox.launch({ executablePath: process.env.EIDOLON_E2E_FIREFOX_PATH,
        headless: process.env.EIDOLON_E2E_FIREFOX_HEADLESS !== '0', args: [] });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 844 }, serviceWorkers: 'block' });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady)).toBe('true');
        const result = await page.evaluate(async () => {
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { Actor } = await import('/src/entities/Actor.js');
            const render = new RenderSystem(false); render.setGraphicsQuality('low');
            document.getElementById('start-screen').style.display = 'none';
            await render.preloadEnvironment();
            const classes = [];
            for (const [index, type] of ['Fighter', 'Rogue', 'Wizard', 'Cleric'].entries()) {
                const actor = new Actor(`firefox-preview-${type}`, {});
                actor.setMesh(await MeshFactory.createMeshForType(type, { quality: 'low' }));
                actor.position.set((index - 1.5) * 4, .5, 200);
                actor.update(.05); actor.resetTransformInterpolation(); actor.render(1);
                let skinnedMeshes = 0;
                actor.mesh.traverse(part => { if (part.isSkinnedMesh) skinnedMeshes++; });
                classes.push({ type, authoredClass: actor.mesh.userData.authoredClass,
                    fallback: Boolean(actor.mesh.userData.assetFallback), skinnedMeshes });
                render.entityGroup.add(actor.mesh);
            }
            render.setZoom(18); render.setCameraTarget({ x: 0, y: .5, z: 200 });
            render.applyLightingPreset('town', true); render.render(); render.render();
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            const pixels = new Uint8Array(64 * 64 * 4);
            gl.readPixels(Math.floor(gl.drawingBufferWidth / 2) - 32,
                Math.floor(gl.drawingBufferHeight / 2) - 32, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            const observation = { classes, calls: render.renderer.info.render.calls,
                triangles: render.renderer.info.render.triangles, glError: gl.getError(),
                coloredPixels: pixels.filter((value, index) => index % 4 !== 3 && value > 0).length,
                renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                userAgent: navigator.userAgent };
            window.__firefoxRendererPreview = render;
            return observation;
        });
        await testInfo.attach('firefox-renderer-observation', { body: JSON.stringify(result), contentType: 'application/json' });
        for (const entry of result.classes) {
            expect(entry.authoredClass).toBe(entry.type); expect(entry.fallback).toBe(false);
            expect(entry.skinnedMeshes).toBeGreaterThan(0);
        }
        expect(result.calls).toBeGreaterThan(0); expect(result.triangles).toBeGreaterThan(0);
        expect(result.glError).toBe(0); expect(result.coloredPixels).toBeGreaterThan(100);
        expect(errors).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath('firefox-four-class-renderer.png') });
        await page.evaluate(() => window.__firefoxRendererPreview.dispose());
    } finally { await browser.close(); }
});

test('real Firefox returns to login with in-page guidance when the graphics context is unavailable', async ({ baseURL }, testInfo) => {
    test.skip(!process.env.EIDOLON_E2E_FIREFOX_PATH, 'Requires an explicitly provided local Firefox');
    if (new URL(baseURL).port === '4190') throw new Error('Use a Firefox-safe HTTP port');
    const browser = await firefox.launch({ executablePath: process.env.EIDOLON_E2E_FIREFOX_PATH, headless: true, args: [] });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 844 }, serviceWorkers: 'block' });
        const page = await context.newPage(), dialogs = [], errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', dialog => { dialogs.push(dialog.message()); void dialog.dismiss(); });
        // A deliberately unavailable canvas, not a browser preference/security
        // override or a successful-rendering claim. All auth traffic is local.
        await page.addInitScript(() => {
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                return type === 'webgl2' ? null : getContext.call(this, type, ...args);
            };
        });
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            socket.onMessage(message => {
                const packet = JSON.parse(message);
                if (packet.type === 'login') socket.send(JSON.stringify({ type: 'login_success', payload: { hasCharacter: false } }));
            });
        });
        await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
        await expect.poll(() => page.evaluate(() => document.documentElement.dataset.eidolonReady)).toBe('true');
        await page.locator('#auth-username').fill('codex-firefox-graphics-fixture');
        await page.locator('#auth-password').fill('fixture-only-no-real-account');
        await page.locator('#btn-login').click();
        await page.locator('.class-btn[data-type="Fighter"]').click();
        await expect(page.locator('#auth-status')).toContainText('3D graphics (WebGL 2) are unavailable');
        await expect(page.locator('#game-startup-status')).toContainText('3D graphics (WebGL 2) are unavailable');
        await expect(page.locator('#game-startup-status')).toBeVisible();
        await expect(page.locator('#game-startup-status')).toBeFocused();
        await expect(page.locator('#start-screen')).toBeVisible();
        await expect(page.locator('#loading-screen')).toBeHidden();
        expect(dialogs).toEqual([]); expect(errors).toEqual([]);
        // Clear synthetic inputs before the human-readable screenshot.
        await page.evaluate(() => {
            document.getElementById('auth-username').value = '';
            document.getElementById('auth-password').value = '';
        });
        await page.screenshot({ path: testInfo.outputPath('firefox-graphics-unavailable.png') });
    } finally { await browser.close(); }
});
