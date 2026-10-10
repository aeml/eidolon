import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { compareActorFrameStorage } from './actor-frame-storage-comparison.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`actor frame storage preserves exact ${quality} color/shadows and changing live eligibility`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.goto('/');
    await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { createProceduralSkeleton, createProceduralInfernoTitan } = await import('/src/art/ProceduralLegacyEnemies.js');
        const { createProceduralTownActor } = await import('/src/art/ProceduralTownActors.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = window.__frameStorageRender = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x4a4842 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        const makers = [createProceduralSkeleton, createProceduralInfernoTitan,
            ...['DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC'].map(type => options => createProceduralTownActor(type, options))];
        const models = makers.flatMap((make, row) => [0, 1, 2].map(index => {
            const root = make({ batch: true, surfaceAttributes: true });
            root.position.set((index - 1) * 4, 0, (row - 2.5) * 4); render.entityGroup.add(root); return root;
        }));
        render.setZoom(23); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
        window.__frameStorageModels = models; window.__frameStorageFloor = floor;
    }, quality);
    const reports = [];
    try {
        for (const phase of ['Idle', 'Attack', 'Stretched', 'Hidden', 'Restored']) {
            await page.evaluate(async phase => {
                const THREE = await import('three');
                for (const mixer of window.__frameStorageMixers || []) { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }
                window.__frameStorageMixers = window.__frameStorageModels.map((root, index) => {
                    root.userData.resetPose(); root.scale.set(1, 1, 1); root.visible = true;
                    if (phase === 'Stretched') root.scale.set(1.7, .8, 1.1);
                    if (phase === 'Hidden' && index % 3 === 0) root.visible = false;
                    const clip = root.userData.animations.find(clip => clip.name === (phase === 'Attack' ? 'Attack' : 'Idle')) || root.userData.animations[0];
                    const mixer = new THREE.AnimationMixer(root); mixer.clipAction(clip).play();
                    mixer.update(.2 + index * .07); return mixer;
                });
            }, phase);
            const paired = await compareActorFrameStorage(page);
            reports.push({ phase, ...paired });
            expect(paired.image.changedChannels).toBe(0); expect(paired.image.unstableChannels).toBe(0);
            expect(paired.candidate.calls).toBe(paired.reference.calls); expect(paired.candidate.triangles).toBe(paired.reference.triangles);
            expect(paired.referenceAgain).toEqual(paired.reference); expect(paired.reference.batches).toBeGreaterThan(0);
            for (const row of [paired.reference, paired.candidate, ...paired.cpu.blocks]) expect(row.restored).toBe(true);
        }
    } finally {
        await writeFile(testInfo.outputPath('actor-frame-storage.json'), JSON.stringify({ quality, reports }, null, 2));
        await page.evaluate(() => {
            for (const mixer of window.__frameStorageMixers || []) { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }
            window.__frameStorageRender.dispose(); delete window.__frameStorageRender; });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
