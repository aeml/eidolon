import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { openGame } from './helpers.js';

test('fitted sun depth preserves visible contact and off-screen tall caster shadows', async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 844 });
    await openGame(page);
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const render = new RenderSystem(false), renderer = render.renderer;
        render.environmentGroup.visible = false;
        const focus = new THREE.Vector3(2100, 0, -1400);
        const owned = new THREE.Group(); owned.position.copy(focus); render.scene.add(owned);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: 0x53614c }));
        floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; owned.add(floor);
        const stone = new THREE.MeshStandardMaterial({ color: 0x8b9299 });
        for (const [size, position] of [[[4, 6, 4], [2, 3, -2]], [[10, 1, 8], [2, 6.5, -2]]]) {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), stone);
            mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true; owned.add(mesh);
        }
        // A tall off-screen caster on a ray to visible ground must survive.
        const tall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), stone);
        tall.position.copy(render.shadowFollowOffset).normalize().multiplyScalar(60).add(new THREE.Vector3(-7, 0, 4));
        tall.castShadow = true; owned.add(tall);
        // Actual many-part enemy behind the receiver volume: shadow-only work.
        const enemy = await MeshFactory.createMeshForType('Skeleton');
        enemy.position.set(70, 0, -60); owned.add(enemy);
        const target = new THREE.WebGLRenderTarget(640, 422), previousTarget = renderer.getRenderTarget();
        renderer.setRenderTarget(target); renderer.info.autoReset = false;
        const capture = (far, bias) => {
            render.keyLight.shadow.camera.far = far;
            render.keyLight.shadow.bias = bias;
            render.keyLight.shadow.camera.updateProjectionMatrix();
            renderer.info.reset(); renderer.render(render.scene, render.camera);
            const pixels = new Uint8Array(640 * 422 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 640, 422, pixels);
            return { pixels, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
        };
        const changedPixels = (a, b) => {
            let changed = 0;
            for (let i = 0; i < a.length; i += 4) if ([0, 1, 2].some(c => Math.abs(a[i + c] - b[i + c]) > 3)) changed++;
            return changed;
        };
        const samples = [];
        for (const quality of ['high', 'low']) for (const zoom of [5, 15, 30]) {
            render.setGraphicsQuality(quality); render.setZoom(zoom);
            render.setCameraTarget(focus); render.updateShadowFocus(focus);
            const far = render.keyLight.shadow.camera.far, bias = render.keyLight.shadow.bias;
            const before = capture(1400, quality === 'high' ? -0.00014 : -0.00012);
            const after = capture(far, bias);
            tall.visible = false; const withoutTall = capture(far, bias); tall.visible = true;
            samples.push({ quality, zoom, far, beforeCalls: before.calls, afterCalls: after.calls,
                beforeTriangles: before.triangles, afterTriangles: after.triangles,
                changed: changedPixels(before.pixels, after.pixels), tallShadowPixels: changedPixels(after.pixels, withoutTall.pixels) });
        }
        renderer.setRenderTarget(previousTarget); renderer.info.autoReset = true;
        render.setGraphicsQuality('high'); render.setZoom(15); render.updateShadowFocus(focus);
        renderer.render(render.scene, render.camera); const picture = renderer.domElement.toDataURL('image/png');
        enemy.removeFromParent(); MeshFactory.releaseMesh('Skeleton', enemy);
        owned.removeFromParent(); render.disposeObjectResources(owned); target.dispose(); render.dispose();
        return { samples, picture };
    });
    await writeFile(testInfo.outputPath('shadow-depth-comparison.json'), JSON.stringify(result.samples, null, 2));
    await testInfo.attach('shadow-depth-comparison', { body: JSON.stringify(result.samples), contentType: 'application/json' });
    const png = Buffer.from(result.picture.split(',')[1], 'base64');
    await writeFile(testInfo.outputPath('fitted-shadow-depth.png'), png);
    await testInfo.attach('fitted-shadow-depth', { body: png, contentType: 'image/png' });
    for (const sample of result.samples) {
        expect(sample.changed, JSON.stringify(sample)).toBeLessThan(640 * 422 * .001);
        expect(sample.afterCalls).toBeLessThanOrEqual(sample.beforeCalls);
        if (sample.quality === 'high') expect(sample.tallShadowPixels).toBeGreaterThan(20);
    }
    const ordinary = result.samples.find(s => s.quality === 'high' && s.zoom === 15);
    expect(ordinary.afterCalls).toBeLessThan(ordinary.beforeCalls);
    expect(ordinary.afterTriangles).toBeLessThan(ordinary.beforeTriangles);
});

