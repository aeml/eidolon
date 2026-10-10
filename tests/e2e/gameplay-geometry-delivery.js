import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const idle = async page => {
    await page.waitForFunction(() => {
        const delivery = window.__geometryDelivery.delivery;
        if (delivery.failed) throw Error('Geometry worker failed');
        return !delivery.active && delivery.jobs.size === 0 && delivery.queue.length === 0;
    }, null, { timeout: 90_000 });
};

export async function prepareGameplayGeometryDelivery(page) {
    const owned = process.env.EIDOLON_E2E_GAMEPLAY_GEOMETRY_RUNTIME_OWNER === '1';
    const compactProof = process.env.EIDOLON_E2E_COMPACT_GEOMETRY_COMPARE === '1';
    await page.evaluate(async ({ owned, compactProof }) => {
        const { ActorGameplayGeometry } = await import('/src/core/ActorGameplayGeometry.js');
        const { ActorGameplayGeometryDelivery } = await import('/src/core/ActorGameplayGeometryDelivery.js');
        const game = window.game, render = game.renderSystem;
        if (owned) render.setActorGameplayGeometryEnabled(true);
        const runtime = owned ? render.actorGameplayGeometry : null;
        const pass = runtime?.pass || new ActorGameplayGeometry(render.renderer, render.scene, render.camera);
        const delivery = runtime?.delivery || new ActorGameplayGeometryDelivery(pass);
        window.__gameplayGeometryLifecycle = { runtime, pass, delivery, started: performance.now() };
        if (compactProof) {
            const state = window.__gameplayGeometryLifecycle;
            state.legacyIndices = new Map(); state.originalRegister = pass.register;
            pass.register = function (mesh, indices) {
                const installed = state.originalRegister.call(this, mesh, indices);
                if (installed) state.legacyIndices.set(mesh, { source: mesh.geometry, indices: indices.slice() });
                return installed;
            };
        }
        if (!runtime) for (const actor of [game.player, ...game.remotePlayers.values()]) delivery.track(actor.mesh);
    }, { owned, compactProof });
    await page.waitForFunction(() => {
        const delivery = window.__gameplayGeometryLifecycle.delivery;
        if (delivery.failed) throw Error('Geometry worker failed');
        return !delivery.active && delivery.jobs.size === 0 && delivery.queue.length === 0;
    }, null, { timeout: 90_000 });
    return page.evaluate(() => {
        const state = window.__gameplayGeometryLifecycle, { pass, delivery, started } = state;
        if (state.originalRegister) pass.register = state.originalRegister;
        return { method: 'automatic-worker-exact-source-cache', milliseconds: performance.now() - started,
            body: { sources: [...pass.entries.values()].filter(row => /_Body$/.test(row.mesh.name)).length },
            installed: { registered: pass.entries.size,
                originalTriangles: [...pass.entries.values()].reduce((sum, entry) => sum + entry.source.index.count / 3, 0),
                candidateTriangles: [...pass.entries.values()].reduce((sum, entry) => sum + entry.candidate.index.count / 3, 0) },
            stats: { ...delivery.stats } };
    });
}

