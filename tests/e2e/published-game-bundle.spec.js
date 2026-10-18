import { requiresHardwareWebGL } from './browserLaunchPolicy.js';
import { expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bundleGameEngine } from '../../scripts/bundle-game-engine.mjs';
import { parseCatalog } from '../../scripts/lib/gameplay-geometry-artifact.mjs';
import { versionPagesRuntime } from '../../scripts/version-pages-runtime.mjs';
import { collectBrowserFailures } from './helpers.js';
import { measureJumpWallClock } from './jump-clock-observation.js';
import { profileGameplayScene } from './scene-performance.js';
import { reviewEarthRockShelves } from './earth-rock-shelf-review.js';

const release = 'bundlefixture20261009';
let root, server, origin, metadata, precomputedCatalog;
async function enterPublishedFixture(page) {
    await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
        socket.onMessage(data => {
            if (JSON.parse(data).type === 'login') socket.send(JSON.stringify({
                type: 'login_success', payload: { gameplayProtocol: 'stationary-actions-roofs-v1', hasCharacter: true, characterType: 'Fighter', terrainProfile: 'flat-v1' }
            }));
        });
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('#auth-username').fill('fixture-only');
    await page.locator('#auth-password').fill('fixture-only');
    await page.locator('#btn-login').click();
    await expect(page.locator('#btn-play-character')).toBeVisible();
    // Two same-turn clicks must share the in-flight start, not just its import.
    await page.evaluate(() => {
        document.getElementById('btn-play-character').click();
        document.getElementById('btn-play-character').click();
    });
}
test.beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'eidolon-published-engine-'));
    for (const filename of ['src', 'assets', 'vendor', 'index.html', 'release.json', 'sw.js'])
        await cp(filename === 'vendor' ? await realpath(filename) : path.resolve(filename), path.join(root, filename), { recursive: true });
    precomputedCatalog = parseCatalog(await readFile(path.join(root, 'src/data/gameplayGeometryPrecomputed.js'), 'utf8'));
    metadata = await bundleGameEngine(root);
    metadata.engineSHA256 = createHash('sha256').update(await readFile(path.join(root, 'src/core/GameEngine.bundle.js'))).digest('hex');
    await versionPagesRuntime(root, release);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
        '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
    server = createServer(async (request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!filename.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
        try {
            if (!(await stat(filename)).isFile()) throw new Error('Not a file');
            response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
                'Cache-Control': 'no-store' });
            response.end(await readFile(filename));
        } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (root) await rm(root, { recursive: true, force: true });
});

// Keep all nine views and eight walking poses per view on both software and
// native WebGL. Three independent High cases bound software rendering/readback
// work without extending the test timeout or dropping either FXAA comparison.
for (const [quality, section, viewRange] of [
    ['high', 'groves', [0, 3]], ['high', 'roads', [3, 6]], ['high', 'details', [6, 9]],
    ['low', 'all views', [0, 9]]
]) test(`copied published ${quality} Earth rock shelves retain equipped views and cleanup: ${section}`, async ({ page }, testInfo) => {
    await reviewEarthRockShelves({ page, baseURL: origin }, testInfo, quality, `/src/core/GameEngine.bundle.js?release=${release}`, 1280, viewRange);
    await testInfo.attach('published-engine-identity', { body: JSON.stringify(metadata, null, 2), contentType: 'application/json' });
});

for (const [quality, forceFallback] of [['high', false], ['low', false], ['low', true]]) test(`copied published ${quality}${forceFallback ? ' without multi-draw' : ''} residential clipping preserves equipped town views and cleanup`, async ({ page }, testInfo) => {
    // Hosted software checks every view and ownership path. Native review also
    // advances eight walking poses per view; this fixture measures no FPS.
    const framesPerView = requiresHardwareWebGL() ? 8 : 1;
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    if (forceFallback) await page.addInitScript(() => {
        for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
            if (!Context) continue;
            const getExtension = Context.prototype.getExtension;
            Context.prototype.getExtension = function (name) {
                return name === 'WEBGL_multi_draw' ? null : getExtension.call(this, name);
            };
        }
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    try {
        const result = await page.evaluate(async ({ release, quality, framesPerView }) => {
            const THREE = await import('three');
            const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
            document.getElementById('start-screen').style.display = 'none';
            const game = new GameEngine('Fighter', false, true, '', 'camp-bundle-fixture', null, 'flat-v1');
            window.__publishedCampReview = { game };
            const render = game.renderSystem, world = game.worldGenerator;
            render.setGraphicsQuality(quality); world.graphicsQuality = quality;
            await render.preloadEnvironment();
            const supported = render.renderer.extensions.has('WEBGL_multi_draw');
            if (world.campInstanceFrustum !== supported) throw Error('Published world owner did not select actual camp capability');
            const clipped = supported || quality === 'low';
            await world.createTownBase(0, 200, 100); await world.loadBuildings(0, 200);
            const field = render.instanceEnvironmentGroup.getObjectByName('Lanternhold residential wards');
            const hero = game.createRemotePlayer('Player', 'camp-equipped-fighter', 'Fighter');
            window.__publishedCampReview.hero = hero; hero.gameEngine = game;
            await hero.ensureMesh();
            const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
            const names = ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield', 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'];
            hero.syncEquipmentVisuals(Object.fromEntries(names.map((name, i) => [slots[i], {
                id: `camp-${slots[i]}`, name, baseName: name, slot: slots[i], type: [7, 8].includes(i) ? 'WEAPON' : 'ARMOR', rarity: 'Rare', potency: 5
            }])));
            await hero.mesh.userData.equipmentReady; render.add(hero.mesh); game.uiManager.showHUD();
            const reference = new THREE.Group();
            if (clipped) for (const batch of field.children) {
                const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, 15);
                mesh.castShadow = batch.castShadow; mesh.receiveShadow = batch.receiveShadow;
                for (let i = 0; i < 15; i++) {
                    mesh.setMatrixAt(i, batch.getMatrixAt(i, new THREE.Matrix4()));
                    if (batch.name.endsWith(':timber') || batch.name.endsWith(':roof'))
                        mesh.setColorAt(i, batch.getColorAt(i, new THREE.Color()));
                }
                mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); reference.add(mesh);
            }
            render.instanceEnvironmentGroup.add(reference);
            const review = window.__publishedCampReview;
            Object.assign(review, { field, reference, clock: Object.getOwnPropertyDescriptor(performance, 'now') });
            const frozen = performance.now(); Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            render.applyLightingPreset('town', true); render.setZoom(15); hero.playAnimation('Run', true, true);
            const canvas = render.renderer.domElement, copy = document.createElement('canvas');
            copy.width = canvas.width; copy.height = canvas.height;
            const context = copy.getContext('2d', { willReadFrequently: true });
            const capture = selected => {
                field.visible = selected || !clipped; reference.visible = !selected && clipped;
                render.render(); context.drawImage(canvas, 0, 0);
                return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            };
            const first = new THREE.Matrix4(); field.children[0].getMatrixAt(0, first);
            const camp = new THREE.Vector3().setFromMatrixPosition(first);
            const views = [{ name: 'town-center', x: -1.25, z: 200 }, { name: 'camp', x: camp.x + 4, z: camp.z + 4 },
                { name: 'camp-edge', x: camp.x + 20, z: camp.z }];
            const rows = [];
            for (const view of views) {
                render.setCameraTarget(new THREE.Vector3(view.x, 0, view.z));
                render.updateEnvironmentLighting(new THREE.Vector3(view.x, 0, view.z), 0);
                capture(false); capture(true); capture(false);
                for (let frame = 0; frame < framesPerView; frame++) {
                    hero.position.set(view.x - .6 + frame * 1.2 / Math.max(1, framesPerView - 1), 0, view.z + 4);
                    hero.mesh.position.copy(hero.position); hero.updateAnimationMixer(1 / 60);
                    const before = capture(false), after = capture(true), again = capture(false);
                    let changedRGB = 0, unstableRGB = 0;
                    for (let i = 0; i < before.pixels.length; i += 4) for (let channel = 0; channel < 3; channel++) {
                        changedRGB += before.pixels[i + channel] !== after.pixels[i + channel] ? 1 : 0;
                        unstableRGB += before.pixels[i + channel] !== again.pixels[i + channel] ? 1 : 0;
                    }
                    rows.push({ view: view.name, frame, changedRGB, unstableRGB,
                        reference: { calls: before.calls, triangles: before.triangles }, selected: { calls: after.calls, triangles: after.triangles } });
                }
            }
            field.visible = true; reference.visible = false; render.render();
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { quality, framesPerView, supported, clipped, ownerEnabled: world.campInstanceFrustum, parts: field.children.length, camps: field.userData.instanceCount,
                batchParts: field.children.filter(part => part.isBatchedMesh).length, rows,
                hero: { quality: hero.mesh.userData.authoredQuality, items: hero.mesh.userData.equipmentVisualItemCount,
                    missing: hero.mesh.userData.equipmentVisualMissing.length, fallback: hero.mesh.userData.equipmentVisualFallback.length },
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
        }, { release, quality, framesPerView });
        await page.screenshot({ path: testInfo.outputPath(`camp-${quality}-selected.png`) });
        await page.evaluate(() => {
            const { game, field, reference } = window.__publishedCampReview;
            const clipped = game.worldGenerator.campInstanceFrustum || game.worldGenerator.graphicsQuality === 'low';
            field.visible = !clipped; reference.visible = clipped;
            game.renderSystem.render();
        });
        await page.screenshot({ path: testInfo.outputPath(`camp-${quality}-reference.png`) });
        const cleanup = await page.evaluate(() => {
            const { game, field } = window.__publishedCampReview;
            const counts = { batches: 0, geometry: 0, matrices: 0, indirection: 0 };
            const observe = (object, key) => {
                const dispose = object.dispose; object.dispose = function () { counts[key]++; return dispose.call(this); };
            };
            for (const batch of field.children) if (batch.isBatchedMesh) {
                observe(batch, 'batches'); observe(batch.geometry, 'geometry'); observe(batch._matricesTexture, 'matrices'); observe(batch._indirectTexture, 'indirection');
            }
            game.renderSystem.clearInstanceScene(); game.renderSystem.clearInstanceScene();
            return counts;
        });
        await testInfo.attach('published-camp-clipping', { body: JSON.stringify({ ...result, cleanup, engineSHA256: metadata.engineSHA256,
            scope: `Current copied engine world owner, supplied fourteen-slot Fighter and real HUD. Three prepared town/camp views with ${3 * framesPerView} mixer updates per quality and same-pose whole-field reference. No server fight, continuous cadence, physical device or global performance acceptance.` }), contentType: 'application/json' });
        expect(result).toMatchObject({ parts: 6, camps: 15, clipped: result.supported || quality === 'low',
            batchParts: result.clipped ? 6 : 0, ownerEnabled: result.supported,
            hero: { quality, items: 14, missing: 0, fallback: 0 } });
        expect(result.framesPerView).toBe(framesPerView);
        expect(result.rows).toHaveLength(3 * framesPerView);
        for (const row of result.rows) {
            expect(row.changedRGB, row.view).toBe(0); expect(row.unstableRGB, row.view).toBe(0);
            // Extension-free clipping trades one whole-field draw for a small
            // number of visible-home draws; preserve the original Low budget.
            expect(row.selected.calls).toBeLessThanOrEqual(result.supported || quality !== 'low' ? row.reference.calls : 200);
            expect(row.selected.triangles).toBeLessThanOrEqual(row.reference.triangles);
        }
        expect(cleanup).toEqual(result.clipped ? { batches: 6, geometry: 6, matrices: 6, indirection: 6 } : { batches: 0, geometry: 0, matrices: 0, indirection: 0 });
        if (forceFallback) expect(result.supported).toBe(false);
        if (requiresHardwareWebGL()) { expect(result.supported).toBe(!forceFallback); expect(result.gpu).not.toMatch(/SwiftShader|llvmpipe|software/i); }
        expect(failures, failures.join('\n')).toEqual([]);
    } finally {
        await page.evaluate(() => {
            const review = window.__publishedCampReview;
            if (!review) return;
            if (review.clock) Object.defineProperty(performance, 'now', review.clock); else delete performance.now;
            review.hero?.dispose(); review.game.destroy(); delete window.__publishedCampReview;
        });
    }
});

