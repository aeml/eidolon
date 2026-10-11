import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { prepareGameplayBodyPilot } from './gameplay-body-lod-pilot.js';
import { prepareGameplayColorPilot } from './gameplay-color-lod-pilot.js';

export async function prepareGameplayGeometryLifecycle(page, kind) {
    if (process.env.EIDOLON_E2E_GAMEPLAY_COLOR_COLLARS !== '1') throw Error('Reviewed collar/seam constraints required');
    const body = await prepareGameplayBodyPilot(page, kind);
    const color = await prepareGameplayColorPilot(page, kind);
    const installed = await page.evaluate(async kind => {
        const { ActorGameplayGeometry } = await import('/src/core/ActorGameplayGeometry.js');
        const qa = window.__classGear, render = window.game?.renderSystem;
        const renderer = kind === 'gallery' ? qa.renderer : render.renderer;
        const scene = kind === 'gallery' ? qa.scene : render.scene;
        const camera = kind === 'gallery' ? qa.camera : render.camera;
        const pass = new ActorGameplayGeometry(renderer, scene, camera), registrations = [];
        try {
            for (const pilot of [window.__gameplayBodyPilot, window.__gameplayColorPilot]) {
                for (const entry of pilot.meshes.values()) {
                    if (!pass.register(entry.mesh, entry.candidate.index.array)) throw Error(`Rejected prepared ${entry.mesh.name}`);
                    registrations.push({ mesh: entry.mesh, indices: entry.candidate.index.array.slice() });
                }
                pilot.dispose();
            }
            delete window.__gameplayBodyPilot; delete window.__gameplayColorPilot;
            window.__gameplayGeometryLifecycle = { pass, registrations };
            return { registered: pass.entries.size, thresholds: { enterPixels: pass.enterPixels, exitPixels: pass.exitPixels },
                originalTriangles: [...pass.entries.values()].reduce((sum, entry) => sum + entry.source.index.count / 3, 0),
                candidateTriangles: [...pass.entries.values()].reduce((sum, entry) => sum + entry.candidate.index.count / 3, 0) };
        } catch (error) { pass.dispose(); throw error; }
    }, kind);
    return { body: { ...body, derivatives: body.derivatives.map(({ indices: _indices, ...row }) => row) },
        color: { ...color, derivatives: color.derivatives.map(({ indices: _indices, ...row }) => row) }, installed };
}