export async function captureGameplayGeometryDelivery(page, testInfo) {
    const owned = process.env.EIDOLON_E2E_GAMEPLAY_GEOMETRY_RUNTIME_OWNER === '1';
    await page.evaluate(async owned => {
        const THREE = await import('three'), qa = window.__classGear;
        const { ActorGameplayGeometry } = await import('/src/core/ActorGameplayGeometry.js');
        const { ActorGameplayGeometryDelivery } = await import('/src/core/ActorGameplayGeometryDelivery.js');
        const oldCamera = qa.camera;
        qa.camera = new THREE.OrthographicCamera(-24, 24, 15, -15, .1, 2000);
        let runtime;
        if (owned) {
            const { ActorGameplayGeometryRuntime } = await import('/src/core/ActorGameplayGeometryRuntime.js');
            runtime = new ActorGameplayGeometryRuntime(qa.renderer, qa.scene, qa.camera, [qa.scene]);
        }
        const pass = runtime?.pass || new ActorGameplayGeometry(qa.renderer, qa.scene, qa.camera);
        const delivery = runtime?.delivery || new ActorGameplayGeometryDelivery(pass);
        const state = window.__geometryDelivery = { runtime, pass, delivery, oldCamera, frames: 0, stopped: false, started: performance.now(),
            legacy: new Map(), originalRegister: pass.register, originalRender: pass.original };
        // QA-only old index-subset copies are disposed before leaving this
        // gallery. They never become product-owned or source geometry.
        pass.register = function (mesh, indices) {
            const installed = state.originalRegister.call(this, mesh, indices);
            if (installed) {
                state.legacy.get(mesh)?.legacy.dispose();
                const entry = this.entries.get(mesh), legacy = entry.source.clone();
                legacy.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
                state.legacy.set(mesh, { legacy, candidate: entry.candidate });
            }
            return installed;
        };
        pass.original = function (...args) {
            const selected = [];
            if (state.useLegacy) for (const entry of pass.active) {
                const previous = state.legacy.get(entry.mesh);
                if (previous?.candidate === entry.candidate) { entry.mesh.geometry = previous.legacy; selected.push([entry, previous.legacy]); }
            }
            try { return state.originalRender.apply(this, args); }
            finally { for (const [entry, legacy] of selected) if (entry.mesh.geometry === legacy) entry.mesh.geometry = entry.candidate; }
        };
        const animate = () => {
            if (state.stopped) return;
            state.frames++; qa.sample('Run', (performance.now() - state.started) / 1000);
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        if (!runtime) for (const entry of qa.actors) delivery.track(entry.root);
    }, owned);
    try {
        await idle(page);
        const initial = await page.evaluate(async () => {
            const { geometryStorageBytes } = await import('/tests/e2e/geometry-frame-comparison.js');
            const state = window.__geometryDelivery; state.stopped = true;
            return { milliseconds: performance.now() - state.started, renderedFrames: state.frames,
                registered: state.pass.entries.size, stats: { ...state.delivery.stats },
                candidateStorageBytes: geometryStorageBytes([...state.pass.entries.values()].map(entry => entry.candidate)),
                legacyStorageBytes: geometryStorageBytes([...state.legacy.values()].map(entry => entry.legacy)),
                sourceTriangles: [...state.pass.entries.values()].reduce((sum, entry) => sum + entry.source.index.count / 3, 0),
                reducedTriangles: [...state.pass.entries.values()].reduce((sum, entry) => sum + entry.candidate.index.count / 3, 0) };
        });
        expect(initial.registered).toBeGreaterThan(60); expect(initial.renderedFrames).toBeGreaterThan(5);
        expect(initial.stats.failed).toBe(0); expect(initial.stats.rejected).toBe(0);
        expect(initial.reducedTriangles).toBeLessThan(initial.sourceTriangles);
        expect(initial.candidateStorageBytes).toBeLessThan(initial.legacyStorageBytes);
        const samples = [];
        for (const quality of ['high', 'low']) for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
            for (const pose of ['CombatIdle', 'Run', 'Attack', 'Blink']) for (const zoom of [5, 15]) {
                const row = await page.evaluate(({ quality, actorClass, pose, zoom }) => {
                    const qa = window.__classGear, state = window.__geometryDelivery, { pass } = state;
                    const entry = qa.actors.find(row => row.type === actorClass && row.quality === quality);
                    for (const other of qa.actors) other.root.visible = other === entry;
                    Object.assign(qa.camera, { left: -zoom * 1.6, right: zoom * 1.6, top: zoom, bottom: -zoom });
                    qa.camera.position.copy(entry.root.position).add({ x: 0, y: 18, z: 24 });
                    qa.camera.lookAt(entry.root.position.clone().add({ x: 0, y: 1.8, z: 0 })); qa.camera.updateProjectionMatrix();
                    qa.sample(pose === 'Blink' ? 'CombatIdle' : pose, pose === 'Attack' ? 14 / 30 : .3, Math.PI);
                    if (pose === 'Blink') entry.root.traverse(mesh => {
                        for (const [name, influence] of [['Blink_L', .75], ['Blink_R', .25]]) {
                            const index = mesh.morphTargetDictionary?.[name];
                            if (index !== undefined) mesh.morphTargetInfluences[index] = influence;
                        }
                    });
                    const canvas = qa.renderer.domElement, copy = document.createElement('canvas');
                    copy.width = canvas.width; copy.height = canvas.height;
                    const context = copy.getContext('2d', { willReadFrequently: true });
                    const draw = (enabled, legacy = false) => {
                        state.useLegacy = legacy;
                        pass.enabled = enabled; qa.renderer.render(qa.scene, qa.camera); context.drawImage(canvas, 0, 0);
                        return { rgba: context.getImageData(0, 0, copy.width, copy.height).data,
                            calls: qa.renderer.info.render.calls, triangles: qa.renderer.info.render.triangles, swaps: pass.lastSwaps };
                    };
                    draw(false); draw(true); draw(false);
                    const source = draw(false), reduced = draw(true), legacy = draw(true, true), legacyAgain = draw(true, true), again = draw(false);
                    let changedChannels = 0, unstableChannels = 0, compactChangedChannels = 0, legacyUnstableChannels = 0;
                    for (let i = 0; i < source.rgba.length; i++) {
                        changedChannels += source.rgba[i] !== reduced.rgba[i] ? 1 : 0;
                        unstableChannels += source.rgba[i] !== again.rgba[i] ? 1 : 0;
                        compactChangedChannels += legacy.rgba[i] !== reduced.rgba[i] ? 1 : 0;
                        legacyUnstableChannels += legacy.rgba[i] !== legacyAgain.rgba[i] ? 1 : 0;
                    }
                    const strip = ({ rgba: _rgba, ...row }) => row;
                    return { quality, actorClass, pose, zoom, source: strip(source), reduced: strip(reduced),
                        changedChannels, unstableChannels, compactChangedChannels, legacyUnstableChannels,
                        restored: [...pass.entries.values()].every(entry => entry.mesh.geometry === entry.source) };
                }, { quality, actorClass, pose, zoom });
                expect(row.unstableChannels).toBe(0); expect(row.restored).toBe(true);
                expect(row.compactChangedChannels).toBe(0); expect(row.legacyUnstableChannels).toBe(0);
                expect(row.source.calls).toBe(row.reduced.calls);
                if (zoom === 5) { expect(row.changedChannels).toBe(0); expect(row.reduced.swaps).toBe(0); }
                else { expect(row.reduced.triangles).toBeLessThan(row.source.triangles); expect(row.reduced.swaps).toBeGreaterThan(0); }
                samples.push(row);
            }
        }
        await page.evaluate(() => {
            const qa = window.__classGear, state = window.__geometryDelivery;
            for (const row of qa.actors) row.root.visible = true;
            const fighter = qa.actors.find(row => row.type === 'Fighter' && row.quality === 'high');
            state.beforeGear = { ...state.delivery.stats };
            fighter.actor.syncEquipmentVisuals({ ...fighter.gear, chest: { ...fighter.gear.chest, baseName: 'Robes', name: 'Robes' } });
            // Change once more before the queued source copy starts. Only the
            // final coverage and fitted pieces may be prepared/installed.
            fighter.actor.syncEquipmentVisuals({ ...fighter.gear, chest: { ...fighter.gear.chest, baseName: 'Leather Tunic', name: 'Leather Tunic' } });
        });
        await page.evaluate(() => window.__classGear.actors.find(row => row.type === 'Fighter' && row.quality === 'high').root.userData.equipmentReady);
        await idle(page);
        const changed = await page.evaluate(() => {
            const { pass, delivery } = window.__geometryDelivery;
            return { stats: { ...delivery.stats }, valid: [...pass.entries.values()].every(entry => pass.valid(entry)) };
        });
        expect(changed.valid).toBe(true); expect(changed.stats.failed).toBe(0);
        await page.evaluate(() => {
            const qa = window.__classGear, fighter = qa.actors.find(row => row.type === 'Fighter' && row.quality === 'high');
            fighter.actor.syncEquipmentVisuals(fighter.gear);
        });
        await page.evaluate(() => window.__classGear.actors.find(row => row.type === 'Fighter' && row.quality === 'high').root.userData.equipmentReady);
        await idle(page);
        const restored = await page.evaluate(() => {
            const { pass, delivery, beforeGear } = window.__geometryDelivery;
            return { beforeGear, stats: { ...delivery.stats }, valid: [...pass.entries.values()].every(entry => pass.valid(entry)),
                registered: pass.entries.size };
        });
        expect(restored.valid).toBe(true); expect(restored.stats.cacheHits).toBeGreaterThan(changed.stats.cacheHits);
        expect(restored.registered).toBe(initial.registered);
        await page.evaluate(() => {
            const qa = window.__classGear, rogue = qa.actors.find(row => row.type === 'Rogue' && row.quality === 'low');
            window.__geometryDelivery.detached = rogue.root; rogue.root.removeFromParent();
        });
        const detached = await page.evaluate(() => {
            const state = window.__geometryDelivery;
            return [...state.pass.entries.values()].every(entry => entry.root !== state.detached);
        });
        expect(detached).toBe(true);
        await page.evaluate(() => window.__classGear.scene.add(window.__geometryDelivery.detached));
        await idle(page);
        const reattached = await page.evaluate(() => {
            const state = window.__geometryDelivery;
            return { registered: state.pass.entries.size, stats: { ...state.delivery.stats } };
        });
        expect(reattached.registered).toBe(initial.registered);
        expect(reattached.stats.cacheHits).toBeGreaterThan(restored.stats.cacheHits);
        expect(reattached.stats.workerCacheBytes).toBeLessThanOrEqual(16 * 1024 * 1024);
        expect(reattached.stats.workerCacheEntries).toBeLessThanOrEqual(128);
        const faded = await page.evaluate(async () => {
            const { applyActorStealthAppearance } = await import('/src/entities/ActorStealthAppearance.js');
            const qa = window.__classGear, rogue = qa.actors.find(row => row.type === 'Rogue' && row.quality === 'low');
            applyActorStealthAppearance(rogue.actor); qa.sample('Run');
            const { pass } = window.__geometryDelivery;
            return { noReducedStealth: [...pass.entries.values()].every(entry => entry.root !== rogue.root),
                valid: [...pass.entries.values()].every(entry => pass.valid(entry)) };
        });
        expect(faded.noReducedStealth && faded.valid).toBe(true);
        await page.evaluate(async () => {
            const { restoreActorStealthAppearance } = await import('/src/entities/ActorStealthAppearance.js');
            restoreActorStealthAppearance(window.__classGear.actors.find(row => row.type === 'Rogue' && row.quality === 'low').actor);
        });
        await idle(page);
        const afterStealth = await page.evaluate(() => ({ registered: window.__geometryDelivery.pass.entries.size,
            stats: { ...window.__geometryDelivery.delivery.stats } }));
        expect(afterStealth.registered).toBe(initial.registered);
        expect(afterStealth.stats.cacheHits).toBeGreaterThan(reattached.stats.cacheHits);
        let replacement = null;
        if (owned) {
            await page.evaluate(async () => {
                const qa = window.__classGear, state = window.__geometryDelivery;
                const entry = qa.actors.find(row => row.type === 'Fighter' && row.quality === 'high');
                const oldRoot = entry.root; oldRoot.removeFromParent();
                const retired = !state.delivery.roots.has(oldRoot);
                qa.MeshFactory.releaseMesh('Fighter', oldRoot);
                const root = await qa.MeshFactory.createMeshForType('Fighter', { quality: 'low' });
                const actor = new entry.actor.constructor('runtime-replacement-fighter', {}); actor.meshType = 'Fighter'; actor.setMesh(root);
                actor.syncEquipmentVisuals(entry.gear); await root.userData.equipmentReady; qa.scene.add(root);
                state.replacement = { entry, oldRoot, actor, root, retired };
            });
            await idle(page);
            replacement = await page.evaluate(async () => {
                const qa = window.__classGear, state = window.__geometryDelivery, row = state.replacement;
                const installed = [...state.pass.entries.values()].filter(entry => entry.root === row.root);
                const proof = { oldRetired: row.retired, quality: row.root.userData.authoredQuality,
                    installed: installed.length, valid: installed.every(entry => state.pass.valid(entry)) };
                row.actor.dispose();
                const returned = await qa.MeshFactory.createMeshForType('Fighter', { quality: 'high' });
                proof.samePoolRootReturned = returned === row.oldRoot;
                row.entry.actor.setMesh(returned); row.entry.root = returned;
                row.entry.actor.syncEquipmentVisuals(row.entry.gear); await returned.userData.equipmentReady; qa.scene.add(returned);
                return proof;
            });
            await idle(page);
            expect(replacement.oldRetired && replacement.valid && replacement.samePoolRootReturned).toBe(true);
            expect(replacement.quality).toBe('low'); expect(replacement.installed).toBe(11);
            expect(await page.evaluate(() => window.__geometryDelivery.pass.entries.size)).toBe(initial.registered);
        }
        await writeFile(testInfo.outputPath('gameplay-geometry-delivery.json'), JSON.stringify({ runtimeOwned: owned, replacement, initial, samples, changed, restored, detached, reattached, faded, afterStealth,
            scope: 'Actual worker delivery for supplied High/Low four-class bodies/fitted gear;64 pose/zoom controls, all exact old-index-subset versus compact RGBA plus32 exact close originals. Includes independent blink, rapid gear changes/cache reuse, stealth, detach/reattach and pool replacement. Retained typed-array byte counts only, not whole-browser or peak memory. No default activation/device/campaign/final-art certificate.' }, null, 2));
    } finally {
        await page.evaluate(() => {
            const state = window.__geometryDelivery, qa = window.__classGear;
            state.stopped = true; state.pass.original = state.originalRender; state.pass.register = state.originalRegister;
            state.runtime?.dispose(); state.delivery.dispose(); state.pass.dispose();
            for (const row of state.legacy.values()) row.legacy.dispose();
            qa.camera = state.oldCamera; delete window.__geometryDelivery; qa.sample('CombatIdle');
        });
    }
}
