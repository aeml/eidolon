import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('canonical dungeon joins have one floor, continuous tiles, and traversable corners', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    const metrics = await page.evaluate(async () => {
        const THREE = await import('three');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        const gallery = window.__eidolonAnimationGalleryController;
        gallery.cleanupPresentation();
        [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach(actor => { if (actor?.mesh) actor.mesh.visible = false; });
        const render = gallery.renderSystem;
        render.staticEnvironmentGroup.visible = false;
        render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
        const collision = new CollisionManager();
        const group = new THREE.Group();
        render.scene.add(group);
        const generator = new WorldGenerator(group, collision);
        const layout = {
            rooms: [
                { x: 0, z: 0, width: 100, height: 100, type: 'start' },
                { x: 80, z: -180, width: 180, height: 180, type: 'boss' }
            ],
            walkRects: [
                { x: 0, z: 0, width: 100, height: 100, kind: 'room' },
                { x: 80, z: -180, width: 180, height: 180, kind: 'room' },
                { x: 0, z: -60, width: 40, height: 60, kind: 'corridor' },
                { x: 40, z: -70, width: 120, height: 40, kind: 'corridor' },
                { x: 80, z: -80, width: 40, height: 60, kind: 'corridor' }
            ],
            corridors: [{ fromRoomIndex: 0, toRoomIndex: 1, width: 40, walkRectIndices: [2, 3, 4] }]
        };
        collision.setDungeonWalkableGeometry(layout.walkRects);
        await generator.createVerdantBastionCatacombs(0, 0, layout);
        render.setEnvironmentContext('verdant_bastion_catacombs', new THREE.Vector3(40, 0, -70), true);
        gallery.controls.maxDistance = 500;
        render.setZoom(30);
        render.camera.zoom = 0.35;
        render.camera.updateProjectionMatrix();
        render.camera.position.set(180, 250, 80);
        gallery.controls.target.set(40, 0, -70);
        gallery.controls.update();
        document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(node => { node.style.display = 'none'; });
        const route = [[0, 0], [0, -70], [80, -70], [80, -180]];
        let blockedSamples = 0;
        let wrongFloorCount = 0;
        const floors = group.children.filter(mesh => mesh.name === 'DungeonUnionFloor');
        for (let i = 1; i < route.length; i++) {
            const start = new THREE.Vector3(route[i - 1][0], 0, route[i - 1][1]);
            const end = new THREE.Vector3(route[i][0], 0, route[i][1]);
            for (let step = 0; step <= 100; step++) {
                const point = start.clone().lerp(end, step / 100);
                const corrected = collision.checkCollision(point, 1.25, point);
                if (corrected && corrected.distanceTo(point) > 0.01) blockedSamples++;
                // Probe just off partition boundaries so two touching edges do
                // not count as overlapping surface interiors.
                const x = point.x + 0.0001;
                const z = point.z + 0.0001;
                const count = floors.filter(mesh => {
                    const r = mesh.userData.walkSurface;
                    return x > r.left && x < r.right && z > r.top && z < r.bottom;
                }).length;
                if (count !== 1) wrongFloorCount++;
            }
        }
        return { blockedSamples, wrongFloorCount, floors: floors.length, floorMaterials: new Set(floors.map(mesh => mesh.material.uuid)).size };
    });
    expect(metrics.blockedSamples).toBe(0);
    expect(metrics.wrongFloorCount).toBe(0);
    expect(metrics.floorMaterials).toBe(1);
    for (const quality of ['high', 'low']) {
        await page.evaluate(quality => window.__eidolonAnimationGalleryController.renderSystem.setGraphicsQuality(quality), quality);
        await page.screenshot({ path: testInfo.outputPath(`dungeon-join-${quality}.png`) });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
