import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('boss warning edge stays exact and visible throughout its pulse at gameplay zoom', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await expect.poll(() => page.evaluate(() => window.__eidolonAnimationGallery?.ready)).toBe(true);
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { createTransientEffect } = await import('/src/core/TransientEffects.js');
        const gallery = window.__eidolonAnimationGalleryController;
        const render = gallery.renderSystem;
        render.setZoom(15);
        render.camera.position.set(100, 100, 100);
        gallery.controls.target.set(0, 0, 0);
        gallery.controls.update();
        render.scene.traverse((object) => { if (object.type === 'GridHelper') object.visible = false; });
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach((element) => { element.style.display = 'none'; });
        // Production warning meshes sampled at fixed phases, not a substitute
        // for network combat. Gallery actors provide normal gameplay scale.
        window.__warningFixture = createTransientEffect(render.effectGroup, 'telegraph', new THREE.Vector3(), 0xff2200, {
            radius: 6, telegraphDuration: 2, threatTier: 'boss',
            theme: 'molten_core', label: 'FURNACE RUPTURE'
        });
    });
    for (const quality of ['high', 'low']) {
        for (const phase of [0.0625, 0.125, 0.25, 0.75]) {
            const result = await page.evaluate(({ quality, phase }) => {
                const render = window.__eidolonAnimationGalleryController.renderSystem;
                render.setGraphicsQuality(quality);
                const effect = window.__warningFixture;
                effect.elapsed = phase * effect.duration;
                effect.update(0);
                const ring = effect.meshes[0];
                return { radius: ring.geometry.parameters.outerRadius * ring.scale.x, opacity: ring.material.opacity };
            }, { quality, phase });
            await testInfo.attach(`${quality}-${phase}`, { body: JSON.stringify(result), contentType: 'application/json' });
            expect(result.radius).toBe(6);
            expect(result.opacity).toBeGreaterThan(0.45);
            await page.screenshot({ path: testInfo.outputPath(`warning-${quality}-${phase}.png`) });
        }
    }
    await page.evaluate(() => window.__warningFixture.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
