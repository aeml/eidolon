import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { installWearableAttributePilot } from './wearable-attribute-pilot.js';
import { installBodyLodPilot, captureBodyLodReview } from './body-lod-pilot.js';
import { collectBrowserFailures } from './helpers.js';

// Explicit routed-asset comparisons need both controls to bypass the service
// worker, which would otherwise serve reviewed files outside page.route.
test.use({ serviceWorkers: process.env.EIDOLON_E2E_WEARABLE_ATTRIBUTE_COMPARE === '1' ||
    process.env.EIDOLON_E2E_WEARABLE_ATTRIBUTE_PILOT || process.env.EIDOLON_E2E_BODY_LOD_COMPARE === '1' ||
    process.env.EIDOLON_E2E_BODY_LOD_PILOT ? 'block' : 'allow' });

test('all delivered classes use fitted gear, independent rigs and alternating Rogue strikes', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    const attributePilot = await installWearableAttributePilot(page);
    const bodyPilot = await installBodyLodPilot(page);
    const surfaceReference = process.env.EIDOLON_E2E_AUTHORED_SURFACES_REFERENCE === '1';
    if (surfaceReference) {
        // Explicit isolated A/B reference: identical gear/poses/batching but
        // no new generated surfaces. No runtime diagnostic flag or source edit.
        await page.route('**/src/art/AuthoredEquipmentSurfaces.js', route => route.fulfill({
            contentType: 'text/javascript', body: 'export const applyAuthoredEquipmentSurface = () => false; export const hasTrustedEquipmentSurfaceMaps = () => false;'
        }));
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const evidence = await page.evaluate(async () => {
        const THREE = await import('three');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { Actor } = await import('/src/entities/Actor.js');
        document.getElementById('start-screen').style.display = 'none';
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(1440, 900); renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15; renderer.domElement.id = 'class-equipment-qa';
        Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', zIndex: '10000' });
        document.body.appendChild(renderer.domElement);
        const scene = new THREE.Scene(); scene.background = new THREE.Color('#151a21');
        scene.add(new THREE.HemisphereLight('#d3e2ee', '#46372e', 2));
        const key = new THREE.DirectionalLight('#ffe3c4', 3); key.position.set(-8, 12, 9); scene.add(key);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: '#30343b', roughness: .85 }));
        floor.rotation.x = -Math.PI / 2; scene.add(floor);
        const camera = new THREE.PerspectiveCamera(36, 1440 / 900, .1, 100);
        camera.position.set(0, 6, 28); camera.lookAt(0, 2, 0);
        const classes = ['Fighter', 'Rogue', 'Wizard', 'Cleric'];
        const outfits = {
            Fighter: { head: 'Iron Helm', chest: 'Plate Mail', legs: 'Plate Greaves', feet: 'Iron Boots', gloves: 'Iron Gauntlets', shoulders: 'Steel Pauldrons', belt: 'Plated Girdle', mainHand: 'Iron Sword', offHand: 'Wooden Shield' },
            Rogue: { head: 'Leather Cap', chest: 'Leather Tunic', legs: 'Leather Pants', feet: 'Leather Boots', gloves: 'Leather Gloves', shoulders: 'Reinforced Spaulders', belt: 'Studded Belt', mainHand: 'Steel Dagger', offHand: 'Iron Sword' },
            Wizard: { head: 'Silk Hood', chest: 'Robes', legs: 'Silk Skirt', feet: 'Sandals', gloves: 'Silk Gloves', shoulders: 'Velvet Mantle', belt: 'Silk Sash', mainHand: 'Wooden Staff', offHand: 'Spell Tome' },
            Cleric: { head: 'Iron Helm', chest: 'Robes', legs: 'Leather Pants', feet: 'Iron Boots', gloves: 'Silk Gloves', shoulders: 'Steel Pauldrons', belt: 'Studded Belt', mainHand: 'Cleric Mace', offHand: 'Wooden Shield' }
        };
        const actors = [];
        for (const [i, type] of classes.entries()) for (const quality of ['high', 'low']) {
            const root = await MeshFactory.createMeshForType(type, { quality });
            if (root.userData.authoredClass !== type) throw new Error(`Authored ${type} failed (${quality})`);
            const actor = new Actor(`asset-${type}-${quality}`, {}); actor.meshType = type; actor.setMesh(root);
            root.position.set((i - 1.5) * 5.3, 0, quality === 'high' ? 0 : -8); scene.add(root);
            const gear = Object.fromEntries(Object.entries({ ...outfits[type], ring1: 'Ruby Ring', ring2: 'Silver Ring', neck: 'Necklace', trinket1: 'Amulet of Power', trinket2: 'Orb of Mana' })
                .map(([slot, name]) => [slot, { id: `${type}-${quality}-${slot}`, name, baseName: name, type: ['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace'].includes(name) ? 'WEAPON' : 'ARMOR',
                    slot: slot === 'offHand' && ['Iron Sword', 'Steel Dagger', 'Cleric Mace'].includes(name) ? 'mainHand' : slot,
                    rarity: quality === 'high' ? 'Legendary' : 'Rare', potency: 5 }]));
            actor.syncEquipmentVisuals(gear); await root.userData.equipmentReady;
            if (root.userData.equipmentVisualMissing?.length) throw new Error(`Missing ${type} equipment`);
            if (root.userData.equipmentVisualFallback?.length) throw new Error(`Runtime ${type} equipment fell back to original geometry`);
            const body = root.getObjectByName(`${type}_Body`);
            let attached = 0, wrongBones = 0;
            root.traverse(part => { if (part.isSkinnedMesh && part.userData.authoredEquipment) {
                attached++; if (!part.skeleton.bones.every(bone => body.skeleton.bones.includes(bone))) wrongBones++;
            } });
            actor.playAnimation('CombatIdle', true, true); actor.updateAnimationMixer(.2);
            const batches = []; root.traverse(part => { if (part.userData.fittedBatchSources) batches.push(part); });
            if (!batches.length) throw new Error(`No fitted batch for ${type}/${quality}`);
            actors.push({ actor, root, type, quality, attached, wrongBones, items: root.userData.equipmentVisualItemCount, gear });
        }
        const sample = (state, time = .3, yaw = 0) => {
            let bad = 0;
            for (const { actor, root } of actors) {
                actor.mixer.stopAllAction(); root.userData.resetRestPose(); root.rotation.y = yaw;
                actor.currentAction = null; actor.playAnimation(state, !['Attack', 'Cast', 'Heal', 'Death'].includes(state), true);
                actor.updateAnimationMixer(time); root.updateMatrixWorld(true);
                root.traverse(part => {
                    if (!part.matrixWorld.elements.every(Number.isFinite)) bad++;
                    if (part.isSkinnedMesh && part.visible) {
                        const position = new THREE.Vector3();
                        for (let i = 0; i < part.geometry.attributes.position.count; i += 53) {
                            position.fromBufferAttribute(part.geometry.attributes.position, i); part.applyBoneTransform(i, position);
                            if (!position.toArray().every(Number.isFinite) || position.length() > 10) bad++;
                        }
                    }
                });
            }
            renderer.render(scene, camera); return bad;
        };
        sample('CombatIdle');
        const costs = [];
        for (const entry of actors) {
            for (const other of actors) other.root.visible = other === entry;
            renderer.render(scene, camera);
            costs.push({ type: entry.type, quality: entry.quality,
                calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
        }
        for (const entry of actors) entry.root.visible = true;
        for (let i = 0; i < 3; i++) renderer.render(scene, camera);
        const resources = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
            programs: renderer.info.programs.length };
        const rogue = actors.find(actor => actor.type === 'Rogue' && actor.quality === 'high');
        rogue.root.userData.updateWeaponProfile(rogue.gear);
        const strikes = [];
        for (let i = 0; i < 4; i++) {
            rogue.actor.playAnimation('Attack', false, true); strikes.push(rogue.actor.currentAction.getClip().name);
            rogue.actor.playAnimation('Attack', false); // Reconciliation must not flip hands each frame.
            if (strikes[i] !== rogue.actor.currentAction.getClip().name) throw new Error('Attack hand changed mid-strike');
        }
        window.__classGear = { actors, renderer, scene, camera, sample, MeshFactory };
        return { classes: actors.map(({ type, quality, attached, wrongBones, items }) => ({ type, quality, attached, wrongBones, items })), strikes, costs, resources,
            independent: actors.every(({ root }, i) => i % 2 === 0 || root.getObjectByName(`${actors[i].type}_Body`).skeleton.bones[0] !== actors[i - 1].root.getObjectByName(`${actors[i].type}_Body`).skeleton.bones[0]) };
    });
    if (process.env.EIDOLON_E2E_EQUIPPED_TRIANGLE_DIAGNOSIS === '1') {
        const census = await page.evaluate(() => {
            const { renderer, scene, camera, actors } = window.__classGear;
            const original = renderer.renderBufferDirect, visibility = actors.map(entry => entry.root.visible);
            const variants = []; let meshes;
            renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
                if (object.isMesh && object !== scene.children.find(child => child.geometry?.type === 'PlaneGeometry')) {
                    const count = group?.count ?? Math.min(geometry.drawRange.count,
                        geometry.index?.count ?? geometry.attributes.position.count);
                    meshes.push({ name: object.name, triangles: count / 3, vertices: geometry.attributes.position.count,
                        skinned: Boolean(object.isSkinnedMesh), morphTargets: Object.keys(geometry.morphAttributes),
                        fitted: Boolean(object.userData.authoredEquipment), slots: object.userData.fittedSlots ||
                            (object.userData.slot ? [object.userData.slot] : []), surfaceBatch: Boolean(material.userData.fittedSurfaceAttributes) });
                }
                return original.call(this, camera, scene, geometry, material, object, group);
            };
            try {
                for (const entry of actors) {
                    for (const other of actors) other.root.visible = other === entry;
                    meshes = []; renderer.render(scene, camera);
                    variants.push({ type: entry.type, quality: entry.quality, items: entry.items,
                        calls: renderer.info.render.calls, trianglesIncludingFloor: renderer.info.render.triangles,
                        meshes: meshes.sort((a, b) => b.triangles - a.triangles) });
                }
            } finally {
                renderer.renderBufferDirect = original;
                actors.forEach((entry, index) => { entry.root.visible = visibility[index]; });
            }
            const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), variants };
        });
        expect(census.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        expect(census.variants).toHaveLength(8);
        for (const variant of census.variants) {
            expect(variant.trianglesIncludingFloor).toBe(2 + variant.meshes.reduce((sum, mesh) => sum + mesh.triangles, 0));
        }
        await writeFile(testInfo.outputPath('equipped-triangle-diagnosis.json'), JSON.stringify({
            scope: 'Separate untimed native gallery draw census. Eight fully fitted High/Low class outfits, color pass only; actual game shadow/party timing recorded separately. ' +
                (attributePilot || bodyPilot ? 'Explicit generated geometry substitutions; source hashes and requests recorded separately.' : 'Normal selected runtime geometry.'), ...census
        }, null, 2));
        console.log('[diagnostic-equipped-triangles]', JSON.stringify(census.variants.map(({ type, quality, meshes }) => ({
            type, quality, total: meshes.reduce((sum, mesh) => sum + mesh.triangles, 0), top: meshes.slice(0, 4)
        }))));
    }
    expect(evidence.independent).toBe(true);
    await testInfo.attach('equipped-surface-costs', { body: JSON.stringify({ surfaceReference, costs: evidence.costs, resources: evidence.resources }), contentType: 'application/json' });
    console.log(`[equipped surface costs] ${JSON.stringify({ surfaceReference, costs: evidence.costs, resources: evidence.resources })}`);
    expect(evidence.classes).toHaveLength(8);
    for (const actor of evidence.classes) { expect(actor.attached).toBeGreaterThan(9); expect(actor.wrongBones).toBe(0); expect(actor.items).toBe(14); }
    expect(evidence.strikes).toEqual(['Dagger_Attack', 'Sword_Attack_Left', 'Dagger_Attack', 'Sword_Attack_Left']);
    let poseIndex = 0;
    for (const [state, time, yaw] of [['CombatIdle', .3, 0], ['Run', .3, .7], ['Attack', 14 / 30, 0], ['Attack', 14 / 30, 0], ['Cast', .4, 0], ['Channel', .5, .4], ['Block', .3, Math.PI]]) {
        expect(await page.evaluate(({ state, time, yaw }) => window.__classGear.sample(state, time, yaw), { state, time, yaw })).toBe(0);
        await page.locator('#class-equipment-qa').screenshot({ path: testInfo.outputPath(`${poseIndex++}-${state}.png`) });
    }
    // Front-only galleries miss lower layers protruding through a long robe.
    // Keep the ordinary poses and inspect the back/side without changing gear.
    for (const [label, state, time, yaw] of [
        ['back-idle', 'CombatIdle', .3, Math.PI],
        ['back-run', 'Run', .3, Math.PI],
        ['side-cast', 'Cast', .4, Math.PI / 2]
    ]) {
        expect(await page.evaluate(({ state, time, yaw }) => window.__classGear.sample(state, time, yaw), { state, time, yaw })).toBe(0);
        await page.locator('#class-equipment-qa').screenshot({ path: testInfo.outputPath(`${label}.png`) });
    }
    expect(await page.evaluate(async () => {
        const { applyActorStealthAppearance, restoreActorStealthAppearance } = await import('/src/entities/ActorStealthAppearance.js');
        const qa = window.__classGear, rogues = qa.actors.filter(entry => entry.type === 'Rogue');
        const check = hidden => rogues.every(({root}) => {
            let sources = 0, batches = 0, valid = true;
            root.traverse(mesh => {
                if (mesh.userData.fittedBatchSource) {
                    sources++; valid &&= mesh.visible === hidden && (!hidden || mesh.material.transparent && mesh.material.opacity === .3);
                }
                if (mesh.userData.fittedBatchSources) { batches++; valid &&= mesh.visible !== hidden; }
            });
            return valid && sources > 0 && batches > 0;
        });
        rogues.forEach(({actor}) => applyActorStealthAppearance(actor));
        const faded = check(true); qa.sample('CombatIdle');
        rogues.forEach(({actor}) => restoreActorStealthAppearance(actor));
        return faded && check(false) && qa.sample('CombatIdle') === 0;
    })).toBe(true);
    const mixed = await page.evaluate(async () => {
        const qa = window.__classGear;
        const changes = {
            Fighter: { chest: 'Robes', legs: 'Leather Pants' },
            Rogue: { chest: 'Robes' },
            Wizard: { chest: null, belt: null }, // Inspect the exposed waistband, not hidden by robes/a sash.
            Cleric: { legs: 'Plate Greaves' }
        };
        const results = [];
        for (const entry of qa.actors) {
            const gear = { ...entry.gear };
            for (const [slot, name] of Object.entries(changes[entry.type])) {
                if (name === null) delete gear[slot];
                else gear[slot] = { ...gear[slot], id: `mixed-${entry.type}-${slot}`, name, baseName: name };
            }
            entry.actor.syncEquipmentVisuals(gear); await entry.root.userData.equipmentReady;
            const shorts = entry.root.getObjectByName(`${entry.type}_Undershorts`);
            const pants = [];
            entry.root.traverse(mesh => {
                if (mesh.userData.slot === 'legs' && mesh.userData.fittedItem !== 'silk-skirt') pants.push(mesh);
            });
            const cutoff = 4.5 / entry.root.userData.authoredScale * .40;
            let concealedFaces = 0;
            for (const mesh of pants) {
                const { index, attributes: { position } } = mesh.geometry;
                for (let i = 0; i < index.count; i += 3) {
                    if ([0, 1, 2].every(k => position.getY(index.getX(i + k)) > cutoff)) concealedFaces++;
                }
            }
            results.push({ type: entry.type, quality: entry.quality,
                missing: entry.root.userData.equipmentVisualMissing, fallback: entry.root.userData.equipmentVisualFallback,
                items: entry.root.userData.equipmentVisualItemCount, shortsHidden: shorts.visible === false,
                maskedPants: pants.some(mesh => mesh.userData.fittedOwnedGeometry), concealedFaces });
        }
        return results;
    });
    for (const entry of mixed) {
        expect(entry.missing).toEqual([]); expect(entry.fallback).toEqual([]);
        expect(entry.items).toBe(entry.type === 'Wizard' ? 12 : 14);
        expect(entry.shortsHidden).toBe(true);
        if (entry.type !== 'Wizard') {
            // Knee/ankle-only material submeshes need no copy or masking.
            expect(entry.maskedPants, `${entry.type}/${entry.quality}`).toBe(true);
            expect(entry.concealedFaces, `${entry.type}/${entry.quality}`).toBe(0);
        }
    }
    for (const [label, state, time, yaw] of [
        ['mixed-back-idle', 'CombatIdle', .3, Math.PI],
        ['mixed-back-run', 'Run', .3, Math.PI],
        ['mixed-side-jump', 'Jump', .45, Math.PI / 2]
    ]) {
        expect(await page.evaluate(({ state, time, yaw }) => window.__classGear.sample(state, time, yaw), { state, time, yaw })).toBe(0);
        await page.locator('#class-equipment-qa').screenshot({ path: testInfo.outputPath(`${label}.png`) });
    }
    await page.evaluate(async () => {
        for (const { actor, root, gear } of window.__classGear.actors) {
            actor.syncEquipmentVisuals(gear); await root.userData.equipmentReady;
        }
    });
    if (process.env.EIDOLON_E2E_BODY_LOD_COMPARE === '1') {
        const samples = await captureBodyLodReview(page, testInfo);
        expect(samples).toHaveLength(process.env.EIDOLON_E2E_BODY_MORPH_BASIS_COMPARE === '1' ? 56 : 32);
        for (const sample of samples) {
            expect(sample.badVertices).toBe(0);
            expect(sample.morphNames).toEqual(['Blink_L', 'Blink_R']);
            expect(sample.morphInfluences).toEqual([sample.blinkLeft, sample.blinkRight]);
        }
        await writeFile(testInfo.outputPath('body-lod-review.json'), JSON.stringify(samples, null, 2));
    }
    const ownership = await page.evaluate(async () => {
        const { actors, MeshFactory } = window.__classGear;
        const { fighterRuntimePath } = await import('/src/art/AuthoredFighter.js');
        const first = actors[0], second = actors[1];
        const secondIndex = second.root.getObjectByName('Fighter_Body').geometry.index.count;
        first.actor.syncEquipmentVisuals({}); await first.root.userData.equipmentReady;
        const ownRestored = first.root.getObjectByName('Fighter_Body').geometry === (await MeshFactory.loadModel(fighterRuntimePath('high'))).scene.getObjectByName('Fighter_Body').geometry;
        const otherUnchanged = second.root.getObjectByName('Fighter_Body').geometry.index.count === secondIndex;
        first.actor.syncEquipmentVisuals(first.gear); MeshFactory.releaseMesh('Fighter', first.root);
        await first.root.userData.equipmentReady;
        return { ownRestored, otherUnchanged, releasedEmpty: first.root.userData.equipmentVisualItemCount === 0 };
    });
    expect(ownership).toEqual({ ownRestored: true, otherUnchanged: true, releasedEmpty: true });
    await page.evaluate(async () => {
        const { CharacterPreview } = await import('/src/ui/CharacterPreview.js');
        const host = document.createElement('div');
        Object.assign(host.style, { position: 'fixed', left: '0', top: '0', width: '430px', height: '720px', background: '#151a21', zIndex: '10001' });
        host.innerHTML = '<div class="character-preview-label"></div><div class="character-preview-stage" style="width:420px;height:680px"><span class="character-preview-status"></span></div>';
        document.body.append(host);
        window.__classGear.previewHost = host;
        window.__classGear.CharacterPreview = CharacterPreview;
    });
    for (const type of ['Rogue', 'Wizard', 'Cleric']) {
        const preview = await page.evaluate(async type => {
            const qa = window.__classGear;
            qa.preview?.dispose();
            qa.preview = new qa.CharacterPreview(qa.previewHost);
            const actor = qa.actors.find(actor => actor.type === type && actor.quality === 'low');
            qa.preview.update({ subType: type, level: 70, equipment: actor.gear, mesh: { userData: { authoredQuality: 'low' } } });
            await qa.preview.modelReady; await qa.preview.model.userData.equipmentReady; qa.preview.render();
            const shown = qa.preview.model;
            let batched = false; shown.traverse(mesh => { batched ||= Boolean(mesh.userData.fittedBatchSources); });
            return { type: shown.userData.authoredClass, quality: shown.userData.authoredQuality, items: shown.userData.equipmentVisualItemCount,
                independent: shown.getObjectByName(`${type}_Body`).skeleton.bones[0] !== actor.root.getObjectByName(`${type}_Body`).skeleton.bones[0],
                idle: shown.userData.resolveAnimationName('Idle'), batched };
        }, type);
        expect(preview).toEqual({ type, quality: 'low', items: 14, independent: true, idle: { Rogue: 'Dagger_Idle_Dual', Wizard: 'Staff_Idle', Cleric: 'Mace_Idle' }[type], batched: true });
        await page.locator('.character-preview-stage canvas').screenshot({ path: testInfo.outputPath(`${type}-equipped-preview.png`) });
    }
    await page.evaluate(() => { window.__classGear.preview.dispose(); window.__classGear.previewHost.remove(); });
    if (attributePilot) {
        const substitution = attributePilot.read();
        expect(substitution.requested.length).toBeGreaterThan(0);
        await writeFile(testInfo.outputPath('wearable-pilot-substitution.json'), JSON.stringify(substitution, null, 2));
    }
    if (bodyPilot) {
        const substitution = bodyPilot.read();
        expect(substitution.requested).toHaveLength(8);
        await writeFile(testInfo.outputPath('body-pilot-substitution.json'), JSON.stringify(substitution, null, 2));
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
