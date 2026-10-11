import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const type of ['InfernoTitan', 'DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC'])
for (const quality of ['high', 'low']) test(`${quality}: nearby ${type} packed surfaces preserve independently animated color and shadow surfaces`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const reports = await page.evaluate(async ({ quality, type }) => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const town = await import('/src/art/ProceduralTownActors.js');
        const enemy = await import('/src/art/ProceduralLegacyEnemies.js');
        const make = options => type === 'InfernoTitan' ? enemy.createProceduralInfernoTitan(options) : town.createProceduralTownActor(type, options);
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        const models = [], groups = [new THREE.Group(), new THREE.Group()];
        for (const [variant, group] of groups.entries()) for (let index = 0; index < 8; index++) {
            const mesh = make({ batch: true, surfaceAttributes: variant === 1 });
            mesh.position.set((index % 4 - 1.5) * 4, 0, index < 4 ? -3 : 3);
            group.add(mesh); models.push(mesh);
        }
        render.entityGroup.add(...groups);
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true }), reports = [];
        const capture = enabled => {
            groups[0].visible = !enabled; groups[1].visible = enabled; render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        capture(false); capture(true);
        try {
            const states = ['Skeleton', 'InfernoTitan'].includes(type) ? ['Idle', 'Walk', 'Run', 'Attack', 'Death', 'StretchedAttack'] : ['Idle', 'StretchedIdle'];
            for (const state of states) {
                const mixers = models.map((mesh, index) => {
                    mesh.scale.set(...(state.startsWith('Stretched') ? [1.7, .8, 1.1] : [1, 1, 1]));
                    const mixer = new THREE.AnimationMixer(mesh);
                    mixer.clipAction(mesh.userData.animations.find(clip => clip.name === (state.startsWith('Stretched') ? state.slice('Stretched'.length) : state))).play();
                    mixer.update(.2 + (index % 8) * .07); return mixer;
                });
                const visibility = new Map(); models.forEach(mesh => mesh.traverse(part => visibility.set(part, part.visible)));
                const before = capture(false), after = capture(true); let error = 0, changed = 0;
                for (let index = 0; index < before.pixels.length; index += 4) {
                    const delta = Math.max(...[0, 1, 2].map(c => Math.abs(before.pixels[index + c] - after.pixels[index + c])));
                    error += delta; if (delta > 8) changed++;
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
            groups.forEach(group => group.removeFromParent());
            floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return reports;
    }, { quality, type });
    await writeFile(testInfo.outputPath(`${type}-surface-comparison.json`), JSON.stringify(reports, null, 2));
    await testInfo.attach('rigid-surface-comparison', { body: JSON.stringify(reports), contentType: 'application/json' });
    for (const row of reports) {
        expect(row.afterCalls).toBeLessThan(row.beforeCalls);
        expect(row.afterTriangles).toBe(row.beforeTriangles);
        expect(row.meanError).toBeLessThan(.1); expect(row.changed).toBeLessThan(.001);
        expect(row.visibilityRestored).toBe(true);
        expect(row.unsafeInstances).toBe(0);
        if (row.state.startsWith('Stretched')) expect(row.shearedLeaves).toBeGreaterThan(0);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