test('copied published scene profiler works without deployed test modules', async ({ page, request }, testInfo) => {
    // This is delivery/ownership coverage with a minimal RAF fixture, not a
    // game-performance measurement. The publication contains no tests folder.
    for (const file of ['scene-performance.js', 'renderFrameInterval.js'])
        expect((await request.get(`${origin}/tests/e2e/${file}`)).status()).toBe(404);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const installFixture = () => {
        const info = { autoReset: true, render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 },
            reset() { this.render.calls = this.render.triangles = 0; } };
        const original = () => { info.render.calls += 3; info.render.triangles += 7; };
        window.game = { loop: original, uiManager: {}, activeEntitiesCache: [], renderSystem: { renderer: {
            info, getContext: () => ({ getExtension: () => null, getParameter: () => 'delivery-fixture' }) } } };
        window.__profileDeliveryOriginal = original;
        const tick = time => {
            if (!window.__profileDeliveryOriginal) return;
            window.game.loop(time); requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };
    await page.evaluate(installFixture);
    try {
        const reports = [];
        for (const label of ['first', 'repeat', 'after-navigation']) {
            if (label === 'after-navigation') {
                await page.reload({ waitUntil: 'networkidle' });
                await page.evaluate(installFixture);
            }
            const report = await profileGameplayScene(page, label);
            expect(report.frames).toBe(180); expect(report.visibleFrames).toBe(180);
            expect(report.drawCallsMedian).toBe(3); expect(report.trianglesMedian).toBe(7);
            expect(report.restored).toBe(true); expect(report.renderer).toBe('delivery-fixture');
            expect(await page.evaluate(() => window.game.loop === window.__profileDeliveryOriginal &&
                window.game.renderSystem.renderer.info.autoReset)).toBe(true);
            reports.push(report);
        }
        expect(await page.evaluate(async () => (await fetch('/tests/e2e/renderFrameInterval.js')).status)).toBe(404);
        await testInfo.attach('profiler-delivery-fixture', { body: JSON.stringify(reports), contentType: 'application/json' });
    } finally {
        await page.evaluate(() => { delete window.__profileDeliveryOriginal; delete window.game; });
    }
});

test('copied published engine renders contact foley and releases its audio resources', async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async release => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        document.getElementById('start-screen').style.display = 'none';
        const game = new GameEngine('Fighter', false, true, '', 'contact-bundle-fixture', null, 'flat-v1');
        const audio = game.audioManager;
        try {
            const context = new OfflineAudioContext(2, 16000, 48000);
            audio.context = context; audio.setVolume(1); audio.setEnabled(true); audio.setBusVolume('combat', 1);
            const played = game.playAudioCue('combat.hit', { kind: 'physical', impact: 1 });
            const voices = audio.activeTones.size;
            const noiseVoices = [...audio.activeTones].filter(voice => voice.oscillator instanceof AudioBufferSourceNode).length;
            const noiseBytes = (audio.contactNoiseBuffer?.length || 0) * 4;
            const buffer = await context.startRendering();
            const data = buffer.getChannelData(0);
            const peak = data.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
            const tailPeak = data.slice(12000).reduce((peak, value) => Math.max(peak, Math.abs(value)), 0);
            const activeAfter = audio.activeTones.size;
            game.destroy();
            return { played, voices, noiseVoices, noiseBytes, peak, tailPeak, activeAfter,
                disposed: audio.disposed, bufferReleased: audio.contactNoiseBuffer === null, contextReleased: audio.context === null };
        } finally { game.destroy(); }
    }, release);
    expect(result).toMatchObject({ played: true, voices: 2, noiseVoices: 1, noiseBytes: 30720,
        tailPeak: 0, activeAfter: 0, disposed: true, bufferReleased: true, contextReleased: true });
    expect(result.peak).toBeGreaterThan(.0001); expect(result.peak).toBeLessThan(.11);
    expect(failures).toEqual([]);
    await testInfo.attach('published-contact-foley', { body: JSON.stringify({ ...result, engineSHA256: metadata.engineSHA256,
        scope: 'Actual copied/versioned engine audio owner with OfflineAudioContext and synthetic confirmed physical cue. Signal and cleanup proof, not a server fight or listening approval.' }), contentType: 'application/json' });
});

