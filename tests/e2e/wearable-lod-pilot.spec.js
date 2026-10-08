import { expect, test } from '@playwright/test';
import path from 'node:path';
import { collectBrowserFailures } from './helpers.js';

// Explicit local generated artifact only; never substitute this for runtime
// catalog activation, full-outfit budgets or a four-class/party acceptance.
for (const quality of ['high', 'low']) test(`Plate Mail derived pilot retains animated fitted rig: ${quality}`, async ({ page, baseURL }, testInfo) => {
    const directory = process.env.EIDOLON_E2E_WEARABLE_PILOT_ROOT;
    test.skip(!directory, 'Requires an explicitly generated local wearable pilot');
    if (!path.isAbsolute(directory)) throw new Error('Pilot artifacts require an absolute path');
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.route('**/__qa/plate-pilot.glb', route => route.fulfill({
        path: path.join(directory, `plate-mail-standard-pilot-${quality}.glb`), contentType: 'model/gltf-binary'
    }));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { Actor } = await import('/src/entities/Actor.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { AUTHORED_ASSETS } = await import('/src/assets/authoredEquipment.generated.js');
        document.getElementById('start-screen').style.display = 'none';
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(1280, 900); renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15; document.body.appendChild(renderer.domElement);
        Object.assign(renderer.domElement.style, { position: 'fixed', inset: 0, zIndex: 10000 });
        const scene = new THREE.Scene(); scene.background = new THREE.Color('#151a21');
        scene.add(new THREE.HemisphereLight('#d3e2ee', '#46372e', 2));
        const light = new THREE.DirectionalLight('#ffe3c4', 3); light.position.set(-8, 12, 9); scene.add(light);
        const camera = new THREE.PerspectiveCamera(36, 1280 / 900, .1, 100);
        camera.position.set(0, 4.5, 20); camera.lookAt(0, 2.1, 0);
        const outfit = { head: 'Iron Helm', chest: 'Plate Mail', legs: 'Plate Greaves', feet: 'Iron Boots', gloves: 'Iron Gauntlets',
            shoulders: 'Steel Pauldrons', belt: 'Plated Girdle', mainHand: 'Iron Sword', offHand: 'Wooden Shield',
            ring1: 'Ruby Ring', ring2: 'Silver Ring', neck: 'Necklace', trinket1: 'Amulet of Power', trinket2: 'Orb of Mana' };
        const gear = Object.fromEntries(Object.entries(outfit).map(([slot, name]) => [slot,
            { ...BASE_ITEMS.find(item => item.name === name), id: `pilot-${slot}`, baseName: name, rarity: 'Rare', level: 75 }]));
        const actors = [];
        const catalog = AUTHORED_ASSETS.items['Plate Mail'].models.standard;
        const originalPath = catalog.Fighter;
        try {
            for (const pilot of [false, true]) {
                const root = await MeshFactory.createMeshForType('Fighter', { quality });
                const actor = new Actor(`pilot-${pilot}`, {}); actor.meshType = 'Fighter'; actor.setMesh(root);
                if (pilot) catalog.Fighter = '/__qa/plate-pilot.glb';
                actor.syncEquipmentVisuals(gear); await root.userData.equipmentReady;
                catalog.Fighter = originalPath;
                if (root.userData.equipmentVisualItemCount !== 14 || root.userData.equipmentVisualMissing?.length) throw new Error('Missing fitted outfit');
                const body = root.getObjectByName('Fighter_Body');
                root.traverse(part => {
                    if (part.isSkinnedMesh && part.userData.authoredEquipment && !part.skeleton.bones.every(bone => body.skeleton.bones.includes(bone))) {
                        throw new Error('Pilot garment references another character skeleton');
                    }
                });
                root.position.x = pilot ? 2.8 : -2.8; scene.add(root); actors.push({ actor, root });
            }
        } finally { catalog.Fighter = originalPath; }
        const pictures = [];
        for (const pose of ['CombatIdle', 'Run', 'Attack', 'Jump']) {
            for (const { actor } of actors) { actor.playAnimation(pose, true, true); actor.updateAnimationMixer(.35); }
            renderer.render(scene, camera);
            pictures.push({ pose, image: renderer.domElement.toDataURL('image/png') });
        }
        for (const { root } of actors) { root.removeFromParent(); MeshFactory.releaseMesh('Fighter', root); }
        renderer.dispose(); renderer.domElement.remove();
        return { pictures, actors: actors.length };
    }, quality);
    expect(result.actors).toBe(2);
    for (const picture of result.pictures) await testInfo.attach(`${quality}-${picture.pose}-original-left-pilot-right`, {
        body: Buffer.from(picture.image.split(',')[1], 'base64'), contentType: 'image/png'
    });
    expect(failures, failures.join('\n')).toEqual([]);
});
