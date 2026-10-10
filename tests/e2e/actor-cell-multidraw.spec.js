import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: actor cell multi-draw preserves exact existing instance pixels and bucket culling`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { ActorInstanceMultiDraw } = await import('/src/art/ActorInstanceMultiDraw.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const owner = render.actorInstances;
        owner.multiDraw = new ActorInstanceMultiDraw(owner.group);
        if (!render.renderer.extensions.has('WEBGL_multi_draw')) throw Error('Actual native multi-draw extension required');
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.position.set(-128, 0, -192); floor.receiveShadow = true; render.scene.add(floor);
        const models = [];
        for (const type of ['Skeleton', 'InfernoTitan', 'DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC']) {
            for (let i = 0; i < (type === 'Skeleton' ? 9 : 3); i++) {
                const mesh = await MeshFactory.createMeshForType(type);
                const cell = i % 3;
                mesh.position.set(-128 + Math.floor(i / 3) * 4 - 4 + models.length % 2,
                    0, -128 - cell * 64 + (type === 'Skeleton' ? -2 : 5 + models.length % 3));
                render.entityGroup.add(mesh); models.push({ type, mesh, position: mesh.position.clone() });
            }
        }
        render.setZoom(18); render.setCameraTarget(new THREE.Vector3(-128, 1, -192));
        render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(-128, 0, -192), 0);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true }), reports = [];
        const capture = enabled => {
            owner.multiDraw.enabled = enabled; render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures,
                restored: !owner.hidden.length && !owner.group.visible && !owner.multiDraw.hidden.length && !owner.multiDraw.group.visible };
        };
        let image;
        try {
            for (const state of ['Idle', 'Run', 'Attack', 'Death', 'FarRealmRun', 'ShearedAttack']) {
                const offset = state === 'FarRealmRun' ? new THREE.Vector3(50000, 0, 20000) : new THREE.Vector3();
                const mixers = models.map(({ mesh, position }, i) => {
                    mesh.position.copy(position).add(offset); mesh.scale.set(...(state === 'ShearedAttack' ? [1.7, .8, 1.1] : [1, 1, 1]));
                    const name = state === 'FarRealmRun' ? 'Run' : state === 'ShearedAttack' ? 'Attack' : state;
                    const clip = mesh.userData.animations.find(clip => clip.name === name) || mesh.userData.animations.find(clip => clip.name === 'Idle');
                    const mixer = new THREE.AnimationMixer(mesh); mixer.clipAction(clip).play(); mixer.update(.2 + i * .073); return mixer;
                });
                floor.position.copy(offset).add(new THREE.Vector3(-128, 0, -192));
                render.setCameraTarget(offset.clone().add(new THREE.Vector3(-128, 1, -192)));
                render.updateEnvironmentLighting(offset.clone().add(new THREE.Vector3(-128, 0, -192)), 0);
                const frozen = performance.now(), descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
                let before, after, again, entries;
                try {
                    Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
                    capture(false); capture(true); capture(false);
                    before = capture(false); after = capture(true);
                    entries = owner.multiDraw.entries.size;
                    if (state === 'Idle') image = canvas.toDataURL('image/png');
                    again = capture(false);
                } finally {
                    if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
                }
                let changedRGB = 0, unstableRGB = 0;
                for (let i = 0; i < before.pixels.length; i++) if (i % 4 !== 3) {
                    changedRGB += before.pixels[i] !== after.pixels[i] ? 1 : 0;
                    unstableRGB += before.pixels[i] !== again.pixels[i] ? 1 : 0;
                }
                const strip = ({ pixels: _pixels, ...counts }) => counts;
                reports.push({ state, changedRGB, unstableRGB, entries, before: strip(before), after: strip(after), again: strip(again) });
                mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
                models.forEach(({ mesh }) => mesh.userData.resetPose());
            }
        } finally {
            render.setActorInstancesEnabled(false);
            models.forEach(({ type, mesh }) => { mesh.removeFromParent(); MeshFactory.releaseMesh(type, mesh); });
            floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return { reports, image };
    }, quality);
    await writeFile(testInfo.outputPath('actor-cell-multidraw.json'), JSON.stringify(result.reports, null, 2));
    await writeFile(testInfo.outputPath('actor-cell-multidraw.png'), Buffer.from(result.image.split(',')[1], 'base64'));
    for (const row of result.reports) {
        expect(row.changedRGB, row.state).toBe(0); expect(row.unstableRGB, row.state).toBe(0);
        expect(row.after.triangles, row.state).toBe(row.before.triangles);
        if (row.state === 'ShearedAttack') expect(row.after.calls).toBeLessThanOrEqual(row.before.calls);
        else { expect(row.entries, row.state).toBeGreaterThan(0); expect(row.after.calls, row.state).toBeLessThan(row.before.calls); }
        for (const phase of [row.before, row.after, row.again]) expect(phase.restored).toBe(true);
        expect(row.again.geometries).toBe(row.before.geometries); expect(row.again.textures).toBe(row.before.textures);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
