import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`${quality}: ten equipped actor instances preserve animated surfaces, shadows and stealth`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { applyProceduralEquipment, EQUIPMENT_RENDER_SLOTS } = await import('/src/art/ProceduralEquipment.js');
        const { applyActorStealthAppearance, restoreActorStealthAppearance } = await import('/src/entities/ActorStealthAppearance.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        render.setActorInstancesEnabled(true);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        const models = [];
        for (let index = 0; index < 10; index++) {
            const type = ['Fighter', 'Rogue', 'Wizard', 'Cleric'][index % 4];
            const mesh = await MeshFactory.createMeshForType(type);
            const equipment = Object.fromEntries(EQUIPMENT_RENDER_SLOTS.map(slot => {
                const candidates = BASE_ITEMS.filter(item => item.slot === slot.replace(/[12]$/, ''));
                const item = candidates[index % candidates.length];
                return [slot, { ...item, id: `instance-${index}-${slot}`, baseName: item.name, rarity: 'Rare', level: 75 }];
            }));
            const fit = applyProceduralEquipment(mesh, equipment);
            if (fit.items !== 14 || fit.missing.length) throw Error('Incomplete instance fixture');
            mesh.position.set((index % 5 - 2) * 4, 0, index < 5 ? -3 : 3);
            render.entityGroup.add(mesh); models.push({ type, mesh, position: mesh.position.clone() });
        }
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const instances = render.actorInstances;
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true }), reports = [];
        const capture = enabled => {
            instances.enabled = enabled; render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        capture(false); capture(true);
        let image, failureRestored = false;
        try {
            for (const state of ['Idle', 'Run', 'Attack', 'Cast', 'Death', 'Stealth', 'FarRealmIdle']) {
                // Real instance coordinates are far from town. Compare both
                // paths there too, without masking position precision errors.
                const offset = state === 'FarRealmIdle' ? new THREE.Vector3(50000, 0, 20000) : new THREE.Vector3();
                models.forEach(({ mesh, position }) => mesh.position.copy(position).add(offset));
                floor.position.copy(offset);
                render.setCameraTarget(offset.clone().add(new THREE.Vector3(0, 1, 0)));
                render.updateEnvironmentLighting(offset, 0);
                const mixers = models.map(({ mesh }) => {
                    const mixer = new THREE.AnimationMixer(mesh), clip = mesh.userData.animations.find(clip => clip.name === (['Stealth', 'FarRealmIdle'].includes(state) ? 'Idle' : state));
                    mixer.clipAction(clip).play(); mixer.update(.37); return mixer;
                });
                const rogues = models.filter(model => model.type === 'Rogue');
                if (state === 'Stealth') rogues.forEach(applyActorStealthAppearance);
                const visibility = new Map(); models.forEach(({ mesh }) => mesh.traverse(part => visibility.set(part, part.visible)));
                const before = capture(false), after = capture(true); let error = 0, changed = 0;
                if (state === 'Idle') image = canvas.toDataURL('image/png');
                for (let i = 0; i < before.pixels.length; i += 4) {
                    const delta = Math.max(...[0, 1, 2].map(c => Math.abs(before.pixels[i + c] - after.pixels[i + c])));
                    error += delta; if (delta > 8) changed++;
                }
                reports.push({ state, beforeCalls: before.calls, afterCalls: after.calls,
                    beforeTriangles: before.triangles, afterTriangles: after.triangles,
                    meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height),
                    visibilityRestored: [...visibility].every(([part, visible]) => part.visible === visible) });
                if (state === 'Stealth') rogues.forEach(restoreActorStealthAppearance);
                mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
                models.forEach(({ mesh, position }) => { mesh.userData.resetPose(); mesh.position.copy(position); });
            }
            floor.position.set(0, 0, 0);
            render.setCameraTarget(new THREE.Vector3(0, 1, 0));
            render.updateEnvironmentLighting(new THREE.Vector3(), 0);
            const visibility = new Map();
            models.forEach(({ mesh }) => mesh.traverse(part => visibility.set(part, part.visible)));
            const originalHook = floor.onBeforeRender, failure = new Error('Prepared mid-frame failure');
            let hiddenDuringFailure = false, observedFailure = false;
            floor.onBeforeRender = () => { hiddenDuringFailure = instances.hidden.length > 0; throw failure; };
            try { render.render(); } catch (error) {
                if (error !== failure) throw error;
                observedFailure = true;
            } finally { floor.onBeforeRender = originalHook; }
            failureRestored = observedFailure && hiddenDuringFailure && !instances.group.visible &&
                [...visibility].every(([part, visible]) => part.visible === visible) && render.renderer.info.autoReset;
            // The next ordinary render remains usable after the caught failure.
            capture(true);
        } finally {
            instances.dispose();
            models.forEach(({ type, mesh }) => { mesh.removeFromParent(); MeshFactory.releaseMesh(type, mesh); });
            floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return { reports, image, failureRestored };
    }, quality);
    await testInfo.attach('instance-comparison', { body: JSON.stringify(result.reports), contentType: 'application/json' });
    await writeFile(testInfo.outputPath('instance-comparison.json'), JSON.stringify(result.reports, null, 2));
    await writeFile(testInfo.outputPath('actor-instances.png'), Buffer.from(result.image.split(',')[1], 'base64'));
    for (const row of result.reports) {
        expect(row.afterCalls).toBeLessThan(row.beforeCalls);
        expect(row.afterTriangles).toBe(row.beforeTriangles);
        expect(row.meanError).toBeLessThan(.1); expect(row.changed).toBeLessThan(.001);
        expect(row.visibilityRestored).toBe(true);
    }
    expect(result.failureRestored).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
