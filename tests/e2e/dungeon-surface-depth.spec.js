import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('dungeon materials preserve near-ground visibility at gameplay zoom', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const results = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { createProceduralDungeonInteriorKit, DUNGEON_INTERIOR_IDS } = await import('/src/art/ProceduralDungeonInteriors.js');
        const render = new RenderSystem(false);
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 2));
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = .1; // canonical walk-floor elevation
        scene.add(floor);
        const underlay = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        underlay.rotation.x = -Math.PI / 2;
        scene.add(underlay);
        const target = new THREE.WebGLRenderTarget(1280, 900);
        const results = [];
        for (const type of DUNGEON_INTERIOR_IDS) {
            const kit = createProceduralDungeonInteriorKit(type);
            floor.material = kit.floorMaterial(24, 24);
            for (const zoom of [10, 30]) {
                render.setZoom(zoom); render.setCameraTarget(new THREE.Vector3(0, 0, 0));
                render.camera.updateMatrixWorld(true);
                const point = new THREE.Vector3(0, .1, 0).project(render.camera);
                const capture = visible => {
                    underlay.visible = visible;
                    render.renderer.setRenderTarget(target);
                    render.renderer.render(scene, render.camera);
                    const pixel = new Uint8Array(4);
                    render.renderer.readRenderTargetPixels(target, Math.floor((point.x + 1) * 640), Math.floor((point.y + 1) * 450), 1, 1, pixel);
                    return Array.from(pixel);
                };
                const covered = capture(true), uncovered = capture(false);
                floor.visible = false;
                const underlayOnly = capture(true);
                floor.visible = true;
                results.push({ type, zoom, covered, uncovered, underlayOnly });
            }
            for (const value of Object.values(floor.material)) if (value?.isTexture) value.dispose();
            floor.material.dispose();
        }
        render.renderer.setRenderTarget(null); target.dispose();
        floor.geometry.dispose(); underlay.geometry.dispose(); underlay.material.dispose();
        render.renderer.dispose();
        return results;
    });
    await testInfo.attach('depth-probe', { body: JSON.stringify(results), contentType: 'application/json' });
    for (const result of results) {
        expect(result.covered, `${result.type} floor at zoom ${result.zoom}`).toEqual(result.uncovered);
        // Readbacks are linear, so the authored dark stone can legitimately be
        // only a few byte values above black. Use a visible control instead of
        // an arbitrary brightness threshold to reject an empty/offscreen probe.
        expect(result.underlayOnly[0]).toBeGreaterThan(result.underlayOnly[1] + 100);
        expect(result.covered).not.toEqual(result.underlayOnly);
    }
    expect(failures).toEqual([]);
});