test('published login recovers one interrupted engine download and constructs only one engine', async ({ page }, testInfo) => {
    const requests = [];
    await page.route('**/src/core/GameEngine.bundle.js?*', route => {
        requests.push(new URL(route.request().url()).search);
        return requests.length === 1 ? route.abort('connectionclosed') : route.continue();
    });
    let constructions = 0;
    page.on('console', message => { if (message.text() === 'Calling loadGame...') constructions++; });
    await enterPublishedFixture(page);
    await expect.poll(() => page.evaluate(() => Boolean(window.game?.renderSystem?.renderer))).toBe(true);
    expect(requests).toEqual([`?release=${release}`, `?startupRetry=1&release=${release}`]);
    const state = await page.evaluate(() => {
        const game = window.game;
        const state = { className: game.constructor.name, defaultGeometryOwned: Boolean(game.renderSystem.actorGameplayGeometry),
            errorHidden: document.getElementById('game-startup-status').hidden };
        game.destroy(); return state;
    });
    expect(state).toEqual({ className: 'GameEngine', defaultGeometryOwned: true, errorHidden: true });
    expect(constructions).toBe(1);
    await testInfo.attach('published-module-download-recovery', { body: JSON.stringify({ requests, constructions, state }), contentType: 'application/json' });
});

for (const kind of ['persistent-download', 'evaluation', 'export', 'dependency-download']) {
    test(`published login exposes ${kind} after bounded recovery`, async ({ page }, testInfo) => {
        const requests = []; let dependencyFailures = 0;
        await page.route('**/src/core/GameEngine.bundle.js?*', route => {
            requests.push(new URL(route.request().url()).search);
            if (kind === 'persistent-download') return route.abort('connectionclosed');
            if (kind === 'evaluation') return route.fulfill({ contentType: 'text/javascript', body: 'throw new TypeError("fixture initialization error"); export class GameEngine {}' });
            if (kind === 'export') return route.fulfill({ contentType: 'text/javascript', body:
                `import {missingFixtureExport} from './GraphicsStartup.js?release=${release}'; export class GameEngine {}` });
            return route.continue();
        });
        if (kind === 'dependency-download') await page.route('**/vendor/three/build/three.module.js*', route => {
            dependencyFailures++; return route.abort('connectionclosed');
        });
        await enterPublishedFixture(page);
        const status = page.locator('#game-startup-status');
        await expect(status).toBeVisible();
        const failureKind = ['persistent-download', 'dependency-download'].includes(kind) ? 'module-download' : kind === 'export' ? 'module-export' : 'unknown';
        await expect(status).toHaveAttribute('data-failure-kind', failureKind);
        await expect(status).toHaveAttribute('data-startup-phase', 'engine-module');
        await expect(page.locator('#start-screen')).not.toHaveClass(/hidden/);
        expect(await page.evaluate(() => Boolean(window.game))).toBe(false);
        const expected = ['persistent-download', 'dependency-download'].includes(kind) ? 2 : 1;
        expect(requests).toHaveLength(expected);
        if (kind === 'dependency-download') expect(dependencyFailures).toBe(1);
        await page.locator('#btn-play-character').click();
        await expect(status).toBeVisible();
        expect(requests).toHaveLength(expected);
        await testInfo.attach(`published-module-${kind}`, { body: JSON.stringify({ requests, dependencyFailures, failureKind, enginePresent: false }), contentType: 'application/json' });
    });
}

test('copied published engine keeps status symbols and keyboard reading through countdowns', async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async release => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        document.getElementById('start-screen').style.display = 'none';
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-bundle-only', null, 'flat-v1');
        try {
            game.uiManager.showHUD();
            game.upsertActiveBuff({ id: 'well_rested', name: 'Well Rested', durationSeconds: 100,
                remainingSeconds: 100, detail: '+10% all stats · +25% enemy-kill XP only' });
            game.minimap._renderBuffList();
            const button = game.minimap.buffList.querySelector('button');
            button.focus();
            const firstSymbol = button.firstChild;
            game.activeBuffs[0].remainingSeconds = 98.5;
            game.minimap._renderBuffList();
            const desktop = { sameButton: game.minimap.buffList.querySelector('button') === button,
                focused: document.activeElement === button, sameSymbol: button.firstChild === firstSymbol,
                symbolCount: button.querySelectorAll('svg').length, textGlyphs: button.textContent,
                width: game.minimap.buffList.getBoundingClientRect().width,
                tooltip: game.minimap.buffTooltip.textContent, describedBy: button.getAttribute('aria-describedby') };
            game.isMobile = true; document.body.classList.add('mobile-mode');
            game.minimap._renderBuffList();
            const phone = game.minimap.phoneStatus;
            phone.open();
            const mobile = { visible: !phone.root.hidden, symbolCount: phone.root.querySelectorAll('svg').length,
                details: phone.root.textContent };
            game.activeBuffs.length = 0; game.minimap._renderBuffList();
            const expired = { desktopIcons: game.minimap.buffList.querySelectorAll('button').length,
                tooltipHidden: game.minimap.buffTooltip.style.display === 'none', phoneRows: phone.rows.size };
            return { desktop, mobile, expired };
        } finally { game.destroy(); document.body.classList.remove('mobile-mode'); }
    }, release);
    expect(result.desktop).toMatchObject({ sameButton: true, focused: true, sameSymbol: true,
        symbolCount: 1, textGlyphs: '', describedBy: 'minimap-buff-tooltip' });
    expect(result.desktop.width).toBeLessThanOrEqual(64);
    expect(result.desktop.tooltip).toContain('98.5s');
    expect(result.mobile).toMatchObject({ visible: true, symbolCount: 1 });
    expect(result.mobile.details).toContain('+25% enemy-kill XP only');
    expect(result.expired).toEqual({ desktopIcons: 0, tooltipHidden: true, phoneRows: 0 });
    expect(failures, failures.join('\n')).toEqual([]);
    await testInfo.attach('published-status-symbols', { body: JSON.stringify({ result, engineSHA256: metadata.engineSHA256,
        scope: 'Actual copied/versioned game bundle UI construction; synthetic status metadata, no server/gameplay/device claim' }), contentType: 'application/json' });
});

test('copied published engine retains filled additive and wireframe effect policies', async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async release => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        const { AdditiveBlending } = await import('three');
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-bundle-only', null, 'flat-v1');
        const actor = game.createRemotePlayer('Player', 'synthetic-effect-fighter', 'Fighter');
        try {
            actor.gameEngine = game; actor.ironFortressTimer = 10; actor.syncAttachedStatusEffects(.04);
            game.spawnTransientEffect('sphere', actor.position, 0xddbb77,
                { source: actor, abilityName: 'Iron Fortress', abilityLayer: 0 });
            game.spawnTransientEffect('combat_feedback', actor.position, 0xddbb77,
                { feedbackKind: 'fighter_strike', amount: 100 });
            for (const effect of game.effects) effect.update(.04);
            const counts = { single: 0, wireframe: 0, ordinary: 0, invalid: 0 };
            game.renderSystem.effectGroup.traverse(mesh => {
                if (!mesh.isMesh) return;
                for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
                    const eligible = material.blending === AdditiveBlending && !material.wireframe;
                    if (eligible) counts.single++; else if (material.wireframe) counts.wireframe++; else counts.ordinary++;
                    if (material.forceSinglePass !== eligible) counts.invalid++;
                }
            });
            return { counts, statuses: actor.attachedStatusEffects.size, transients: game.effects.length };
        } finally { actor.dispose(); game.destroy(); }
    }, release);
    expect(result.statuses).toBeGreaterThan(0); expect(result.transients).toBe(2);
    expect(result.counts.single).toBeGreaterThan(0); expect(result.counts.wireframe).toBeGreaterThan(0);
    expect(result.counts.ordinary).toBeGreaterThan(0); expect(result.counts.invalid).toBe(0);
    expect(failures, failures.join('\n')).toEqual([]);
    await testInfo.attach('published-additive-policy', { body: JSON.stringify({ result, engineSHA256: metadata.engineSHA256,
        scope: 'Actual copied/versioned bundle factories exercised through engine/actor entry points; synthetic metadata, no server or gameplay timing claim.' }), contentType: 'application/json' });
});

