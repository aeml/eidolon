import { expect, test } from '@playwright/test';
import { openGame } from './helpers.js';

test('batched town fence preserves rendered rails and shadows with fewer draw calls', async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await openGame(page);
    const result = await page.evaluate(async () => {
        const THREE = await import('/vendor/three/build/three.module.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const scene = new THREE.Scene(), boxes = [];
        new WorldGenerator(scene, { addCollider: box => boxes.push(box) }).createRectangularFence(0, 200, 200, 200);
        const batched = scene.children[0], legacy = new THREE.Group();
        const post = new THREE.BoxGeometry(.8, 8, .8), rail = new THREE.BoxGeometry(4, .4, .2);
        // Reconstruct the old segment renderer from the unchanged colliders.
        for (const box of boxes) {
            const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
            for (const [geometry, y] of [[post, 4], [rail, 2], [rail, 4], [rail, 6]]) {
                const material = MeshFactory.configureShadowCastingForMaterial(
                    new THREE.MeshStandardMaterial({ color: 0x8b4513 }), { stableFrontShadows: true });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(center.x, y, center.z);
                if (geometry === rail && size.z > size.x) mesh.rotation.y = Math.PI / 2;
                mesh.castShadow = mesh.receiveShadow = true;
                legacy.add(mesh);
            }
        }
        scene.add(legacy);
        scene.background = new THREE.Color(0x17202b);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260),
            new THREE.MeshStandardMaterial({ color: 0x53614c }));
        ground.rotation.x = -Math.PI / 2; ground.position.z = 200; ground.receiveShadow = true;
        scene.add(ground, new THREE.HemisphereLight(0xc5ddff, 0x302218, 1.5));
        const light = new THREE.DirectionalLight(0xffe0bd, 2);
        light.position.set(80, 160, 290); light.target.position.set(0, 0, 200);
        light.castShadow = true; light.shadow.mapSize.set(512, 512);
        Object.assign(light.shadow.camera, { left: -160, right: 160, top: 160, bottom: -160, far: 500 });
        light.shadow.camera.updateProjectionMatrix(); scene.add(light, light.target);
        const camera = new THREE.OrthographicCamera(-150, 150, 150, -150, .1, 800);
        camera.position.set(130, 160, 430); camera.lookAt(0, 0, 200);
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(320, 320); renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const target = new THREE.WebGLRenderTarget(320, 320);
        renderer.setRenderTarget(target);
        const capture = useBatch => {
            batched.visible = useBatch; legacy.visible = !useBatch;
            renderer.shadowMap.needsUpdate = true;
            renderer.render(scene, camera);
            const pixels = new Uint8Array(320 * 320 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 320, 320, pixels);
            return { pixels, calls: renderer.info.render.calls };
        };
        const before = capture(false), after = capture(true);
        let different = 0;
        for (let i = 0; i < before.pixels.length; i += 4) {
            if ([0, 1, 2].some(channel => Math.abs(before.pixels[i + channel] - after.pixels[i + channel]) > 3)) different++;
        }
        // Include both actually rendered views in the report for inspection.
        renderer.setRenderTarget(null);
        const pictures = [false, true].map(useBatch => {
            batched.visible = useBatch; legacy.visible = !useBatch;
            renderer.render(scene, camera);
            return renderer.domElement.toDataURL('image/png');
        });
        target.dispose(); renderer.dispose();
        return { beforeCalls: before.calls, afterCalls: after.calls, differentPixels: different,
            meshes: batched.children.length, pictures };
    });
    for (const [index, picture] of result.pictures.entries()) await testInfo.attach(index ? 'batched-fence' : 'original-fence', {
        body: Buffer.from(picture.split(',')[1], 'base64'), contentType: 'image/png'
    });
    const { pictures: _pictures, ...metrics } = result;
    await testInfo.attach('fence-render-metrics', { body: JSON.stringify(metrics), contentType: 'application/json' });
    expect(result.beforeCalls).toBeGreaterThan(500);
    expect(result.afterCalls).toBeLessThan(result.beforeCalls / 5);
    expect(result.meshes).toBeLessThan(32);
    expect(result.differentPixels).toBeLessThan(320 * 320 * .005);
});
