import { writeFile } from 'node:fs/promises';

// Observe stock Three preparation in the live RAF. Never skip it or change
// content, matrices, draw lists, material callbacks or the normal game clock.
export async function captureUnderstoryPreparation(page, label, testInfo) {
    const result = await page.evaluate(async () => {
        const render = window.game.renderSystem, meshes = [];
        render.scene.traverse(mesh => {
            if (mesh.isBatchedMesh && mesh.userData.understorySpatialBatch) meshes.push(mesh);
        });
        if (!meshes.length) throw new Error('Native spatial understory is required for this diagnostic');
        const wrappers = [], observed = new Set(), frames = [];
        let frame = null, result, restored = true;
        const empty = () => ({ calls: 0, milliseconds: 0, slots: 0, draws: 0,
            sameCameraAndInputs: 0, unchangedDrawLists: 0 });
        const same = (a, b) => a.length === b.length && a.every((value, i) => value === b[i]);
        try {
            for (const mesh of meshes) {
                const original = mesh.onBeforeRender, own = Object.hasOwn(mesh, 'onBeforeRender');
                let previous = null;
                const wrapper = function (renderer, scene, camera, geometry, material) {
                    // This intentionally describes only potential camera/matrix
                    // reuse. It is not a complete production invalidation guard.
                    const cameraValues = [...camera.projectionMatrix.elements,
                        ...camera.matrixWorldInverse.elements, ...this.matrixWorld.elements];
                    const input = { camera, cameraValues, coordinates: camera.coordinateSystem,
                        reversed: camera.reversedDepth, matrices: this._matricesTexture,
                        matrixVersion: this._matricesTexture.version,
                        visibilityChanged: this._visibilityChanged, geometry,
                        culling: this.perObjectFrustumCulled, sort: this.sortObjects,
                        slots: this._instanceInfo.length };
                    const reuse = previous && !input.visibilityChanged &&
                        Object.keys(input).filter(key => key !== 'cameraValues' && key !== 'visibilityChanged')
                            .every(key => input[key] === previous.input[key]) &&
                        same(cameraValues, previous.input.cameraValues);
                    const start = performance.now();
                    const value = original.call(this, renderer, scene, camera, geometry, material);
                    const duration = performance.now() - start;
                    const starts = Array.from(this._multiDrawStarts.subarray(0, this._multiDrawCount));
                    const counts = Array.from(this._multiDrawCounts.subarray(0, this._multiDrawCount));
                    const ids = Array.from(this._indirectTexture.image.data.subarray(0, this._multiDrawCount));
                    const unchanged = previous && same(starts, previous.starts) &&
                        same(counts, previous.counts) && same(ids, previous.ids);
                    previous = { input, starts, counts, ids };
                    if (frame) {
                        observed.add(this); frame.calls++; frame.milliseconds += duration;
                        frame.slots += input.slots; frame.draws += this._multiDrawCount;
                        frame.sameCameraAndInputs += Number(Boolean(reuse));
                        frame.unchangedDrawLists += Number(Boolean(unchanged));
                    }
                    return value;
                };
                mesh.onBeforeRender = wrapper; wrappers.push({ mesh, original, own, wrapper });
            }
            await new Promise(resolve => requestAnimationFrame(resolve));
            for (let i = 0; i < 120; i++) {
                frame = empty(); await new Promise(resolve => requestAnimationFrame(resolve));
                frames.push(frame);
            }
            frame = null;
            const values = frames.map(entry => entry.milliseconds).sort((a, b) => a - b);
            const total = frames.reduce((sum, entry) => {
                for (const key of Object.keys(entry)) sum[key] += entry[key]; return sum;
            }, empty());
            result = { frames: frames.length, registeredBatches: meshes.length, observedBatches: observed.size,
                preparationMilliseconds: { median: values[Math.floor(values.length / 2)],
                    p95: values[Math.ceil(values.length * 0.95) - 1], total: total.milliseconds },
                totals: total, frameSamples: frames, entities: render.entityGroup.children.length,
                renderer: render.renderer.getContext().getParameter(
                    render.renderer.getContext().getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) };
        } finally {
            for (const { mesh, original, own, wrapper } of wrappers) {
                if (mesh.onBeforeRender !== wrapper) { restored = false; continue; }
                if (own) mesh.onBeforeRender = original; else delete mesh.onBeforeRender;
            }
        }
        if (!restored) throw new Error('Concurrent understory callback replacement');
        return { ...result, callbacksRestored: restored };
    });
    const evidence = { label, scope: 'Separate instrumented 120-RAF stock BatchedMesh preparation sample in the actual live game. Timings surround only original onBeforeRender; wrapper bookkeeping still perturbs the game. Potential reuse is a partial-input diagnostic, not a validated cache or frame-budget certificate.', ...result };
    await writeFile(testInfo.outputPath(`${label}-understory-preparation.json`), JSON.stringify(evidence, null, 2));
    console.log('[diagnostic-understory-preparation]', JSON.stringify({ label,
        frames: result.frames, registeredBatches: result.registeredBatches, observedBatches: result.observedBatches,
        preparationMilliseconds: result.preparationMilliseconds, totals: result.totals, entities: result.entities }));
    return evidence;
}
