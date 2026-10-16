import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const type of ['Skeleton', 'InfernoTitan', 'DemonOrc', 'DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC'])
for (const quality of ['high', 'low']) test(`${quality}: nearby ${type} material variants preserve independently animated color and shadows`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ quality, type }) => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        const models = [];
        for (let index = 0; index < 8; index++) {
            const mesh = await MeshFactory.createMeshForType(type);
            mesh.position.set((index % 4 - 1.5) * 4, 0, index < 4 ? -3 : 3);
            render.entityGroup.add(mesh); models.push(mesh);
        }
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true }), reports = [];
        const pool = render.actorInstances.multiDraw.materialVariantPool, qualityPolicies = [];
        for (const value of [quality, 'low', 'medium', 'high', quality]) {
            render.setGraphicsQuality(value); render.render();
            qualityPolicies.push({ quality: value, enabled: render.actorInstances.multiDraw.materialVariants, active: pool.entries.size });
        }
        const capture = variants => {
            render.actorInstances.enabled = true; render.actorInstances.multiDraw.materialVariants = variants; render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        capture(false); capture(true);
        try {
            const states = ['Skeleton', 'InfernoTitan', 'DemonOrc'].includes(type) ? ['Idle', 'Walk', 'Run', 'Attack', 'Death', 'StretchedAttack'] : ['Idle', 'StretchedIdle'];
            for (const state of states) {
                const mixers = models.map((mesh, index) => {
                    mesh.scale.set(...(state.startsWith('Stretched') ? [1.7, .8, 1.1] : [1, 1, 1]));
                    const mixer = new THREE.AnimationMixer(mesh);
                    mixer.clipAction(mesh.userData.animations.find(clip => clip.name === (state.startsWith('Stretched') ? state.slice('Stretched'.length) : state))).play();
                    mixer.update(.2 + index * .07); return mixer;
                });
                const visibility = new Map(); models.forEach(mesh => mesh.traverse(part => visibility.set(part, part.visible)));
                const before = capture(false), after = capture(true); let error = 0, changed = 0;
                for (let index = 0; index < before.pixels.length; index += 4) {
                    const delta = Math.max(...[0, 1, 2].map(c => Math.abs(before.pixels[index + c] - after.pixels[index + c])));
                    error += delta; if (delta > 0) changed++;
                }
                let shearedLeaves = 0;
                const columns = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
                const sheared = matrix => {
                    columns.forEach((column, index) => column.setFromMatrixColumn(matrix, index).normalize());
                    return Math.max(Math.abs(columns[0].dot(columns[1])), Math.abs(columns[0].dot(columns[2])),
                        Math.abs(columns[1].dot(columns[2]))) > 1e-7;
                };
                for (const mesh of models) mesh.traverse(part => {
                    if (part.isMesh && !part.isInstancedMesh && sheared(part.matrixWorld)) shearedLeaves++;
                });
                let unsafeInstances = 0;
                const instanceMatrix = new THREE.Matrix4();
                for (const batch of render.actorInstances.batches.values()) for (let index = 0; index < batch.count; index++) {
                    batch.getMatrixAt(index, instanceMatrix);
                    if (sheared(instanceMatrix)) unsafeInstances++;
                }
                reports.push({ state, shearedLeaves, unsafeInstances, beforeCalls: before.calls, afterCalls: after.calls,
                    beforeTriangles: before.triangles, afterTriangles: after.triangles,
                    meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height),
                    visibilityRestored: [...visibility].every(([part, visible]) => part.visible === visible) });
                mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
                models.forEach(mesh => mesh.userData.resetPose());
            }
        } finally {
            render.setActorInstancesEnabled(false);
            models.forEach(mesh => { mesh.removeFromParent(); MeshFactory.releaseMesh(type, mesh); });
            floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return { reports, qualityPolicies, materials: { created: pool.created, retired: pool.retired, remaining: pool.entries.size } };
    }, { quality, type });
    await writeFile(testInfo.outputPath(`${type}-instance-comparison.json`), JSON.stringify(result, null, 2));
    await testInfo.attach('skeleton-instance-comparison', { body: JSON.stringify(result), contentType: 'application/json' });
    for (const row of result.reports) {
        expect(row.afterCalls).toBe(row.beforeCalls);
        expect(row.afterTriangles).toBe(row.beforeTriangles);
        expect(row.meanError).toBe(0); expect(row.changed).toBe(0);
        expect(row.visibilityRestored).toBe(true);
        expect(row.unsafeInstances).toBe(0);
        if (row.state.startsWith('Stretched')) expect(row.shearedLeaves).toBeGreaterThan(0);
    }
    expect(result.materials.created).toBeGreaterThan(0);
    expect(result.materials.retired).toBe(result.materials.created); expect(result.materials.remaining).toBe(0);
    for (const policy of result.qualityPolicies) {
        expect(policy.enabled).toBe(policy.quality === 'high');
        if (policy.quality === 'high') expect(policy.active).toBeGreaterThan(0);
        else expect(policy.active).toBe(0);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
