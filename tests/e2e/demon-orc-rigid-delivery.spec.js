import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`${quality}: DemonOrc preserves original animated surfaces through constructor and instance delivery`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const evidence = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { createProceduralDemonOrc } = await import('/src/art/ProceduralLegacyEnemies.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        const groups = [new THREE.Group(), new THREE.Group()], models = [], reports = [];
        for (const [variant, group] of groups.entries()) for (let i = 0; i < 6; i++) {
            const mesh = variant ? await MeshFactory.createMeshForType('DemonOrc') : createProceduralDemonOrc();
            const position = new THREE.Vector3((i % 3 - 1) * 4, 0, i < 3 ? -3 : 3);
            mesh.position.copy(position); group.add(mesh); models.push({ mesh, variant, index: i, position });
        }
        render.entityGroup.add(...groups);
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const owner = render.actorInstances, canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const capture = (variant, delivery) => {
            groups[0].visible = variant === 0; groups[1].visible = variant === 1; owner.enabled = delivery;
            render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                restored: !owner.hidden.length && !owner.multiDraw.hidden.length && !owner.group.visible && !owner.multiDraw.group.visible };
        };
        const difference = (a, b) => {
            let error = 0, changed = 0, exactChanges = 0;
            for (let i = 0; i < a.length; i += 4) {
                const delta = Math.max(...[0, 1, 2].map(c => Math.abs(a[i + c] - b[i + c])));
                error += delta; changed += delta > 8 ? 1 : 0; exactChanges += delta > 0 ? 1 : 0;
            }
            return { meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height), exactChanges };
        };
        let restoredAfterFailure = false, pooledReturns = 0;
        try {
            capture(0, false); capture(1, false); capture(1, true);
            for (const state of ['Idle', 'Walk', 'Run', 'Attack', 'Death', 'FarRealmRun', 'StretchedAttack', 'SingletonAttack']) {
                const offset = state === 'FarRealmRun' ? new THREE.Vector3(50000, 0, 20000) : new THREE.Vector3();
                floor.position.copy(offset); render.setCameraTarget(offset.clone().add(new THREE.Vector3(0, 1, 0)));
                render.updateEnvironmentLighting(offset, 0);
                const clipName = state.endsWith('Attack') ? 'Attack' : state === 'FarRealmRun' ? 'Run' : state;
                const mixers = models.map(({ mesh, index, position }) => {
                    mesh.visible = state !== 'SingletonAttack' || index === 0;
                    mesh.position.copy(position).add(offset);
                    mesh.scale.set(...(state === 'StretchedAttack' ? [1.7, .8, 1.1] : [1, 1, 1]));
                    const mixer = new THREE.AnimationMixer(mesh);
                    mixer.clipAction(mesh.userData.animations.find(clip => clip.name === clipName)).play();
                    mixer.update(.2 + index * .07); return mixer;
                });
                const visibility = new Map(); models.forEach(({ mesh }) => mesh.traverse(part => visibility.set(part, part.visible)));
                const original = capture(0, false), constructor = capture(1, false), delivered = capture(1, true), again = capture(0, false);
                const instanceMatrix = new THREE.Matrix4(), columns = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
                let unsafeInstances = 0;
                for (const batch of owner.batches.values()) for (let i = 0; i < batch.count; i++) {
                    batch.getMatrixAt(i, instanceMatrix);
                    columns.forEach((column, c) => column.setFromMatrixColumn(instanceMatrix, c).normalize());
                    if (Math.max(Math.abs(columns[0].dot(columns[1])), Math.abs(columns[0].dot(columns[2])), Math.abs(columns[1].dot(columns[2]))) > 1e-7) unsafeInstances++;
                }
                reports.push({ state, original: { calls: original.calls, triangles: original.triangles },
                    constructor: { calls: constructor.calls, triangles: constructor.triangles, ...difference(original.pixels, constructor.pixels) },
                    delivered: { calls: delivered.calls, triangles: delivered.triangles, ...difference(original.pixels, delivered.pixels) },
                    referenceAgain: difference(original.pixels, again.pixels), unsafeInstances,
                    restored: constructor.restored && delivered.restored && [...visibility].every(([part, visible]) => part.visible === visible) });
                mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
                models.forEach(({ mesh }) => mesh.userData.resetPose());
            }
            groups[0].visible = false; groups[1].visible = true; owner.enabled = true;
            floor.onBeforeRender = () => { throw Error('owned DemonOrc render failure'); };
            try { render.render(); } catch (error) { if (error.message !== 'owned DemonOrc render failure') throw error; }
            finally { floor.onBeforeRender = THREE.Object3D.prototype.onBeforeRender; }
            restoredAfterFailure = !owner.hidden.length && !owner.multiDraw.hidden.length && !owner.group.visible && !owner.multiDraw.group.visible;
            render.render();
            for (const { mesh, variant } of models) {
                mesh.removeFromParent();
                if (variant) MeshFactory.releaseMesh('DemonOrc', mesh);
            }
            render.render();
            for (const { mesh, variant } of models) if (variant) {
                const returned = await MeshFactory.createMeshForType('DemonOrc');
                if (models.some(model => model.variant && model.mesh === returned)) pooledReturns++;
                render.add(returned); render.render(); returned.removeFromParent();
                MeshFactory.releaseMesh('DemonOrc', returned);
                if (!mesh.userData.humanoidRenderBatches) throw Error('Production DemonOrc did not own reviewed constructor batches');
            }
            render.render();
        } finally {
            groups.forEach(group => group.removeFromParent());
            floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return { quality, reports, restoredAfterFailure, pooledReturns,
            disposed: owner.disposed && owner.multiDraw === null && !owner.roots.size };
    }, quality);
    await writeFile(testInfo.outputPath('demon-orc-rigid-delivery.json'), JSON.stringify(evidence, null, 2));
    expect(evidence.reports).toHaveLength(8);
    for (const row of evidence.reports) {
        // Existing reviewed rigid-constructor native surface thresholds: no new tolerance.
        expect(row.constructor.meanError, row.state).toBeLessThan(.1);
        expect(row.constructor.changed, row.state).toBeLessThan(.001);
        expect(row.delivered.meanError, row.state).toBeLessThan(.1);
        expect(row.delivered.changed, row.state).toBeLessThan(.001);
        expect(row.referenceAgain.exactChanges, row.state).toBe(0);
        expect(row.constructor.calls, row.state).toBeLessThan(row.original.calls);
        expect(row.delivered.calls, row.state).toBeLessThan(row.original.calls);
        expect(row.constructor.triangles, row.state).toBe(row.original.triangles);
        expect(row.delivered.triangles, row.state).toBeLessThanOrEqual(row.original.triangles);
        expect(row.unsafeInstances, row.state).toBe(0); expect(row.restored, row.state).toBe(true);
    }
    expect(evidence.restoredAfterFailure && evidence.disposed).toBe(true);
    expect(evidence.pooledReturns).toBe(6);
    expect(failures, failures.join('\n')).toEqual([]);
});
