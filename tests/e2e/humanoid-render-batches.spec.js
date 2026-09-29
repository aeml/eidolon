import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

// A bounded renderer equivalence check, not party/network or frame-time QA.
for (const quality of ['high', 'low']) test(`four class rigid batches preserve rendered poses: ${quality}`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const factories = await import('/src/art/ProceduralHumanoid.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low');
        render.setGraphicsQuality(quality);
        render.renderer.domElement.dataset.batchReview = 'true';
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
        render.scene.add(floor);
        const original = new THREE.Group(), batched = new THREE.Group();
        render.entityGroup.add(original, batched);
        const place = (mesh, index) => mesh.position.set(index % 2 ? 3 : -3, 0, index < 2 ? -3 : 3);
        for (const [index, type] of ['Fighter', 'Rogue', 'Wizard', 'Cleric'].entries()) {
            const meshes = [factories[`createProcedural${type}`](), await MeshFactory.createMeshForType(type)];
            meshes.forEach((mesh, variant) => {
                place(mesh, index);
                [original, batched][variant].add(mesh);
            });
        }
        render.setZoom(11); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true);
        render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const copy = document.createElement('canvas'), canvas = render.renderer.domElement;
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = optimized => {
            original.visible = !optimized; batched.visible = optimized;
            render.render();
            context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        const results = [];
        // The first render includes reflection-environment preparation. Warm
        // both variants so the comparison measures their steady draw counts.
        capture(false); capture(true);
        for (const state of ['Idle', 'Run', 'Attack', 'Death']) {
            const mixers = [...original.children, ...batched.children].map(mesh => {
                const mixer = new THREE.AnimationMixer(mesh);
                mixer.clipAction(mesh.userData.animations.find(clip => clip.name === state)).play();
                mixer.update(.37); return mixer;
            });
            const before = capture(false), after = capture(true);
            let absoluteError = 0, changedPixels = 0;
            for (let i = 0; i < before.pixels.length; i += 4) {
                let pixelError = 0;
                for (let c = 0; c < 3; c++) pixelError = Math.max(pixelError, Math.abs(before.pixels[i + c] - after.pixels[i + c]));
                absoluteError += pixelError;
                if (pixelError > 8) changedPixels++;
            }
            results.push({ state, before: { calls: before.calls, triangles: before.triangles },
                after: { calls: after.calls, triangles: after.triangles },
                meanPixelError: absoluteError / (copy.width * copy.height),
                changedFraction: changedPixels / (copy.width * copy.height) });
            mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
            for (const group of [original, batched]) group.children.forEach((mesh, index) => {
                mesh.userData.resetPose(); place(mesh, index);
            });
        }
        capture(true);
        return results;
    }, quality);
    await testInfo.attach('rigid-batch-render-comparison', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    await writeFile(testInfo.outputPath('comparison.json'), JSON.stringify(results, null, 2));
    await page.locator('canvas[data-batch-review]').screenshot({ path: testInfo.outputPath('four-class-batched.png') });
    for (const result of results) {
        expect(result.after.calls).toBeLessThan(result.before.calls);
        expect(result.before.calls - result.after.calls).toBeGreaterThanOrEqual(63);
        expect(result.after.triangles).toBe(result.before.triangles);
        expect(result.meanPixelError).toBeLessThan(.1);
        expect(result.changedFraction).toBeLessThan(.001);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});