test('copied published engine constructs a grounded ward and drives its state through the world owner', async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    const layout = JSON.parse(await readFile('tests/fixtures/production-dungeon-layouts.json', 'utf8'))
        .find(fixture => fixture.dungeonType === 'verdant_bastion_catacombs').layout;
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ release, layout }) => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-bundle-only', null, 'flat-v1');
        try {
            const world = game.worldGenerator;
            await world.createVerdantBastionCatacombs(0, 0, layout);
            const target = game.renderSystem.cameraTarget.clone().set(layout.rooms[0].x, .1, layout.rooms[0].z);
            game.renderSystem.setEnvironmentContext('verdant_bastion_catacombs', target, true);
            game.renderSystem.setCameraTarget(target); game.renderSystem.updateEnvironmentLighting(target, 0);
            const floor = game.renderSystem.instanceEnvironmentGroup.children.find(part => part.name === 'DungeonUnionFloor');
            const rootBatches = game.renderSystem.instanceEnvironmentGroup.children
                .filter(part => part.userData.proceduralDungeonInterior)
                .flatMap(part => part.children.filter(mesh => mesh.isMesh && mesh.material.vertexColors && !mesh.material.map));
            const roots = rootBatches.map(mesh => ({ triangles: (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3,
                maxY: mesh.geometry.boundingBox.max.y, roughness: mesh.material.roughness,
                smooth: !mesh.material.flatShading, textures: Object.values(mesh.material).filter(value => value?.isTexture).length }));
            const state = world.dungeonRoomPresentations.get(0), ward = state.getObjectByName('DungeonEntryWard');
            const veil = ward.getObjectByName('DungeonExitPortal');
            veil.updateMatrix();
            const matrix = veil.matrix.toArray();
            const colliders = JSON.stringify(game.collisionManager.colliders), phases = [];
            for (const objectiveRoomIndex of [0, -1, 0]) {
                world.updateDungeonRoomState({ currentRoomIndex: 0, objectiveRoomIndex, rooms: [{ index: 0, cleared: objectiveRoomIndex === -1 }] });
                const appliedOpacity = veil.material.opacity;
                world.updateDungeonPresentation(.25);
                game.renderSystem.render();
                phases.push({ ready: state.userData.exitReady, appliedOpacity, time: veil.material.userData.dungeonVeilTime.value,
                    stable: veil.matrix.elements.every((value, index) => value === matrix[index]) });
            }
            const gl = game.renderSystem.renderer.getContext();
            const floorPatinaCompiled = game.renderSystem.renderer.info.programs.some(program =>
                gl.getShaderSource(program.fragmentShader)?.includes('verdantWeather'));
            return { parts: ward.children.length, visualOnly: ward.userData.visualOnly, phases, roots,
                floorPatinaCompiled, floorPatina: floor.material.userData.verdantFloorPatina === true,
                collidersStable: JSON.stringify(game.collisionManager.colliders) === colliders };
        } finally { game.destroy(); }
    }, { release, layout });
    expect(result).toMatchObject({ parts: 3, visualOnly: true, collidersStable: true, floorPatina: true, floorPatinaCompiled: true });
    expect(result.roots).toHaveLength(layout.rooms.length);
    for (const root of result.roots) {
        expect(root).toMatchObject({ triangles: 2880, roughness: .94, smooth: true, textures: 0 });
        expect(root.maxY).toBeLessThan(1);
    }
    expect(result.phases).toEqual([{ ready: false, appliedOpacity: .18, time: .25, stable: true },
        { ready: true, appliedOpacity: .9, time: .5, stable: true }, { ready: false, appliedOpacity: .18, time: .75, stable: true }]);
    expect(failures, failures.join('\n')).toEqual([]);
    await testInfo.attach('published-entry-ward', { body: JSON.stringify({ result, engineSHA256: metadata.engineSHA256,
        scope: 'Copied/versioned engine and actual WorldGenerator entry points, prepared layout and room summaries. No server or earned completion claim.' }), contentType: 'application/json' });
});

test('actual published engine stays lazy at login and constructs each class from the bounded module graph', async ({ page, request }) => {
    const failures = collectBrowserFailures(page, origin), modules = new Set();
    page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.js')) modules.add(url.pathname);
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await expect(page.locator('#auth-username')).toBeVisible();
    const manifest = await (await request.get(`${origin}/release.json`)).json();
    const packageVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
    expect(manifest).toEqual({ commit: release, version: `Alpha ${packageVersion}` });
    await expect(page.locator('.start-version-row__label')).toHaveText(manifest.version);
    expect([...modules].some(file => file.includes('GameEngine') || file.includes('/vendor/three/'))).toBe(false);
    const loginModules = new Set([...modules].filter(file => file.startsWith('/src/')));
    const result = await page.evaluate(async release => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        const result = [];
        for (const character of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
            const game = new GameEngine(character, false, true, '', 'synthetic-bundle-only', null, 'flat-v1');
            try {
                const actor = game.createRemotePlayer('Player', `class-${character}`, character);
                const enemy = game.createRemotePlayer('Enemy', `enemy-${character}`, 'Skeleton');
                result.push({ character, renderer: Boolean(game.renderSystem?.renderer),
                    network: Boolean(game.network), ui: Boolean(game.uiManager),
                    className: actor.constructor.name, enemyName: enemy.constructor.name });
                actor.dispose(); enemy.dispose();
            } finally { game.destroy(); }
        }
        return result;
    }, release);
    expect(result).toEqual(['Fighter', 'Rogue', 'Wizard', 'Cleric'].map(character =>
        ({ character, renderer: true, network: true, ui: true, className: character, enemyName: 'Skeleton' })));
    expect(metadata.bundledModules).toBeGreaterThan(350);
    // Shared login imports retain their one module instance; independent game
    // entities/UI/art/data arrive through one bundle, not hundreds of requests.
    const applicationModules = [...modules].filter(file => file.startsWith('/src/'));
    expect(applicationModules.filter(file => !loginModules.has(file)))
        .toEqual(['/src/core/GameEngine.bundle.js']);
    expect(applicationModules).toContain('/src/core/GameEngine.bundle.js');
    expect(applicationModules.some(file => file.startsWith('/src/entities/'))).toBe(false);
    expect(failures, failures.join('\n')).toEqual([]);
});

for (const type of ['Skeleton', 'DemonOrc'])
for (const quality of ['high', 'low']) test(`published ${quality} ${type === 'Skeleton' ? 'actor' : 'DemonOrc'} defaults render generated roots and retire owned copies`, async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ release, quality, type }) => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-bundle-only', null, 'flat-v1');
        const render = game.renderSystem, owner = render.actorInstances, multi = owner?.multiDraw, actors = [];
        let result;
        try {
            render.setGraphicsQuality(quality);
            for (let i = 0; i < 6; i++) {
                const actor = game.createRemotePlayer('Enemy', `published-${type}-${i}`, type);
                actors.push(actor); await actor.ensureMesh();
                actor.mesh.position.set(i % 3 * 3, 0, i < 3 ? 0 : 3); render.add(actor.mesh);
            }
            const poses = [];
            for (const state of type === 'DemonOrc' ? ['Idle', 'Walk', 'Run', 'Attack', 'Death'] : ['Idle']) {
                for (const [i, actor] of actors.entries()) {
                    actor.playAnimation(state, state !== 'Death', true);
                    actor.updateAnimationMixer(.2 + i * .07);
                }
                render.render();
                poses.push({ state, groups: multi?.entries.size || 0, draws: render.renderer.info.render.calls,
                    restored: !owner.hidden.length && !multi.hidden.length && !owner.group.visible && !multi.group.visible });
            }
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            result = { enabled: Boolean(owner?.enabled && multi?.enabled && multi.perInstanceFrustum),
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                constructors: actors.map(actor => actor.mesh.userData.humanoidRenderBatches), poses,
                groups: multi?.entries.size || 0, extension: render.renderer.extensions.has('WEBGL_multi_draw'),
                restored: !owner.hidden.length && !multi.hidden.length && !owner.group.visible && !multi.group.visible,
                draws: render.renderer.info.render.calls,
                materialVariants: { enabled: multi.materialVariants, active: multi.materialVariantPool.entries.size,
                    created: multi.materialVariantPool.created } };
        } finally {
            for (const actor of actors) actor.dispose();
            game.destroy();
        }
        result.disposed = multi.disposed && multi.entries.size === 0 && multi.group.parent === null && owner.roots.size === 0;
        result.materialVariants.retired = multi.materialVariantPool.retired;
        result.materialVariants.remaining = multi.materialVariantPool.entries.size;
        return result;
    }, { release, quality, type });
    await testInfo.attach('published-default-actor-owner', { body: JSON.stringify({ quality, type, result, engineSHA256: metadata.engineSHA256 }), contentType: 'application/json' });
    expect(result.enabled && result.extension && result.restored && result.disposed).toBe(true);
    expect(result.materialVariants.enabled).toBe(quality === 'high');
    if (quality === 'high') expect(result.materialVariants.active).toBeGreaterThan(0);
    else expect(result.materialVariants.active).toBe(0);
    expect(result.materialVariants.created).toBe(result.materialVariants.retired);
    expect(result.materialVariants.remaining).toBe(0);
    expect(result.groups).toBeGreaterThan(0); expect(result.draws).toBeGreaterThan(0);
    if (type === 'DemonOrc') {
        expect(result.poses.map(pose => pose.state)).toEqual(['Idle', 'Walk', 'Run', 'Attack', 'Death']);
        for (const constructor of result.constructors) expect(constructor).toMatchObject({ sourceMeshes: 55, drawMeshes: 23, surfaceAttributes: true });
        for (const pose of result.poses) {
            expect(pose.groups).toBeGreaterThan(0); expect(pose.draws).toBeGreaterThan(0); expect(pose.restored).toBe(true);
        }
    }
    if (requiresHardwareWebGL()) expect(result.gpu).not.toMatch(/SwiftShader|llvmpipe|softpipe|software/i);
    expect(failures, failures.join('\n')).toEqual([]);
});

