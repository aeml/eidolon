import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('direct foliage visitor retains exact previous color and shadow pixels across qualities and realms', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_FOLIAGE_VISITOR_COMPARE !== '1', 'Explicit private comparison requires the recorded predecessor source');
    const previous = execFileSync('git', ['show', 'd04aa7c6:src/core/FoliageShadowInfluence.js'], { encoding: 'utf8' });
    await page.route('**/src/core/FoliageShadowInfluenceReference.js', route => route.fulfill({ body: previous, contentType: 'text/javascript' }));
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { FoliageShadowInfluence: Reference } = await import('/src/core/FoliageShadowInfluenceReference.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(false);
        const generator = new WorldGenerator(render.staticEnvironmentGroup, { addCollider() {} });
        await generator.loadTrees(0, 200);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.MeshStandardMaterial({ color: 0x4a4842 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        const candidate = render.foliageShadowInfluence;
        const reference = new Reference(render.scene, [render.scene, render.environmentGroup, render.staticEnvironmentGroup, render.instanceEnvironmentGroup]);
        const visits = { candidate: 0, reference: 0 };
        for (const [key, controller] of [['candidate', candidate], ['reference', reference]]) {
            const visit = controller.visit;
            controller.visit = object => { visits[key]++; return visit(object); };
        }
        const copy = document.createElement('canvas'); copy.width = render.renderer.domElement.width; copy.height = render.renderer.domElement.height;
        const ctx = copy.getContext('2d', { willReadFrequently: true });
        const reports = [], now = performance.now;
        // Frozen shader time, identical scene/camera/materials/geometry. Only
        // traversal changes; no render deadlines or image tolerances weakened.
        performance.now = () => 10_000;
        try {
            for (const quality of ['high', 'low']) {
                render.setGraphicsQuality(quality);
                const { updateFoliageRenderQuality } = await import('/src/art/FoliageRenderBatches.js');
                updateFoliageRenderQuality(render.staticEnvironmentGroup, quality);
                for (const [realm, x, z] of [['earth', -100, -300], ['earth', 390, 150], ['water', 0, -1000], ['fire', -1100, 200], ['air', 1100, 200]]) {
                    const focus = new THREE.Vector3(x, 0, z);
                    render.setZoom(28); render.setCameraTarget(focus); render.applyLightingPreset(realm, true);
                    render.updateShadowFocus(focus);
                    const capture = controller => {
                        visits.candidate = visits.reference = 0;
                        render.foliageShadowInfluence = controller; render.render();
                        ctx.drawImage(render.renderer.domElement, 0, 0);
                        return { pixels: ctx.getImageData(0, 0, copy.width, copy.height).data,
                            calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                            visits: controller === candidate ? visits.candidate : visits.reference };
                    };
                    capture(reference); capture(candidate);
                    const old = capture(reference), current = capture(candidate);
                    let changed = 0, maximum = 0;
                    for (let i = 0; i < old.pixels.length; i++) {
                        const delta = Math.abs(old.pixels[i] - current.pixels[i]);
                        if (delta) changed++; maximum = Math.max(maximum, delta);
                    }
                    reports.push({ quality, realm, x, z, changed, maximum, previousCalls: old.calls,
                        calls: current.calls, previousTriangles: old.triangles, triangles: current.triangles,
                        previousVisits: old.visits, visits: current.visits });
                }
            }
        } finally {
            performance.now = now; render.foliageShadowInfluence = candidate;
            reference.dispose(); render.dispose();
        }
        return reports;
    });
    await testInfo.attach('previous-foliage-visitor-pixel-comparison', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    console.log('[foliage-visitor-parity]', JSON.stringify(result));
    for (const sample of result) {
        expect(sample.maximum, JSON.stringify(sample)).toBe(0);
        expect(sample.changed).toBe(0);
        expect(sample.calls).toBe(sample.previousCalls);
        expect(sample.triangles).toBe(sample.previousTriangles);
        expect(sample.visits).toBeLessThan(sample.previousVisits);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
