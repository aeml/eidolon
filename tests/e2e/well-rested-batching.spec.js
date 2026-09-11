import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { compareAuraPixels } from '../auraPixelComparison.js';

// Controlled rendering only: no account, server simulation or earned buff.
// Independent unit tests compare every mote to its original authored formula;
// here an expanded-mesh reference checks GPU rendering of those same instances.
test('batched sanctuary sparks retain rendered detail with fewer draw calls', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.addInitScript({ content: `window.__compareAuraPixels = (${compareAuraPixels.toString()});` });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const renderer = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Wizard } = await import('/src/entities/Wizard.js');
        const { createProceduralStatusEffect, updateProceduralStatusEffect,
            releaseProceduralStatusEffect } = await import('/src/art/ProceduralStatusEffects.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false);
        document.body.appendChild(render.renderer.domElement);
        const hero = new Wizard('aura-comparison');
        hero.name = 'Prepared aura comparison';
        await hero.ensureMesh(); render.scene.add(hero.mesh);
        render.setCameraTarget(hero.position); render.setZoom(7);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x29352d }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -.05; render.scene.add(ground);
        const target = new THREE.WebGLRenderTarget(256, 256);
        const qa = window.__restBatchComparison = { render, hero, ground, target, roots: [], materials: [] };
        qa.clear = () => {
            qa.roots.forEach(releaseProceduralStatusEffect); qa.roots = [];
            qa.materials.forEach(material => material.dispose()); qa.materials = [];
        };
        qa.capture = () => {
            const previous = render.renderer.getRenderTarget();
            const pixels = new Uint8Array(256 * 256 * 4);
            render.renderer.setRenderTarget(target);
            render.renderer.render(render.scene, render.camera);
            const calls = render.renderer.info.render.calls;
            render.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels);
            render.renderer.setRenderTarget(previous);
            return { calls, pixels };
        };
        qa.compare = (quality, elapsed) => {
            qa.clear(); render.setGraphicsQuality(quality);
            const baseline = qa.capture();
            const batch = createProceduralStatusEffect('well_rested', { quality });
            updateProceduralStatusEffect(batch, elapsed, elapsed);
            const expanded = new THREE.Group();
            for (const part of batch.children) {
                if (!part.isInstancedMesh) { expanded.add(part.clone()); continue; }
                for (let slot = 0; slot < part.count; slot++) {
                    const material = part.material.clone(); qa.materials.push(material);
                    if (part.instanceColor) {
                        const tint = new THREE.Color(); part.getColorAt(slot, tint); material.color.multiply(tint);
                    }
                    const mote = new THREE.Mesh(part.geometry, material);
                    mote.matrixAutoUpdate = false; part.getMatrixAt(slot, mote.matrix);
                    expanded.add(mote);
                }
            }
            qa.roots = [batch, expanded];
            render.scene.add(expanded); const reference = qa.capture(); render.scene.remove(expanded);
            render.scene.add(batch); const batched = qa.capture();
            render.renderer.render(render.scene, render.camera);
            return { pixels: window.__compareAuraPixels(batched.pixels, reference.pixels, baseline.pixels),
                calls: { batched: batched.calls - baseline.calls, reference: reference.calls - baseline.calls } };
        };
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable';
    });
    try {
        for (const quality of ['high', 'low']) {
            for (const elapsed of [.37, 1.8, 4.2]) {
                const { pixels, calls } = await page.evaluate(({ quality, elapsed }) =>
                    window.__restBatchComparison.compare(quality, elapsed), { quality, elapsed });
                console.log('[rest-aura-render]', JSON.stringify({ renderer, quality, elapsed, pixels, calls }));
                expect(pixels.referenceSignal, 'the aura must contribute visible pixels').toBeGreaterThan(1000);
                expect(pixels.relativeError, 'instancing must preserve the rendered aura, not remove detail').toBeLessThan(.03);
                expect(calls.batched).toBeGreaterThan(0);
                expect(calls.batched).toBeLessThanOrEqual(quality === 'high' ? 10 : 8);
                expect(calls.batched).toBeLessThan(calls.reference);
            }
            await page.screenshot({ path: testInfo.outputPath(`rest-aura-${quality}.png`) });
        }
    } finally {
        await page.evaluate(() => {
            const qa = window.__restBatchComparison;
            qa.clear(); qa.target.dispose(); qa.hero.dispose();
            qa.ground.geometry.dispose(); qa.ground.material.dispose(); qa.render.dispose();
        });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
