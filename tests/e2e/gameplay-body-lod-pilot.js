import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gameplayBodyIndices } from '../../scripts/lib/gameplay-body-indices.mjs';

export async function prepareGameplayBodyPilot(page, kind = 'gallery', error = .006, sourceOutput = null) {
    const started = performance.now();
    // One JSON string avoids Playwright's per-number protocol objects for
    // millions of raw body/morph components. Keep socket I/O responsive while
    // transporting the same exact numeric inputs, before any measured frames.
    const sources = JSON.parse(await page.evaluate(kind => {
        const qa = window.__classGear, game = window.game;
        const actors = kind === 'gallery' ? qa.actors : [game.player, ...game.remotePlayers.values()].map(actor => ({ root: actor.mesh }));
        const meshes = new Map();
        for (const { root } of actors) {
            if (!['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(root?.userData.authoredClass)) continue;
            root.traverse(mesh => {
                const geometry = mesh.geometry, material = mesh.material;
                if (!mesh.isSkinnedMesh || !mesh.visible || !geometry.index?.count || geometry.groups.length ||
                    !/_Body$/.test(mesh.name) || !geometry.morphTargetsRelative ||
                    geometry.morphAttributes.position?.length !== 2 || geometry.morphAttributes.normal?.length !== 2 ||
                    !material?.isMeshStandardMaterial || material.transparent || material.opacity !== 1 ||
                    material.alphaTest || material.alphaHash || material.displacementMap || material.clippingPlanes ||
                    geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return;
                meshes.set(mesh.uuid, { mesh, source: geometry, candidate: null, quality: root.userData.authoredQuality });
            });
        }
        const pilot = window.__gameplayBodyPilot = { meshes };
        pilot.select = enabled => {
            for (const entry of meshes.values()) {
                if (entry.mesh.geometry !== entry.source && entry.mesh.geometry !== entry.candidate) throw new Error('Body pilot source generation changed');
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
            index: Array.from(source.index.array), morphTargetsRelative: source.morphTargetsRelative,
            morphNames: Object.keys(mesh.morphTargetDictionary).sort(),
            morphTargets: source.morphAttributes.position.map((position, i) => ({
                position: { itemSize: position.itemSize, array: values(position) },
                normal: { itemSize: source.morphAttributes.normal[i].itemSize, array: values(source.morphAttributes.normal[i]) } })) })));
    }, kind));
    if (sources.some(source => source.morphNames.join(',') !== 'Blink_L,Blink_R')) throw new Error('Expected independent supplied Blink_L/R');
    if (!sources.length) throw new Error('No supplied body sources');
    if (sourceOutput) await writeFile(sourceOutput, JSON.stringify(sources));
    const derivatives = sources.map(source => {
        const attributes = Object.fromEntries(Object.entries(source.attributes).map(([name, attr]) => [name, { ...attr, array: new Float32Array(attr.array) }]));
        const start = performance.now();
        const { indices, ...details } = gameplayBodyIndices({ attributes, index: new Uint32Array(source.index), morphTargetsRelative: source.morphTargetsRelative,
            morphTargets: source.morphTargets.map(target => Object.fromEntries(Object.entries(target).map(([name, attr]) =>
                [name, { ...attr, array: new Float32Array(attr.array) }]))) }, { error });
        const { id: _id, name: _name, ...data } = source;
        return { id: source.id, name: source.name, quality: source.quality,
            sourceSHA256: createHash('sha256').update(JSON.stringify(data)).digest('hex'),
            sourceTriangles: source.index.length / 3, candidateTriangles: indices.length / 3,
            preparationMilliseconds: performance.now() - start, indices: Array.from(indices), ...details };
    });
    await page.evaluate(async derivatives => {
        const THREE = await import('three'), pilot = window.__gameplayBodyPilot;
        for (const row of derivatives) {
            const entry = pilot.meshes.get(row.id), geometry = entry.source.clone();
            geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(row.indices), 1));
            if (Object.keys(geometry.attributes).some(name => geometry.attributes[name].array === entry.source.attributes[name].array) ||
                Object.keys(geometry.morphAttributes).some(name => geometry.morphAttributes[name].some((attr, i) => attr.array === entry.source.morphAttributes[name][i].array))) throw new Error('Shared body buffers');
            entry.candidate = geometry;
        }
    }, derivatives);
    return { sources: sources.length, error, wallPreparationMilliseconds: performance.now() - started, derivatives };
}

