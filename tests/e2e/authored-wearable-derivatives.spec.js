import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { collectBrowserFailures } from './helpers.js';

// Qualification of explicitly supplied local copies, not production activation.
const directory = process.env.EIDOLON_E2E_WEARABLE_CATALOG_ROOT;
const catalog = directory && JSON.parse(fs.readFileSync(path.join(directory, 'runtime-catalog.json')));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const routes = new Map();
if (directory) {
    if (!path.isAbsolute(directory)) throw new Error('Wearable artifacts require an absolute path');
    const manifest = fs.readFileSync('assets/equipment/authored/manifest.json');
    if (digest(manifest) !== catalog.sourceManifestSHA256 || catalog.sources.length !== 252) throw new Error('Unqualified source catalog');
    for (const row of catalog.sources) {
        if (digest(fs.readFileSync(row.source)) !== row.sourceHash) throw new Error('Delivered wearable changed');
        for (const [quality, variant] of Object.entries(row.variants)) {
            if (!path.resolve(variant.file).startsWith(`${path.resolve(directory)}${path.sep}`) ||
                digest(fs.readFileSync(variant.file)) !== variant.sha256) throw new Error('Generated wearable changed');
            const url = `/__qa/wearable-derivatives/${row.itemID}/${row.tier}/${row.actorClass}/${quality}.glb`;
            if (routes.has(url)) throw new Error('Duplicate derivative identity');
            routes.set(url, variant.file);
        }
    }
}

