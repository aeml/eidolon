import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

for (const quality of ['high', 'low']) test(`${quality}: singleton reviewed actors preserve existing color and shadows`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1100, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const evidence = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        const owner = render.actorInstances;
        if (owner.batchSingletons !== (quality === 'high') || !owner.multiDraw?.enabled) throw Error('Quality-specific singleton owner missing');
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const multiDraw = render.renderer.extensions.has('WEBGL_multi_draw');
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x4a4842, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
        render.setZoom(18); render.applyLightingPreset('town', true);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const frozen = performance.now(), descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
        const rows = [], images = [], qualityTransitions = []; let mesh;
        const capture = (selected, imageName) => {
            owner.batchSingletons = selected && quality === 'high'; render.render(); context.drawImage(canvas, 0, 0);
            if (imageName) images.push({ name: imageName, data: copy.toDataURL('image/png').split(',')[1] });
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                restored: !owner.hidden.length && !owner.multiDraw.hidden.length && !owner.group.visible && !owner.multiDraw.group.visible };
        };
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            for (const type of ['Skeleton', 'InfernoTitan', 'DemonOrc', 'DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC']) {
                mesh = await MeshFactory.createMeshForType(type); render.entityGroup.add(mesh);
                const states = mesh.userData.animations.some(clip => clip.name === 'Run')
                    ? ['Idle', 'Run', 'Attack', 'Death', 'FarIdle', 'StretchedAttack'] : ['Idle', 'FarIdle', 'StretchedIdle'];
                for (const state of states) {
                    const offset = state === 'FarIdle' ? new THREE.Vector3(50000, 0, 20000) : new THREE.Vector3();
                    mesh.position.copy(offset); floor.position.copy(offset);
                    mesh.scale.set(...(state.startsWith('Stretched') ? [1.7, .8, 1.1] : [1, 1, 1]));
                    render.setCameraTarget(offset.clone().add(new THREE.Vector3(0, 1, 0)));
                    render.updateEnvironmentLighting(offset, 0);
                    const animation = state === 'FarIdle' ? 'Idle' : state.replace('Stretched', '');
                    const mixer = new THREE.AnimationMixer(mesh);
                    mixer.clipAction(mesh.userData.animations.find(clip => clip.name === animation)).play(); mixer.update(.37);
                    const visibility = new Map(); mesh.traverse(part => visibility.set(part, part.visible));
                    capture(false); capture(true); capture(false);
                    const reference = capture(false, `${type}-${state}-reference`), candidate = capture(true, `${type}-${state}-candidate`), again = capture(false);
                    let error = 0, changed = 0, exactChanges = 0, unstable = 0;
                    for (let i = 0; i < reference.pixels.length; i += 4) {
                        const delta = Math.max(...[0, 1, 2].map(c => Math.abs(reference.pixels[i + c] - candidate.pixels[i + c])));
                        error += delta; changed += delta > 8 ? 1 : 0; exactChanges += delta > 0 ? 1 : 0;
                        unstable += [0, 1, 2].some(c => reference.pixels[i + c] !== again.pixels[i + c]) ? 1 : 0;
                    }
                    rows.push({ type, state, reference: { calls: reference.calls, triangles: reference.triangles },
                        candidate: { calls: candidate.calls, triangles: candidate.triangles },
                        meanError: error / (copy.width * copy.height), changed: changed / (copy.width * copy.height), exactChanges, unstable,
                        restored: reference.restored && candidate.restored && again.restored && [...visibility].every(([part, visible]) => part.visible === visible) });
                    mixer.stopAllAction(); mixer.uncacheRoot(mesh); mesh.userData.resetPose();
                }
                mesh.removeFromParent(); MeshFactory.releaseMesh(type, mesh); mesh = null;
            }
            mesh = await MeshFactory.createMeshForType('QuestNPC'); render.add(mesh);
            for (const selected of ['high', 'low', 'medium', 'high']) {
                render.setGraphicsQuality(selected); render.render();
                qualityTransitions.push({ quality: selected, selected: owner.batchSingletons,
                    restored: !owner.hidden.length && !owner.multiDraw.hidden.length && !owner.group.visible });
            }
            mesh.removeFromParent(); MeshFactory.releaseMesh('QuestNPC', mesh); mesh = null;
        } finally {
            render.setGraphicsQuality(quality);
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
            mesh?.removeFromParent(); floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
        }
        return { rows, images, renderer, multiDraw, qualityTransitions };
    }, quality);
    for (const entry of evidence.images) await writeFile(testInfo.outputPath(`${entry.name}.png`), Buffer.from(entry.data, 'base64'));
    delete evidence.images;
    await writeFile(testInfo.outputPath('singleton-actor-delivery.json'), JSON.stringify(evidence, null, 2));
    if (requiresHardwareWebGL()) {
        expect(evidence.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        expect(evidence.multiDraw).toBe(true);
    }
    for (const transition of evidence.qualityTransitions) {
        expect(transition.selected).toBe(transition.quality === 'high'); expect(transition.restored).toBe(true);
    }
    const { rows } = evidence;
    expect(new Set(rows.map(row => row.type)).size).toBe(7);
    for (const row of rows) {
        const label = `${row.type} ${row.state}`;
        expect(row.meanError, label).toBeLessThan(.1); expect(row.changed, label).toBeLessThan(.001);
        expect(row.unstable, label).toBe(0); expect(row.restored, label).toBe(true);
        expect(row.candidate.calls, label).toBeLessThanOrEqual(row.reference.calls);
        expect(row.candidate.triangles, label).toBeLessThanOrEqual(row.reference.triangles);
    }
    if (quality !== 'high' || !evidence.multiDraw) for (const row of rows) {
        expect(row.exactChanges, `${row.type} ${row.state} fallback`).toBe(0);
        expect(row.candidate.calls).toBe(row.reference.calls); expect(row.candidate.triangles).toBe(row.reference.triangles);
    }
    if (quality === 'high' && evidence.multiDraw) for (const type of new Set(rows.map(row => row.type))) {
        expect(rows.some(row => row.type === type && row.candidate.calls < row.reference.calls), type).toBe(true);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
