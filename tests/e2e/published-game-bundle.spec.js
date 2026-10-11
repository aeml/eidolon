import { expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bundleGameEngine } from '../../scripts/bundle-game-engine.mjs';
import { versionPagesRuntime } from '../../scripts/version-pages-runtime.mjs';
import { collectBrowserFailures } from './helpers.js';
import { measureJumpWallClock } from './jump-clock-observation.js';

const release = 'bundlefixture20261009';
let root, server, origin, metadata;
async function enterPublishedFixture(page) {
    await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
        socket.onMessage(data => {
            if (JSON.parse(data).type === 'login') socket.send(JSON.stringify({
                type: 'login_success', payload: { hasCharacter: true, characterType: 'Fighter', terrainProfile: 'flat-v1' }
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
        await cp(path.resolve(filename), path.join(root, filename), { recursive: true });
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
            return { parts: ward.children.length, visualOnly: ward.userData.visualOnly, phases,
                collidersStable: JSON.stringify(game.collisionManager.colliders) === colliders };
        } finally { game.destroy(); }
    }, { release, layout });
    expect(result).toMatchObject({ parts: 3, visualOnly: true, collidersStable: true });
    expect(result.phases).toEqual([{ ready: false, appliedOpacity: .18, time: .25, stable: true },
        { ready: true, appliedOpacity: .9, time: .5, stable: true }, { ready: false, appliedOpacity: .18, time: .75, stable: true }]);
    expect(failures, failures.join('\n')).toEqual([]);
    await testInfo.attach('published-entry-ward', { body: JSON.stringify({ result, engineSHA256: metadata.engineSHA256,
        scope: 'Copied/versioned engine and actual WorldGenerator entry points, prepared layout and room summaries. No server or earned completion claim.' }), contentType: 'application/json' });
});

test('actual published engine stays lazy at login and constructs each class from the bounded module graph', async ({ page }) => {
    const failures = collectBrowserFailures(page, origin), modules = new Set();
    page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname.endsWith('.js')) modules.add(url.pathname);
    });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await expect(page.locator('#auth-username')).toBeVisible();
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

for (const quality of ['high', 'low']) test(`published ${quality} actor defaults render generated roots and retire owned copies`, async ({ page }, testInfo) => {
    const failures = collectBrowserFailures(page, origin);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto(origin, { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ release, quality }) => {
        const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
        const game = new GameEngine('Fighter', false, true, '', 'synthetic-bundle-only', null, 'flat-v1');
        const render = game.renderSystem, owner = render.actorInstances, multi = owner?.multiDraw, actors = [];
        let result;
        try {
            render.setGraphicsQuality(quality);
            for (let i = 0; i < 6; i++) {
                const actor = game.createRemotePlayer('Enemy', `published-skeleton-${i}`, 'Skeleton');
                actors.push(actor); await actor.ensureMesh();
                actor.mesh.position.set(i % 3 * 3, 0, i < 3 ? 0 : 3); render.add(actor.mesh);
            }
            render.render();
            result = { enabled: Boolean(owner?.enabled && multi?.enabled && multi.perInstanceFrustum),
                groups: multi?.entries.size || 0, extension: render.renderer.extensions.has('WEBGL_multi_draw'),
                restored: !owner.hidden.length && !multi.hidden.length && !owner.group.visible && !multi.group.visible,
                draws: render.renderer.info.render.calls };
        } finally {
            for (const actor of actors) actor.dispose();
            game.destroy();
        }
        result.disposed = multi.disposed && multi.entries.size === 0 && multi.group.parent === null && owner.roots.size === 0;
        return result;
    }, { release, quality });
    await testInfo.attach('published-default-actor-owner', { body: JSON.stringify({ quality, result, engineSHA256: metadata.engineSHA256 }), contentType: 'application/json' });
    expect(result.enabled && result.extension && result.restored && result.disposed).toBe(true);
    expect(result.groups).toBeGreaterThan(0); expect(result.draws).toBeGreaterThan(0);
    expect(failures, failures.join('\n')).toEqual([]);
});

test('published geometry owner loads its immutable worker, retires streamed roots and reuses the exact cached worker offline', async ({ page, context }, testInfo) => {
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, origin), workers = [];
    page.on('worker', worker => workers.push(worker.url()));
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
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
    } finally { await context.setOffline(false); }
    for (const row of offline) { expect(row.id).toBe(7); expect(row.error).toBeNull(); expect(row.indices).toBeGreaterThan(0); }
    await testInfo.attach('published-geometry-worker', { body: JSON.stringify({ startup, worker: metadata.worker,
        workerURL, lifecycle, offline }, null, 2), contentType: 'application/json' });
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
    expect(result.samples.map(sample => sample.fps)).toEqual([15, 60]);
    for (const sample of result.samples) {
        expect(sample.elapsedMs).toBeGreaterThanOrEqual(1300);
        expect(sample.elapsedMs).toBeLessThan(1550);
        expect(sample.positionError).toBeLessThan(0.01);
        expect(sample.renderError).toBeLessThan(0.01);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
