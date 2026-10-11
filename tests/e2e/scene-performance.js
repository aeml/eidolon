import { renderFrameInterval } from './renderFrameInterval.js';

const observers = new WeakMap();
const profileModuleLoads = new WeakMap();

/** Optional real-game profiling; no account state or network commands changed. */
export function observeGameplayScene(game, label, { phases = false } = {}) {
    return new Promise((resolve, reject) => {
        const renderer = game?.renderSystem?.renderer;
        if (!renderer || game.isDestroyed || typeof game.loop !== 'function') { reject(new Error('A live game is required for profiling')); return; }
        if (observers.has(game)) { reject(new Error('Scene already has an active profiler')); return; }
        const originalLoop = game.loop;
        const loopDescriptor = Object.getOwnPropertyDescriptor(game, 'loop');
        const renderInfo = renderer.info;
        const originalReset = renderInfo.autoReset;
        const samples = [];
        const hooks = [];
        let phaseFrame = null;
        const phaseNames = ['update', 'presentation', 'renderSystem', 'renderer', 'rendererWorld', 'rendererOther'];
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
            for (const hook of hooks) {
                if (!hook.installed) continue;
                if (hook.owner[hook.method] === hook.wrapper) {
                    if (hook.descriptor) Object.defineProperty(hook.owner, hook.method, hook.descriptor);
                    else delete hook.owner[hook.method];
                } else error ??= new Error(`Scene profiler lost ${hook.name} phase ownership`);
            }
            if (phases && (game.renderSystem !== renderSystem || renderSystem.renderer !== renderer
                || renderSystem.scene !== worldScene || renderSystem.camera !== worldCamera))
                error ??= new Error('Scene profiler lost phase renderer ownership');
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
                const phaseSummary = phases ? {
                    scope: 'Opt-in inclusive synchronous CPU clocks; renderer includes Three.js traversal/submission, not GPU elapsed time. rendererWorld matches the exact gameplay scene AND camera; rendererOther is every other call, including fullscreen composer passes. Exclusive components subtract nested clocks. Instrumentation overhead is included; this separate diagnostic does not replace the ordinary budget sample.',
                    components: Object.fromEntries(Object.keys(samples[0].phaseCpuMs).map(name => [name, {
                        medianMs: percentile(samples.map(sample => sample.phaseCpuMs[name]), .5),
                        p95Ms: percentile(samples.map(sample => sample.phaseCpuMs[name]), .95)
                    }])),
                    calls: Object.fromEntries(phaseNames.map(name => [name, {
                        min: Math.min(...samples.map(sample => sample.phaseCalls[name])),
                        max: Math.max(...samples.map(sample => sample.phaseCalls[name]))
                    }]))
                } : null;
                resolve({
                    label, frames: samples.length, intervalMethod: 'exact-reported-decimal', restored: true,
                    ...(phases ? { phaseSummary } : {}),
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
                if (phases && (hooks.some(hook => hook.owner[hook.method] !== hook.wrapper)
                    || game.renderSystem !== renderSystem || renderSystem.renderer !== renderer
                    || renderSystem.scene !== worldScene || renderSystem.camera !== worldCamera))
                    throw new Error('Scene profiler lost phase ownership');
                if (phases) phaseFrame = {
                    cpu: Object.fromEntries(phaseNames.map(name => [name, 0])),
                    calls: Object.fromEntries(phaseNames.map(name => [name, 0]))
                };
                started = performance.now();
                renderInfo.reset();
                result = originalLoop.call(this, time);
                if (phases && (hooks.some(hook => hook.owner[hook.method] !== hook.wrapper)
                    || renderSystem.scene !== worldScene || renderSystem.camera !== worldCamera))
                    throw new Error('Scene profiler lost phase ownership');
            } catch (error) {
                phaseFrame = null;
                finish(error);
                throw error;
            }
            const cpuMs = performance.now() - started;
            const framePhases = phaseFrame; phaseFrame = null;
            const previousTime = previous;
            const rawIntervalMs = previous === null ? 0 : time - previous;
            const intervalMs = previous === null ? 0 : renderFrameInterval(time, previous);
            previous = time;
            if (warmup-- > 0) return result;
            if (firstPreviewFrame === null) firstPreviewFrame = game.uiManager.characterPreview?.renderer?.info.render.frame || 0;
            const geometry = this.renderSystem.actorGameplayGeometry;
            samples.push({ time, previousTime, rawIntervalMs, intervalMs, cpuMs, visibility: document.visibilityState, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
                ...(phases ? { phaseCalls: framePhases.calls, phaseCpuMs: {
                    ...framePhases.cpu,
                    presentationOutsideRenderSystem: framePhases.cpu.presentation - framePhases.cpu.renderSystem,
                    renderSystemOutsideRenderer: framePhases.cpu.renderSystem - framePhases.cpu.renderer,
                    loopOutsideUpdateAndPresentation: cpuMs - framePhases.cpu.update - framePhases.cpu.presentation
                } } : {}),
                activeEntities: this.activeEntitiesCache?.length || 0,
                gameplayGeometry: geometry ? { pending: geometry.delivery.jobs.size, installed: geometry.pass.entries.size,
                    swaps: geometry.pass.lastSwaps, reduced: geometry.pass.reduced, enabled: geometry.pass.enabled } : null });
            if (samples.length === 180) finish();
            return result;
        }
        const renderSystem = game.renderSystem;
        const worldScene = renderSystem.scene, worldCamera = renderSystem.camera;
        observers.set(game, observedLoop);
        try {
            if (phases) {
                if (!worldScene || !worldCamera) throw new Error('Scene phase profiling requires a gameplay scene and camera');
                const targets = [[game, 'update', 'update'], [game, 'render', 'presentation'],
                    [renderSystem, 'render', 'renderSystem'], [renderer, 'render', 'renderer']];
                if (targets.some(([owner, method]) => typeof owner[method] !== 'function'))
                    throw new Error('Scene phase profiling requires update and render methods');
                for (const [owner, method, name] of targets) {
                    const original = owner[method], descriptor = Object.getOwnPropertyDescriptor(owner, method);
                    const hook = { owner, method, name, descriptor, installed: false, wrapper: function (...args) {
                        const frame = phaseFrame;
                        if (!frame) return original.apply(this, args);
                        const role = name === 'renderer' ? (args[0] === worldScene && args[1] === worldCamera ? 'rendererWorld' : 'rendererOther') : null;
                        const started = performance.now(); frame.calls[name]++;
                        if (role) frame.calls[role]++;
                        try { return original.apply(this, args); }
                        finally {
                            const elapsed = performance.now() - started;
                            frame.cpu[name] += elapsed;
                            if (role) frame.cpu[role] += elapsed;
                        }
                    } };
                    hooks.push(hook);
                    owner[method] = hook.wrapper; hook.installed = true;
                }
            }
            renderInfo.autoReset = false; game.loop = observedLoop;
            timer = setTimeout(() => finish(new Error(`Scene profile timed out after ${samples.length} samples`)), 45_000);
        } catch (error) { finish(error); }
    });
}

export async function profileGameplayScene(page, label, options) {
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
    return page.evaluate(async ({ label, options }) => {
        const { observeGameplayScene } = await import('/tests/e2e/scene-performance.js');
        return observeGameplayScene(window.game, label, options);
    }, { label, options });
}
