import { expect, test } from '@playwright/test';
import { openGame } from './helpers.js';

for (const fallback of [false, true]) test(`weathered perimeter batching preserves materials, culling and shadows (${fallback ? 'no multi-draw extension' : 'native extensions'})`, async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await openGame(page);
    const result = await page.evaluate(async fallback => {
        const THREE = await import('/vendor/three/build/three.module.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { createLanternholdPerimeter } = await import('/src/art/LanternholdPerimeter.js');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const scene = new THREE.Scene(), boxes = [];
        new WorldGenerator(scene, { addCollider: box => boxes.push(box) }).createRectangularFence(0, 200, 200, 200);
        // Compare the new art with its unbatched reference. Legacy collision
        // equality is independently tested against the original rail layout.
        const batched = scene.children[0], legacy = createLanternholdPerimeter(0, 200, 200, 200, { batched: false });
        const cellReference = createLanternholdPerimeter(0, 200, 200, 200, { multiDraw: false });
        scene.add(legacy, cellReference);
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
        const canvas = document.createElement('canvas'), context = canvas.getContext('webgl2', { antialias: false });
        const getExtension = context.getExtension.bind(context);
        if (fallback) context.getExtension = name => name === 'WEBGL_multi_draw' ? null : getExtension(name);
        const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false });
        renderer.setSize(320, 320); renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const target = new THREE.WebGLRenderTarget(320, 320);
        renderer.setRenderTarget(target);
        const capture = visible => {
            for (const root of [batched, legacy, cellReference]) root.visible = root === visible;
            renderer.shadowMap.needsUpdate = true;
            renderer.render(scene, camera);
            const pixels = new Uint8Array(320 * 320 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 320, 320, pixels);
            return { pixels, calls: renderer.info.render.calls };
        };
        const difference = (before, after) => {
            let count = 0;
            for (let i = 0; i < before.pixels.length; i += 4) {
                if ([0, 1, 2].some(channel => Math.abs(before.pixels[i + channel] - after.pixels[i + channel]) > 3)) count++;
            }
            return count;
        };
        const before = capture(legacy), cells = capture(cellReference), after = capture(batched);
        const different = difference(before, after), cellDifference = difference(cells, after);
        // Include both actually rendered views in the report for inspection.
        renderer.setRenderTarget(null);
        const pictures = [legacy, batched].map(visible => {
            for (const root of [batched, legacy, cellReference]) root.visible = root === visible;
            renderer.render(scene, camera);
            return renderer.domElement.toDataURL('image/png');
        });
        // Tight gate view catches lost per-cell culling and shader coordinates
        // that a whole-town view could conceal. Include the actual sun shadows.
        Object.assign(camera, { left: -20, right: 20, top: 20, bottom: -20 });
        camera.position.set(24, 25, 331); camera.lookAt(0, 2, 300); camera.updateProjectionMatrix();
        renderer.setRenderTarget(target);
        const localCells = capture(cellReference), localBatch = capture(batched);
        const localDifference = difference(localCells, localBatch);
        const multiDraw = renderer.extensions.has('WEBGL_multi_draw');
        const texturesBeforeBatchDispose = renderer.info.memory.textures;
        RenderSystem.prototype.disposeObjectResources.call({}, batched);
        const ownedTexturesReleased = texturesBeforeBatchDispose - renderer.info.memory.textures;
        scene.remove(batched);
        target.dispose(); light.shadow.dispose();
        RenderSystem.prototype.disposeObjectResources.call({}, scene);
        const remaining = { ...renderer.info.memory };
        renderer.dispose();
        return { beforeCalls: before.calls, afterCalls: after.calls, differentPixels: different,
            cellCalls: cells.calls, cellDifference, localDifference, multiDraw, remaining, ownedTexturesReleased,
            meshes: batched.children.length, pictures };
    }, fallback);
    for (const [index, picture] of result.pictures.entries()) await testInfo.attach(index ? 'batched-fence' : 'unbatched-new-perimeter', {
        body: Buffer.from(picture.split(',')[1], 'base64'), contentType: 'image/png'
    });
    const { pictures: _pictures, ...metrics } = result;
    await testInfo.attach('fence-render-metrics', { body: JSON.stringify(metrics), contentType: 'application/json' });
    expect(result.beforeCalls).toBeGreaterThan(500);
    expect(result.afterCalls).toBeLessThan(result.beforeCalls / 5);
    expect(result.meshes).toBeLessThan(64);
    expect(result.differentPixels).toBeLessThan(320 * 320 * .005);
    expect(result.cellDifference).toBeLessThan(320 * 320 * .005);
    expect(result.localDifference).toBeLessThan(320 * 320 * .005);
    if (fallback) expect(result.multiDraw).toBe(false);
    if (result.multiDraw) expect(result.afterCalls).toBeLessThan(result.cellCalls);
    else expect(result.afterCalls).toBe(result.cellCalls);
    // The renderer may retain its generic null-sampler texture. Check the six
    // actual matrix/indirection allocations, rather than claiming engine-wide
    // zero textures before renderer teardown.
    expect(result.ownedTexturesReleased).toBe(6);
    expect(result.remaining.geometries).toBe(0);
});
