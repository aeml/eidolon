import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`${quality}: packed rig buckets retire while shared GPU recipes remain stable`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const report = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const types = ['DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC', 'InfernoTitan'];
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const read = () => ({ geometries: render.renderer.info.memory.geometries,
            textures: render.renderer.info.memory.textures, programs: render.renderer.info.programs.length,
            buckets: render.actorInstances.batches.size, registeredRoots: render.actorInstances.roots.size });
        const cycles = [];
        const cycle = async injectFailure => {
            const roots = [];
            for (const [i, type] of types.entries()) for (let copy = 0; copy < 4; copy++) {
                const root = await MeshFactory.createMeshForType(type);
                root.position.set((i - 2) * 4, 0, (copy - 1.5) * 4);
                render.entityGroup.add(root); roots.push({ type, root });
            }
            render.render(); render.render();
            const active = read();
            const original = render.renderer.renderBufferDirect;
            let restoredAfterFailure = true, injectedFailureObserved = false;
            try {
                if (injectFailure) {
                    const visible = new Map(); roots.forEach(({ root }) => root.traverse(part => visible.set(part, part.visible)));
                    render.renderer.renderBufferDirect = () => { throw new Error('Owned packed-rig render failure'); };
                    try { render.render(); } catch (error) {
                        if (error.message !== 'Owned packed-rig render failure') throw error;
                        injectedFailureObserved = true;
                    }
                    restoredAfterFailure = [...visible].every(([part, value]) => part.visible === value);
                }
            } finally {
                render.renderer.renderBufferDirect = original;
                for (const { type, root } of roots) MeshFactory.releaseMesh(type, root);
            }
            render.render(); return { active, retired: read(), restoredAfterFailure, injectedFailureObserved };
        };
        try {
            const warm = await cycle(false);
            for (let i = 0; i < 4; i++) cycles.push(await cycle(i === 1));
            return { scope: 'Four native repeated pooled20-rig allocation/retirement cycles after warming shared family buffers and programs. Counter stability is not byte-accurate VRAM or sustained device proof.', renderer, warm, cycles };
        } finally { render.dispose(); }
    }, quality);
    await writeFile(testInfo.outputPath('lifetime.json'), JSON.stringify(report, null, 2));
    for (const [index, cycle] of report.cycles.entries()) {
        expect(cycle.active.buckets).toBeGreaterThan(0);
        expect(cycle.retired).toEqual(report.warm.retired);
        expect(cycle.retired.buckets).toBe(0); expect(cycle.retired.registeredRoots).toBe(0);
        expect(cycle.restoredAfterFailure).toBe(true);
        expect(cycle.injectedFailureObserved).toBe(index === 1);
    }
    expect(report.renderer).not.toMatch(/SwiftShader|llvmpipe|softpipe/i);
    expect(failures).toEqual([]);
});