for (const actorClass of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
    for (const tier of ['standard', 'legendary']) for (const quality of ['high', 'low']) {
        test(`complete derived outfit retains animated ${actorClass} rig: ${tier}/${quality}`, async ({ page, baseURL }, testInfo) => {
            test.skip(!directory, 'Requires an explicitly generated wearable catalog');
            const failures = collectBrowserFailures(page, baseURL);
            await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
            await page.route('**/__qa/wearable-derivatives/**', route => {
                const file = routes.get(new URL(route.request().url()).pathname);
                return file ? route.fulfill({ path: file, contentType: 'model/gltf-binary' }) : route.abort();
            });
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.goto('/', { waitUntil: 'networkidle' });
            const result = await page.evaluate(async ({ actorClass, tier, quality, rows }) => {
                const THREE = await import('three');
                const { MeshFactory } = await import('/src/utils/MeshFactory.js');
                const { Actor } = await import('/src/entities/Actor.js');
                const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
                const { AUTHORED_ASSETS } = await import('/src/assets/authoredEquipment.generated.js');
                document.getElementById('start-screen').style.display = 'none';
                const renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(1280, 900); renderer.setPixelRatio(1);
                renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
                renderer.toneMappingExposure = 1.15; renderer.domElement.id = 'wearable-derivatives-qa';
                Object.assign(renderer.domElement.style, { position: 'fixed', inset: 0, zIndex: 10000 });
                document.body.appendChild(renderer.domElement);
                const scene = new THREE.Scene(); scene.background = new THREE.Color('#151a21');
                scene.add(new THREE.HemisphereLight('#d3e2ee', '#46372e', 2));
                const light = new THREE.DirectionalLight('#ffe3c4', 3); light.position.set(-8, 12, 9); scene.add(light);
                const camera = new THREE.PerspectiveCamera(36, 1280 / 900, .1, 100);
                camera.position.set(0, 4.5, 20); camera.lookAt(0, 2.1, 0);
                const outfits = {
                    Fighter: { head: 'Iron Helm', chest: 'Plate Mail', legs: 'Plate Greaves', feet: 'Iron Boots', gloves: 'Iron Gauntlets', shoulders: 'Steel Pauldrons', belt: 'Plated Girdle', mainHand: 'Iron Sword', offHand: 'Wooden Shield' },
                    Rogue: { head: 'Leather Cap', chest: 'Leather Tunic', legs: 'Leather Pants', feet: 'Leather Boots', gloves: 'Leather Gloves', shoulders: 'Reinforced Spaulders', belt: 'Studded Belt', mainHand: 'Steel Dagger', offHand: 'Iron Sword' },
                    Wizard: { head: 'Silk Hood', chest: 'Robes', legs: 'Silk Skirt', feet: 'Sandals', gloves: 'Silk Gloves', shoulders: 'Velvet Mantle', belt: 'Silk Sash', mainHand: 'Wooden Staff', offHand: 'Spell Tome' },
                    Cleric: { head: 'Iron Helm', chest: 'Robes', legs: 'Leather Pants', feet: 'Iron Boots', gloves: 'Silk Gloves', shoulders: 'Steel Pauldrons', belt: 'Studded Belt', mainHand: 'Cleric Mace', offHand: 'Wooden Shield' }
                };
                const outfit = { ...outfits[actorClass], ring1: 'Ruby Ring', ring2: 'Silver Ring', neck: 'Necklace', trinket1: 'Amulet of Power', trinket2: 'Orb of Mana' };
                const gear = Object.fromEntries(Object.entries(outfit).map(([slot, name]) => [slot,
                    { ...BASE_ITEMS.find(item => item.name === name), id: `derivative-${slot}`, baseName: name,
                        rarity: tier === 'legendary' ? 'Legendary' : 'Rare', level: 75 }]));
                const substitutions = Object.values(outfit).filter((name, index, all) => all.indexOf(name) === index).map(name => {
                    const fits = AUTHORED_ASSETS.items[name].models[tier];
                    const fit = fits[actorClass] ? actorClass : 'universal';
                    const row = rows.find(row => row.item === name && row.tier === tier && row.actorClass === fit);
                    if (!row) throw new Error(`Missing derived fit: ${name}/${fit}/${tier}`);
                    return { fits, fit, original: fits[fit], url: `/__qa/wearable-derivatives/${row.itemID}/${tier}/${fit}/${quality}.glb` };
                });
                const actors = [], counts = [];
                try {
                    for (const derivative of [false, true]) {
                        const root = await MeshFactory.createMeshForType(actorClass, { quality });
                        const actor = new Actor(`derivative-${derivative}`, {}); actor.meshType = actorClass; actor.setMesh(root);
                        if (derivative) substitutions.forEach(row => { row.fits[row.fit] = row.url; });
                        actor.syncEquipmentVisuals(gear); await root.userData.equipmentReady;
                        substitutions.forEach(row => { row.fits[row.fit] = row.original; });
                        if (root.userData.equipmentVisualItemCount !== 14 || root.userData.equipmentVisualMissing?.length) throw new Error('Missing complete outfit');
                        const body = root.getObjectByName(`${actorClass}_Body`);
                        let attached = 0;
                        root.traverse(part => {
                            if (part.isSkinnedMesh && part.userData.authoredEquipment) {
                                attached++;
                                if (!part.skeleton.bones.every(bone => body.skeleton.bones.includes(bone))) throw new Error('Outfit references another skeleton');
                            }
                        });
                        if (attached < 10) throw new Error('Insufficient fitted skins');
                        root.position.x = derivative ? 2.8 : -2.8; scene.add(root); actors.push({ actor, root });
                    }
                } finally { substitutions.forEach(row => { row.fits[row.fit] = row.original; }); }
                for (const entry of actors) {
                    actors.forEach(other => { other.root.visible = entry === other; });
                    entry.actor.playAnimation('CombatIdle', true, true); entry.actor.updateAnimationMixer(.35);
                    renderer.render(scene, camera); counts.push({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls });
                }
                actors.forEach(entry => { entry.root.visible = true; });
                const sample = pose => {
                    for (const { actor, root } of actors) {
                        actor.mixer.stopAllAction(); root.userData.resetRestPose(); actor.currentAction = null;
                        actor.playAnimation(pose, !['Attack', 'Cast'].includes(pose), true); actor.updateAnimationMixer(.35);
                        root.updateMatrixWorld(true);
                        root.traverse(part => {
                            if (!part.matrixWorld.elements.every(Number.isFinite)) throw new Error('Nonfinite animated transform');
                            if (part.isSkinnedMesh && part.visible) for (let index = 0; index < part.geometry.attributes.position.count; index += 53) {
                                const position = new THREE.Vector3().fromBufferAttribute(part.geometry.attributes.position, index);
                                part.applyBoneTransform(index, position);
                                if (!position.toArray().every(Number.isFinite) || position.length() > 10) throw new Error('Invalid animated fitted vertex');
                            }
                        });
                    }
                    renderer.render(scene, camera);
                };
                window.__wearableDerivatives = { sample, actors, renderer, MeshFactory, actorClass };
                return { counts, independent: actors[0].root.getObjectByName(`${actorClass}_Body`).skeleton.bones[0] !== actors[1].root.getObjectByName(`${actorClass}_Body`).skeleton.bones[0] };
            }, { actorClass, tier, quality, rows: catalog.sources.map(({ item, itemID, actorClass, tier }) => ({ item, itemID, actorClass, tier })) });
            expect(result.independent).toBe(true);
            expect(result.counts[1].triangles).toBeLessThan(result.counts[0].triangles);
            expect(result.counts[1].calls).toBeLessThanOrEqual(result.counts[0].calls);
            for (const pose of ['CombatIdle', 'Run', 'Attack', 'Jump']) {
                await page.evaluate(pose => window.__wearableDerivatives.sample(pose), pose);
                await page.locator('#wearable-derivatives-qa').screenshot({ path: testInfo.outputPath(`${pose}-original-left-derived-right.png`) });
            }
            await testInfo.attach('geometry-counts', { body: JSON.stringify(result), contentType: 'application/json' });
            await page.evaluate(() => {
                const qa = window.__wearableDerivatives;
                for (const { root } of qa.actors) { root.removeFromParent(); qa.MeshFactory.releaseMesh(qa.actorClass, root); }
                qa.renderer.dispose(); qa.renderer.domElement.remove();
            });
            expect(failures, failures.join('\n')).toEqual([]);
        });
    }
}
