import { expect, test } from '@playwright/test';
import { collectBrowserFailures, openGame } from './helpers.js';

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    for (const quality of ['high', 'low']) {
        test(`${viewport.width}x${viewport.height} ${quality}: readable names leave the crowd and quest marker clear`, async ({ page, baseURL }, testInfo) => {
            const failures = collectBrowserFailures(page, baseURL);
            await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
            await page.setViewportSize(viewport);
            await openGame(page);
            await page.evaluate(async ({ quality, viewport }) => {
                const THREE = await import('three');
                const { RenderSystem } = await import('/src/core/RenderSystem.js');
                const { NameplatePresentation } = await import('/src/core/NameplatePresentation.js');
                const { Wizard } = await import('/src/entities/Wizard.js');
                const { Skeleton } = await import('/src/entities/Skeleton.js');
                const { QuestNPC } = await import('/src/entities/QuestNPC.js');
                document.getElementById('start-screen').style.display = 'none';
                const render = new RenderSystem(viewport.width < 900);
                document.body.appendChild(render.renderer.domElement);
                render.setGraphicsQuality(quality);
                const hero = new Wizard('nameplate-hero'); hero.name = 'Wanderer'; hero.position.set(-4, 0, 3);
                // Keep this independent NPC outside the pack's screen-space
                // label bounds; a selected overlapping enemy legitimately wins.
                const npc = new QuestNPC('nameplate-ilyra', { story: true }); npc.position.set(11, 0, -6);
                npc.markerSymbol = '!';
                const enemies = Array.from({ length: 20 }, (_, i) => {
                    const enemy = new Skeleton(`crowd-${i}`);
                    enemy.position.set((i % 5) * .8 - 1.6, 0, Math.floor(i / 5) * .8 - 1.2);
                    return enemy;
                });
                const actors = [hero, npc, ...enemies];
                for (const actor of actors) {
                    await actor.ensureMesh(); actor.mesh.position.copy(actor.position); render.add(actor.mesh);
                }
                const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100),
                    new THREE.MeshStandardMaterial({ color: 0x454738, roughness: 1 }));
                ground.rotation.x = -Math.PI / 2; ground.position.y = -.03; render.addToEnvironment(ground);
                render.setZoom(24); render.setCameraTarget(new THREE.Vector3(0, 0, 0));
                const presentation = new NameplatePresentation();
                const options = { camera: render.camera, ...viewport, player: hero, target: enemies[0],
                    isInteractable: entity => entity === npc, mobile: viewport.width < 900 };
                const q = { render, actors, npc, enemies, presentation, options,
                    originals: actors.map(actor => actor.mesh.position.toArray()) };
                q.apply = () => { presentation.update(actors, options); render.render(); };
                q.snapshot = () => actors.filter(actor => actor.nameTag.visible).map(actor => {
                    const tag = actor.nameTag, p = tag.getWorldPosition(new THREE.Vector3()).project(render.camera);
                    const scale = tag.getWorldScale(new THREE.Vector3());
                    const h = scale.y / ((render.camera.top - render.camera.bottom) / render.camera.zoom) * viewport.height;
                    return { id: actor.id, x: (p.x + 1) * viewport.width / 2, y: (1 - p.y) * viewport.height / 2,
                        width: h * tag.material.map.image.width / tag.material.map.image.height, height: h };
                });
                window.__nameplateQA = q; render.render();
            }, { quality, viewport });
            await page.screenshot({ path: testInfo.outputPath('names-before.png') });
            const labels = await page.evaluate(() => { const q = window.__nameplateQA; q.apply(); return q.snapshot(); });
            expect(labels.length).toBeGreaterThan(1);
            expect(labels.length).toBeLessThanOrEqual(viewport.width < 900 ? 8 : 12);
            expect(labels.map(label => label.id)).toEqual(expect.arrayContaining(['crowd-0', 'nameplate-ilyra']));
            for (const label of labels) expect(label.height).toBeCloseTo(22, 3);
            for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
                const a = labels[i], b = labels[j];
                expect(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 ||
                    Math.abs(a.y - b.y) >= (a.height + b.height) / 2).toBe(true);
            }
            await page.screenshot({ path: testInfo.outputPath('names-after.png') });
            expect(await page.evaluate(() => {
                const q = window.__nameplateQA;
                for (let i = 0; i < 20; i++) q.apply();
                return q.npc.questMarker.visible && q.npc.questMarker.userData.symbol === '!' &&
                    JSON.stringify(q.actors.map(actor => actor.mesh.position.toArray())) === JSON.stringify(q.originals);
            })).toBe(true);
            expect(await page.evaluate(() => {
                const q = window.__nameplateQA; q.options.target = q.enemies[19]; q.apply();
                return q.enemies[19].nameTag.visible && q.enemies[19].nameTag.material.color.getHex() === 0xffdd89;
            })).toBe(true);
            expect(failures, failures.join('\n')).toEqual([]);
            await page.evaluate(() => {
                const q = window.__nameplateQA;
                q.actors.forEach(actor => actor.dispose()); q.render.dispose();
            });
        });
    }
}