export async function captureGameplayBodyPilot(page, testInfo) {
    const samples = [], preparations = [], lifetimes = [];
    try {
        await page.evaluate(async () => {
            const THREE = await import('three'), qa = window.__classGear;
            qa.bodyCamera = qa.camera;
            qa.camera = new THREE.OrthographicCamera(-24, 24, 15, -15, .1, 2000);
            qa.bodyTarget = new THREE.WebGLRenderTarget(1440, 900);
            if (qa.renderer.shadowMap.enabled) throw new Error('Body color review requires shadows off');
        });
        for (const outfit of ['equipped', 'bare']) {
            if (outfit === 'bare') await page.evaluate(async () => {
                const qa = window.__classGear;
                for (const entry of qa.actors) { entry.actor.syncEquipmentVisuals({}); await entry.root.userData.equipmentReady; }
            });
            const preparation = await prepareGameplayBodyPilot(page, 'gallery', .006, testInfo.outputPath(`body-${outfit}-sources.json`));
            preparations.push({ outfit, ...preparation });
            await writeFile(testInfo.outputPath(`body-${outfit}-indices.json`), JSON.stringify(preparation, null, 2));
            expect(preparation.sources).toBe(8);
            for (const quality of ['high', 'low']) for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
                for (const [label, pose, time, yaw, blink] of [
                    ['open', 'CombatIdle', .3, 0, [0, 0]], ['left', 'Idle', .2, 0, [1, 0]],
                    ['right', 'Idle', .2, 0, [0, 1]], ['both', 'Idle', .2, 0, [1, 1]],
                    ['partial', 'Idle', .2, 0, [.75, .25]], ['back-run', 'Run', .3, Math.PI, [0, 0]],
                    ['side-attack', 'Attack', 14 / 30, Math.PI / 2, [.25, .75]]
                ]) for (const zoom of [5, 15, 30]) {
                    const { sourcePNG, ...result } = await page.evaluate(async ({ actorClass, quality, pose, time, yaw, blink, zoom }) => {
                        const THREE = await import('three'), qa = window.__classGear, pilot = window.__gameplayBodyPilot;
                        const entry = qa.actors.find(entry => entry.type === actorClass && entry.quality === quality);
                        qa.sample(pose, time, yaw);
                        for (const other of qa.actors) other.root.visible = other === entry;
                        entry.root.traverse(part => {
                            for (const [i, name] of ['Blink_L', 'Blink_R'].entries()) {
                                const target = part.morphTargetDictionary?.[name];
                                if (target !== undefined) part.morphTargetInfluences[target] = blink[i];
                            }
                        });
                        const camera = qa.camera, aspect = 1440 / 900;
                        Object.assign(camera, { left: -zoom * aspect, right: zoom * aspect, top: zoom, bottom: -zoom });
                        camera.updateProjectionMatrix(); camera.position.copy(entry.root.position).add(new THREE.Vector3(100, 100, 100));
                        camera.lookAt(entry.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
                        entry.root.updateMatrixWorld(true);
                        const draw = enabled => {
                            pilot.select(enabled); qa.renderer.setRenderTarget(qa.bodyTarget); qa.renderer.render(qa.scene, camera);
                            const pixels = new Uint8Array(1440 * 900 * 4);
                            qa.renderer.readRenderTargetPixels(qa.bodyTarget, 0, 0, 1440, 900, pixels);
                            const info = { calls: qa.renderer.info.render.calls, triangles: qa.renderer.info.render.triangles };
                            qa.renderer.setRenderTarget(null); return { pixels, info };
                        };
                        const source = draw(false); qa.renderer.render(qa.scene, camera);
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
                        const body = entry.root.getObjectByName(`${actorClass}_Body`), point = new THREE.Vector3();
                        let invalidPosedVertices = 0;
                        for (const vertex of new Set(body.geometry.index.array)) {
                            body.getVertexPosition(vertex, point);
                            if (!point.toArray().every(Number.isFinite) || point.length() > 10) invalidPosedVertices++;
                        }
                        return { reference: source.info, candidate: candidate.info, changedPixels: changed, maximumChannel: maximum,
                            meanChannel: sum / (1440 * 900 * 3), unstableReference: unstable, invalidPosedVertices,
                            morphInfluences: body.morphTargetInfluences.slice(), sourcePNG };
                    }, { actorClass, quality, pose, time, yaw, blink, zoom });
                    expect(result.unstableReference).toBe(0); expect(result.invalidPosedVertices).toBe(0);
                    if (zoom === 5) expect(result.changedPixels).toBe(0);
                    else expect(result.candidate.triangles).toBeLessThanOrEqual(result.reference.triangles);
                    samples.push({ outfit, actorClass, quality, label, pose, time, yaw, blink, zoom, ...result });
                    const stem = `body-${outfit}-${quality}-${actorClass}-${label}-zoom${zoom}`;
                    await writeFile(testInfo.outputPath(`${stem}-source.png`), Buffer.from(sourcePNG.split(',')[1], 'base64'));
                    await page.locator('#class-equipment-qa').screenshot({ path: testInfo.outputPath(`${stem}-candidate.png`) });
                }
            }
            const lifetime = await page.evaluate(async derivatives => {
                const THREE = await import('three'), qa = window.__classGear, pilot = window.__gameplayBodyPilot;
                for (const entry of qa.actors) entry.root.visible = true;
                pilot.select(false); pilot.dispose();
                for (const entry of pilot.meshes.values()) entry.candidate = null;
                qa.sample('CombatIdle');
                const memory = () => ({ geometries: qa.renderer.info.memory.geometries, textures: qa.renderer.info.memory.textures, programs: qa.renderer.info.programs.length });
                const baseline = memory(), cycles = [];
                for (let cycle = 0; cycle < 4; cycle++) {
                    for (const row of derivatives) {
                        const entry = pilot.meshes.get(row.id); entry.candidate = entry.source.clone();
                        entry.candidate.setIndex(new THREE.BufferAttribute(new Uint32Array(row.indices), 1));
                    }
                    pilot.select(true); qa.sample('Run'); pilot.select(false); pilot.dispose();
                    for (const entry of pilot.meshes.values()) entry.candidate = null;
                    qa.sample('CombatIdle'); cycles.push(memory());
                }
                return { baseline, cycles, originalsRestored: [...pilot.meshes.values()].every(entry => entry.mesh.geometry === entry.source) };
            }, preparation.derivatives);
            expect(lifetime.originalsRestored).toBe(true);
            for (const cycle of lifetime.cycles) expect(cycle).toEqual(lifetime.baseline);
            lifetimes.push({ outfit, ...lifetime });
            await page.evaluate(() => { window.__gameplayBodyPilot.dispose(); delete window.__gameplayBodyPilot; });
        }
        const renderer = await page.evaluate(() => {
            const gl = window.__classGear.renderer.getContext(); return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
        });
        expect(renderer).not.toMatch(/software|swiftshader|llvmpipe/i);
        await writeFile(testInfo.outputPath('gameplay-body-review.json'), JSON.stringify({
            scope: 'Unselected source-index body pilot:336bare/equipped asymmetric-blink/motion pairs at orthographic5/15/30. Zoom5selects originals. Shadows off, full raw skin and morph buffers retained. Approximate endpoint penalties, not every pose/pixel or final art/device/continuous LOD acceptance. Four owned allocation/disposal cycles per outfit, Three counters only.',
            renderer, preparations: preparations.map(row => ({ ...row, derivatives: row.derivatives.map(({ indices: _indices, ...derivative }) => derivative) })), samples, lifetimes
        }, null, 2));
    } finally {
        await page.evaluate(async () => {
            const qa = window.__classGear;
            window.__gameplayBodyPilot?.dispose(); delete window.__gameplayBodyPilot;
            qa.bodyTarget.dispose(); qa.camera = qa.bodyCamera; delete qa.bodyTarget; delete qa.bodyCamera;
            for (const entry of qa.actors) { entry.root.visible = true; entry.actor.syncEquipmentVisuals(entry.gear); await entry.root.userData.equipmentReady; }
            qa.sample('CombatIdle');
        });
    }
}
