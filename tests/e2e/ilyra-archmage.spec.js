import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test('Ilyra is dressed, independently animated and keeps his story quest marker', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const intake = await page.evaluate(async () => {
        const THREE = await import('three');
        const { QuestNPC } = await import('/src/entities/QuestNPC.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { ILYRA_MODEL_PATH } = await import('/src/art/AuthoredIlyra.js');
        document.getElementById('start-screen').style.display = 'none';
        const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(1280, 900); renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1; renderer.shadowMap.enabled = true;
        renderer.domElement.id = 'ilyra-preview';
        Object.assign(renderer.domElement.style, { position: 'fixed', inset: '0', zIndex: '10000' });
        document.body.appendChild(renderer.domElement);
        const scene = new THREE.Scene(); scene.background = new THREE.Color('#151b28');
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#303946', roughness: .9 }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
        scene.add(new THREE.HemisphereLight('#d0deee', '#504238', 2));
        const key = new THREE.DirectionalLight('#ffe0ba', 3); key.position.set(-5, 10, 7); key.castShadow = true;
        key.shadow.camera.left = -12; key.shadow.camera.right = 12; key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
        key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.00014; key.shadow.normalBias = .05; scene.add(key);
        const camera = new THREE.PerspectiveCamera(35, 1280 / 900, .1, 80);
        camera.position.set(0, 4.4, 18); camera.lookAt(0, 2.7, 0);
        const actors = [];
        for (let i = 0; i < 2; i++) {
            const actor = new QuestNPC(`ilyra-preview-${i}`, { story: true });
            actor.position.x = i ? 2 : -2; actor.markerSymbol = '!';
            await actor.ensureMesh(); actor.render(1); scene.add(actor.mesh); actors.push(actor);
        }
        const renderPose = (yaw, time) => {
            for (const actor of actors) { actor.mesh.rotation.y = yaw; actor.mixer.setTime(time); }
            renderer.render(scene, camera);
        };
        renderPose(0, .4);
        const a = actors[0].mesh.getObjectByName('Ilyra_FourfoldCostume'), b = actors[1].mesh.getObjectByName('Ilyra_FourfoldCostume');
        const costumeSkin = costume => { let skin; costume.traverse(part => { if (part.isSkinnedMesh) skin ||= part; }); return skin; };
        const aSkin = costumeSkin(a), bSkin = costumeSkin(b);
        const firstPose = aSkin.skeleton.bones.map(bone => bone.quaternion.toArray());
        renderPose(0, 1.2);
        const idleMotion = Math.max(...aSkin.skeleton.bones.flatMap((bone, i) => bone.quaternion.toArray().map((value, axis) => Math.abs(value - firstPose[i][axis]))));
        renderPose(0, .4);
        const bounds = new THREE.Box3().setFromObject(a, true);
        const source = await MeshFactory.loadModel(ILYRA_MODEL_PATH);
        const sourceNames = []; source.scene.traverse(part => { if (part.isMesh) sourceNames.push(part.name); });
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        window.ilyraPreview = { actors, renderPose };
        return { appearance: actors.map(actor => actor.mesh.userData.npcAppearance),
            independent: aSkin.skeleton.bones.every((bone, i) => bone !== bSkin.skeleton.bones[i]),
            bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
            emptyEquipment: actors.map(actor => actor.syncEquipmentVisuals({})),
            marker: actors.map(actor => ({ symbol: actor.questMarker.userData.symbol, kind: actor.questMarker.userData.questKind, height: actor.questMarker.position.y })),
            sourceNames, idleMotion, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
            renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'not exposed' };
    });
    expect(intake.appearance).toEqual(['ilyra-fourfold-archmage', 'ilyra-fourfold-archmage']);
    expect(intake.independent).toBe(true); expect(intake.emptyEquipment).toEqual([false, false]);
    expect(intake.idleMotion).toBeGreaterThan(.00001);
    expect(intake.bounds.min[1]).toBeGreaterThan(-.25);
    expect(intake.bounds.max[1]).toBeLessThan(5.4);
    for (const marker of intake.marker) { expect(marker.symbol).toBe('!'); expect(marker.kind).toBe('story'); expect(marker.height).toBeGreaterThan(intake.bounds.max[1]); }
    for (const [name, yaw, time] of [['front', 0, .4], ['side', Math.PI / 2, .8], ['back', Math.PI, 1.2], ['isometric', -.65, 1.8]]) {
        await page.evaluate(({ yaw, time }) => window.ilyraPreview.renderPose(yaw, time), { yaw, time });
        await page.locator('#ilyra-preview').screenshot({ path: testInfo.outputPath(`${name}.png`) });
    }
    await writeFile(testInfo.outputPath('intake.json'), JSON.stringify(intake, null, 2));
    expect(failures).toEqual([]);
});