test('published geometry owner loads its immutable worker, retires streamed roots and reuses the exact cached worker offline', async ({ page, context }, testInfo) => {
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, origin), workers = [], indexRequests = new Set();
    page.on('worker', worker => workers.push(worker.url()));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/assets/gameplay-geometry/indices.')) indexRequests.add(request.url()); });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.evaluate(() => {
        const Original = window.Worker;
        function CaptureWorker(...args) {
            const worker = new Original(...args), post = worker.postMessage;
            if (String(args[0]).includes('ActorGameplayGeometryWorker')) worker.postMessage = function (message, ...rest) {
                if (!window.__publishedBodyRequest && message.kind === 'body') window.__publishedBodyRequest = structuredClone(message);
                return Reflect.apply(post, this, [message, ...rest]);
            };
            return worker;
        }
        Object.setPrototypeOf(CaptureWorker, Original); CaptureWorker.prototype = Original.prototype;
        window.Worker = CaptureWorker; window.__restorePublishedWorker = () => { window.Worker = Original; };
    });
    const startup = await page.evaluate(async release => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-bundle-only', null, 'flat-v1');
        const render = game.renderSystem, defaultOwned = Boolean(render.actorGameplayGeometry),
            workerDeferred = render.actorGameplayGeometry.delivery.worker === null;
        const actor = game.createRemotePlayer('Player', 'owned-worker-fighter', 'Fighter'); actor.gameEngine = game;
        await actor.ensureMesh(); render.add(actor.mesh);
        window.__publishedGeometry = { game, actor, owner: render.actorGameplayGeometry };
        return { defaultOwned, workerDeferred, authored: actor.mesh.userData.authoredClass };
    }, release);
    expect(startup).toEqual({ defaultOwned: true, workerDeferred: true, authored: 'Fighter' });
    await page.waitForFunction(() => {
        const { delivery, pass } = window.__publishedGeometry.owner;
        if (delivery.failed) throw Error('Published geometry worker failed');
        return !delivery.active && !delivery.jobs.size && pass.entries.size > 0;
    }, null, { timeout: 90_000 });
    const workerURL = `${origin}/${metadata.worker.output}?release=${release}`;
    expect(workers).toEqual([workerURL]);
    await expect.poll(() => page.evaluate(async workerURL => {
        for (const key of await caches.keys()) if (await (await caches.open(key)).match(workerURL)) return true;
        return false;
    }, workerURL)).toBe(true);
    const indexURLs = [...indexRequests], allowedShards = new Set(metadata.worker.precomputed.shards.map(shard => `${origin}/${shard.path}`));
    expect(indexURLs.length).toBeGreaterThan(0);
    expect(indexURLs.every(url => allowedShards.has(url))).toBe(true);
    expect(indexURLs).not.toContain(`${origin}/${metadata.worker.precomputed.path}`);
    await expect.poll(() => page.evaluate(async indexURLs => {
        const stores = await Promise.all((await caches.keys()).map(name => caches.open(name)));
        for (const url of indexURLs) {
            let found = false; for (const store of stores) if (await store.match(url)) { found = true; break; }
            if (!found) return false;
        }
        return true;
    }, indexURLs)).toBe(true);
    await page.evaluate(() => window.__restorePublishedWorker());
    const lifecycle = await page.evaluate(() => {
        const { game, actor, owner } = window.__publishedGeometry;
        const before = { roots: owner.delivery.roots.size, entries: owner.pass.entries.size, cacheHits: owner.delivery.stats.cacheHits };
        actor.mesh.removeFromParent();
        const retired = !owner.delivery.roots.has(actor.mesh) && [...owner.pass.entries.values()].every(row => row.root !== actor.mesh);
        game.renderSystem.add(actor.mesh);
        const reattached = owner.delivery.roots.has(actor.mesh);
        return { before, retired, reattached };
    });
    await page.waitForFunction(() => {
        const { delivery, pass } = window.__publishedGeometry.owner;
        if (delivery.failed) throw Error('Returning geometry worker failed');
        return !delivery.active && !delivery.jobs.size && pass.entries.size > 0;
    });
    Object.assign(lifecycle, await page.evaluate(() => {
        const { game, actor, owner } = window.__publishedGeometry;
        const returning = { entries: owner.pass.entries.size, cacheHits: owner.delivery.stats.cacheHits };
        actor.dispose(); game.destroy(); delete window.__publishedGeometry;
        return { returning, disposed: owner.disposed && owner.delivery.disposed,
            rootsAfter: owner.delivery.roots.size, jobsAfter: owner.delivery.jobs.size, entriesAfter: owner.pass.entries.size };
    }));
    expect(lifecycle.retired && lifecycle.reattached && lifecycle.disposed).toBe(true);
    expect([lifecycle.rootsAfter, lifecycle.jobsAfter, lifecycle.entriesAfter]).toEqual([0, 0, 0]);
    expect(lifecycle.returning.cacheHits).toBeGreaterThan(lifecycle.before.cacheHits);
    await context.setOffline(true);
    const offline = [];
    try {
        for (const kind of ['color', 'rigid']) offline.push({ kind, ...await page.evaluate(({ workerURL, kind }) => new Promise((resolve, reject) => {
            const worker = new Worker(workerURL, { type: 'module' });
            const timer = setTimeout(() => { worker.terminate(); reject(Error('Offline worker timeout')); }, 15_000);
            worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(Error('Offline worker failed')); };
            worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); resolve({ id: data.id,
                indices: data.indices?.length, error: data.error || null }); };
            const attribute = (array, itemSize) => ({ array: new Float32Array(array), itemSize });
            worker.postMessage({ id: 7, kind, source: { quality: 'low', index: new Uint32Array([0, 1, 2, 0, 2, 3]), attributes: {
                position: attribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3),
                normal: attribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
                ...(kind === 'rigid' ? { uv: attribute([0, 0, 1, 0, 1, 1, 0, 1], 2) } : {
                    skinIndex: attribute(new Float32Array(16), 4),
                    skinWeight: attribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4) })
            } } });
        }), { workerURL, kind }) });
        offline.push({ kind: 'supplied-body', ...await page.evaluate(workerURL => new Promise((resolve, reject) => {
            const worker = new Worker(workerURL, { type: 'module' });
            const timer = setTimeout(() => { worker.terminate(); reject(Error('Offline precomputed body timeout')); }, 15000);
            worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(Error('Offline precomputed body failed')); };
            worker.onmessage = async ({ data }) => {
                clearTimeout(timer); worker.terminate();
                const sha256 = data.indices ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', data.indices))].map(byte => byte.toString(16).padStart(2, '0')).join('') : null;
                resolve({ id: data.id, indices: data.indices?.length, error: data.error || null, key: data.key, sha256, precomputed: data.precomputed });
            };
            worker.postMessage({ ...structuredClone(window.__publishedBodyRequest), id: 7 });
        }), workerURL) });
    } finally { await context.setOffline(false); }
    for (const row of offline) { expect(row.id).toBe(7); expect(row.error).toBeNull(); expect(row.indices).toBeGreaterThan(0); }
    const body = offline.find(row => row.kind === 'supplied-body');
    expect(body.precomputed).toBe(true); expect(body.sha256).toBe(precomputedCatalog.entries[body.key]?.sha256);
    await testInfo.attach('published-geometry-worker', { body: JSON.stringify({ startup, worker: metadata.worker,
        workerURL, indexURLs, lifecycle, offline }, null, 2), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});

