import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

const costOnly = process.env.EIDOLON_E2E_ELEMENTAL_COST === '1';
const creatures = [
    ['SandstormDjinn', 'fire', 23], ['MagmaGolem', 'fire', 32], ['ScorchedWraith', 'fire', 23],
    ['InfernalBehemoth', 'fire', 22], ['PhoenixSentinel', 'fire', 23], ['StormHarpy', 'air', 33],
    ['CloudElemental', 'air', 23], ['ThunderRoc', 'air', 23], ['TempestGiant', 'air', 28], ['CycloneAvatar', 'air', 24]
];
for (const framing of costOnly ? ['group'] : ['group', 'close']) for (const [type, realm, drawMeshes] of creatures) for (const quality of ['high', 'low'])
    test(`${costOnly ? 'cost' : framing} ${quality} ${type} rigid siblings preserve the animated surfaces`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        const evidence = await page.evaluate(async ({ type, quality, framing, costOnly, realm }) => {
            const THREE = await import('three');
            const { RenderSystem } = await import('/src/core/RenderSystem.js');
            const recipes = await import('/src/art/ProceduralOverworldEnemies.js');
            const { MeshFactory } = await import('/src/utils/MeshFactory.js');
            const make = recipes[`createProcedural${type}`];
            document.getElementById('start-screen').style.display = 'none';
            const system = new RenderSystem(quality === 'low'); system.setGraphicsQuality(quality);
            const offset = realm === 'fire' ? new THREE.Vector3(-1252, 0, 200) : new THREE.Vector3(1968, 0, 130);
            const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x454342, roughness: 1 }));
            floor.rotation.x = -Math.PI / 2; floor.position.copy(offset); floor.receiveShadow = true; system.scene.add(floor);
            const groups = [new THREE.Group(), new THREE.Group()], models = [], rows = [], images = [];
            for (let variant = 0; variant < 2; variant++) for (let i = 0; i < 4; i++) {
                const root = variant ? await MeshFactory.createMeshForType(type) : make({ batch: false });
                groups[variant].add(root); models.push({ root, index: i, variant });
            }
            system.entityGroup.add(...groups);
            system.setZoom(framing === 'close' ? 8 : quality === 'low' ? 32 : 16);
            system.setCameraTarget(offset.clone().add(framing === 'close' ? new THREE.Vector3(-3, 1, -3) : new THREE.Vector3(0, 1, 0)));
            system.applyLightingPreset(system.getRealmForPosition(offset), true);
            system.updateEnvironmentLighting(offset, 0);
            const lightingRealm = system.currentRealm;
            const gl = system.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            const factoryModels = models.filter(m => m.variant === 1).map(({ root }) => ({
                type: root.userData.proceduralActorType, batches: root.userData.humanoidRenderBatches,
                fallback: Boolean(root.userData.assetFallback)
            }));
            const canvas = system.renderer.domElement, copy = document.createElement('canvas');
            copy.width = canvas.width; copy.height = canvas.height;
            const context = copy.getContext('2d', { willReadFrequently: true });
            const capture = variant => {
                groups.forEach((group, i) => { group.visible = variant === i; });
                system.render(); context.drawImage(canvas, 0, 0);
                return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                    calls: system.renderer.info.render.calls, triangles: system.renderer.info.render.triangles };
            };
            const difference = (a, b) => {
                let total = 0, changed = 0, exactChanges = 0, maximumChannelError = 0;
                for (let i = 0; i < a.length; i += 4) {
                    const delta = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
                    total += delta; changed += Number(delta > 8); exactChanges += Number(delta > 0);
                    maximumChannelError = Math.max(maximumChannelError, delta);
                }
                return { meanError: total / (copy.width * copy.height), changed: changed / (copy.width * copy.height), exactChanges, maximumChannelError };
            };
            let canvasRetired = false;
            if (costOnly) {
                const { measureElementalRenderCost } = await import('/tests/e2e/elemental-render-cost.js');
                let cost;
                try { cost = await measureElementalRenderCost({ THREE, system, groups, models, offset }); }
                finally { system.dispose(); canvasRetired = !canvas.isConnected; }
                return { cost, rows: [], images: [], canvasRetired, renderer, quality: system.graphicsQuality, lightingRealm, factoryModels };
            }
            try {
                capture(0); capture(1); capture(0);
                for (const state of ['Idle', 'Walk', 'Run', 'Attack', 'Death']) for (const phase of [.15, .55]) for (let view = 0; view < 3; view++) {
                    const mixers = models.map(({ root, index }) => {
                        root.userData.resetPose();
                        root.visible = framing !== 'close' || index === 0;
                        const mixer = new THREE.AnimationMixer(root), clip = THREE.AnimationClip.findByName(root.userData.animations, state);
                        const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
                        mixer.setTime(clip.duration * (phase + index * .06));
                        root.position.set((index % 2 ? 1 : -1) * 3, 0, index < 2 ? -3 : 3).add(offset);
                        root.rotation.y = [0, -Math.PI / 3, Math.PI / 2][view];
                        root.updateMatrixWorld(true); return mixer;
                    });
                    const empty = capture(-1), source = capture(0), candidate = capture(1);
                    if (phase === .55 && view === 0) images.push({ name: `${state}-${type}-${quality}.png`, data: canvas.toDataURL('image/png').split(',')[1] });
                    const restored = capture(0);
                    rows.push({ state, phase, view, source: { calls: source.calls, triangles: source.triangles },
                        candidate: { calls: candidate.calls, triangles: candidate.triangles, ...difference(source.pixels, candidate.pixels) },
                        referenceAgain: difference(source.pixels, restored.pixels), foregroundPixels: difference(source.pixels, empty.pixels).exactChanges });
                    mixers.forEach((mixer, i) => { mixer.stopAllAction(); mixer.uncacheRoot(models[i].root); });
                }
            } finally { system.dispose(); canvasRetired = !canvas.isConnected; }
            return { rows, images, canvasRetired, renderer, quality: system.graphicsQuality, framing, lightingRealm, factoryModels };
        }, { type, quality, framing, costOnly, realm });
        for (const entry of evidence.images) await writeFile(testInfo.outputPath(entry.name), Buffer.from(entry.data, 'base64'));
        delete evidence.images;
        await writeFile(testInfo.outputPath('elemental-rigid-parts.json'), JSON.stringify(evidence, null, 2));
        expect(evidence.rows).toHaveLength(costOnly ? 0 : 30);
        expect(evidence.quality).toBe(quality);
        expect(evidence.lightingRealm).toBe(realm);
        expect(evidence.factoryModels).toHaveLength(4);
        for (const model of evidence.factoryModels) {
            expect(model.type).toBe(type); expect(model.fallback).toBe(false);
            expect(model.batches.drawMeshes).toBe(drawMeshes);
        }
        for (const row of evidence.rows) {
            const label = `${row.state}/${row.phase}/${row.view}`;
            // Same pre-existing native rigid-constructor thresholds as DemonOrc.
            expect(row.candidate.meanError, label).toBeLessThan(.1);
            expect(row.candidate.changed, label).toBeLessThan(.001);
            expect(row.referenceAgain.exactChanges, label).toBe(0);
            expect(row.foregroundPixels, label).toBeGreaterThan(1000);
            expect(row.candidate.calls, label).toBeLessThan(row.source.calls);
            expect(row.candidate.triangles, label).toBe(row.source.triangles);
        }
        if (costOnly) {
            expect(evidence.cost.restored).toBe(true);
            expect(evidence.cost.windows.map(w => w.variant)).toEqual([0, 1, 1, 0]);
            for (const window of evidence.cost.windows) {
                expect(window.samples).toHaveLength(32);
                expect(window.samples.every(s => s.visibility === 'visible')).toBe(true);
            }
            const source = evidence.cost.windows.filter(w => w.variant === 0), candidate = evidence.cost.windows.filter(w => w.variant === 1);
            for (const row of candidate) {
                expect(row.callsMedian).toBeLessThan(Math.min(...source.map(w => w.callsMedian)));
                expect(row.trianglesMedian).toBe(source[0].trianglesMedian);
            }
        }
        expect(evidence.canvasRetired).toBe(true);
        expect(failures, failures.join('\n')).toEqual([]);
    });
