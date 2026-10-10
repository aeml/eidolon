import { expect, test } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bundleGameEngine } from '../../scripts/bundle-game-engine.mjs';
import { versionPagesRuntime } from '../../scripts/version-pages-runtime.mjs';
import { collectBrowserFailures, loginAndEnterWorld, projectGroundOffset } from './helpers.js';

test.use({ trace: 'off', video: 'off', screenshot: 'off' });
const enabled = process.env.EIDOLON_E2E_MAINTENANCE_CONNECTED === '1';
const release = process.env.EIDOLON_EXPECTED_COMMIT;
let root, server, metadata;
test.beforeAll(async () => {
    if (!enabled) return;
    if (!/^[a-f0-9]{40}$/.test(release)) throw Error('Explicit candidate commit required');
    root = await mkdtemp(path.join(tmpdir(), 'eidolon-connected-publication-'));
    for (const name of ['src', 'assets', 'vendor', 'index.html', 'release.json', 'sw.js'])
        await cp(path.resolve(name), path.join(root, name), { recursive: true });
    const index = path.join(root, 'index.html');
    await writeFile(index, (await readFile(index, 'utf8')).replace(
        /(<input type="hidden" id="server-address" value=")[^"]+(">)/,
        (_match, prefix, suffix) => `${prefix}${process.env.EIDOLON_E2E_WS_URL}${suffix}`));
    const manifest = path.join(root, 'release.json');
    await writeFile(manifest, JSON.stringify({ ...JSON.parse(await readFile(manifest, 'utf8')), commit: release }));
    metadata = await bundleGameEngine(root);
    await versionPagesRuntime(root, release);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
        '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
    server = createServer(async (request, response) => {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!filename.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
        try {
            if (!(await stat(filename)).isFile()) throw Error('Not a file');
            response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            response.end(await readFile(filename));
        } catch { response.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(4194, '127.0.0.1', resolve));
});
test.afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (root) await rm(root, { recursive: true, force: true });
});

for (const [index, fps] of [60, 15].entries()) {
    test(`actual published login and accepted jump at ${fps} FPS${index ? ' after entry recovery' : ''}`, async ({ page, baseURL }, testInfo) => {
        test.skip(!enabled, 'Explicit disposable real-server publication fixture only');
        const credentials = JSON.parse(process.env.EIDOLON_E2E_MAINTENANCE_ACCOUNTS)[index];
        const requests = [], documents = [];
        let constructions = 0;
        page.on('console', message => { if (message.text() === 'Calling loadGame...') constructions++; });
        page.on('request', request => { if (request.resourceType() === 'document') documents.push(new URL(request.url()).pathname); });
        await page.route('**/src/core/GameEngine.bundle.js?*', route => {
            requests.push(new URL(route.request().url()).search);
            return index && requests.length === 1 ? route.abort('connectionclosed') : route.continue();
        });
        const failures = collectBrowserFailures(page, baseURL);
        await loginAndEnterWorld(page, credentials);
        await page.waitForFunction(() => Boolean(window.game?.player?.mesh?.parent &&
            window.game.player.mesh.userData.authoredClass === 'Fighter'), null, { timeout: 30000 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        expect(documents).toEqual(['/']);
        expect(constructions).toBe(1);
        expect(requests).toEqual(index ? [`?release=${release}`, `?startupRetry=1&release=${release}`] : [`?release=${release}`]);
        expect(await page.evaluate(() => ({ authored: window.game.player.mesh.userData.authoredClass,
            firstState: window.game._firstStateReceived, socket: window.game.network.socket.readyState,
            geometryOwnerAbsent: !('actorGameplayGeometry' in window.game.renderSystem) })))
            .toEqual({ authored: 'Fighter', firstState: true, socket: 1, geometryOwnerAbsent: true });
        let target;
        for (const [x, z] of [[27, 0], [-27, 0], [0, 27], [0, -27]]) {
            const point = await projectGroundOffset(page, x, z, { allowScaling: false });
            if (point?.canvas) { target = point; break; }
        }
        expect(target, 'A full long-jump destination must be visible on the canvas').toBeTruthy();
        await page.evaluate(fps => {
            const game = window.game, original = game.loop;
            const descriptor = Object.getOwnPropertyDescriptor(game, 'loop');
            const record = window.__maintenanceJump = { fps, frameTimes: [], history: [], active: true };
            let previous = performance.now();
            function paced(time) {
                if (time - previous < 1000 / fps - .5) {
                    if (!this.isDestroyed) this.animationFrameId = requestAnimationFrame(t => this.loop(t));
                    return;
                }
                previous = time; record.frameTimes.push(time);
                return original.call(this, time);
            }
            game.loop = paced;
            record.restore = () => {
                record.active = false;
                if (game.loop !== paced) throw Error('Jump fixture lost loop ownership');
                if (descriptor) Object.defineProperty(game, 'loop', descriptor); else delete game.loop;
                return game.loop === original;
            };
            const click = event => { if (event.ctrlKey) record.clickedAt ??= performance.now(); };
            window.addEventListener('pointerdown', click);
            record.stopClick = () => window.removeEventListener('pointerdown', click);
            const sample = () => {
                if (!record.active) return;
                const now = performance.now(), jump = game.playerJumpState;
                if (jump) {
                    record.startedAt ??= now;
                    record.history.push({ milliseconds: now - record.clickedAt, progress: jump.progress,
                        elapsed: jump.elapsed, serverDriven: jump.serverDriven });
                    record.distance = Math.hypot(jump.end.x - jump.start.x, jump.end.z - jump.start.z);
                    record.end = { x: jump.end.x, z: jump.end.z };
                    if (jump.serverDriven) record.acceptedDuration = jump.duration;
                } else if (record.startedAt && game.player.state !== 'JUMPING') {
                    record.elapsedMs = now - record.clickedAt;
                    record.positionError = Math.hypot(game.player.position.x - record.end.x, game.player.position.z - record.end.z);
                    record.renderError = Math.hypot(game.player.mesh.position.x - record.end.x, game.player.mesh.position.z - record.end.z);
                    return;
                }
                requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
        }, fps);
        let jump;
        try {
            await page.keyboard.down('Control');
            try { await page.mouse.click(target.x, target.y); }
            finally { await page.keyboard.up('Control'); }
            await expect.poll(() => page.evaluate(() => window.__maintenanceJump.elapsedMs), { timeout: 6000 }).toBeGreaterThan(0);
        } finally {
            jump = await page.evaluate(() => {
                const record = window.__maintenanceJump;
                record.stopClick(); record.restored = record.restore();
                const { restore: _restore, stopClick: _stop, ...result } = record;
                return result;
            });
            await testInfo.attach('connected-published-jump', { body: JSON.stringify(jump, null, 2), contentType: 'application/json' });
        }
        expect(jump.restored).toBe(true);
        if (fps === 15) {
            expect(jump.frameTimes.length).toBeGreaterThan(10);
            expect(Math.min(...jump.frameTimes.slice(1).map((time, i) => time - jump.frameTimes[i]))).toBeGreaterThan(65);
        }
        expect(jump.distance).toBeGreaterThanOrEqual(20.25);
        // JumpDuration crosses the protobuf float32 wire boundary.
        expect(jump.acceptedDuration).toBeCloseTo(1.3, 6);
        expect(jump.elapsedMs).toBeGreaterThan(1250);
        expect(jump.elapsedMs).toBeLessThan(1600);
        expect(jump.positionError).toBeLessThan(.1);
        expect(jump.renderError).toBeLessThan(.1);
        const faults = new Set(index ? [
            `requestfailed: GET ${baseURL}/src/core/GameEngine.bundle.js?release=${release} (net::ERR_CONNECTION_CLOSED)`,
            `console: Failed to load resource: net::ERR_CONNECTION_CLOSED [${baseURL}/src/core/GameEngine.bundle.js?release=${release}:0]`
        ] : []);
        // Only this fixture's injected exact entry failure is expected. The
        // ordinary browser policy and every other resource failure stay strict.
        expect(failures.filter(failure => !faults.has(failure)), failures.join('\n')).toEqual([]);
        if (index) expect(failures.some(failure => failure.startsWith('requestfailed: GET '))).toBe(true);
        const initialRequests = [...requests];
        await loginAndEnterWorld(page, credentials);
        expect(constructions).toBe(2);
        expect(requests).toEqual([...initialRequests, `?release=${release}`]);
        expect(await page.evaluate(end => Math.hypot(window.game.player.position.x - end.x,
            window.game.player.position.z - end.z), jump.end)).toBeLessThan(.1);
        expect(failures.filter(failure => !faults.has(failure)), failures.join('\n')).toEqual([]);
        const receipt = { fps, recoveredEntry: Boolean(index), release, initialRequests, constructions,
            faults: failures, jump, metadata, freshLoginPositionExact: true };
        await writeFile(path.join(process.env.EIDOLON_E2E_MAINTENANCE_EVIDENCE, `connected-${fps}.json`), JSON.stringify(receipt, null, 2));
    });
}