for (const quality of ['high', 'low']) test(`copied published ${quality} elemental floor materials render through the world owner`, async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    const fixtures = JSON.parse(await readFile('tests/fixtures/production-dungeon-layouts.json', 'utf8'));
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ release, quality, fixtures }) => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        localStorage.setItem('eidolon.graphicsQuality', quality);
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-floor-only', null, 'flat-v1');
        const render = game.renderSystem, world = game.worldGenerator, samples = [];
        try {
            game.uiManager.setGraphicsQuality(quality);
            render.render();
            const unwarmedBaseline = { ...render.renderer.info.memory };
            // An empty scene has not initialized Three's PBR reflection/PMREM
            // resources. Warm an actual room, then require exact return to that
            // baseline after every subsequent room, rather than counting the
            // renderer's first PBR allocation as a dungeon ownership leak.
            const warmLayout = fixtures.find(fixture => fixture.dungeonType === 'molten_core').layout;
            await world.createMoltenCore(0, 0, warmLayout);
            const warmTarget = render.cameraTarget.clone().set(warmLayout.rooms[0].x, .1, warmLayout.rooms[0].z);
            render.setEnvironmentContext('molten_core', warmTarget, true);
            render.setCameraTarget(warmTarget); render.updateEnvironmentLighting(warmTarget, 0);
            render.render(); render.render();
            const warmFloor = render.instanceEnvironmentGroup.children.find(part => part.name === 'DungeonUnionFloor');
            const warmed = Boolean(render.renderer.properties.get(warmFloor.material).currentProgram);
            render.clearGroupChildren(render.instanceEnvironmentGroup, { dispose: true }); render.render();
            const baseline = { ...render.renderer.info.memory }, cleared = [];
            const methods = { molten_core: 'createMoltenCore', tempest_spire: 'createTempestSpire',
                abyssal_well: 'createAbyssalWell', umbral_nexus: 'createUmbralNexus',
                verdant_bastion_catacombs: 'createVerdantBastionCatacombs' };
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            for (const [type, method] of Object.entries(methods)) {
                render.clearGroupChildren(render.instanceEnvironmentGroup, { dispose: true });
                const layout = fixtures.find(fixture => fixture.dungeonType === type).layout;
                await world[method](0, 0, layout);
                const target = render.cameraTarget.clone().set(layout.rooms[0].x, .1, layout.rooms[0].z);
                render.setEnvironmentContext(type, target, true); render.setCameraTarget(target); render.updateEnvironmentLighting(target, 0);
                const colliders = JSON.stringify(game.collisionManager.colliders);
                render.render(); render.render();
                const floor = render.instanceEnvironmentGroup.children.find(part => part.name === 'DungeonUnionFloor');
                const program = render.renderer.properties.get(floor.material).currentProgram;
                const compiled = Boolean(program && gl.getShaderSource(program.fragmentShader)?.includes('elementalFloorWeather') &&
                    gl.getProgramParameter(program.program, gl.LINK_STATUS));
                const propMaterials = new Map();
                render.instanceEnvironmentGroup.traverse(part => {
                    const role = part.material?.userData.dungeonPropSurface;
                    if (role) propMaterials.set(`${role}:${part.material.vertexColors}`, { role, material: part.material });
                });
                const props = [...propMaterials.values()].map(({ role, material }) => {
                    const propProgram = render.renderer.properties.get(material).currentProgram;
                    return { role, vertexColors: material.vertexColors,
                        compiled: Boolean(propProgram && gl.getProgramParameter(propProgram.program, gl.LINK_STATUS)),
                        maps: ['map', 'normalMap', 'roughnessMap'].map(key => ({ key, size: material[key].image.width,
                            colorSpace: material[key].colorSpace })) };
                });
                const compositions = render.instanceEnvironmentGroup.children.filter(part => part.userData.floorComposition);
                const plans = new Map();
                for (const dressing of compositions) {
                    const { plan, stones } = dressing.userData.floorComposition;
                    if (plans.has(plan)) continue;
                    const room = layout.rooms[dressing.userData.roomIndex];
                    const views = [];
                    for (const [view, offset] of plan === 'arena' ? [['center', 0], ['edge', 17]] : [['feature', 8]]) {
                        target.set(room.x, .1, room.z + offset);
                        render.setCameraTarget(target); render.updateEnvironmentLighting(target, 0); render.render();
                        views.push({ view, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles });
                    }
                    plans.set(plan, { plan, stones, calls: render.renderer.info.render.calls,
                        triangles: render.renderer.info.render.triangles, masonry: dressing.userData.bossMasonry || null, views });
                }
                samples.push({ type, compiled, floorLinked: Boolean(program && gl.getProgramParameter(program.program, gl.LINK_STATUS)),
                    patina: floor.material.userData.elementalFloorPatina,
                    verdant: floor.material.userData.verdantFloorPatina, props,
                    paving: render.instanceEnvironmentGroup.children.filter(part => part.userData.processionalPaving)
                        .map(part => part.userData.processionalPaving.identity),
                    relics: render.instanceEnvironmentGroup.children.filter(part => part.userData.regionalRelic)
                        .map(part => part.userData.regionalRelic),
                    compositions: [...plans.values()], compositionRooms: compositions.length, roomCount: layout.rooms.length,
                    quality: world.graphicsQuality, mapSize: floor.material.map.image.width,
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                    collidersStable: colliders === JSON.stringify(game.collisionManager.colliders) });
                render.clearGroupChildren(render.instanceEnvironmentGroup, { dispose: true }); render.render();
                cleared.push({ type, ...render.renderer.info.memory });
            }
            render.clearGroupChildren(render.instanceEnvironmentGroup, { dispose: true }); render.render();
            const remainingMeshes = [];
            render.scene.traverse(part => {
                if (part.geometry) remainingMeshes.push({ name: part.name, type: part.type, geometry: part.geometry.type, parent: part.parent?.name });
            });
            return { samples, warmed, unwarmedBaseline, baseline, cleared, after: { ...render.renderer.info.memory }, remainingMeshes,
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
        } finally { game.destroy(); }
    }, { release, quality, fixtures });
    await testInfo.attach('published-elemental-floors', { body: JSON.stringify({ ...result, engineSHA256: metadata.engineSHA256,
        scope: 'Actual copied/versioned engine, normal saved quality preference and world builders. Prepared materials, shader compilation, collider stability and GPU cleanup; no server, gameplay timing or physical-device claim.' }), contentType: 'application/json' });
    for (const row of result.samples) {
        expect(row).toMatchObject({ quality, floorLinked: true,
            mapSize: quality === 'low' && row.type !== 'verdant_bastion_catacombs' ? 64 : 256, collidersStable: true });
        if (row.type === 'verdant_bastion_catacombs') expect(row.verdant).toBe(true);
        else expect(row).toMatchObject({ compiled: true, patina: row.type });
        // The finished entry ward shares the prop maps while retaining its
        // baked vertex colors, including ironwork as well as masonry.
        expect(row.props.map(prop => `${prop.role}:${prop.vertexColors}`).sort()).toEqual(['metal:false', 'metal:true', 'stone:false', 'stone:true']);
        for (const identity of ['entry_gate', 'treasure_cache', 'restorative_shrine']) expect(row.paving).toContain(identity);
        expect(row.compositionRooms).toBe(row.roomCount);
        // Each canonical seed retains its actual room purposes. Cache, font,
        // passage and ambush courts now have their own physical paving plans.
        const expectedPlans = row.type === 'umbral_nexus' ? ['arena', 'broken-court', 'chapel', 'nave', 'vault']
            : row.type === 'verdant_bastion_catacombs' ? ['arena', 'broken-court', 'chapel', 'nave', 'procession', 'vault']
                : ['aisle', 'arena', 'chapel', 'nave', 'procession', 'vault'];
        expect(row.compositions.map(part => part.plan).sort()).toEqual(expectedPlans);
        for (const part of row.compositions) {
            expect(part.stones).toBeGreaterThan(0); expect(part.stones).toBeLessThanOrEqual(44);
            expect(part.calls).toBeGreaterThan(0); expect(part.calls).toBeLessThanOrEqual(quality === 'low' ? 200 : 350);
            expect(part.triangles).toBeGreaterThan(0); expect(part.triangles).toBeLessThanOrEqual(quality === 'low' ? 85000 : 250000);
            if (part.plan === 'arena') {
                expect(part.masonry).toMatchObject({ outerRadius: 17.4, visualOnly: true });
                expect(part.masonry.triangles).toBeLessThanOrEqual(640);
                expect(part.views.map(view => view.view)).toEqual(['center', 'edge']);
            }
            for (const view of part.views) {
                expect(view.calls).toBeGreaterThan(0); expect(view.calls).toBeLessThanOrEqual(quality === 'low' ? 200 : 350);
                expect(view.triangles).toBeGreaterThan(0); expect(view.triangles).toBeLessThanOrEqual(quality === 'low' ? 85000 : 250000);
            }
        }
        if (row.type === 'verdant_bastion_catacombs') expect(row.relics).toEqual([]);
        else {
            expect(row.relics.length).toBeGreaterThan(0);
            for (const relic of row.relics) expect(relic).toEqual({ type: row.type, count: 2, channels: ['body', 'metal', 'glow'], quality });
        }
        for (const prop of row.props) {
            expect(prop.compiled, `${row.type} ${prop.role}`).toBe(true);
            for (const map of prop.maps) expect(map).toMatchObject({ size: quality === 'low' ? 64 : 128,
                colorSpace: map.key === 'map' ? 'srgb' : '' });
        }
        expect(row.calls).toBeGreaterThan(0); expect(row.calls).toBeLessThanOrEqual(quality === 'low' ? 200 : 350);
        expect(row.triangles).toBeGreaterThan(0); expect(row.triangles).toBeLessThanOrEqual(quality === 'low' ? 85000 : 250000);
    }
    expect(result.after).toEqual(result.baseline);
    expect(result.warmed).toBe(true);
    for (const { type, ...memory } of result.cleared) expect(memory, type).toEqual(result.baseline);
    if (requiresHardwareWebGL()) expect(result.gpu).not.toMatch(/SwiftShader|llvmpipe|software/i);
    expect(failures, failures.join('\n')).toEqual([]);
});

