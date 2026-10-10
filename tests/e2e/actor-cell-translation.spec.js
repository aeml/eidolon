import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`${quality}: cell translation preserves native matrices, surfaces and shadows`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { compareActorCellTranslation } = await import('/tests/e2e/actor-cell-translation-comparison.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x4a4842 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        const models = [], samples = [], lifetime = [];
        try {
            for (const type of ['Skeleton', 'InfernoTitan', 'DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC']) {
                for (let i = 0; i < 4; i++) {
                    const root = await MeshFactory.createMeshForType(type);
                    const position = new THREE.Vector3(i * 3 - 4.5, 0, models.length / 4 * 3 - 7.5);
                    root.position.copy(position); render.entityGroup.add(root); models.push({ root, type, position });
                }
            }
            render.setZoom(22); render.applyLightingPreset('town', true);
            for (const state of ['Idle', 'Attack', 'Stretched', 'FarRealm', 'NegativeCellBoundary']) {
                const offset = state === 'FarRealm' ? new THREE.Vector3(50000.123, 0, 20000.456)
                    : state === 'NegativeCellBoundary' ? new THREE.Vector3(-32.00001, 0, -32.00001) : new THREE.Vector3();
                floor.position.copy(offset); render.setCameraTarget(offset.clone().add(new THREE.Vector3(0, 1, 0)));
                render.updateEnvironmentLighting(offset, 0);
                const mixers = models.map(({ root, position }, i) => {
                    root.position.copy(position).add(offset);
                    root.scale.set(...(state === 'Stretched' ? [1.7, .8, 1.1] : [1, 1, 1]));
                    const mixer = new THREE.AnimationMixer(root), clips = root.userData.animations;
                    mixer.clipAction(clips.find(clip => clip.name === (state === 'Attack' ? 'Attack' : 'Idle')) || clips[0]).play();
                    mixer.update(.2 + i * .07); return mixer;
                });
                samples.push({ state, ...compareActorCellTranslation(render, state === 'Idle') });
                mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
                models.forEach(({ root }) => root.userData.resetPose());
                lifetime.push({ geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures,
                    programs: render.renderer.info.programs.length });
            }
            return { quality, renderer, samples, lifetime,
                writerRestored: !Object.hasOwn(render.actorInstances, 'writeCellMatrix') };
        } finally {
            render.setActorInstancesEnabled(false);
            models.forEach(({ root, type }) => { root.removeFromParent(); MeshFactory.releaseMesh(type, root); });
            floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
    }, quality);
    await writeFile(testInfo.outputPath('cell-translation.json'), JSON.stringify(result, null, 2));
    expect(result.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(result.writerRestored).toBe(true);
    for (const row of result.samples) {
        expect(row.image.changedChannels).toBe(0); expect(row.image.unstableChannels).toBe(0);
        expect(row.matrices.matrixDifferences).toBe(0); expect(row.matrices.batches).toBeGreaterThan(0);
        expect(row.reference).toEqual(row.candidate); expect(row.reference).toEqual(row.again);
        expect(row.reference.restored).toBe(true);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
