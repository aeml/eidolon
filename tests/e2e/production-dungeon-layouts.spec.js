import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { buildDungeonTraversalRoutes, sampleDungeonTraversalRoute } from '../dungeonTraversalRoutes.js';
import { collectBrowserFailures } from './helpers.js';

const fixtures = JSON.parse(fs.readFileSync('tests/fixtures/production-dungeon-layouts.json', 'utf8'));

test('production dungeon and raid fixtures have clear routes at their real coordinates', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(300_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/repro.html?gallery=1&instances=1', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__eidolonAnimationGallery?.ready);
    for (const fixture of fixtures) {
        const samples = buildDungeonTraversalRoutes(fixture.layout).flatMap(route => sampleDungeonTraversalRoute(route));
        const metrics = await page.evaluate(async ({ dungeonType, layout, samples }) => {
            const THREE = await import('three');
            const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
            const { CollisionManager } = await import('/src/core/CollisionManager.js');
            const gallery = window.__eidolonAnimationGalleryController;
            gallery.cleanupPresentation();
            const render = gallery.renderSystem;
            const previous = render.scene.getObjectByName('ProductionDungeonFixture');
            if (previous) {
                previous.traverse(mesh => mesh.geometry?.dispose());
                render.scene.remove(previous);
            }
            [gallery.actor, gallery.remoteActor, gallery.targetActor].forEach(actor => { if (actor?.mesh) actor.mesh.visible = false; });
            render.staticEnvironmentGroup.visible = false;
            render.scene.children.filter(child => child.type === 'GridHelper').forEach(child => { child.visible = false; });
            const scene = new THREE.Group();
            scene.name = 'ProductionDungeonFixture';
            render.scene.add(scene);
            const collision = new CollisionManager();
            collision.setDungeonWalkableGeometry(layout.walkRects);
            const generator = new WorldGenerator(scene, collision);
            const environment = {
                weekly_raid: 'umbral_nexus', earth_crystal_raid: 'verdant_bastion_catacombs',
                water_crystal_raid: 'abyssal_well', fire_crystal_raid: 'molten_core', air_crystal_raid: 'tempest_spire'
            }[dungeonType] || dungeonType;
            const method = {
                verdant_bastion_catacombs: 'createVerdantBastionCatacombs', molten_core: 'createMoltenCore',
                tempest_spire: 'createTempestSpire', abyssal_well: 'createAbyssalWell', umbral_nexus: 'createUmbralNexus'
            }[environment];
            await generator[method](0, 0, layout);
            const join = layout.walkRects[layout.corridors[0].walkRectIndices[1] ?? layout.corridors[0].walkRectIndices[0]];
            const focus = new THREE.Vector3(join.x, 0, join.z);
            render.setEnvironmentContext(environment, focus, true);
            gallery.controls.maxDistance = 500;
            render.setZoom(30);
            render.camera.zoom = 0.35;
            render.camera.updateProjectionMatrix();
            render.camera.position.copy(focus).add(new THREE.Vector3(140, 230, 150));
            gallery.controls.target.copy(focus);
            gallery.controls.update();
            document.querySelectorAll('#repro-hud, #animation-gallery, #perf-overlay').forEach(node => { node.style.display = 'none'; });
            const floors = scene.children.filter(mesh => mesh.name === 'DungeonUnionFloor');
            let blocked = 0;
            let wrongFloorCount = 0;
            for (const { x, z } of samples) {
                const point = new THREE.Vector3(x, 0, z);
                const correction = collision.checkCollision(point, 1.25, point);
                if (correction && correction.distanceTo(point) > 0.01) blocked++;
                const count = floors.filter(mesh => {
                    const r = mesh.userData.walkSurface;
                    return x + 0.0001 > r.left && x + 0.0001 < r.right && z + 0.0001 > r.top && z + 0.0001 < r.bottom;
                }).length;
                if (count !== 1) wrongFloorCount++;
            }
            return { blocked, wrongFloorCount, samples: samples.length };
        }, { ...fixture, samples });
        expect(metrics, `${fixture.dungeonType} seed ${fixture.layout.generationSeed}`).toEqual({ blocked: 0, wrongFloorCount: 0, samples: samples.length });
        for (const quality of ['high', 'low']) {
            await page.evaluate(quality => window.__eidolonAnimationGalleryController.renderSystem.setGraphicsQuality(quality), quality);
            if (fixture.layout.generationSeed === '2026090501' || fixture.layout.generationFallback) {
                const variant = fixture.layout.generationFallback ? '-fallback' : '';
                await page.screenshot({ path: testInfo.outputPath(`${fixture.dungeonType}${variant}-${quality}.png`) });
            }
        }
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