for (const quality of ['high', 'low']) test(`published ${quality} geometry scheduling preserves prepared four-class outfits`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ release, quality }) => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-scheduling-only', null, 'flat-v1');
        const render = game.renderSystem, actors = [], arms = [];
        const outfits = {
            Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
            Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
            Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
            Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
        };
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
        const digest = async array => [...new Uint8Array(await crypto.subtle.digest('SHA-256', array))].map(byte => byte.toString(16).padStart(2, '0')).join('');
        try {
            render.setGraphicsQuality(quality); render.setActorGameplayGeometryEnabled(false);
            for (const [index, character] of Object.keys(outfits).entries()) {
                const actor = game.createRemotePlayer('Player', `schedule-${character}`, character);
                actor.gameEngine = game; actors.push(actor); await actor.ensureMesh();
                actor.syncEquipmentVisuals(Object.fromEntries([...outfits[character], 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, i) =>
                    [slots[i], { id: `schedule-${character}-${slots[i]}`, name, baseName: name, slot: i === 8 && character === 'Rogue' ? 'mainHand' : slots[i],
                        type: [7, 8].includes(i) ? 'WEAPON' : 'ARMOR', rarity: 'Rare', potency: 5 }])));
                await actor.mesh.userData.equipmentReady;
                if (character === 'Rogue') {
                    actor.mixedWeaponStances = [];
                    for (const state of ['Idle', 'CombatIdle', 'Walk', 'Run', 'Block']) {
                        actor.playAnimation(state, true, true); actor.updateAnimationMixer(.2);
                        actor.mixedWeaponStances.push(actor.currentAction.getClip().name);
                    }
                }
                actor.mesh.position.set((index - 1.5) * 4, 0, 0); render.add(actor.mesh);
            }
            render.setZoom(18); render.setCameraTarget(actors[1].mesh.position);
            const canvas = render.renderer.domElement, copy = document.createElement('canvas');
            copy.width = canvas.width; copy.height = canvas.height;
            const context = copy.getContext('2d', { willReadFrequently: true });
            for (const reference of [true, false]) {
                render.setActorGameplayGeometryEnabled(false); render.setActorGameplayGeometryEnabled(true);
                const { pass, delivery } = render.actorGameplayGeometry, order = [], indices = new Map(), outputs = [], pendingOutputs = [];
                const complete = delivery.complete;
                delivery.complete = function (message) {
                    if (message.indices) pendingOutputs.push(digest(message.indices).then(sha256 => outputs.push({
                        key: message.key, sha256, fallback: message.fallback, precomputed: message.precomputed })));
                    return complete.call(this, message);
                };
                const next = delivery.nextJob, register = pass.register;
                delivery.nextJob = function () {
                    const pending = this.queue.map(job => ({ id: job.id, triangles: job.sourceTriangles }));
                    const expected = reference || this.dispatched % 4 === 3 ? pending[0] : pending.reduce((best, job) => !best || job.triangles > best.triangles ? job : best, null);
                    const job = reference ? this.queue.shift() : next.call(this);
                    if (job) order.push({ id: job.id, mesh: job.generation.mesh.name, triangles: job.sourceTriangles, expected: expected.id });
                    return job;
                };
                pass.register = function (mesh, prepared) {
                    const installed = register.call(this, mesh, prepared);
                    if (installed) indices.set(mesh.uuid, prepared.slice());
                    return installed;
                };
                const deadline = performance.now() + 90_000;
                while (delivery.active || delivery.jobs.size) {
                    if (delivery.failed || performance.now() > deadline) throw Error('Four-class geometry scheduling did not complete');
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                await Promise.all(pendingOutputs);
                render.render(); render.render(); context.drawImage(canvas, 0, 0);
                const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
                arms.push({ reference, order, outputs, indices: Object.fromEntries(await Promise.all([...indices].map(async ([id, array]) => [id, await digest(array)]))),
                    pixels: await digest(pixels), draws: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                    restored: !pass.active.length && [...pass.entries.values()].every(entry => entry.mesh.geometry === entry.source), stats: { ...delivery.stats } });
            }
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { quality, arms, classes: actors.map(actor => ({ character: actor.mesh.userData.authoredClass,
                quality: actor.mesh.userData.authoredQuality, items: actor.mesh.userData.equipmentVisualItemCount,
                missing: actor.mesh.userData.equipmentVisualMissing.length, fallback: actor.mesh.userData.equipmentVisualFallback.length,
                mixedWeaponStances: actor.mixedWeaponStances || [] })),
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), engineSHA256: null };
        } finally {
            for (const actor of actors) actor.dispose(); game.destroy();
        }
    }, { release, quality });
    result.engineSHA256 = metadata.engineSHA256;
    await testInfo.attach('published-geometry-scheduling', { body: JSON.stringify(result), contentType: 'application/json' });
    if (requiresHardwareWebGL()) expect(result.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(result.classes).toHaveLength(4);
    for (const actor of result.classes) expect(actor).toMatchObject({ quality, items: 14, missing: 0, fallback: 0 });
    expect(result.classes.find(actor => actor.character === 'Rogue').mixedWeaponStances)
        .toEqual(['Idle', 'CombatIdle', 'Walk', 'Run', 'Block'].map(state => `Dagger_Sword_${state}_Dual`));
    const [reference, candidate] = result.arms;
    for (const arm of result.arms) {
        expect(arm.restored).toBe(true); expect(arm.stats.failed).toBe(0); expect(arm.stats.rejected).toBe(0);
        expect(arm.order.length).toBeGreaterThan(60); expect(arm.order.every(row => row.id === row.expected)).toBe(true);
        expect(arm.outputs.length).toBe(arm.order.length);
        for (const row of arm.outputs) {
            expect(row.precomputed).toBe(true);
            expect(row.sha256).toBe(precomputedCatalog.entries[row.key]?.sha256);
            expect(row.fallback).toBe(precomputedCatalog.entries[row.key]?.fallback);
        }
    }
    expect(Object.keys(candidate.indices).length).toBeGreaterThan(40);
    expect(candidate.indices).toEqual(reference.indices);
    expect(candidate.pixels).toBe(reference.pixels);
    expect(candidate.draws).toBe(reference.draws); expect(candidate.triangles).toBe(reference.triangles);
    expect(candidate.order.map(row => row.mesh)).not.toEqual(reference.order.map(row => row.mesh));
    expect(failures, failures.join('\n')).toEqual([]);
});

