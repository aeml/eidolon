import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) for (const type of ['Skeleton', 'InfernoTitan', 'DwarfSalesman', 'QuestNPC', 'DungeonNPC', 'RespecNPC']) {
    test(`${quality}: ${type} view filtering preserves exact visible surfaces and incoming shadows`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width: 1100, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        const { sourcePNG, candidatePNG, ...report } = await page.evaluate(async ({ quality, type }) => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const { ActorInstanceView } = await import('/src/art/ActorInstanceView.js');
            document.getElementById('start-screen').style.display = 'none';
            const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x4a4842 }));
            floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; render.scene.add(floor);
            const locations = [[0, 0, 0], [4, 0, 0], [-22, 25, 10], [-26, 25, 10],
                [-65, 0, -4], [-69, 0, 0], [65, 0, 0], [69, 0, 4], [0, 0, -65], [4, 0, -69]];
            const models = [];
            for (const location of locations) {
                const root = await MeshFactory.createMeshForType(type); root.position.fromArray(location);
                render.entityGroup.add(root); models.push(root);
            }
            render.setZoom(18); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
            render.applyLightingPreset('town', true); render.updateEnvironmentLighting(new THREE.Vector3(), 0);
            const view = new ActorInstanceView(), instances = render.actorInstances;
            // Compare the qualified rigid view algorithm independently. Low's
            // default owned selection is checked by the real-party comparison.
            instances.lowColorViewEnabled = false;
            const canvas = render.renderer.domElement, copy = document.createElement('canvas');
            copy.width = canvas.width; copy.height = canvas.height;
            const context = copy.getContext('2d', { willReadFrequently: true });
            const capture = enabled => {
                instances.viewFilter = enabled ? view : null; render.render(); context.drawImage(canvas, 0, 0);
                return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                    calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles, stats: { ...view.stats } };
            };
            const compare = () => {
                const source = capture(false), candidate = capture(true), again = capture(false);
                let changedChannels = 0, unstableChannels = 0, maximumChannel = 0;
                for (let i = 0; i < source.pixels.length; i += 4) for (let c = 0; c < 3; c++) {
                    const error = Math.abs(source.pixels[i + c] - candidate.pixels[i + c]);
                    changedChannels += error !== 0 ? 1 : 0; maximumChannel = Math.max(maximumChannel, error);
                    unstableChannels += source.pixels[i + c] !== again.pixels[i + c] ? 1 : 0;
                }
                return { source: { calls: source.calls, triangles: source.triangles }, candidate: { calls: candidate.calls,
                    triangles: candidate.triangles, stats: candidate.stats }, changedChannels, unstableChannels, maximumChannel };
            };
            const original = new Map(); models.forEach(root => root.traverse(part => original.set(part, part.visible)));
            const states = ['Skeleton', 'InfernoTitan'].includes(type) ? ['Idle', 'Walk', 'Run', 'Attack', 'Death', 'StretchedAttack', 'FarRealmIdle', 'CellBoundaryIdle'] : ['Idle', 'StretchedIdle', 'FarRealmIdle', 'CellBoundaryIdle'];
            const samples = [], lifetime = [];
            let sourcePNG, candidatePNG, failureRestored = false;
            try {
                capture(false); capture(true);
                for (const state of states) {
                    const offset = state === 'FarRealmIdle' ? new THREE.Vector3(50000, 0, 20000) : new THREE.Vector3();
                    const mixers = models.map((root, i) => {
                        root.position.fromArray(locations[i]).add(offset);
                        if (state === 'CellBoundaryIdle' && i < 2) root.position.set(i === 0 ? 31.9999 : -31.9999, 0, 0);
                        root.scale.set(...(state.startsWith('Stretched') ? [1.7, .8, 1.1] : [1, 1, 1]));
                        const mixer = new THREE.AnimationMixer(root), animation = state.startsWith('Stretched') ? state.slice(9) : ['FarRealmIdle', 'CellBoundaryIdle'].includes(state) ? 'Idle' : state;
                        mixer.clipAction(root.userData.animations.find(clip => clip.name === animation)).play(); mixer.update(.2 + i * .07);
                        return mixer;
                    });
                    floor.position.copy(offset); render.setCameraTarget(offset.clone().add(new THREE.Vector3(state === 'CellBoundaryIdle' ? -29 : 0, 1, 0)));
                    render.updateEnvironmentLighting(offset, 0);
                    const result = compare();
                    result.visibilityRestored = [...original].every(([part, visible]) => part.visible === visible);
                    samples.push({ state, ...result });
                    if (state === 'Idle') {
                        capture(false); sourcePNG = canvas.toDataURL('image/png');
                        capture(true); candidatePNG = canvas.toDataURL('image/png');
                    }
                    mixers.forEach(mixer => { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); });
                    models.forEach(root => root.userData.resetPose());
                }
                models.forEach((root, i) => { root.position.fromArray(locations[i]); root.scale.set(1, 1, 1); });
                floor.position.set(0, 0, 0); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
                render.updateEnvironmentLighting(new THREE.Vector3(), 0);
                const point = new THREE.PointLight(); point.castShadow = true; point.position.set(0, 8, 0); render.scene.add(point);
                if (quality === 'high') samples.push({ state: 'UnknownPointShadow', ...compare() });
                point.removeFromParent(); point.dispose();
                for (let cycle = 0; cycle < 4; cycle++) {
                    capture(true); capture(false);
                    lifetime.push({ geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures,
                        programs: render.renderer.info.programs.length });
                }
                const originalHook = floor.onBeforeRender;
                floor.onBeforeRender = () => { throw Error('actor-view-draw-failure'); };
                instances.viewFilter = view;
                try { render.render(); } catch (error) {
                    if (error.message !== 'actor-view-draw-failure') throw error;
                    failureRestored = instances.hidden.length === 0 && !instances.group.visible && [...original].every(([part, visible]) => part.visible === visible);
                } finally { floor.onBeforeRender = originalHook; }
                capture(true);
            } finally {
                instances.viewFilter = null; view.dispose(); render.setActorInstancesEnabled(false);
                models.forEach(root => { root.removeFromParent(); MeshFactory.releaseMesh(type, root); });
                floor.removeFromParent(); render.disposeObjectResources(floor); render.dispose();
            }
            return { quality, type, renderer, samples, lifetime, failureRestored, sourcePNG, candidatePNG };
        }, { quality, type });
        await writeFile(testInfo.outputPath('actor-view-review.json'), JSON.stringify(report, null, 2));
        await writeFile(testInfo.outputPath('source.png'), Buffer.from(sourcePNG.split(',')[1], 'base64'));
        await writeFile(testInfo.outputPath('candidate.png'), Buffer.from(candidatePNG.split(',')[1], 'base64'));
        expect(report.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        for (const row of report.samples) {
            expect(row.changedChannels).toBe(0); expect(row.unstableChannels).toBe(0);
            expect(row.candidate.calls).toBeLessThanOrEqual(row.source.calls);
            expect(row.candidate.triangles).toBeLessThanOrEqual(row.source.triangles);
            if (row.visibilityRestored !== undefined) expect(row.visibilityRestored).toBe(true);
            if (row.state === 'UnknownPointShadow') expect(row.candidate.stats.unknownShadow).toBe(true);
        }
        expect(report.samples.some(row => row.candidate.stats.culled > 0)).toBe(true);
        for (const row of report.lifetime) expect(row).toEqual(report.lifetime[0]);
        expect(report.failureRestored).toBe(true);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
