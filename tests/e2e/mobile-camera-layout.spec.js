import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true });

test('phone camera renders production silhouettes and warning edges with a stable rotation scale', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { InputManager } = await import('/src/core/InputManager.js');
        const { createTransientEffect } = await import('/src/core/TransientEffects.js');
        const { createProceduralTerrainMaterial } = await import('/src/art/ProceduralRealmTerrain.js');
        document.body.classList.add('mobile-mode');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(true);
        document.body.appendChild(render.renderer.domElement);
        const ui = new UIManager(true);
        const input = new InputManager(render.camera, render.scene, render.renderer.domElement);
        input.setupMobileControls();
        ui.showHUD();
        ui.toggleChat(true);
        const hero = await MeshFactory.createMeshForType('Fighter');
        const enemy = await MeshFactory.createMeshForType('Skeleton');
        enemy.position.set(4, 0, -4);
        render.entityGroup.add(hero, enemy);
        const terrain = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), createProceduralTerrainMaterial('earth', { quality: 'low' }));
        terrain.rotation.x = -Math.PI / 2;
        terrain.position.y = -0.02;
        render.environmentGroup.add(terrain);
        const warning = createTransientEffect(render.effectGroup, 'telegraph', enemy.position, 0xff2200,
            { radius: 6, telegraphDuration: 2, threatTier: 'boss', theme: 'verdant_bastion', label: 'CAMERA QA' });
        warning.elapsed = 1;
        warning.update(0);
        render.setCameraTarget(hero.position);
        render.setZoom(15);
        const measure = () => {
            render.camera.updateMatrixWorld(true);
            render.scene.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(hero);
            const low = new THREE.Vector3(0, box.min.y, 0).project(render.camera);
            const high = new THREE.Vector3(0, box.max.y, 0).project(render.camera);
            const enemyPoint = enemy.position.clone().project(render.camera);
            const warningEdges = Array.from({ length: 32 }, (_, i) => {
                const angle = i * Math.PI / 16;
                const point = enemy.position.clone().add(new THREE.Vector3(6 * Math.cos(angle), 0, 6 * Math.sin(angle))).project(render.camera);
                return { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2 };
            });
            return { heroHeight: Math.abs(high.y - low.y) * innerHeight / 2,
                horizontalSpan: render.camera.right - render.camera.left,
                pixelsPerUnit: innerWidth / (render.camera.right - render.camera.left),
                enemyX: (enemyPoint.x + 1) * innerWidth / 2, warningEdges };
        };
        window.__phoneCamera = { render, input, measure };
        const draw = () => { render.render(); window.__phoneCamera.frame = requestAnimationFrame(draw); };
        draw();
    });
    for (const [width, height] of [[360, 800], [390, 844], [430, 932], [844, 390], [800, 360]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => window.__phoneCamera.render.onWindowResize());
        const metrics = await page.evaluate(() => window.__phoneCamera.measure());
        await testInfo.attach(`camera-${width}-${height}`, { body: JSON.stringify(metrics), contentType: 'application/json' });
        expect(metrics.pixelsPerUnit).toBeCloseTo(Math.min(width, height) / 24);
        expect(metrics.heroHeight).toBeGreaterThan(44);
        expect(metrics.enemyX).toBeGreaterThan(0);
        expect(metrics.enemyX).toBeLessThan(width);
        for (const point of metrics.warningEdges) {
            expect(point.x).toBeGreaterThan(0);
            expect(point.x).toBeLessThan(width);
            expect(point.y).toBeGreaterThan(60);
            expect(point.y).toBeLessThan(height - 120);
        }
        await page.screenshot({ path: testInfo.outputPath(`phone-camera-${width}-${height}.png`) });
        if (width === 390) {
            const legacy = await page.evaluate(() => {
                const { render, measure } = window.__phoneCamera;
                render.isMobile = false; // Reproduce the pre-change projection, in this fixture only.
                render.setZoom(30);
                return measure();
            });
            expect(metrics.heroHeight).toBeGreaterThan(legacy.heroHeight);
            await page.screenshot({ path: testInfo.outputPath('phone-camera-legacy-maximum.png') });
            await page.evaluate(() => { window.__phoneCamera.render.isMobile = true; window.__phoneCamera.render.setZoom(15); });
        }
    }
    await page.evaluate(() => {
        cancelAnimationFrame(window.__phoneCamera.frame);
        window.__phoneCamera.input.dispose();
        window.__phoneCamera.render.dispose();
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
