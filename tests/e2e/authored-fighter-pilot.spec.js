import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test('derived Fighter assets render and animate with independent player skeletons', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const intake = await page.evaluate(async () => {
        const THREE = await import('three');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { Actor } = await import('/src/entities/Actor.js');
        const { createAuthoredFighterInstance, fighterRuntimePath } = await import('/src/art/AuthoredFighter.js');
        document.getElementById('start-screen').style.display = 'none';
        const started = performance.now();
        const inputs = await Promise.all(['high', 'low'].map(quality => MeshFactory.loadModel(fighterRuntimePath(quality))));
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(1280, 900); renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.shadowMap.enabled = true;
        renderer.domElement.id = 'fighter-pilot';
        Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', zIndex: '10000' });
        document.body.appendChild(renderer.domElement);
        const scene = new THREE.Scene(); scene.background = new THREE.Color('#171b23');
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#303946', roughness: .9 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
        scene.add(new THREE.HemisphereLight('#d0deee', '#504238', 2));
        const key = new THREE.DirectionalLight('#ffe0ba', 3);
        key.position.set(-5, 10, 7); key.castShadow = true;
        key.shadow.camera.left = -12; key.shadow.camera.right = 12;
        key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
        key.shadow.mapSize.set(2048, 2048); scene.add(key);
        // Use the game's normal/bias policy, not WebGL's zero-bias default,
        // which produces self-shadow acne that resembles a bad skin texture.
        key.shadow.bias = -.00014;
        key.shadow.normalBias = .05;
        const camera = new THREE.PerspectiveCamera(35, 1280 / 900, .1, 80);
        camera.position.set(0, 4.2, 16); camera.lookAt(0, 2, 0);
        const actors = await Promise.all(inputs.flatMap((input, index) => Array.from({ length: 2 }, async (_, seat) => {
            const entity = new Actor(`equipped-fighter-pilot-${index}-${seat}`, {});
            entity.meshType = 'Fighter';
            entity.gameEngine = { renderSystem: { graphicsQuality: index === 0 ? 'high' : 'low', isMobile: false } };
            entity.position.x = (index * 2 + seat - 1.5) * 3;
            await entity.ensureMesh();
            const root = entity.mesh;
            if (root?.userData.authoredClass !== 'Fighter') throw new Error('Normal Fighter load did not select the authored model');
            entity.render(1);
            scene.add(root);
            return { root, mixer: entity.mixer, entity };
        })));
        const renderPose = (clipName, yaw = 0, time = .25) => {
            for (const actor of actors) {
                actor.mixer.stopAllAction(); actor.root.userData.resetRestPose();
                const clip = actor.root.userData.animations.find(clip => clip.name === clipName);
                actor.mixer.clipAction(clip).reset().play(); actor.mixer.setTime(time);
                actor.root.rotation.y = yaw;
                actor.root.userData.updateEquipmentPose?.();
            }
            renderer.render(scene, camera);
        };
        renderPose('Idle');
        const body = actors[0].root.getObjectByName('Fighter_Body');
        const clonedBody = actors[1].root.getObjectByName('Fighter_Body');
        const independent = body.skeleton.bones.every((bone, index) => bone !== clonedBody.skeleton.bones[index]);
        const textureImages = [];
        for (const input of inputs) input.scene.traverse(part => {
            for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
                if (!material) continue;
                for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
                    const image = material[key]?.image;
                    if (image) textureImages.push([image.width, image.height]);
                }
            }
        });
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        window.fighterPilot = { THREE, renderer, scene, camera, actors, renderPose, inputs };
        return { loadMs: performance.now() - started, independent, textureImages,
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'not exposed',
            calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
            skinCounts: actors.map(actor => { let count = 0; actor.root.traverse(part => { if (part.isSkinnedMesh) count++; }); return count; }) };
    });
    expect(intake.independent).toBe(true);
    expect(intake.skinCounts).toEqual([11, 11, 11, 11]);
    expect(intake.textureImages.length).toBeGreaterThan(0);
    expect(intake.textureImages.every(([width, height]) => width <= 1024 && height <= 1024 && width > 0 && height > 0)).toBe(true);
    for (const [clip, yaw] of [['Idle', 0], ['Run', Math.PI / 2], ['Attack', 0], ['Block', 0], ['Death', 0], ['Jump', Math.PI],
        ['Cast', 0], ['Channel', 0], ['Guard', 0], ['Shout', 0], ['Bless', 0]]) {
        const pose = await page.evaluate(({ clip, yaw }) => {
            const { renderPose, actors } = window.fighterPilot;
            renderPose(clip, yaw);
            let bad = 0;
            for (const actor of actors) actor.root.traverse(part => { if (!part.matrixWorld.elements.every(Number.isFinite)) bad++; });
            return bad;
        }, { clip, yaw });
        expect(pose).toBe(0);
        await page.locator('#fighter-pilot').screenshot({ path: testInfo.outputPath(`${clip}.png`) });
    }
    const movingCast = await page.evaluate(async () => {
        const { THREE, inputs } = window.fighterPilot;
        const { Actor } = await import('/src/entities/Actor.js');
        const { createAuthoredFighterInstance } = await import('/src/art/AuthoredFighter.js');
        return inputs.map((input, index) => {
            const make = () => {
                const actor = new Actor(`fighter-moving-pilot-${index}`, {});
                actor.meshType = 'Fighter'; actor.setMesh(createAuthoredFighterInstance(input, { quality: index === 0 ? 'high' : 'low' }));
                actor.isRemote = true; actor.state = 'MOVING'; actor.isRunning = true;
                actor.playAnimation('Run'); actor.updateAnimationMixer(.15);
                actor.playAbilityAnimation('Guardian Roar', { duration: 1 });
                return actor;
            };
            const actor = make(), baseline = make(), samples = [];
            baseline.movingCastGait.dispose(); baseline.movingCastGait = null;
            let upperBodyDifference = 0;
            for (let frame = 0; frame < 30; frame++) {
                actor.updateAnimationMixer(1 / 60); baseline.updateAnimationMixer(1 / 60);
                samples.push(actor.mesh.getObjectByName('thigh_r').quaternion.clone());
                for (const name of ['upperarm_r', 'lowerarm_r', 'spine_03']) {
                    // Float32 source rotations can be slightly non-unit;
                    // angleTo(q, q) then reports a false angle. Compare the
                    // actual mixer components to prove the mask left them alone.
                    const actual = actor.mesh.getObjectByName(name).quaternion.toArray();
                    const expected = baseline.mesh.getObjectByName(name).quaternion.toArray();
                    upperBodyDifference = Math.max(upperBodyDifference, ...actual.map((value, component) => Math.abs(value - expected[component])));
                }
            }
            actor.playHitReaction(new THREE.Vector3(-5, 0, 0), 10);
            const result = { stride: Math.max(...samples.map(pose => pose.angleTo(samples[0]))), upperBodyDifference,
                clip: actor.currentAnimationName, position: actor.position.toArray(), recoilRig: actor.hitReaction?.rig?.name };
            actor.dispose(); baseline.dispose();
            return result;
        });
    });
    for (const result of movingCast) {
        expect(result.stride).toBeGreaterThan(.1);
        expect(result.upperBodyDifference).toBeLessThan(1e-12);
        expect(result.position).toEqual([0, 0, 0]);
        expect(result.recoilRig).toBe('FighterVisualRig');
    }
    intake.movingCast = movingCast;
    const equipped = await page.evaluate(async () => {
        const { actors, renderPose, renderer } = window.fighterPilot;
        const kits = [
            ['Iron Helm', 'Steel Pauldrons', 'Plate Mail', 'Iron Gauntlets', 'Plated Girdle', 'Plate Greaves', 'Iron Boots', 'Iron Sword', 'Wooden Shield'],
            ['Leather Cap', 'Reinforced Spaulders', 'Leather Tunic', 'Leather Gloves', 'Studded Belt', 'Leather Pants', 'Leather Boots', 'Steel Dagger', 'Wooden Shield'],
            ['Iron Helm', 'Steel Pauldrons', 'Plate Mail', 'Iron Gauntlets', 'Plated Girdle', 'Plate Greaves', 'Iron Boots', 'Cleric Mace', 'Wooden Shield'],
            ['Silk Hood', 'Velvet Mantle', 'Robes', 'Silk Gloves', 'Silk Sash', 'Silk Skirt', 'Sandals', 'Wooden Staff', 'Spell Tome']
        ];
        const slots = ['head', 'shoulders', 'chest', 'gloves', 'belt', 'legs', 'feet', 'mainHand', 'offHand'];
        const results = actors.map(({ entity, root }, index) => {
            const names = Object.fromEntries(slots.map((slot, i) => [slot, kits[index][i]]));
            Object.assign(names, { neck: 'Pendant', ring1: 'Gold Ring', ring2: 'Ruby Ring', trinket1: 'Amulet of Power', trinket2: 'Orb of Mana' });
            const equipment = Object.fromEntries(Object.entries(names).map(([slot, name]) => [slot, { id: `pilot-${index}-${slot}`, name, baseName: name,
                slot: slot.startsWith('ring') ? 'ring' : slot.startsWith('trinket') ? 'trinket' : slot,
                level: 60, rarity: index === 1 ? 'Uncommon' : 'Rare', potency: 4,
                sockets: ['chest', 'mainHand'].includes(slot) ? 2 : 0, gems: ['chest', 'mainHand'].includes(slot) ? [{ type: 'Ruby' }, { type: 'Sapphire' }] : [],
                setId: slot === 'chest' ? 'bulwark_ages' : '', uniqueEffect: slot === 'mainHand' ? 'guardian' : '' }]));
            const original = root.getObjectByName('Fighter_Body').geometry;
            const result = entity.syncEquipmentVisuals(equipment);
            const garments = root.getObjectByName('AuthoredFighterGarments');
            const skins = [];
            garments.traverse(part => { if (part.isSkinnedMesh) skins.push({ name: part.name, triangles: part.geometry.index?.count / 3 || part.geometry.attributes.position.count / 3,
                sameSkeleton: part.skeleton === root.getObjectByName('Fighter_Body').skeleton }); });
            entity.userDataPilotEquipment = equipment;
            return { ...result, skins, masked: root.getObjectByName('Fighter_Body').geometry !== original,
                hairHidden: !root.getObjectByName('Fighter_Hair').visible, shortsHidden: !root.getObjectByName('Fighter_Undershorts').visible };
        });
        renderPose('Idle');
        return { actors: results, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    });
    await writeFile(testInfo.outputPath('equipment-intake.json'), JSON.stringify(equipped, null, 2));
    await page.locator('#fighter-pilot').screenshot({ path: testInfo.outputPath('Equipped-Idle.png') });
    for (const actor of equipped.actors) {
        expect(actor.supported).toBe(true); expect(actor.items).toBe(14); expect(actor.missing).toEqual([]);
        expect(actor.masked && actor.hairHidden && actor.shortsHidden).toBe(true);
        expect(actor.skins.filter(skin => skin.name.startsWith('AuthoredGear_'))).toHaveLength(6);
        expect(actor.skins.filter(skin => !(skin.triangles > 0 && skin.sameSkeleton))).toEqual([]);
    }
    for (const clip of ['Idle', 'Run', 'Attack', 'Guard', 'Shout', 'Death']) {
        await page.evaluate(clip => window.fighterPilot.renderPose(clip, 0, .45), clip);
        await page.locator('#fighter-pilot').screenshot({ path: testInfo.outputPath(`Equipped-${clip}.png`) });
    }
    const seated = await page.evaluate(async () => {
        const { actors, renderPose, renderer, scene, camera, THREE } = window.fighterPilot;
        const { CasinoController } = await import('/src/core/CasinoController.js');
        renderPose('Idle');
        const controller = Object.assign(Object.create(CasinoController.prototype), {
            engine: { player: actors[0].entity, currentInstanceId: '' }, poses: new Map(), cutawayActors: new Map(), active: false
        });
        const previous = actors.map(({ root }) => root.getObjectByName('thigh_l').quaternion.toArray());
        actors.forEach(({ entity, root }) => { entity.state = 'SEATED'; root.rotation.y = Math.PI / 6; });
        controller.render(actors.map(actor => actor.entity)); renderer.render(scene, camera);
        window.fighterPilot.clearSeated = () => {
            actors.forEach(({ entity }) => { entity.state = 'IDLE'; });
            controller.render(actors.map(actor => actor.entity));
            return actors.every(({ root }, i) => root.getObjectByName('thigh_l').quaternion.toArray().every((value, j) => value === previous[i][j]));
        };
        return actors.map(({ root, entity }) => ({ hipHeight: root.getObjectByName('pelvis').getWorldPosition(new THREE.Vector3()).y,
            slots: root.userData.equipmentVisualItemCount, position: entity.position.toArray() }));
    });
    seated.forEach(actor => { expect(actor.hipHeight).toBeCloseTo(1.12, 4); expect(actor.slots).toBe(14); expect(actor.position[1]).toBe(0); });
    await page.locator('#fighter-pilot').screenshot({ path: testInfo.outputPath('Equipped-Seated.png') });
    expect(await page.evaluate(() => window.fighterPilot.clearSeated())).toBe(true);
    intake.seated = seated;
    const death = await page.evaluate(() => {
        const { actors, renderPose, THREE } = window.fighterPilot;
        const duration = actors[0].root.userData.animations.find(clip => clip.name === 'Death').duration;
        renderPose('Death', 0, duration * .98);
        return actors.map(({ root, entity }) => ({ headHeight: root.getObjectByName('head').getWorldPosition(new THREE.Vector3()).y,
            position: entity.position.toArray() }));
    });
    await page.locator('#fighter-pilot').screenshot({ path: testInfo.outputPath('Equipped-DeathEnd.png') });
    death.forEach(actor => { expect(actor.headHeight).toBeLessThan(1.8); expect(actor.position[1]).toBe(0); });
    intake.death = death;
    const workload = await page.evaluate(async () => {
        const { actors, renderer, scene, THREE, renderPose } = window.fighterPilot;
        const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, .1, 500);
        camera.position.set(100, 100, 100); camera.lookAt(0, 2, 0);
        renderPose('Run');
        const samples = [];
        for (let frame = 0; frame < 60; frame++) {
            await new Promise(requestAnimationFrame);
            const started = performance.now();
            actors.forEach(({ entity }) => entity.updateAnimationMixer(1 / 60));
            renderer.render(scene, camera); samples.push(performance.now() - started);
        }
        samples.sort((a, b) => a - b);
        return { renderCpuMsP50: samples[30], renderCpuMsP95: samples[57], frames: samples.length,
            calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
            geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    });
    await page.locator('#fighter-pilot').screenshot({ path: testInfo.outputPath('Equipped-Isometric.png') });
    intake.workload = workload;
    expect(workload.frames).toBe(60); expect(Number.isFinite(workload.renderCpuMsP95)).toBe(true);
    for (const index of [0, 2]) {
        await page.evaluate(async index => {
            const { actors, renderer } = window.fighterPilot;
            const { CharacterPreview } = await import('/src/ui/CharacterPreview.js');
            renderer.domElement.style.display = 'none';
            const host = document.createElement('div'); host.id = 'fighter-preview-review';
            host.style.cssText = 'position:fixed;inset:0;z-index:10001;background:#171b23;display:grid;place-content:center;color:white';
            host.innerHTML = '<div class="character-preview-label"></div><div class="character-preview-stage" style="width:360px;height:480px"><span class="character-preview-status"></span></div>';
            document.body.appendChild(host);
            const preview = new CharacterPreview(host), { entity } = actors[index];
            entity.subType = 'Fighter'; entity.level = 60;
            preview.update(entity); window.fighterPreviewReview = { preview, host, entity };
        }, index);
        await page.waitForFunction(() => window.fighterPreviewReview.preview.model?.userData.authoredClass === 'Fighter');
        const preview = await page.evaluate(() => {
            const { preview, entity } = window.fighterPreviewReview;
            return { quality: preview.model.userData.authoredQuality, slots: preview.model.userData.equipmentVisualItemCount,
                independent: preview.model.getObjectByName('Fighter_Body').skeleton.bones[0] !== entity.mesh.getObjectByName('Fighter_Body').skeleton.bones[0],
                signature: preview.model.userData.equipmentVisualSignature === entity.mesh.userData.equipmentVisualSignature };
        });
        expect(preview).toEqual({ quality: index === 0 ? 'high' : 'low', slots: 14, independent: true, signature: true });
        await page.locator('#fighter-preview-review').screenshot({ path: testInfo.outputPath(`CharacterPreview-${preview.quality}.png`) });
        await page.evaluate(() => { window.fighterPreviewReview.preview.dispose(); window.fighterPreviewReview.host.remove(); window.fighterPilot.renderer.domElement.style.display = ''; });
    }
    const restored = await page.evaluate(async () => {
        const { actors, renderPose } = window.fighterPilot;
        const { clearEquipmentVisuals } = await import('/src/art/EquipmentVisuals.js');
        const result = actors.map(({ root }) => {
            clearEquipmentVisuals(root);
            return { hair: root.getObjectByName('Fighter_Hair').visible, shorts: root.getObjectByName('Fighter_Undershorts').visible,
                garmentChildren: root.getObjectByName('AuthoredFighterGarments').children.reduce((sum, mount) => sum + mount.children.length, 0),
                rigidChildren: ['head', 'mainHand', 'offHand', 'neck', 'ring1', 'ring2', 'trinket1', 'trinket2'].map(slot => root.getObjectByName(`AuthoredMount_${slot}`).children.length) };
        });
        renderPose('Idle'); return result;
    });
    for (const actor of restored) {
        expect(actor.hair && actor.shorts).toBe(true); expect(actor.garmentChildren).toBe(0);
        expect(actor.rigidChildren).toEqual(Array(8).fill(0));
    }
    intake.equipped = equipped; intake.restored = restored;
    await testInfo.attach('fighter-pilot-metrics', { body: JSON.stringify(intake, null, 2), contentType: 'application/json' });
    await writeFile(testInfo.outputPath('metrics.json'), JSON.stringify(intake, null, 2));
    expect(failures, failures.join('\n')).toEqual([]);
    await page.evaluate(() => {
        const { actors, renderer } = window.fighterPilot;
        actors.forEach(actor => actor.entity.dispose());
        renderer.dispose(); renderer.domElement.remove();
    });
});
