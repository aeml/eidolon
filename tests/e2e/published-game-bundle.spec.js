import { expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
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
        const state = { className: game.constructor.name,
            geometryOwnerAbsent: !('actorGameplayGeometry' in game.renderSystem) &&
                typeof game.renderSystem.setActorGameplayGeometryEnabled === 'undefined',
            errorHidden: document.getElementById('game-startup-status').hidden };
        game.destroy(); return state;
    });
    expect(state).toEqual({ className: 'GameEngine', geometryOwnerAbsent: true, errorHidden: true });
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
