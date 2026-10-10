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

// Exact native control for the scene-container cache, independent of foliage
// density, live actors and timing. Both ordinary and manual children cast shadows.
test('cached container invalidation matches ordinary Three color and shadows', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_MATRIX_INVALIDATION !== '1', 'Explicit private matrix correctness control');
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    const failures = collectBrowserFailures(page, baseURL);
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { cacheUnchangedLocalMatrix } = await import('/src/core/UnchangedLocalMatrix.js');
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(640, 480); renderer.shadowMap.enabled = true;
        const context = renderer.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
        const graphics = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
        const camera = new THREE.OrthographicCamera(-32, 32, 24, -24, .1, 500);
        camera.position.set(15, 35, 45); camera.lookAt(10, 0, 0); camera.updateMatrixWorld();
        const geometry = new THREE.BoxGeometry(3, 4, 3), floorGeometry = new THREE.PlaneGeometry(120, 100);
        const material = new THREE.MeshStandardMaterial({ color: 0xdd8d49, roughness: .8 });
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x6c8c80 });
        const build = cached => {
            const scene = new THREE.Scene(); scene.background = new THREE.Color('#17242d');
            const group = new THREE.Group(); scene.add(group);
            const ordinaryChild = new THREE.Mesh(geometry, material);
            ordinaryChild.position.set(0, 2, 0); ordinaryChild.castShadow = true; group.add(ordinaryChild);
            const manualChild = new THREE.Mesh(geometry, material);
            manualChild.matrixAutoUpdate = false; manualChild.matrix.makeTranslation(5, 2, 2);
            manualChild.castShadow = true; group.add(manualChild);
            const floor = new THREE.Mesh(floorGeometry, floorMaterial);
            floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
            scene.add(new THREE.HemisphereLight(0xffffff, 0x867049, 2));
            const light = new THREE.DirectionalLight(0xffffff, 3);
            light.position.set(-15, 30, 20); light.castShadow = true;
            light.shadow.mapSize.set(512, 512);
            Object.assign(light.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 150 });
            light.shadow.camera.updateProjectionMatrix(); scene.add(light, light.target);
            const restorers = cached ? [scene, group].map(cacheUnchangedLocalMatrix) : [];
            return { scene, group, light, restorers };
        };
        const controls = [build(false), build(true)];
        const copy = document.createElement('canvas'); copy.width = 640; copy.height = 480;
        const ctx = copy.getContext('2d', { willReadFrequently: true });
        const capture = control => {
            renderer.render(control.scene, camera); ctx.drawImage(renderer.domElement, 0, 0);
            return { pixels: ctx.getImageData(0, 0, 640, 480).data, world: control.group.matrixWorld.toArray() };
        };
        const differences = (a, b) => a.reduce((count, value, i) => count + Number(value !== b[i]), 0);
        const reports = [];
        try {
            const scenarios = [
                ['manual-to-auto', [node => { node.position.x = 3; }, node => { node.matrixAutoUpdate = false; node.matrix.makeTranslation(20, 0, 0); node.matrixWorldNeedsUpdate = true; }, node => { node.matrixAutoUpdate = true; }]],
                ['direct-world-write', [node => { node.matrixAutoUpdate = true; node.position.x = 3; }, node => { node.matrixWorld.makeTranslation(99, 0, 0); }]],
                ['restore-world-auto', [node => { node.position.x = 3; }, node => { node.matrixWorldAutoUpdate = false; node.position.x = 7; }, node => { node.matrixWorldAutoUpdate = true; }]],
                ['manual-child-local', [node => { node.position.x = 3; node.children[1].matrix.makeTranslation(5, 2, 2); node.children[1].matrixWorldNeedsUpdate = true; }, node => { node.children[1].matrix.makeTranslation(22, 2, 2); }]],
                ['manual-child-world', [node => { node.children[1].matrix.makeTranslation(5, 2, 2); node.children[1].matrixWorldNeedsUpdate = true; }, node => { node.children[1].matrixWorld.makeTranslation(99, 2, 2); }]],
                ['manual-group-world', [node => { node.matrixAutoUpdate = false; node.matrix.makeTranslation(7, 0, 0); node.matrixWorldNeedsUpdate = true; }, node => { node.matrixWorld.makeTranslation(88, 0, 0); }]]
            ];
            for (const [name, steps] of scenarios) {
                for (const [step, mutate] of steps.entries()) {
                    controls.forEach(control => mutate(control.group));
                    controls.forEach(capture); // Compile/warm both exact material paths.
                    const ordinary = capture(controls[0]), cached = capture(controls[1]), repeated = capture(controls[0]);
                    reports.push({ name, step, changedChannels: differences(ordinary.pixels, cached.pixels), unstableChannels: differences(ordinary.pixels, repeated.pixels), worldEqual: differences(ordinary.world, cached.world) === 0 });
                }
            }
        } finally {
            controls.forEach(control => { control.restorers.forEach(restore => restore()); control.light.shadow.dispose(); control.scene.clear(); });
            geometry.dispose(); floorGeometry.dispose(); material.dispose(); floorMaterial.dispose(); renderer.dispose(); renderer.forceContextLoss();
        }
        return { graphics, reports };
    });
    await testInfo.attach('matrix-invalidation-native', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    expect(result.graphics).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(result.reports).toHaveLength(14);
    for (const report of result.reports) expect(report).toMatchObject({ changedChannels: 0, unstableChannels: 0, worldEqual: true });
    expect(failures, failures.join('\n')).toEqual([]);
});
