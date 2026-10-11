import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

test('shared understory geometry survives partial retirement and repeated quality replacement', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { createSpatialUnderstoryBatches } = await import('/src/art/SpatialUnderstoryBatches.js');
        const { createWoodlandUnderstoryGeometry } = await import('/src/art/WoodlandUnderstoryGeometry.js');
        const { createWoodlandWindMaterial } = await import('/src/art/WoodlandWindMaterial.js');
        const { earthUnderstoryScale, earthUnderstoryTint } = await import('/src/art/EarthUnderstory.js');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(640, 422); renderer.setClearColor(0x182129);
        const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-28, 28, 18, -18, .1, 200);
        camera.position.set(16, 25, 35); camera.lookAt(16, 0, 0);
        scene.add(new THREE.HemisphereLight(0xe0edff, 0x60523d, 2));
        const light = new THREE.DirectionalLight(0xffffff, 2); light.position.set(-10, 20, 10); scene.add(light);
        const target = new THREE.WebGLRenderTarget(640, 422); renderer.setRenderTarget(target);
        const render = () => {
            renderer.render(scene, camera);
            const pixels = new Uint8Array(640 * 422 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 640, 422, pixels);
            return pixels;
        };
        const samePixels = (a, b) => a.every((value, i) => value === b[i]);
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        // Stock PBR lazily initializes its renderer-wide 32x32 DFG lookup on
        // the first lit material. Establish that actual renderer baseline with
        // an ordinary unbatched mesh, then remove all of the seed's resources.
        let lutUniform;
        const seedMaterial = new THREE.MeshStandardMaterial();
        seedMaterial.onBeforeCompile = shader => { lutUniform = shader.uniforms.dfgLUT; };
        const seed = new THREE.Mesh(new THREE.BoxGeometry(), seedMaterial);
        seed.position.set(16, 0, 0); scene.add(seed); render();
        const lut = lutUniform.value;
        const rendererPbrLookup = { width: lut.image.width, height: lut.image.height,
            bytes: lut.image.data.byteLength, rg16f: lut.format === THREE.RGFormat && lut.type === THREE.HalfFloatType };
        seed.removeFromParent(); seed.geometry.dispose(); seedMaterial.dispose();
        const emptyPixels = render(), baseline = { ...renderer.info.memory }, rows = [];
        try {
            for (const quality of ['high', 'low', 'high', 'low']) {
                const plants = [-4, -2, 34, 36].map((x, i) => ({ x, z: i % 2 * 2, variant: i % 2, rotation: .3, scale: 1.4 }));
                const material = createWoodlandWindMaterial({ now: () => 12 });
                const root = new THREE.Group();
                root.add(...createSpatialUnderstoryBatches({ plants, geometries: ['bracken', 'sedge']
                    .map(kind => createWoodlandUnderstoryGeometry(kind, { quality })), material,
                scaleForPlant: earthUnderstoryScale, tintForPlant: earthUnderstoryTint }));
                scene.add(root); render();
                const [first, second] = root.children, geometry = first.geometry;
                const whole = { ...renderer.info.memory };
                // The second sector is rendered before and after retiring its
                // sibling. Its buffers must stay live without re-uploading.
                first.visible = false; const before = render();
                first.dispose(); first.dispose(); first.removeFromParent();
                const after = render(), partial = { ...renderer.info.memory };
                const stillShared = second.geometry === geometry;
                RenderSystem.prototype.disposeObjectResources.call({}, root);
                root.removeFromParent(); render();
                rows.push({ quality, whole, partial, after: { ...renderer.info.memory }, stillShared,
                    identicalPixels: samePixels(before, after), changedColorChannels: before.reduce((sum, value, i) =>
                        sum + (i % 4 !== 3 && value !== emptyPixels[i] ? 1 : 0), 0) });
            }
            return { gpu, rendererPbrLookup, baseline, rows };
        } finally { target.dispose(); renderer.dispose(); }
    });
    await testInfo.attach('shared-understory-lifetime', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
    if (requiresHardwareWebGL()) expect(result.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(result.rendererPbrLookup).toEqual({ width: 32, height: 32, bytes: 4096, rg16f: true });
    expect(result.baseline).toEqual({ geometries: 0, textures: 2 });
    expect(result.rows).toHaveLength(4);
    for (const row of result.rows) {
        expect(row.whole.geometries).toBe(result.baseline.geometries + 1);
        expect(row.partial.geometries).toBe(row.whole.geometries);
        expect(row.whole.textures - row.partial.textures).toBe(3);
        expect(row.after).toEqual(result.baseline);
        expect(row.changedColorChannels).toBeGreaterThan(0);
        expect(row.stillShared).toBe(true); expect(row.identicalPixels).toBe(true);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
