import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1280, 720], [390, 844]]) {
    test(`${width}x${height}: Maelin's distinct model channels and returns to idle`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { CrystalKeeper } = await import('/src/entities/CrystalKeeper.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(mobile);
            render.scene.background = new THREE.Color(0x202930);
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x46525a, roughness: 0.95 }));
            floor.rotation.x = -Math.PI / 2;
            floor.receiveShadow = true;
            render.instanceEnvironmentGroup.add(floor);
            const before = new CrystalKeeper('before-mage-rig'), after = new CrystalKeeper('after-artificer');
            // Explicit model reference: the prior actor used the ordinary
            // Wizard mesh and has no Channel clip. No live NPC is substituted.
            before.meshType = 'Wizard';
            before.name = 'Previous mage rig';
            after.name = 'Maelin, Resonance Artificer';
            before.position.x = -2.1;
            after.position.x = 2.1;
            for (const actor of [before, after]) {
                actor.isRemote = true;
                await actor.ensureMesh();
                actor.update(1 / 60, null, null, []);
                render.entityGroup.add(actor.mesh);
            }
            render.setCameraTarget(new THREE.Vector3(0, 2, 0));
            render.cameraOffset.set(3, 2, 9);
            render.updateCamera();
            render.setZoom(mobile ? 8 : 5);
            window.__maelinArt = { render, before, after };
        }, width < 600);
        try {
            for (const quality of ['high', 'low']) {
                for (const [phase, state] of ['IDLE', 'CHANNELING', 'IDLE'].entries()) {
                    const metrics = await page.evaluate(({ quality, state }) => {
                        const { render, before, after } = window.__maelinArt;
                        render.setGraphicsQuality(quality);
                        for (const actor of [before, after]) {
                            actor.updateState(state);
                            for (let frame = 0; frame < 45; frame++) actor.update(1 / 60, null, null, []);
                        }
                        render.render();
                        return { state: after.state, animation: after.currentAction?.getClip()?.name,
                            beforeAnimation: before.currentAction?.getClip()?.name,
                            meshType: after.meshType, missing: [...after.missingAnimationClips],
                            armAngle: after.mesh.getObjectByName('Rig_UpperArmRight').rotation.x,
                            tuningFork: Boolean(after.mesh.getObjectByName('Maelin_TuningFork')) };
                    }, { quality, state });
                    const label = `${quality}-${phase}-${state}`;
                    await testInfo.attach(label, { body: JSON.stringify(metrics), contentType: 'application/json' });
                    await page.screenshot({ path: testInfo.outputPath(`${label}.png`) });
                    expect(metrics.state).toBe(state);
                    expect(metrics.animation).toBe(state === 'CHANNELING' ? 'Channel' : 'Idle');
                    expect(metrics.beforeAnimation).toBe('Idle');
                    expect(metrics.meshType).toBe('CrystalKeeper');
                    expect(metrics.missing).toEqual([]);
                    expect(metrics.tuningFork).toBe(true);
                    if (state === 'CHANNELING') expect(metrics.armAngle).toBeLessThan(-0.8);
                    else expect(Math.abs(metrics.armAngle)).toBeLessThan(0.2);
                }
            }
        } finally {
            await page.evaluate(() => {
                const q = window.__maelinArt;
                q.before.dispose(); q.after.dispose(); q.render.dispose();
                delete window.__maelinArt;
            });
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
