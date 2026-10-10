import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gameplayColorIndices } from '../../scripts/lib/gameplay-color-indices.mjs';

export async function prepareGameplayColorPilot(page, kind = 'gallery', error = .006, sourceOutput = null) {
    const started = performance.now();
    // Preserve exact numeric inputs without per-number protocol objects that
    // can stall the live socket peers during this unmeasured QA preparation.
    const sources = JSON.parse(await page.evaluate(kind => {
        const qa = window.__classGear, game = window.game;
        const actors = kind === 'gallery' ? qa.actors : [game.player, ...game.remotePlayers.values()].map(actor => ({ root: actor.mesh }));
        const meshes = new Map();
        for (const { root } of actors) {
            if (!['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(root?.userData.authoredClass)) continue;
            root.traverse(mesh => {
                const geometry = mesh.geometry, material = mesh.material;
                if (!mesh.isSkinnedMesh || !mesh.visible || !geometry.index?.count || geometry.groups.length ||
                    Object.keys(geometry.morphAttributes).length || /_Body$/.test(mesh.name) ||
                    !material?.isMeshStandardMaterial || material.transparent || material.opacity !== 1 ||
                    material.alphaTest || material.alphaHash || material.displacementMap || material.clippingPlanes ||
                    geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return;
                meshes.set(mesh.uuid, { mesh, source: geometry, candidate: null, quality: root.userData.authoredQuality });
            });
        }
        const pilot = window.__gameplayColorPilot = { meshes };
        pilot.select = enabled => {
            for (const entry of meshes.values()) {
                if (entry.mesh.geometry !== entry.source && entry.mesh.geometry !== entry.candidate) throw new Error('Color pilot source generation changed');
                entry.mesh.geometry = enabled ? entry.candidate : entry.source;
            }
        };
        pilot.dispose = () => {
            for (const entry of meshes.values()) {
                if (entry.mesh.geometry === entry.candidate) entry.mesh.geometry = entry.source;
                entry.candidate?.dispose();
            }
        };
        const values = attr => Array.from({ length: attr.count * attr.itemSize }, (_, i) => attr.getComponent(Math.floor(i / attr.itemSize), i % attr.itemSize));
        return JSON.stringify([...meshes.values()].map(({ mesh, source, quality }) => ({ id: mesh.uuid, name: mesh.name, quality,
            attributes: Object.fromEntries(Object.entries(source.attributes).map(([name, attr]) => [name, { itemSize: attr.itemSize, array: values(attr) }])),
            index: Array.from(source.index.array) })));
    }, kind));
    if (!sources.length) throw new Error('No supplied fitted gear/eye color sources');
    if (sourceOutput) await writeFile(sourceOutput, JSON.stringify(sources));
    const derivatives = sources.map(source => {
        const attributes = Object.fromEntries(Object.entries(source.attributes).map(([name, attr]) => [name, { ...attr, array: new Float32Array(attr.array) }]));
        const start = performance.now();
        const { indices, ...details } = gameplayColorIndices({ attributes, index: new Uint32Array(source.index) }, { error });
        const { id: _id, name: _name, ...data } = source;
        return { id: source.id, name: source.name, quality: source.quality,
            sourceSHA256: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
            sourceTriangles: source.index.length / 3, candidateTriangles: indices.length / 3,
            preparationMilliseconds: performance.now() - start, indices: Array.from(indices), ...details };
    });
    await page.evaluate(async derivatives => {
        const THREE = await import('three'), pilot = window.__gameplayColorPilot;
        for (const row of derivatives) {
            const entry = pilot.meshes.get(row.id), geometry = entry.source.clone();
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(row.indices), 1));
            if (Object.keys(geometry.attributes).some(name => geometry.attributes[name].array === entry.source.attributes[name].array)) throw new Error('Shared color buffers');
            entry.candidate = geometry;
        }
    }, derivatives);
    return { sources: sources.length, error, wallPreparationMilliseconds: performance.now() - started, derivatives };
}

export async function captureGameplayColorPilot(page, testInfo) {
    const preparation = await prepareGameplayColorPilot(page, 'gallery', .006, testInfo.outputPath('gameplay-color-sources.json'));
    await writeFile(testInfo.outputPath('gameplay-color-indices.json'), JSON.stringify(preparation, null, 2));
    const before = await page.evaluate(async () => {
        const THREE = await import('three'), qa = window.__classGear, pilot = window.__gameplayColorPilot;
        pilot.originalCamera = qa.camera;
        const aspect = 1440 / 900;
        const camera = new THREE.OrthographicCamera(-15 * aspect, 15 * aspect, 15, -15, .1, 2000);
        qa.camera = camera;
        // qa.sample closes over its original camera. Explicit renders below
        // use the production isometric projection/offset for this diagnostic.
        pilot.target = new THREE.WebGLRenderTarget(1440, 900);
        pilot.compare = (entry, zoom) => {
            for (const other of qa.actors) other.root.visible = other === entry;
            Object.assign(camera, { left: -zoom * aspect, right: zoom * aspect, top: zoom, bottom: -zoom });
            camera.updateProjectionMatrix(); camera.position.copy(entry.root.position).add(new THREE.Vector3(100, 100, 100));
            camera.lookAt(entry.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
            const draw = enabled => {
                pilot.select(enabled); qa.renderer.setRenderTarget(pilot.target); qa.renderer.render(qa.scene, camera);
                const pixels = new Uint8Array(1440 * 900 * 4);
                qa.renderer.readRenderTargetPixels(pilot.target, 0, 0, 1440, 900, pixels);
                const info = { calls: qa.renderer.info.render.calls, triangles: qa.renderer.info.render.triangles };
                qa.renderer.setRenderTarget(null);
                return { pixels, info };
            };
            const source = draw(false);
            qa.renderer.render(qa.scene, camera);
            const sourcePNG = qa.renderer.domElement.toDataURL('image/png');
            const candidate = draw(zoom >= 10), again = draw(false);
            let changed = 0, maximum = 0, sum = 0, unstable = 0;
            for (let i = 0; i < source.pixels.length; i += 4) {
                let differs = false;
                for (let channel = 0; channel < 3; channel++) {
                    const error = Math.abs(source.pixels[i + channel] - candidate.pixels[i + channel]);
                    differs ||= error !== 0; maximum = Math.max(maximum, error); sum += error;
                    unstable += source.pixels[i + channel] !== again.pixels[i + channel] ? 1 : 0;
                }
                changed += differs ? 1 : 0;
            }
            pilot.select(zoom >= 10); qa.renderer.render(qa.scene, camera);
            return { reference: source.info, candidate: candidate.info, changedPixels: changed,
                maximumChannel: maximum, meanChannel: sum / (1440 * 900 * 3), unstableReference: unstable, sourcePNG };
        };
        return { shadowEnabled: qa.renderer.shadowMap.enabled, renderer: qa.renderer.getContext().getParameter(
            qa.renderer.getContext().getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) };
    });
    const samples = [];
    try {
        expect(before.shadowEnabled).toBe(false);
        expect(before.renderer).not.toMatch(/software|swiftshader|llvmpipe/i);
        for (const quality of ['high', 'low']) for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
            for (const [label, pose, time, yaw] of [['idle', 'CombatIdle', .3, 0], ['back-run', 'Run', .3, Math.PI],
                ['side-attack', 'Attack', 14 / 30, Math.PI / 2]]) for (const zoom of [5, 15, 30]) {
                const { sourcePNG, ...result } = await page.evaluate(({ actorClass, quality, pose, time, yaw, zoom }) => {
                    const qa = window.__classGear;
                    qa.sample(pose, time, yaw);
                    const entry = qa.actors.find(entry => entry.type === actorClass && entry.quality === quality);
                    return window.__gameplayColorPilot.compare(entry, zoom);
                }, { actorClass, quality, pose, time, yaw, zoom });
                expect(result.unstableReference).toBe(0);
                if (zoom === 5) expect(result.changedPixels).toBe(0);
                else expect(result.candidate.triangles).toBeLessThanOrEqual(result.reference.triangles);
                samples.push({ actorClass, quality, label, pose, time, yaw, zoom, ...result });
                await writeFile(testInfo.outputPath(`source-${quality}-${actorClass}-${label}-zoom${zoom}.png`), Buffer.from(sourcePNG.split(',')[1], 'base64'));
                await page.locator('#class-equipment-qa').screenshot({ path: testInfo.outputPath(`color-${quality}-${actorClass}-${label}-zoom${zoom}.png`) });
            }
        }
        await writeFile(testInfo.outputPath('gameplay-color-review.json'), JSON.stringify({
            scope: 'Explicit color-only source-index pilot at production orthographic5/15/30zoom, shadows off; close zoom5uses exact originals. No runtime selection, actual party, final art or device acceptance.',
            renderer: before.renderer, preparation: { ...preparation, derivatives: preparation.derivatives.map(({ indices: _indices, ...row }) => row) }, samples
        }, null, 2));
    } finally {
        await page.evaluate(() => {
            const qa = window.__classGear, pilot = window.__gameplayColorPilot;
            pilot.dispose(); pilot.target.dispose(); qa.camera = pilot.originalCamera;
            for (const entry of qa.actors) entry.root.visible = true;
            qa.sample('CombatIdle'); delete window.__gameplayColorPilot;
        });
    }
}

export async function captureGameplayColorResources(page, testInfo) {
    const preparation = await prepareGameplayColorPilot(page);
    try {
        const lifetime = await page.evaluate(async derivatives => {
            const THREE = await import('three'), qa = window.__classGear, pilot = window.__gameplayColorPilot;
            for (const entry of qa.actors) entry.root.visible = true;
            pilot.select(false); qa.sample('CombatIdle');
            const memory = () => ({ geometries: qa.renderer.info.memory.geometries,
                textures: qa.renderer.info.memory.textures, programs: qa.renderer.info.programs.length });
            const baseline = memory(), cycles = [];
            for (let cycle = 0; cycle < 4; cycle++) {
                for (const row of derivatives) {
                    const entry = pilot.meshes.get(row.id);
                    if (!entry.candidate) {
                        entry.candidate = entry.source.clone();
                        // Retain the exact reviewed candidate index typed array
                        // independently of every source/other generation.
                        entry.candidate.setIndex(new THREE.BufferAttribute(new Uint32Array(row.indices), 1));
                    }
                }
                pilot.select(true); qa.sample('Run');
                pilot.select(false);
                for (const entry of pilot.meshes.values()) { entry.candidate.dispose(); entry.candidate = null; }
                qa.sample('CombatIdle'); cycles.push(memory());
            }
            return { baseline, cycles,
                originalsRestored: [...pilot.meshes.values()].every(entry => entry.mesh.geometry === entry.source),
                renderer: qa.renderer.getContext().getParameter(qa.renderer.getContext().getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) };
        }, preparation.derivatives);
        expect(lifetime.originalsRestored).toBe(true);
        expect(lifetime.renderer).not.toMatch(/software|swiftshader|llvmpipe/i);
        for (const cycle of lifetime.cycles) expect(cycle).toEqual(lifetime.baseline);
        await writeFile(testInfo.outputPath('gameplay-color-lifetime.json'), JSON.stringify({
            scope: 'Four explicit owned color-geometry allocation/render/disposal cycles on8supplied High/Low rigs; stable Three counters, not VRAM or active equip/reconnect/long-session proof.',
            sources: preparation.sources, lifetime
        }, null, 2));
    } finally {
        await page.evaluate(() => {
            const qa = window.__classGear;
            window.__gameplayColorPilot.dispose(); delete window.__gameplayColorPilot;
            qa.sample('CombatIdle');
        });
    }
}
