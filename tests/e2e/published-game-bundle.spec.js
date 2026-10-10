import { expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bundleGameEngine } from '../../scripts/bundle-game-engine.mjs';
import { versionPagesRuntime } from '../../scripts/version-pages-runtime.mjs';
import { collectBrowserFailures } from './helpers.js';

const release = 'bundlefixture20261009';
let root, server, origin, metadata;
test.beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'eidolon-published-engine-'));
    for (const filename of ['src', 'assets', 'vendor', 'index.html', 'release.json', 'sw.js'])
        await cp(path.resolve(filename), path.join(root, filename), { recursive: true });
    metadata = await bundleGameEngine(root);
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
        const render = game.renderSystem, defaultInactive = render.actorGameplayGeometry === null;
        render.setActorGameplayGeometryEnabled(true);
        const actor = game.createRemotePlayer('Player', 'owned-worker-fighter', 'Fighter'); actor.gameEngine = game;
        await actor.ensureMesh(); render.add(actor.mesh);
        window.__publishedGeometry = { game, actor, owner: render.actorGameplayGeometry };
        return { defaultInactive, authored: actor.mesh.userData.authoredClass };
    }, release);
    expect(startup).toEqual({ defaultInactive: true, authored: 'Fighter' });
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
        const before = { roots: owner.delivery.roots.size, entries: owner.pass.entries.size };
        actor.mesh.removeFromParent();
        const retired = !owner.delivery.roots.has(actor.mesh) && [...owner.pass.entries.values()].every(row => row.root !== actor.mesh);
        game.renderSystem.add(actor.mesh);
        const reattached = owner.delivery.roots.has(actor.mesh);
        actor.dispose(); game.destroy(); delete window.__publishedGeometry;
        return { before, retired, reattached, disposed: owner.disposed && owner.delivery.disposed,
            rootsAfter: owner.delivery.roots.size, jobsAfter: owner.delivery.jobs.size, entriesAfter: owner.pass.entries.size };
    });
    expect(lifecycle.retired && lifecycle.reattached && lifecycle.disposed).toBe(true);
    expect([lifecycle.rootsAfter, lifecycle.jobsAfter, lifecycle.entriesAfter]).toEqual([0, 0, 0]);
    await context.setOffline(true);
    let offline;
    try {
        offline = await page.evaluate(workerURL => new Promise((resolve, reject) => {
            const worker = new Worker(workerURL, { type: 'module' });
            const timer = setTimeout(() => { worker.terminate(); reject(Error('Offline worker timeout')); }, 15_000);
            worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(Error('Offline worker failed')); };
            worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); resolve({ id: data.id,
                indices: data.indices?.length, error: data.error || null }); };
            const attribute = (array, itemSize) => ({ array: new Float32Array(array), itemSize });
            worker.postMessage({ id: 7, kind: 'color', source: { index: new Uint32Array([0, 1, 2, 0, 2, 3]), attributes: {
                position: attribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3),
                normal: attribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
                skinIndex: attribute(new Float32Array(16), 4),
                skinWeight: attribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4)
            } } });
        }), workerURL);
    } finally { await context.setOffline(false); }
    expect(offline.id).toBe(7); expect(offline.error).toBeNull(); expect(offline.indices).toBeGreaterThan(0);
    await testInfo.attach('published-geometry-worker', { body: JSON.stringify({ startup, worker: metadata.worker,
        workerURL, lifecycle, offline }, null, 2), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
