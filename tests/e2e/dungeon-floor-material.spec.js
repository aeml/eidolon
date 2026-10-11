import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

const cases = [
    ['Verdant', 'verdant_bastion_catacombs', 'high'],
    ...['molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus']
        .flatMap(type => ['high', 'low'].map(quality => [`${type} ${quality}:`, type, quality]))
];
for (const [label, type, quality] of cases) test(`${label} floor weathering crosses mesh partitions without repeating with the tile`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ type, quality }) => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { createProceduralDungeonInteriorKit } = await import('/src/art/ProceduralDungeonInteriors.js');
        const render = new RenderSystem(false), origin = 20000;
        render.setGraphicsQuality(quality);
        const kit = createProceduralDungeonInteriorKit(type, { quality });
        const material = kit.floorMaterial(24, 24), control = material.clone();
        const whole = new THREE.Group(), split = new THREE.Group();
        const addFloor = (group, width, depth, x, z) => {
            const geometry = new THREE.PlaneGeometry(width, depth), p = geometry.attributes.position, uv = geometry.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + x - origin) / 24, (p.getY(i) - z + origin) / 24);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .1, z); group.add(mesh);
        };
        addFloor(whole, 120, 120, origin, origin);
        for (const x of [-30, 30]) for (const z of [-30, 30]) addFloor(split, 60, 60, origin + x, origin + z);
        render.scene.add(whole, split); split.visible = false;
        render.setCameraTarget(new THREE.Vector3(origin, .1, origin));
        const target = new THREE.WebGLRenderTarget(256, 256), pixels = new Uint8Array(256 * 256 * 4);
        const capture = () => {
            render.renderer.setRenderTarget(target); render.renderer.render(render.scene, render.camera);
            render.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels); return pixels.slice();
        };
        const unified = capture(); whole.visible = false; split.visible = true;
        const partitioned = capture(); let maximumPartitionDelta = 0;
        for (let i = 0; i < unified.length; i++) maximumPartitionDelta = Math.max(maximumPartitionDelta, Math.abs(unified[i] - partitioned[i]));
        split.visible = false; whole.visible = true;
        const samples = [];
        for (const patched of [false, true]) {
            whole.children[0].material = patched ? material : control;
            const rgb = [];
            for (const x of [-48, -24, 0, 24, 48]) for (const z of [-48, -24, 0, 24, 48]) {
                render.setCameraTarget(new THREE.Vector3(origin + x, .1, origin + z));
                const data = capture(), offset = (128 * 256 + 128) * 4;
                rgb.push([...data.slice(offset, offset + 3)]);
            }
            samples.push({ patched, rgb, span: Math.max(...[0, 1, 2].map(c => Math.max(...rgb.map(v => v[c])) - Math.min(...rgb.map(v => v[c])))) });
        }
        const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        render.renderer.setRenderTarget(null); target.dispose(); whole.children[0].material = material;
        control.dispose(); render.dispose();
        return { type, quality, maximumPartitionDelta, samples, gpu,
            scope: 'Material readbacks at production far-origin coordinates. One plane versus four UV-registered partitions; patched/unpatched periodic controls. No gameplay timing or device claim.' };
    }, { type, quality });
    await testInfo.attach('dungeon-floor-material', { body: JSON.stringify(result), contentType: 'application/json' });
    expect(result.gpu).not.toMatch(/swiftshader|llvmpipe|software/i);
    expect(result.maximumPartitionDelta).toBeLessThanOrEqual(1);
    expect(result.samples[0].span).toBeLessThanOrEqual(1);
    expect(result.samples[1].span).toBeGreaterThan(1);
    expect(failures, failures.join('\n')).toEqual([]);
});
