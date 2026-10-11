import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { shadowLodIndices } from '../../scripts/lib/shadow-lod-indices.mjs';

function accessor(array, width) {
    return { getArray: () => array, getCount: () => array.length / width, getElementSize: () => width,
        getElement: (vertex, target) => { for (let i = 0; i < width; i++) target[i] = array[vertex * width + i]; return target; } };
}

export async function prepareShadowGeometryPilot(page, kind = 'gallery', maximumError = .006) {
    const started = performance.now();
    // Transport the same raw numeric depth inputs as one string so normal
    // peer I/O can run during this unmeasured QA preparation.
    const sources = JSON.parse(await page.evaluate(async kind => {
        const { ActorShadowGeometry, createOwnedShadowGeometry } = await import('/src/core/ActorShadowGeometry.js');
        const qa = window.__classGear, game = window.game;
        const renderer = kind === 'gallery' ? qa.renderer : game.renderSystem.renderer;
        const scene = kind === 'gallery' ? qa.scene : game.renderSystem.scene;
        const actors = kind === 'gallery' ? qa.actors : [game.player, ...game.remotePlayers.values()].map(actor => ({ root: actor.mesh }));
        const pass = new ActorShadowGeometry(renderer, scene), meshes = new Map();
        let examined = 0, rejected = 0;
        for (const { root } of actors) {
            if (root?.userData.authoredQuality !== 'high' ||
                !['Fighter', 'Rogue', 'Wizard', 'Cleric'].includes(root.userData.authoredClass)) continue;
            root.traverse(mesh => {
                if (!mesh.isSkinnedMesh || !mesh.geometry.attributes.skinIndex || !mesh.visible) return;
                examined++;
                const geometry = createOwnedShadowGeometry(mesh.geometry);
                if (!pass.register(mesh, geometry)) { geometry.dispose(); rejected++; return; }
                meshes.set(mesh.uuid, mesh);
            });
        }
        window.__shadowGeometryPilot = { pass, meshes, createOwnedShadowGeometry, examined, rejected };
        const values = attribute => Array.from({ length: attribute.count * attribute.itemSize },
            (_, index) => attribute.getComponent(Math.floor(index / attribute.itemSize), index % attribute.itemSize));
        return JSON.stringify([...pass.entries.values()].map(({ mesh, source }) => ({ id: mesh.uuid, name: mesh.name,
            position: values(source.attributes.position), joints: values(source.attributes.skinIndex),
            weights: values(source.attributes.skinWeight), indices: Array.from(source.index.array),
            morphs: (source.morphAttributes.position || []).map(values) })));
    }, kind));
    if (!sources.length) throw new Error('No actual supplied High shadow geometry registered');
    const derivatives = sources.map(source => {
        const position = accessor(new Float32Array(source.position), 3), joints = accessor(new Uint16Array(source.joints), 4);
        const weights = accessor(new Float32Array(source.weights), 4), index = accessor(new Uint32Array(source.indices), 1);
        const morphs = source.morphs.map(array => {
            const position = accessor(new Float32Array(array), 3);
            return { getAttribute: () => position };
        });
        const primitive = { getAttribute: name => ({ POSITION: position, JOINTS_0: joints, WEIGHTS_0: weights })[name],
            getIndices: () => index, listTargets: () => morphs };
        const started = performance.now();
        const { indices, ...details } = shadowLodIndices(primitive, maximumError);
        const preparationMilliseconds = performance.now() - started;
        const { id: _id, name: _name, ...geometryData } = source;
        return { id: source.id, name: source.name, sourceSHA256: createHash('sha256').update(JSON.stringify(geometryData)).digest('hex'),
            sourceTriangles: source.indices.length / 3, candidateTriangles: indices.length / 3, indices: Array.from(indices),
            preparationMilliseconds, ...details };
    });
    return { sources: sources.length, wallPreparationMilliseconds: performance.now() - started, derivatives };
}

export async function selectSimplifiedShadowGeometry(page, derivatives) {
    return page.evaluate(derivatives => {
        const pilot = window.__shadowGeometryPilot;
        for (const result of derivatives) {
            const mesh = pilot.meshes.get(result.id), entry = pilot.pass.entries.get(mesh);
            if (!entry || !pilot.pass.valid(entry)) throw new Error('Prepared shadow source changed');
            const geometry = pilot.createOwnedShadowGeometry(entry.source, result.indices);
            if (!pilot.pass.register(mesh, geometry)) { geometry.dispose(); throw new Error('Prepared shadow registration failed'); }
        }
        return { registered: pilot.pass.entries.size, sourceTriangles: derivatives.reduce((sum, row) => sum + row.sourceTriangles, 0),
            candidateTriangles: derivatives.reduce((sum, row) => sum + row.candidateTriangles, 0) };
    }, derivatives);
}

