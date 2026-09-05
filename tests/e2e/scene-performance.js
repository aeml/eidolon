/** Optional real-game profiling; no account state or network commands changed. */
export async function profileGameplayScene(page, label) {
    return page.evaluate((label) => new Promise((resolve, reject) => {
        const game = window.game;
        const renderer = game?.renderSystem?.renderer;
        if (!renderer || game.isDestroyed) { reject(new Error('A live game is required for profiling')); return; }
        const originalLoop = game.loop;
        const originalReset = renderer.info.autoReset;
        const samples = [];
        let warmup = 60;
        let previous = null;
        let firstPreviewFrame = null;
        let timer;
        const finish = (error) => {
            clearTimeout(timer);
            game.loop = originalLoop;
            renderer.info.autoReset = originalReset;
            if (error) { reject(error); return; }
            const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)];
            const interval = samples.map((sample) => sample.intervalMs);
            const cpu = samples.map((sample) => sample.cpuMs);
            const preview = game.uiManager.characterPreview;
            resolve({
                label, frames: samples.length,
                frameMedianMs: percentile(interval, 0.5), frameP95Ms: percentile(interval, 0.95), frameP99Ms: percentile(interval, 0.99),
                framesOver33ms: interval.filter((value) => value > 33.34).length,
                cpuLoopMedianMs: percentile(cpu, 0.5), cpuLoopP95Ms: percentile(cpu, 0.95),
                drawCallsMedian: percentile(samples.map((sample) => sample.calls), 0.5),
                trianglesMedian: percentile(samples.map((sample) => sample.triangles), 0.5),
                geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
                activeEntities: game.activeEntitiesCache?.length || 0,
                previewFramesDuringSample: (preview?.renderer?.info.render.frame || 0) - (firstPreviewFrame || 0),
                previewGeometries: preview?.renderer?.info.memory.geometries || 0,
                previewTextures: preview?.renderer?.info.memory.textures || 0
            });
        };
        renderer.info.autoReset = false;
        game.loop = function (time) {
            const started = performance.now();
            renderer.info.reset();
            try {
                originalLoop.call(this, time);
            } catch (error) {
                finish(error);
                return;
            }
            const cpuMs = performance.now() - started;
            const intervalMs = previous === null ? 0 : time - previous;
            previous = time;
            if (warmup-- > 0) return;
            if (firstPreviewFrame === null) firstPreviewFrame = game.uiManager.characterPreview?.renderer?.info.render.frame || 0;
            samples.push({ intervalMs, cpuMs, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
            if (samples.length === 180) finish();
        };
        timer = setTimeout(() => finish(new Error(`Scene profile timed out after ${samples.length} samples`)), 45_000);
    }), label);
}