test.describe('default geometry worker fallback', () => {
    test.use({ serviceWorkers: 'block' });
    test('actual published worker exception keeps the game and original model usable', async ({ page }, testInfo) => {
        const failures = collectBrowserFailures(page, origin), workerURLs = [];
        page.on('worker', worker => workerURLs.push(worker.url()));
        await page.route('**/ActorGameplayGeometryWorker.*.js?*', route => route.fulfill({ contentType: 'text/javascript',
            body: 'self.onmessage = () => { throw Error("intentional geometry worker failure"); };' }));
        await page.goto(origin, { waitUntil: 'networkidle' });
        await page.evaluate(async release => {
            const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
            const game = new GameEngine('Fighter', false, true, '', 'synthetic-fallback-only', null, 'flat-v1');
            const actor = game.createRemotePlayer('Player', 'fallback-fighter', 'Fighter'); actor.gameEngine = game;
            await actor.ensureMesh(); game.renderSystem.add(actor.mesh);
            window.__workerFallback = { game, actor, owner: game.renderSystem.actorGameplayGeometry };
        }, release);
        await page.waitForFunction(() => window.__workerFallback.owner.delivery.failed);
        const result = await page.evaluate(() => {
            const { game, actor, owner } = window.__workerFallback, render = game.renderSystem;
            render.setCameraTarget(actor.position);
            const original = render.renderer.render, before = [];
            actor.mesh.traverse(mesh => { if (mesh.isMesh) before.push([mesh, mesh.geometry]); });
            render.render();
            const result = { owned: owner === render.actorGameplayGeometry, failed: owner.delivery.failed,
                entries: owner.pass.entries.size, jobs: owner.delivery.jobs.size, queue: owner.delivery.queue.length,
                originalGeometry: before.every(([mesh, geometry]) => mesh.geometry === geometry),
                rendererWrapped: render.renderer.render === original,
                calls: render.renderer.info.render.calls, failures: owner.delivery.stats.failed };
            actor.dispose(); game.destroy(); delete window.__workerFallback;
            return { ...result, retired: owner.disposed && !owner.delivery.roots.size && !owner.pass.entries.size };
        });
        expect(workerURLs).toEqual([`${origin}/${metadata.worker.output}?release=${release}`]);
        expect(result.failed && result.owned && result.originalGeometry && result.rendererWrapped && result.retired).toBe(true);
        expect([result.entries, result.jobs, result.queue, result.failures]).toEqual([0, 0, 0, 1]);
        expect(result.calls).toBeGreaterThan(0);
        expect(failures.filter(message => !message.includes('intentional geometry worker failure'))).toEqual([]);
        await testInfo.attach('default-worker-fallback', { body: JSON.stringify({ result, workerURLs, expectedFailures: failures }), contentType: 'application/json' });
    });
});

test('published engine reaches the jump destination in real elapsed time at low FPS', async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(measureJumpWallClock, { publishedRelease: release });
    await testInfo.attach('published-jump-wall-clock', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.errors).toEqual([]);
    if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(result.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(result.samples.map(sample => sample.fps)).toEqual([15, 60]);
    for (const sample of result.samples) {
        expect(sample.acceptedDurationMs).toBe(1100);
        expect(sample.elapsedMs).toBeGreaterThanOrEqual(sample.acceptedDurationMs);
        expect(sample.elapsedMs).toBeLessThan(1550);
        expect(sample.positionError).toBeLessThan(0.01);
        expect(sample.renderError).toBeLessThan(0.01);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});


for (const quality of ['high', 'low']) test(`published ${quality} singleton actors follow quality changes and restore source visibility`, async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ release, quality }) => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-bundle-only', null, 'flat-v1');
        const render = game.renderSystem, owner = render.actorInstances, multi = owner.multiDraw, actors = [], rows = [], transitions = [];
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const frozen = performance.now(), descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const capture = selected => {
            owner.batchSingletons = selected; render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        let result;
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            render.setGraphicsQuality(quality); const selected = owner.batchSingletons;
            for (const [type, subType, states] of [['NPC', 'QuestNPC', ['Idle']], ['Enemy', 'DemonOrc', ['Idle', 'Run', 'Attack', 'Death']]]) {
                const actor = game.createRemotePlayer(type, `singleton-${subType}`, subType);
                actors.push(actor); await actor.ensureMesh(); render.add(actor.mesh);
                for (const state of states) {
                    actor.playAnimation(state, state !== 'Death', true); actor.updateAnimationMixer(.37);
                    const visible = new Map(); actor.mesh.traverse(part => visible.set(part, part.visible));
                    capture(false); capture(selected); capture(false);
                    const reference = capture(false), candidate = capture(selected), again = capture(false);
                    let error = 0, changed = 0, exactChanges = 0, unstable = 0;
                    for (let i = 0; i < reference.pixels.length; i += 4) {
                        const delta = Math.max(...[0, 1, 2].map(c => Math.abs(reference.pixels[i + c] - candidate.pixels[i + c])));
                        error += delta; changed += delta > 8 ? 1 : 0; exactChanges += delta > 0 ? 1 : 0;
                        unstable += [0, 1, 2].some(c => reference.pixels[i + c] !== again.pixels[i + c]) ? 1 : 0;
                    }
                    rows.push({ subType, state, selected, meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height), exactChanges, unstable,
                        reference: { calls: reference.calls, triangles: reference.triangles }, candidate: { calls: candidate.calls, triangles: candidate.triangles },
                        restored: [...visible].every(([part, value]) => part.visible === value) && !owner.hidden.length && !multi.hidden.length });
                }
                capture(selected);
                const retirement = { instances: 0, batches: 0, geometry: 0, matrices: 0, indirection: 0 };
                const expected = { instances: owner.batches.size, batches: multi.entries.size, geometry: multi.entries.size,
                    matrices: multi.entries.size, indirection: multi.entries.size };
                const observe = (object, key) => {
                    const dispose = object.dispose; object.dispose = function () { retirement[key]++; return dispose.call(this); };
                };
                for (const batch of owner.batches.values()) observe(batch, 'instances');
                for (const { mesh } of multi.entries.values()) {
                    observe(mesh, 'batches'); observe(mesh.geometry, 'geometry');
                    observe(mesh._matricesTexture, 'matrices'); observe(mesh._indirectTexture, 'indirection');
                }
                actor.dispose(); actors.pop(); render.render(); render.render();
                rows.at(-1).retirement = { expected, actual: retirement };
            }
            for (const setting of ['high', 'low', 'medium', 'high']) {
                render.setGraphicsQuality(setting); render.render(); transitions.push({ setting, selected: owner.batchSingletons });
            }
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            result = { rows, transitions, extension: render.renderer.extensions.has('WEBGL_multi_draw'),
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
        } finally {
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
            for (const actor of actors) actor.dispose(); game.destroy();
        }
        result.disposed = multi.disposed && multi.entries.size === 0 && owner.roots.size === 0;
        return result;
    }, { release, quality });
    await testInfo.attach('published-singleton-owner', { body: JSON.stringify({ quality, result, engineSHA256: metadata.engineSHA256 }), contentType: 'application/json' });
    expect(result.disposed).toBe(true);
    if (requiresHardwareWebGL()) { expect(result.gpu).not.toMatch(/swiftshader|llvmpipe|software/i); expect(result.extension).toBe(true); }
    for (const row of result.rows) {
        expect(row.selected).toBe(quality === 'high'); expect(row.restored).toBe(true); expect(row.unstable).toBe(0);
        expect(row.meanError).toBeLessThan(.1); expect(row.changed).toBeLessThan(.001);
        expect(row.candidate.calls).toBeLessThanOrEqual(row.reference.calls);
        if (row.retirement) expect(row.retirement.actual).toEqual(row.retirement.expected);
        if (quality === 'low') { expect(row.exactChanges).toBe(0); expect(row.candidate).toEqual(row.reference); }
    }
    for (const row of result.transitions) expect(row.selected).toBe(row.setting === 'high');
    if (quality === 'high' && result.extension) for (const type of ['QuestNPC', 'DemonOrc'])
        expect(result.rows.some(row => row.subType === type && row.candidate.calls < row.reference.calls), type).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
