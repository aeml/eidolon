import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('phone contacts visibly ground actors above both terrain and the raised dungeon floor', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(true); render.setGraphicsQuality('low');
        render.renderer.domElement.dataset.contactReview = 'true';
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x69604f }));
        floor.rotation.x = -Math.PI / 2; render.scene.add(floor);
        const mesh = await MeshFactory.createMeshForType('Fighter'); render.entityGroup.add(mesh);
        const actor = { mesh, position: new THREE.Vector3(), isActive: true, state: 'IDLE' };
        render.setZoom(12); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('earth', true);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const ctx = copy.getContext('2d', { willReadFrequently: true });
        const capture = visible => {
            render.actorContactShadows.mesh.visible = visible; render.render();
            ctx.drawImage(canvas, 0, 0);
            return { pixels: ctx.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        render.updateActorContactShadows([actor], { isActor: entity => entity === actor });
        const results = [];
        for (const ground of [0, .1]) {
            floor.position.y = ground;
            capture(false); capture(true);
            const before = capture(false), after = capture(true);
            let darkened = 0, brightened = 0;
            for (let i = 0; i < before.pixels.length; i += 4) {
                const delta = before.pixels[i] - after.pixels[i];
                if (delta > 3) darkened++;
                if (delta < -3) brightened++;
            }
            results.push({ ground, darkened, brightened, draws: after.calls - before.calls,
                triangles: after.triangles - before.triangles });
        }
        return results;
    });
    await page.locator('canvas[data-contact-review]').screenshot({ path: testInfo.outputPath('floor-contact.png') });
    await testInfo.attach('pixel-comparison', { body: JSON.stringify(results), contentType: 'application/json' });
    for (const result of results) {
        expect(result.darkened, `visible contact on floor at ${result.ground}`).toBeGreaterThan(10);
        expect(result.brightened).toBe(0);
        expect(result.draws).toBe(1); expect(result.triangles).toBe(2);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
