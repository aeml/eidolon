import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Art-only fixture: this does not substitute for earning discoveries in-world.
test('all fifteen readable Chronicle landmarks render with distinct silhouettes', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const metrics = await page.evaluate(async () => {
        const THREE = await import('three');
        const { createChronicleSiteModel } = await import('/src/art/ChronicleSiteModels.js');
        const { chronicleInvestigations } = await import('/src/data/chronicleInvestigations.generated.js');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x18222d);
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(innerWidth, innerHeight);
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        renderer.domElement.id = 'chronicle-art-fixture';
        Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', zIndex: '99999' });
        document.body.append(renderer.domElement);
        scene.add(new THREE.HemisphereLight(0xcbdfff, 0x6f6652, 2));
        const sun = new THREE.DirectionalLight(0xffe4bc, 3);
        sun.position.set(-20, 50, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60 });
        scene.add(sun);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ color: 0x444b47, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.08;
        floor.receiveShadow = true;
        scene.add(floor);
        let total = 0;
        // One realm per column; its home/record is closest to the viewer.
        for (const [column, realm] of ['earth', 'water', 'fire', 'air'].entries()) {
            const sites = chronicleInvestigations.filter(chapter => chapter.realm === realm).flatMap(chapter => chapter.sites).filter(site => site.kind === 'inspect');
            for (const [row, site] of sites.entries()) {
                const model = createChronicleSiteModel(site, realm);
                model.mesh.position.set(column * 12, 0, -row * 11);
                model.beacon.visible = true;
                scene.add(model.mesh);
                total++;
            }
        }
        const camera = new THREE.OrthographicCamera(-32.4, 32.4, 22.5, -22.5, 0.1, 300);
        camera.position.set(18, 48, 54);
        camera.lookAt(18, 0, -15);
        renderer.render(scene, camera);
        return { total, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, contextLost: renderer.getContext().isContextLost() };
    });
    expect(metrics.total).toBe(15);
    expect(metrics.calls).toBeGreaterThan(100);
    expect(metrics.triangles).toBeLessThan(30000);
    expect(metrics.contextLost).toBe(false);
    await page.locator('#chronicle-art-fixture').screenshot({ path: testInfo.outputPath('chronicle-landmarks.png') });
    await testInfo.attach('model-metrics', { body: JSON.stringify(metrics), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
