import { renderFrameInterval } from './renderFrameInterval.js';

const observers = new WeakMap();
const profileModuleLoads = new WeakMap();

/** Optional real-game profiling; no account state or network commands changed. */
export function observeGameplayScene(game, label) {
    return new Promise((resolve, reject) => {
        const renderer = game?.renderSystem?.renderer;
        if (!renderer || game.isDestroyed || typeof game.loop !== 'function') { reject(new Error('A live game is required for profiling')); return; }
        if (observers.has(game)) { reject(new Error('Scene already has an active profiler')); return; }
        const originalLoop = game.loop;
        const loopDescriptor = Object.getOwnPropertyDescriptor(game, 'loop');
        const renderInfo = renderer.info;
        const originalReset = renderInfo.autoReset;
        const samples = [];
        let warmup = 60;
        let previous = null;
        let firstPreviewFrame = null;
        let timer, closed = false;
        const finish = (error) => {
            if (closed) return;
            closed = true; clearTimeout(timer);
            observers.delete(game);
            if (game.loop === observedLoop) {
                if (loopDescriptor) Object.defineProperty(game, 'loop', loopDescriptor);
                else delete game.loop;
            } else error ??= new Error('Scene profiler lost loop ownership');
            if (renderInfo.autoReset === false) renderInfo.autoReset = originalReset;
            if (renderer.info !== renderInfo || renderInfo.autoReset !== originalReset)
                error ??= new Error('Scene profiler lost render policy ownership');
            if (error) { reject(error); return; }
            try {
                const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
                const interval = samples.map((sample) => sample.intervalMs);
                const raw = samples.map((sample) => sample.rawIntervalMs);
                const cpu = samples.map((sample) => sample.cpuMs);
                const preview = game.uiManager.characterPreview;
                const gl = renderer.getContext();
                const debug = gl.getExtension('WEBGL_debug_renderer_info');
                resolve({
                    label, frames: samples.length, intervalMethod: 'exact-reported-decimal', restored: true,
                    frameSamples: samples, visibleFrames: samples.filter(sample => sample.visibility === 'visible').length,
                    rawFrameMedianMs: percentile(raw, .5), rawFrameP95Ms: percentile(raw, .95), rawFrameP99Ms: percentile(raw, .99),
                    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                    viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
                    userAgent: navigator.userAgent, visibility: document.visibilityState,
                    frameMedianMs: percentile(interval, 0.5), frameP95Ms: percentile(interval, 0.95), frameP99Ms: percentile(interval, 0.99),
                    framesOver33ms: interval.filter((value) => value > 33.34).length,
                    cpuLoopMedianMs: percentile(cpu, 0.5), cpuLoopP95Ms: percentile(cpu, 0.95),
                    drawCallsMedian: percentile(samples.map((sample) => sample.calls), 0.5),
                    trianglesMedian: percentile(samples.map((sample) => sample.triangles), 0.5),
                    geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
                    activeEntities: game.activeEntitiesCache?.length || 0,
                    activeEntitiesMin: Math.min(...samples.map(sample => sample.activeEntities)),
                    activeEntitiesMax: Math.max(...samples.map(sample => sample.activeEntities)),
                    previewFramesDuringSample: (preview?.renderer?.info.render.frame || 0) - (firstPreviewFrame || 0),
                    previewGeometries: preview?.renderer?.info.memory.geometries || 0,
                    previewTextures: preview?.renderer?.info.memory.textures || 0
                });
            } catch (error) { reject(error); }
        };
        function observedLoop(time) {
            if (closed) return originalLoop.call(this, time);
            if (this.isDestroyed || !Number.isFinite(time) || previous !== null && time < previous) {
                finish(new Error('Scene profiling requires a running game and monotonic finite frame timestamps')); return;
            }
            let result, started;
            try {
                started = performance.now();
                renderInfo.reset();
                result = originalLoop.call(this, time);
            } catch (error) {
                finish(error);
                throw error;
            }
            const cpuMs = performance.now() - started;
            const previousTime = previous;
            const rawIntervalMs = previous === null ? 0 : time - previous;
            const intervalMs = previous === null ? 0 : renderFrameInterval(time, previous);
            previous = time;
            if (warmup-- > 0) return result;
            if (firstPreviewFrame === null) firstPreviewFrame = game.uiManager.characterPreview?.renderer?.info.render.frame || 0;
            samples.push({ time, previousTime, rawIntervalMs, intervalMs, cpuMs, visibility: document.visibilityState, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
                activeEntities: this.activeEntitiesCache?.length || 0 });
            if (samples.length === 180) finish();
            return result;
        }
        observers.set(game, observedLoop);
        try {
            renderInfo.autoReset = false; game.loop = observedLoop;
            timer = setTimeout(() => finish(new Error(`Scene profile timed out after ${samples.length} samples`)), 45_000);
        } catch (error) { finish(error); }
    });
}

export async function profileGameplayScene(page, label) {
    if (!profileModuleLoads.has(page)) {
        page.once('domcontentloaded', () => profileModuleLoads.delete(page));
        // Only the Node test runner executes this wrapper. A published site
        // deliberately has no /tests/ tree: deliver the two observer modules
        // from this checkout, then remove our routes before sampling frames.
        // The observer, interval arithmetic and sample budgets stay unchanged.
        const loading = (async () => {
            const { readFile } = await import('node:fs/promises');
            const modules = await Promise.all(['scene-performance.js', 'renderFrameInterval.js'].map(async file => {
                const body = await readFile(new URL(file, import.meta.url), 'utf8');
                return { url: `**/tests/e2e/${file}`, handler: route => route.fulfill({ body, contentType: 'text/javascript' }) };
            }));
            try {
                for (const module of modules) await page.route(module.url, module.handler);
                await page.evaluate(async () => { await import('/tests/e2e/scene-performance.js'); });
            } finally {
                for (const module of modules) await page.unroute(module.url, module.handler);
            }
        })();
        profileModuleLoads.set(page, loading);
    }
    await profileModuleLoads.get(page);
    return page.evaluate(async label => {
        const { observeGameplayScene } = await import('/tests/e2e/scene-performance.js');
        return observeGameplayScene(window.game, label);
    }, label);
}