for (const fallback of [false, true]) test(`planted street cells preserve both edges and shadows (${fallback ? 'extension fallback' : 'native extensions'})`, async ({ page }, testInfo) => {
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await openGame(page);
    const result = await page.evaluate(async fallback => {
        const THREE = await import('three');
        const { createLanternholdStreetFurniture } = await import('/src/art/LanternholdStreetFurniture.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x17202b);
        const models = [createLanternholdStreetFurniture({ multiDraw: false }), createLanternholdStreetFurniture()];
        for (const model of models) {
            model.traverse(part => { if (part.isMesh) MeshFactory.configureShadowCastingForObject(part, { stableFrontShadows: true }); });
            scene.add(model);
        }
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: 0x53614c }));
        floor.rotation.x = -Math.PI / 2; floor.position.z = 206.5; floor.receiveShadow = true;
        scene.add(floor, new THREE.HemisphereLight(0xc5ddff, 0x302218, 1.5));
        const light = new THREE.DirectionalLight(0xffe0bd, 2);
        light.position.set(-35, 80, 260); light.target.position.set(0, 0, 206.5);
        light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
        Object.assign(light.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, far: 250 });
        light.shadow.camera.updateProjectionMatrix(); scene.add(light, light.target);
        const camera = new THREE.OrthographicCamera(-28, 28, 28, -28, .1, 300);
        const canvas = document.createElement('canvas'), context = canvas.getContext('webgl2', { antialias: false });
        const getExtension = context.getExtension.bind(context);
        if (fallback) context.getExtension = name => name === 'WEBGL_multi_draw' ? null : getExtension(name);
        const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false }); renderer.setSize(400, 400);
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.info.autoReset = false;
        const target = new THREE.WebGLRenderTarget(400, 400); renderer.setRenderTarget(target);
        const capture = variant => {
            models.forEach((model, i) => { model.visible = i === variant; });
            renderer.info.reset();
            renderer.render(scene, camera);
            const pixels = new Uint8Array(400 * 400 * 4); renderer.readRenderTargetPixels(target, 0, 0, 400, 400, pixels);
            return { pixels, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
        };
        const samples = [];
        for (const x of [0, -19, 19]) {
            const span = x ? 9 : 28; Object.assign(camera, { left: -span, right: span, top: span, bottom: -span });
            camera.position.set(x + 35, 40, 241.5); camera.lookAt(x, 2, 206.5); camera.updateProjectionMatrix();
            const before = capture(0), after = capture(1); let changed = 0;
            for (let i = 0; i < before.pixels.length; i += 4) {
                if ([0, 1, 2].some(c => Math.abs(before.pixels[i + c] - after.pixels[i + c]) > 3)) changed++;
            }
            samples.push({ x, beforeCalls: before.calls, afterCalls: after.calls,
                beforeTriangles: before.triangles, afterTriangles: after.triangles, changed });
        }
        renderer.setRenderTarget(null);
        const pictures = models.map((model, i) => {
            models.forEach((entry, index) => { entry.visible = index === i; });
            renderer.render(scene, camera); return canvas.toDataURL('image/png');
        });
        const multiDraw = renderer.extensions.has('WEBGL_multi_draw'), textures = renderer.info.memory.textures;
        RenderSystem.prototype.disposeObjectResources.call({}, models[1]); scene.remove(models[1]);
        const released = textures - renderer.info.memory.textures;
        target.dispose(); light.shadow.dispose(); RenderSystem.prototype.disposeObjectResources.call({}, scene);
        const remainingGeometries = renderer.info.memory.geometries; renderer.dispose();
        return { samples, multiDraw, released, remainingGeometries, pictures };
    }, fallback);
    const { pictures, ...metrics } = result;
    await writeFile(testInfo.outputPath('street-cell-comparison.json'), JSON.stringify(metrics, null, 2));
    await testInfo.attach('street-cell-comparison', { body: JSON.stringify(metrics), contentType: 'application/json' });
    for (const [i, picture] of pictures.entries()) {
        const png = Buffer.from(picture.split(',')[1], 'base64');
        await writeFile(testInfo.outputPath(i ? 'street-batched.png' : 'street-source.png'), png);
        await testInfo.attach(i ? 'street-batched' : 'street-source', { body: png, contentType: 'image/png' });
    }
    for (const sample of result.samples) {
        expect(sample.changed).toBeLessThan(400 * 400 * .001);
        expect(sample.afterTriangles).toBe(sample.beforeTriangles);
        expect(sample.beforeTriangles).toBeGreaterThan(1000);
        expect(sample.afterCalls).toBeLessThanOrEqual(sample.beforeCalls);
    }
    if (fallback) expect(result.multiDraw).toBe(false);
    if (result.multiDraw) expect(result.samples[0].afterCalls).toBeLessThan(result.samples[0].beforeCalls);
    else expect(result.samples[0].afterCalls).toBe(result.samples[0].beforeCalls);
    expect(result.released).toBe(12); expect(result.remainingGeometries).toBe(0);
});

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
