/* global window, localStorage */
import { createReadStream } from 'node:fs';
import { stat, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { hardwareWebGLBrowserArgs } from '../tests/e2e/browserLaunchPolicy.js';
import { collectBrowserFailures } from '../tests/e2e/helpers.js';
import { gameplayGeometryFixture } from './lib/gameplay-geometry-fixture.js';
import { CATALOG_PATH, buildGeometryArtifact, checkGeometryArtifact, geometryProvenance, serializeCatalog } from './lib/gameplay-geometry-artifact.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
if (process.argv.length > 3 || (process.argv[2] && process.argv[2] !== '--check')) throw Error('Usage: npm run generate:gameplay-geometry [-- --check]');
if (process.argv[2] === '--check') {
    console.log(JSON.stringify(await checkGeometryArtifact(repository)));
} else await generate();

async function generate() {
    const provenance = await geometryProvenance(repository);
    // This worker always executes the canonical algorithms; it cannot read an
    // existing precomputed artifact. Compilation/listener ordering mirrors runtime.
    const source = `import {gameplayGeometryFingerprint} from './src/core/GameplayGeometryFingerprint.js';
let preparation;
self.addEventListener('message',async ({data:{id,kind,source}})=>{
 try {
  preparation ||= import('./src/core/GameplayGeometryPreparation.js');
  const {prepareGameplayGeometry}=await preparation;
  const key=await gameplayGeometryFingerprint(kind,source),result=prepareGameplayGeometry(kind,source);
  self.postMessage({id,key,indices:result.indices,fallback:result.fallback||null,cacheHit:false,cacheBytes:0,cacheEntries:0},[result.indices.buffer]);
 } catch(error) { self.postMessage({id,error:String(error)}); }
});`;
    const compiled = await build({ absWorkingDir: repository, stdin: { contents: source, resolveDir: repository, sourcefile: 'geometry-generation-worker.js' },
        bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false, logLevel: 'silent' });
    const worker = compiled.outputFiles[0].text;
    const mime = { '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.html': 'text/html', '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' };
    const server = createServer(async (request, response) => {
        try {
            const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const filename = path.resolve(repository, `.${pathname === '/' ? '/index.html' : pathname}`);
            if (!filename.startsWith(repository) || !(await stat(filename)).isFile()) throw Error('Invalid static path');
            response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            createReadStream(filename).pipe(response);
        } catch { response.writeHead(404).end('Not Found'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseURL = `http://127.0.0.1:${server.address().port}`, rows = new Map(), counts = [];
    let browser;
    try {
        browser = await chromium.launch({ executablePath: process.env.EIDOLON_CHROME || '/usr/bin/google-chrome', headless: true, args: hardwareWebGLBrowserArgs() });
        for (const quality of ['high', 'low']) {
            const context = await browser.newContext({ viewport: { width: quality === 'high' ? 1280 : 390, height: 844 } });
            try {
                const page = await context.newPage(), failures = collectBrowserFailures(page, baseURL);
                await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
                await page.route('**/ActorGameplayGeometryWorker*.js*', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: worker }));
                await page.addInitScript(quality => localStorage.setItem('eidolon.graphicsQuality', quality), quality);
                await page.goto(baseURL, { waitUntil: 'networkidle' });
                await page.evaluate(() => {
                    const Original = window.Worker, rows = [], pending = new Map();
                    window.__geometryOutputRows = rows;
                    function ObserveWorker(...args) {
                        const worker = new Original(...args);
                        if (!String(args[0]).includes('ActorGameplayGeometryWorker')) return worker;
                        const post = worker.postMessage;
                        worker.postMessage = function (message, ...rest) {
                            pending.set(message.id, { kind: message.kind, vertices: message.source.attributes.position.array.length / message.source.attributes.position.itemSize,
                                sourceIndexCount: message.source.index.length });
                            return Reflect.apply(post, this, [message, ...rest]);
                        };
                        worker.addEventListener('message', ({ data }) => {
                            const input = pending.get(data.id); pending.delete(data.id);
                            if (!input) throw Error('Unexpected generation response');
                            if (data.error) { rows.push({ error: data.error }); return; }
                            const bytes = new Uint8Array(data.indices.buffer, data.indices.byteOffset, data.indices.byteLength);
                            let text = ''; for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
                            rows.push({ ...input, key: data.key, fallback: data.fallback, base64: btoa(text) });
                        });
                        return worker;
                    }
                    Object.setPrototypeOf(ObserveWorker, Original); ObserveWorker.prototype = Original.prototype;
                    window.Worker = ObserveWorker;
                    window.__restoreGenerationObserver = () => { window.Worker = Original; };
                });
                await page.evaluate(gameplayGeometryFixture, { quality });
                await page.waitForFunction(() => window.__geometryGeneration.render.actorGameplayGeometry.delivery.jobs.size === 0, null, { timeout: 60000 });
                const result = await page.evaluate(() => {
                    const { game, actors, render } = window.__geometryGeneration, delivery = render.actorGameplayGeometry.delivery;
                    const result = { rows: window.__geometryOutputRows, stats: { ...delivery.stats },
                        outfits: actors.map(actor => ({ count: actor.mesh.userData.equipmentVisualItemCount, fallback: actor.mesh.userData.equipmentVisualFallback })) };
                    window.__restoreGenerationObserver(); for (const actor of actors) actor.dispose(); game.destroy();
                    return result;
                });
                if (failures.length || result.stats.failed || result.stats.stale || result.stats.rejected || !result.rows.length ||
                    result.rows.length > result.stats.requested || result.rows.length !== result.stats.installed + result.stats.fallback ||
                    result.outfits.some(row => row.count !== 14 || row.fallback.length)) throw Error(JSON.stringify({ quality, failures,
                        result: { responseRows: result.rows.length, stats: result.stats, outfits: result.outfits } }));
                for (const row of result.rows) {
                    if (row.error) throw Error(row.error);
                    const bytes = Buffer.from(row.base64, 'base64');
                    const indices = new Uint32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
                    const normalized = { ...row, indices }; delete normalized.base64;
                    const previous = rows.get(row.key);
                    if (previous && (Buffer.compare(Buffer.from(previous.indices.buffer), bytes) || previous.kind !== row.kind || previous.fallback !== row.fallback ||
                        previous.vertices !== row.vertices || previous.sourceIndexCount !== row.sourceIndexCount)) throw Error('Conflicting exact geometry generation outputs');
                    rows.set(row.key, normalized);
                }
                counts.push({ quality, executedJobs: result.rows.length, requestedJobs: result.stats.requested,
                    canceledBeforeExecution: result.stats.requested - result.rows.length, installed: result.stats.installed, fallback: result.stats.fallback });
            } finally { await context.close(); }
        }
    } finally {
        await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
    // Abort if source changed while generation ran. No partial stale catalog.
    if (JSON.stringify(provenance) !== JSON.stringify(await geometryProvenance(repository))) throw Error('Geometry sources changed during generation');
    const artifact = buildGeometryArtifact([...rows.values()], provenance), asset = path.join(repository, artifact.catalog.url.slice(6));
    await mkdir(path.dirname(asset), { recursive: true }); await writeFile(asset, artifact.bytes);
    for (const [index, shard] of artifact.catalog.shards.entries()) await writeFile(path.join(repository, shard.url.slice(6)), artifact.shards[index]);
    await writeFile(path.join(repository, CATALOG_PATH), serializeCatalog(artifact.catalog));
    console.log(JSON.stringify({ ...await checkGeometryArtifact(repository), counts }));
}