export async function captureGameplayGeometryLifecycle(page, testInfo) {
    await page.evaluate(async () => {
        const THREE = await import('three'), qa = window.__classGear;
        qa.lifecycleCamera = qa.camera;
        qa.camera = new THREE.OrthographicCamera(-24, 24, 15, -15, .1, 2000);
    });
    let preparation;
    const samples = [], images = [];
    try {
        preparation = await prepareGameplayGeometryLifecycle(page, 'gallery');
        expect(preparation.body.sources).toBe(8);
        for (const quality of ['high', 'low']) for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
            for (const pose of ['CombatIdle', 'Run', 'Attack', 'Blink']) for (const zoom of [5, 15]) {
                const { sourcePNG, candidatePNG, ...row } = await page.evaluate(({ quality, actorClass, pose, zoom }) => {
                    const qa = window.__classGear, { pass } = window.__gameplayGeometryLifecycle;
                    const entry = qa.actors.find(row => row.type === actorClass && row.quality === quality);
                    for (const other of qa.actors) other.root.visible = other === entry;
                    Object.assign(qa.camera, { left: -zoom * 1.6, right: zoom * 1.6, top: zoom, bottom: -zoom });
                    qa.camera.position.copy(entry.root.position).add({ x: 0, y: 18, z: 24 });
                    qa.camera.lookAt(entry.root.position.clone().add({ x: 0, y: 1.8, z: 0 })); qa.camera.updateProjectionMatrix();
                    qa.sample(pose === 'Blink' ? 'CombatIdle' : pose, pose === 'Attack' ? 14 / 30 : .3, pose === 'Run' ? Math.PI : .5);
                    if (pose === 'Blink') entry.root.traverse(mesh => {
                        for (const [name, influence] of [['Blink_L', .75], ['Blink_R', .25]]) {
                            const index = mesh.morphTargetDictionary?.[name];
                            if (index !== undefined) mesh.morphTargetInfluences[index] = influence;
                        }
                    });
                    const canvas = qa.renderer.domElement, copy = document.createElement('canvas');
                    copy.width = canvas.width; copy.height = canvas.height;
                    const context = copy.getContext('2d', { willReadFrequently: true });
                    const draw = enabled => {
                        pass.enabled = enabled; qa.renderer.render(qa.scene, qa.camera); context.drawImage(canvas, 0, 0);
                        return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                            calls: qa.renderer.info.render.calls, triangles: qa.renderer.info.render.triangles,
                            swaps: pass.lastSwaps, restored: [...pass.entries.values()].every(entry => entry.mesh.geometry === entry.source) };
                    };
                    draw(false); draw(true); draw(false);
                    const reference = draw(false), sourcePNG = pose === 'CombatIdle' ? canvas.toDataURL() : null;
                    const candidate = draw(true), candidatePNG = pose === 'CombatIdle' ? canvas.toDataURL() : null;
                    const again = draw(false);
                    let changedPixels = 0, unstableChannels = 0, maximumChannel = 0;
                    for (let i = 0; i < reference.pixels.length; i += 4) {
                        let changed = false;
                        for (let channel = 0; channel < 4; channel++) {
                            const delta = Math.abs(reference.pixels[i + channel] - candidate.pixels[i + channel]);
                            changed ||= delta !== 0; maximumChannel = Math.max(maximumChannel, delta);
                            unstableChannels += reference.pixels[i + channel] !== again.pixels[i + channel] ? 1 : 0;
                        }
                        changedPixels += changed ? 1 : 0;
                    }
                    const strip = ({ pixels: _pixels, ...row }) => row;
                    return { quality, actorClass, pose, zoom, changedPixels, unstableChannels, maximumChannel,
                        reference: strip(reference), candidate: strip(candidate), again: strip(again), sourcePNG, candidatePNG };
                }, { quality, actorClass, pose, zoom });
                expect(row.unstableChannels).toBe(0);
                expect(row.reference.restored && row.candidate.restored && row.again.restored).toBe(true);
                expect(row.candidate.calls).toBe(row.reference.calls);
                if (zoom === 5) { expect(row.changedPixels).toBe(0); expect(row.candidate.swaps).toBe(0); }
                else { expect(row.candidate.triangles).toBeLessThan(row.reference.triangles); expect(row.candidate.swaps).toBeGreaterThan(0); }
                samples.push(row);
                if (sourcePNG) {
                    const stem = `${quality}-${actorClass}-zoom${zoom}`;
                    await writeFile(testInfo.outputPath(`${stem}-source.png`), Buffer.from(sourcePNG.split(',')[1], 'base64'));
                    await writeFile(testInfo.outputPath(`${stem}-candidate.png`), Buffer.from(candidatePNG.split(',')[1], 'base64'));
                    images.push(stem);
                }
            }
        }
        const lifecycle = await page.evaluate(async () => {
            const qa = window.__classGear, state = window.__gameplayGeometryLifecycle, pass = state.pass;
            const render = () => qa.renderer.render(qa.scene, qa.camera);
            const entry = qa.actors.find(row => row.type === 'Fighter' && row.quality === 'high');
            for (const other of qa.actors) other.root.visible = true;
            const before = pass.entries.size;
            entry.actor.syncEquipmentVisuals({ ...entry.gear, chest: { ...entry.gear.chest, baseName: 'Robes', name: 'Robes' } });
            await entry.root.userData.equipmentReady; qa.sample('Run'); render();
            const afterEquip = pass.entries.size, noStaleAfterEquip = [...pass.entries.values()].every(row => pass.valid(row));
            entry.actor.syncEquipmentVisuals(entry.gear); await entry.root.userData.equipmentReady;
            const detached = qa.actors.find(row => row.type === 'Rogue' && row.quality === 'low');
            detached.root.removeFromParent(); qa.sample('CombatIdle'); render();
            const detachedRetired = [...pass.entries.values()].every(row => row.root !== detached.root); qa.scene.add(detached.root);
            pass.dispose(); qa.sample('CombatIdle'); render();
            const memory = () => ({ geometries: qa.renderer.info.memory.geometries, textures: qa.renderer.info.memory.textures, programs: qa.renderer.info.programs.length });
            const baseline = memory(), cycles = [];
            for (let i = 0; i < 4; i++) {
                const fresh = new pass.constructor(qa.renderer, qa.scene, qa.camera);
                for (const { mesh, indices } of state.registrations) if (mesh.parent && qa.scene.getObjectById(mesh.id)) fresh.register(mesh, indices);
                qa.sample('Run'); render(); fresh.dispose(); qa.sample('CombatIdle'); render(); cycles.push(memory());
            }
            return { before, afterEquip, noStaleAfterEquip, detachedRetired, baseline, cycles,
                originalsRestored: [...pass.entries.values()].length === 0 };
        });
        await writeFile(testInfo.outputPath('gameplay-geometry-lifecycle.json'), JSON.stringify({ preparation, samples, lifecycle, images,
            scope: 'Explicit prepared index-only body+gear controller,64native pose/zoom controls,32exact close controls, equip retirement/detachment/four GPU cycles. Approximate far images descriptive pending review; no runtime installation, new-gear derivative delivery, device or final-art acceptance.' }, null, 2));
        expect(lifecycle.afterEquip).toBeLessThan(lifecycle.before); expect(lifecycle.noStaleAfterEquip).toBe(true);
        expect(lifecycle.detachedRetired).toBe(true); expect(lifecycle.originalsRestored).toBe(true);
        for (const cycle of lifecycle.cycles) expect(cycle).toEqual(lifecycle.baseline);
    } finally {
        await page.evaluate(() => {
            window.__gameplayGeometryLifecycle?.pass.dispose(); delete window.__gameplayGeometryLifecycle;
            window.__gameplayBodyPilot?.dispose(); delete window.__gameplayBodyPilot;
            window.__gameplayColorPilot?.dispose(); delete window.__gameplayColorPilot;
            const qa = window.__classGear; qa.camera = qa.lifecycleCamera; delete qa.lifecycleCamera;
        });
    }
}