export async function captureShadowGeometryPilot(page, testInfo) {
    const preparation = await prepareShadowGeometryPilot(page);
    expect(preparation.derivatives.filter(row => /_Body$/.test(row.name))).toHaveLength(4);
    await writeFile(testInfo.outputPath('shadow-pilot-indices.json'), JSON.stringify(preparation, null, 2));
    await page.evaluate(async () => {
        const THREE = await import('three'), qa = window.__classGear, pilot = window.__shadowGeometryPilot;
        const light = qa.scene.children.find(child => child.isDirectionalLight), floor = qa.scene.children.find(child => child.isMesh);
        pilot.original = { enabled: qa.renderer.shadowMap.enabled, type: qa.renderer.shadowMap.type,
            autoReset: qa.renderer.info.autoReset, lightCast: light.castShadow, receive: floor.receiveShadow,
            cameraPosition: qa.camera.position.clone(), cameraQuaternion: qa.camera.quaternion.clone() };
        pilot.light = light; pilot.floor = floor;
        qa.renderer.shadowMap.enabled = true; qa.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        qa.renderer.info.autoReset = false; light.castShadow = true; floor.receiveShadow = true;
        light.shadow.mapSize.set(2048, 2048); light.shadow.camera.left = light.shadow.camera.bottom = -20;
        light.shadow.camera.right = light.shadow.camera.top = 20; light.shadow.camera.near = .1; light.shadow.camera.far = 80;
        light.shadow.bias = -.00014; light.shadow.normalBias = .05; light.shadow.radius = 4;
        light.shadow.camera.updateProjectionMatrix();
        pilot.target = new THREE.WebGLRenderTarget(960, 600);
        pilot.pair = exact => {
            const a = new Uint8Array(960 * 600 * 4), b = a.slice(), back = a.slice();
            const draw = (enabled, pixels) => {
                pilot.pass.enabled = enabled; qa.renderer.info.reset(); qa.renderer.setRenderTarget(pilot.target);
                qa.renderer.render(qa.scene, qa.camera); qa.renderer.readRenderTargetPixels(pilot.target, 0, 0, 960, 600, pixels);
                qa.renderer.setRenderTarget(null);
                return { calls: qa.renderer.info.render.calls, triangles: qa.renderer.info.render.triangles, swaps: pilot.pass.lastSwaps };
            };
            const reference = draw(false, a), candidate = draw(true, b); draw(false, back);
            let changedPixels = 0, maximumChannel = 0, sum = 0, unstableReference = 0;
            for (let i = 0; i < a.length; i += 4) {
                let changed = false;
                for (let channel = 0; channel < 3; channel++) {
                    const error = Math.abs(a[i + channel] - b[i + channel]); changed ||= error !== 0;
                    sum += error; maximumChannel = Math.max(maximumChannel, error);
                    unstableReference += a[i + channel] !== back[i + channel] ? 1 : 0;
                }
                changedPixels += changed ? 1 : 0;
            }
            pilot.pass.enabled = true; qa.renderer.info.reset(); qa.renderer.render(qa.scene, qa.camera);
            if (unstableReference || exact && changedPixels) throw new Error(`Shadow control mismatch: changed=${changedPixels}, unstable=${unstableReference}`);
            if ([...pilot.pass.entries.values()].some(entry => entry.mesh.geometry !== entry.source)) throw new Error('Shadow geometry escaped its pass');
            return { reference, candidate, changedPixels, maximumChannel, meanChannel: sum / (960 * 600 * 3), unstableReference };
        };
    });
    const samples = [];
    try {
        for (const mode of ['exact-index', 'simplified']) {
            if (mode === 'simplified') await selectSimplifiedShadowGeometry(page, preparation.derivatives);
            for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
                for (const [label, pose, time, yaw, blink] of [['idle', 'CombatIdle', .3, 0, [0, 0]],
                    ['back-run', 'Run', .3, Math.PI, [0, 0]], ['side-attack', 'Attack', 14 / 30, Math.PI / 2, [0, 0]],
                    ['partial-blink', 'CombatIdle', .3, .5, [.75, .25]]]) {
                    const result = await page.evaluate(({ mode, actorClass, label, pose, time, yaw, blink }) => {
                        const qa = window.__classGear, pilot = window.__shadowGeometryPilot;
                        const entry = qa.actors.find(entry => entry.type === actorClass && entry.quality === 'high');
                        for (const other of qa.actors) other.root.visible = other === entry;
                        qa.camera.position.copy(entry.root.position).add({ x: 0, y: 7, z: 13 });
                        qa.camera.lookAt(entry.root.position.clone().add({ x: 0, y: 1.8, z: 0 }));
                        qa.sample(pose, time, yaw);
                        entry.root.traverse(mesh => {
                            for (const [index, name] of ['Blink_L', 'Blink_R'].entries()) {
                                const target = mesh.morphTargetDictionary?.[name];
                                if (target !== undefined) mesh.morphTargetInfluences[target] = blink[index];
                            }
                        });
                        return { mode, actorClass, label, pose, time, yaw, blink, ...pilot.pair(mode === 'exact-index') };
                    }, { mode, actorClass, label, pose, time, yaw, blink });
                    expect(result.unstableReference).toBe(0);
                    if (mode === 'exact-index') expect(result.changedPixels).toBe(0);
                    else expect(result.candidate.triangles).toBeLessThan(result.reference.triangles);
                    samples.push(result);
                    await page.locator('#class-equipment-qa').screenshot({ path: testInfo.outputPath(`shadow-${mode}-${actorClass}-${label}.png`) });
                }
            }
        }
        const fallbacks = await page.evaluate(async () => {
            const qa = window.__classGear, pilot = window.__shadowGeometryPilot;
            const rogue = qa.actors.find(entry => entry.type === 'Rogue' && entry.quality === 'high');
            for (const entry of qa.actors) entry.root.visible = entry === rogue;
            qa.camera.position.copy(rogue.root.position).add({ x: 0, y: 7, z: 13 });
            qa.camera.lookAt(rogue.root.position.clone().add({ x: 0, y: 1.8, z: 0 }));
            qa.sample('CombatIdle');
            const { applyActorStealthAppearance, restoreActorStealthAppearance } = await import('/src/entities/ActorStealthAppearance.js');
            let stealth;
            applyActorStealthAppearance(rogue.actor);
            try { stealth = pilot.pair(true); }
            finally { restoreActorStealthAppearance(rogue.actor); }
            const enabled = qa.renderer.shadowMap.enabled;
            let disabled;
            qa.renderer.shadowMap.enabled = false;
            try { disabled = pilot.pair(true); }
            finally { qa.renderer.shadowMap.enabled = enabled; }
            return { stealth, disabled };
        });
        expect(fallbacks.stealth.candidate.swaps).toBe(0);
        expect(fallbacks.disabled.candidate.swaps).toBe(0);
        const lifetime = await page.evaluate(() => {
            const qa = window.__classGear, pilot = window.__shadowGeometryPilot;
            for (const entry of qa.actors) entry.root.visible = true;
            qa.camera.position.copy(pilot.original.cameraPosition); qa.camera.quaternion.copy(pilot.original.cameraQuaternion);
            const memory = () => ({ geometries: qa.renderer.info.memory.geometries, textures: qa.renderer.info.memory.textures, programs: qa.renderer.info.programs.length });
            const cycles = [];
            pilot.pass.dispose(); qa.sample('CombatIdle');
            const baseline = memory();
            for (let cycle = 0; cycle < 4; cycle++) {
                const sources = [...pilot.meshes.values()].filter(mesh => mesh.parent);
                const fresh = new pilot.pass.constructor(qa.renderer, qa.scene);
                for (const mesh of sources) {
                    const geometry = pilot.createOwnedShadowGeometry(mesh.geometry);
                    if (!fresh.register(mesh, geometry)) geometry.dispose();
                }
                qa.sample('Run'); fresh.dispose(); qa.sample('CombatIdle'); cycles.push(memory());
            }
            return { baseline, cycles, originalsRestored: [...pilot.meshes.values()].every(mesh => mesh.geometry.attributes.normal),
                examined: pilot.examined, rejected: pilot.rejected, renderer: qa.renderer.getContext().getParameter(qa.renderer.getContext().getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL) };
        });
        expect(lifetime.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        expect(lifetime.originalsRestored).toBe(true);
        for (const cycle of lifetime.cycles) expect(cycle).toEqual(lifetime.baseline);
        await writeFile(testInfo.outputPath('shadow-pilot-review.json'), JSON.stringify({ scope: 'Explicit High native shadow-only pilot,2048 PCFSoft; exact-index pass parity and descriptive simplified views, not actual game/device/art acceptance. Low source/color paths unchanged.',
            sources: preparation.sources, derivatives: preparation.derivatives.map(({ indices: _indices, ...row }) => row), samples, fallbacks, lifetime }, null, 2));
    } finally {
        await page.evaluate(() => {
            const qa = window.__classGear, pilot = window.__shadowGeometryPilot;
            pilot.pass.dispose(); pilot.target.dispose();
            qa.renderer.shadowMap.enabled = pilot.original.enabled; qa.renderer.shadowMap.type = pilot.original.type;
            qa.renderer.info.autoReset = pilot.original.autoReset; pilot.light.castShadow = pilot.original.lightCast;
            pilot.floor.receiveShadow = pilot.original.receive;
            for (const entry of qa.actors) entry.root.visible = true;
            qa.camera.position.copy(pilot.original.cameraPosition); qa.camera.quaternion.copy(pilot.original.cameraQuaternion);
            qa.sample('CombatIdle'); delete window.__shadowGeometryPilot;
        });
    }
}
