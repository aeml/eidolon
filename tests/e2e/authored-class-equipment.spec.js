import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('all delivered classes use fitted gear, independent rigs and alternating Rogue strikes', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
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
            const body = root.getObjectByName(`${type}_Body`);
            let attached = 0, wrongBones = 0;
            root.traverse(part => { if (part.isSkinnedMesh && part.userData.authoredEquipment) {
                attached++; if (!part.skeleton.bones.every(bone => body.skeleton.bones.includes(bone))) wrongBones++;
            } });
            actor.playAnimation('CombatIdle', true, true); actor.updateAnimationMixer(.2);
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
        const rogue = actors.find(actor => actor.type === 'Rogue' && actor.quality === 'high');
        rogue.root.userData.updateWeaponProfile(rogue.gear);
        const strikes = [];
        for (let i = 0; i < 4; i++) {
            rogue.actor.playAnimation('Attack', false, true); strikes.push(rogue.actor.currentAction.getClip().name);
            rogue.actor.playAnimation('Attack', false); // Reconciliation must not flip hands each frame.
            if (strikes[i] !== rogue.actor.currentAction.getClip().name) throw new Error('Attack hand changed mid-strike');
        }
        window.__classGear = { actors, renderer, scene, camera, sample, MeshFactory };
        return { classes: actors.map(({ type, quality, attached, wrongBones, items }) => ({ type, quality, attached, wrongBones, items })), strikes,
            independent: actors.every(({ root }, i) => i % 2 === 0 || root.getObjectByName(`${actors[i].type}_Body`).skeleton.bones[0] !== actors[i - 1].root.getObjectByName(`${actors[i].type}_Body`).skeleton.bones[0]) };
    });
    expect(evidence.independent).toBe(true);
    expect(evidence.classes).toHaveLength(8);
    for (const actor of evidence.classes) { expect(actor.attached).toBeGreaterThan(9); expect(actor.wrongBones).toBe(0); expect(actor.items).toBe(14); }
    expect(evidence.strikes).toEqual(['Dagger_Attack', 'Sword_Attack_Left', 'Dagger_Attack', 'Sword_Attack_Left']);
    let poseIndex = 0;
    for (const [state, time, yaw] of [['CombatIdle', .3, 0], ['Run', .3, .7], ['Attack', 14 / 30, 0], ['Attack', 14 / 30, 0], ['Cast', .4, 0], ['Channel', .5, .4], ['Block', .3, Math.PI]]) {
        expect(await page.evaluate(({ state, time, yaw }) => window.__classGear.sample(state, time, yaw), { state, time, yaw })).toBe(0);
        await page.locator('#class-equipment-qa').screenshot({ path: testInfo.outputPath(`${poseIndex++}-${state}.png`) });
    }
    const ownership = await page.evaluate(async () => {
        const { actors, MeshFactory } = window.__classGear;
        const first = actors[0], second = actors[1];
        const secondIndex = second.root.getObjectByName('Fighter_Body').geometry.index.count;
        first.actor.syncEquipmentVisuals({}); await first.root.userData.equipmentReady;
        const ownRestored = first.root.getObjectByName('Fighter_Body').geometry === (await MeshFactory.loadModel('./assets/archetypes/Fighter/fighter-runtime-high.glb')).scene.getObjectByName('Fighter_Body').geometry;
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
            return { type: shown.userData.authoredClass, quality: shown.userData.authoredQuality, items: shown.userData.equipmentVisualItemCount,
                independent: shown.getObjectByName(`${type}_Body`).skeleton.bones[0] !== actor.root.getObjectByName(`${type}_Body`).skeleton.bones[0],
                idle: shown.userData.resolveAnimationName('Idle') };
        }, type);
        expect(preview).toEqual({ type, quality: 'low', items: 14, independent: true, idle: { Rogue: 'Dagger_Idle_Dual', Wizard: 'Staff_Idle', Cleric: 'Mace_Idle' }[type] });
        await page.locator('.character-preview-stage canvas').screenshot({ path: testInfo.outputPath(`${type}-equipped-preview.png`) });
    }
    await page.evaluate(() => { window.__classGear.preview.dispose(); window.__classGear.previewHost.remove(); });
    expect(failures, failures.join('\n')).toEqual([]);
});
