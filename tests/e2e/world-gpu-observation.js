const observers = new WeakSet();

/** Separate opt-in diagnostic. Never run alongside a renderer-wrapping CPU profiler. */
export function observeWorldGpuTime(game, label) {
    return new Promise((resolve, reject) => {
        const system = game?.renderSystem, renderer = system?.renderer;
        const scene = system?.scene, camera = system?.camera;
        if (!renderer || !scene || !camera || game.isDestroyed || typeof renderer.render !== 'function') {
            reject(new Error('GPU observation requires a live gameplay renderer')); return;
        }
        if (observers.has(renderer)) { reject(new Error('Renderer already has a GPU observer')); return; }
        const original = renderer.render, descriptor = Object.getOwnPropertyDescriptor(renderer, 'render');
        const queries = new Set(), pending = [], samples = [];
        let gl, extension, active = null, warmup = 60, issued = 0, closed = false, installed = false;
        let deadline, polling;
        const current = () => gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY);
        function finish(error) {
            if (closed) return;
            closed = true; clearTimeout(deadline); clearTimeout(polling);
            observers.delete(renderer);
            if (installed) {
                if (renderer.render === observedRender) {
                    try {
                        if (descriptor) Object.defineProperty(renderer, 'render', descriptor);
                        else delete renderer.render;
                    } catch (cleanupError) { error ??= cleanupError; }
                } else error ??= new Error('GPU observer lost renderer hook ownership');
            }
            if (active) {
                try { if (current() === active) gl.endQuery(extension.TIME_ELAPSED_EXT); }
                catch (cleanupError) { error ??= cleanupError; }
                active = null;
            }
            for (const query of queries) {
                try { gl.deleteQuery(query); }
                catch (cleanupError) { error ??= cleanupError; }
            }
            queries.clear();
            if (error) { reject(error); return; }
            const percentile = (key, fraction) => samples.map(row => row[key]).sort((a, b) => a - b)[Math.floor((samples.length - 1) * fraction)];
            resolve({ label, calls: samples.length, warmupCalls: 60, restored: true,
                scope: 'Separate instrumented world-render calls, matching exact gameplay scene AND camera. CPU clocks include synchronous waits; GPU queries measure elapsed device time for submitted world work, including its shadows, excluding later fullscreen passes. Asynchronous polling never waits for the GPU. This is not an ordinary frame-budget sample or a comparison with another population.',
                cpuMedianMs: percentile('cpuMs', .5), cpuP95Ms: percentile('cpuMs', .95),
                gpuMedianMs: percentile('gpuMs', .5), gpuP95Ms: percentile('gpuMs', .95), samples });
        }
        function validate() {
            if (game.isDestroyed || game.renderSystem !== system || system.renderer !== renderer
                || system.scene !== scene || system.camera !== camera || renderer.render !== observedRender)
                throw new Error('GPU observer lost gameplay renderer ownership');
            if (gl.isContextLost()) throw new Error('GPU observation context lost');
            if (gl.getParameter(extension.GPU_DISJOINT_EXT)) throw new Error('GPU observation invalidated by disjoint clock');
        }
        function poll() {
            if (closed) return;
            try {
                validate();
                for (let i = 0; i < pending.length;) {
                    const entry = pending[i];
                    if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) { i++; continue; }
                    const ns = gl.getQueryParameter(entry.query, gl.QUERY_RESULT);
                    if (!Number.isFinite(ns) || ns < 0) throw new Error('GPU observation returned invalid elapsed time');
                    entry.sample.gpuMs = ns / 1_000_000;
                    gl.deleteQuery(entry.query); queries.delete(entry.query); pending.splice(i, 1);
                }
                // A disjoint after reading any results invalidates the entire window.
                validate();
                if (issued === 180 && pending.length === 0) { finish(); return; }
                polling = setTimeout(poll, 16);
            } catch (error) { finish(error); }
        }
        function observedRender(...args) {
            if (closed) return original.apply(this, args);
            let query, sample, measure = false;
            try {
                validate();
                measure = args[0] === scene && args[1] === camera && issued < 180 && warmup-- <= 0;
                if (measure) {
                    if (current()) throw new Error('GPU observation conflicts with an active elapsed query');
                    query = gl.createQuery();
                    if (!query) throw new Error('GPU observation could not allocate a query');
                    queries.add(query); active = query; gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
                    if (current() !== query) throw new Error('GPU observation could not acquire elapsed query ownership');
                    sample = { index: issued++, cpuMs: 0, gpuMs: null,
                        activeEntities: game.activeEntitiesCache?.length || 0, visibility: document.visibilityState };
                }
            } catch (error) {
                finish(error);
                return original.apply(this, args);
            }
            if (!measure) {
                try { return original.apply(this, args); }
                catch (error) { finish(error); throw error; }
            }
            const started = performance.now();
            let result, renderError;
            try { result = original.apply(this, args); }
            catch (error) { renderError = error; }
            sample.cpuMs = performance.now() - started;
            try {
                if (current() !== query) throw new Error('GPU observer lost elapsed query ownership');
                gl.endQuery(extension.TIME_ELAPSED_EXT); active = null;
                validate(); samples.push(sample); pending.push({ query, sample });
            } catch (error) { finish(renderError || error); }
            if (renderError) { finish(renderError); throw renderError; }
            return result;
        }
        try {
            gl = renderer.getContext(); extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
            if (!extension || typeof gl.createQuery !== 'function') throw new Error('WebGL2 GPU elapsed queries are unavailable');
            if (gl.isContextLost() || gl.getParameter(extension.GPU_DISJOINT_EXT)) throw new Error('GPU elapsed clock is unavailable');
            if (current()) throw new Error('GPU observation conflicts with an active elapsed query');
            observers.add(renderer);
            renderer.render = observedRender; installed = true;
            if (renderer.render !== observedRender) throw new Error('GPU observer could not install renderer hook');
            deadline = setTimeout(() => finish(new Error(`GPU observation timed out after ${samples.length} calls and ${pending.length} pending queries`)), 45_000);
            polling = setTimeout(poll, 16);
        } catch (error) { finish(error); }
    });
}

export async function profileWorldGpuTime(page, label) {
    const { readFile } = await import('node:fs/promises');
    const body = await readFile(new URL('world-gpu-observation.js', import.meta.url), 'utf8');
    const url = '**/tests/e2e/world-gpu-observation.js';
    const handler = route => route.fulfill({ body, contentType: 'text/javascript' });
    try {
        await page.route(url, handler);
        await page.evaluate(async () => { await import('/tests/e2e/world-gpu-observation.js'); });
    } finally { await page.unroute(url, handler); }
    return page.evaluate(async label => {
        const { observeWorldGpuTime } = await import('/tests/e2e/world-gpu-observation.js');
        return observeWorldGpuTime(window.game, label);
    }, label);
}
