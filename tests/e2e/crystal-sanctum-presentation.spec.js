import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

const realms = [
    ['earth_crystal_raid', 'Earth', 'createVerdantBastionCatacombs'],
    ['water_crystal_raid', 'Water', 'createAbyssalWell'],
    ['fire_crystal_raid', 'Fire', 'createMoltenCore'],
    ['air_crystal_raid', 'Air', 'createTempestSpire']
];

// Controlled presentation fixtures use the actual room generator, renderer,
// crystal snapshot consumer and Maelin actor. They do not grant earned raid
// completion or stand in for live/reconnect/group gameplay acceptance.
for (const [width, height] of [[1280, 720], [390, 844]]) {
    for (const [raidType, element, generate] of realms) {
        test(`${width}x${height} ${element}: crystal restoration is visible in High and Low`, async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
            await page.setViewportSize({ width, height });
            await page.goto('/', { waitUntil: 'networkidle' });
            await page.evaluate(async ({ raidType, generate, mobile }) => {
                const THREE = await import('three');
                const { RenderSystem } = await import('/src/core/RenderSystem.js');
                const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
                const { CollisionManager } = await import('/src/core/CollisionManager.js');
                const { CrystalKeeper } = await import('/src/entities/CrystalKeeper.js');
                document.getElementById('start-screen').style.display = 'none';
                const render = new RenderSystem(mobile);
                const chamber = { x: 0, z: 0, width: 270, height: 250, type: 'boss', hook: 'crystal_vigil', color: 0x26302b };
                const layout = { rooms: [chamber], walkRects: [{ x: 0, z: 0, width: 270, height: 250, kind: 'room', roomIndex: 0 }], corridors: [] };
                const generator = new WorldGenerator(render.instanceEnvironmentGroup, new CollisionManager(), {
                    instanceId: 'presentation-raid', instanceType: raidType, layout
                });
                await generator[generate](0, 0, layout);
                const maelin = new CrystalKeeper('presentation-maelin');
                maelin.isRemote = true;
                maelin.rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
                await maelin.ensureMesh();
                maelin.mesh.position.set(0, 0, 0);
                render.entityGroup.add(maelin.mesh);
                render.setEnvironmentContext(raidType, new THREE.Vector3(), true);
                render.setCameraTarget(new THREE.Vector3(0, 7, -22));
                render.setZoom(mobile ? 55 : 30);
                window.__crystalPresentation = { render, generator, maelin, THREE };
            }, { raidType, generate, mobile: width < 600 });
            try {
                const evidence = [];
                for (const quality of ['high', 'low']) {
                    for (const [stage, progress] of [['fractured', 0], ['repairing', 66], ['restored', 100]]) {
                        const metrics = await page.evaluate(({ raidType, element, stage, progress, quality }) => {
                            const { render, generator, maelin, THREE } = window.__crystalPresentation;
                            render.setGraphicsQuality(quality);
                            generator.updateDungeonRoomState({ rooms: [], crystal: {
                                instanceId: 'presentation-raid', raidType, element, stage, progress, wave: 3, totalWaves: 3, x: 0, z: 0
                            } });
                            generator.updateDungeonPresentation(0, quality);
                            maelin.updateState(stage === 'repairing' ? 'CHANNELING' : 'IDLE');
                            for (let frame = 0; frame < 30; frame++) maelin.update(1 / 60, null, null, []);
                            const root = generator.crystalSanctum;
                            const target = new THREE.WebGLRenderTarget(256, 256);
                            const visible = new Uint8Array(256 * 256 * 4), hidden = new Uint8Array(visible.length);
                            render.renderer.setRenderTarget(target);
                            root.visible = false;
                            render.renderer.render(render.scene, render.camera);
                            render.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, hidden);
                            root.visible = true;
                            render.renderer.render(render.scene, render.camera);
                            render.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, visible);
                            render.renderer.setRenderTarget(null);
                            target.dispose();
                            let changedPixels = 0, visibleMeshes = 0;
                            for (let i = 0; i < visible.length; i += 4) {
                                if (Math.abs(visible[i] - hidden[i]) + Math.abs(visible[i + 1] - hidden[i + 1]) + Math.abs(visible[i + 2] - hidden[i + 2]) > 18) changedPixels++;
                            }
                            root.traverseVisible(object => { if (object.isMesh) visibleMeshes++; });
                            const box = new THREE.Box3().setFromObject(root.getObjectByName('ThreeCrystalFacets'));
                            const center = box.getCenter(new THREE.Vector3()).project(render.camera);
                            render.render();
                            return { stage: root.userData.stage, quality, changedPixels, visibleMeshes,
                                center: center.toArray(), motes: root.getObjectByName('CrystalResonanceMotes').count,
                                theme: render.environmentThemeOverride, maelinType: maelin.type,
                                maelinAnimation: maelin.currentAction?.getClip()?.name };
                        }, { raidType, element, stage, progress, quality });
                        evidence.push(metrics);
                        await testInfo.attach(`${quality}-${stage}`, { body: JSON.stringify(metrics), contentType: 'application/json' });
                        await page.screenshot({ path: testInfo.outputPath(`${quality}-${stage}.png`) });
                        expect(metrics.stage).toBe(stage);
                        expect(metrics.changedPixels).toBeGreaterThan(30);
                        expect(Math.abs(metrics.center[0])).toBeLessThan(0.9);
                        expect(Math.abs(metrics.center[1])).toBeLessThan(0.9);
                        expect(metrics.motes).toBe(quality === 'low' ? 6 : 12);
                        expect(metrics.maelinType).toBe('CrystalKeeper');
                        expect(metrics.maelinAnimation).toBe(stage === 'repairing' ? 'Channel' : 'Idle');
                    }
                }
                const high = evidence.find(row => row.quality === 'high' && row.stage === 'restored');
                const low = evidence.find(row => row.quality === 'low' && row.stage === 'restored');
                expect(low.visibleMeshes).toBeLessThan(high.visibleMeshes);
            } finally {
                await page.evaluate(() => {
                    const q = window.__crystalPresentation;
                    q.maelin.dispose();
                    q.render.clearInstanceScene();
                    q.render.dispose();
                    delete window.__crystalPresentation;
                });
            }
            expect(failures, failures.join('\n')).toEqual([]);
        });
    }
}
