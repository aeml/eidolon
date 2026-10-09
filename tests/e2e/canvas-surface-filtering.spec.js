import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';
import { writeFile } from 'node:fs/promises';

test('physical canvas threads compile, remain visible close up and filter away at gameplay distance', async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { applyWorldSurfaceDetail } = await import('/src/art/WorldSurfaceDetail.js');
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(64, 64); renderer.setPixelRatio(1);
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        const hardware = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
        const material = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x77705f, roughness: .98 }), 'canvas');
        const reference = applyWorldSurfaceDetail(new THREE.MeshStandardMaterial({ color: 0x77705f, roughness: .98 }), 'canvas');
        const original = reference.onBeforeCompile;
        reference.customProgramCacheKey = () => 'canvas-thread-filter-reference';
        reference.onBeforeCompile = shader => {
            original(shader);
            if (!shader.fragmentShader.includes('sin(weaveDomain) * detail')) throw new Error('Canvas reference source changed');
            shader.fragmentShader = shader.fragmentShader.replace('sin(weaveDomain) * detail', 'vec3(0.)');
        };
        const geometry = new THREE.PlaneGeometry(20, 20), mesh = new THREE.Mesh(geometry, material);
        const scene = new THREE.Scene(); scene.add(mesh, new THREE.AmbientLight(0xffffff, 1));
        const light = new THREE.DirectionalLight(0xffffff, 2); scene.add(light, light.target);
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 5);
        const target = new THREE.WebGLRenderTarget(64, 64), samples = [];
        target.texture.colorSpace = THREE.SRGBColorSpace;
        const sheet = document.createElement('canvas'); sheet.width = 512; sheet.height = 300;
        const context = sheet.getContext('2d'), tile = document.createElement('canvas'); tile.width = tile.height = 64;
        const tileContext = tile.getContext('2d');
        const capture = selected => {
            mesh.material = selected; renderer.setRenderTarget(target); renderer.render(scene, camera);
            const pixels = new Uint8Array(64 * 64 * 4); renderer.readRenderTargetPixels(target, 0, 0, 64, 64, pixels);
            return pixels;
        };
        try {
            for (const [index, worldX] of [0, 2250].entries()) {
                mesh.position.set(worldX, 2, 0); camera.position.set(worldX, 2, 2);
                light.position.set(worldX + 3, 5, 4); light.target.position.copy(mesh.position);
                for (const [row, halfSpan] of [.032, 4].entries()) {
                    camera.left = camera.bottom = -halfSpan; camera.right = camera.top = halfSpan; camera.updateProjectionMatrix();
                    const baseline = capture(reference), actual = capture(material);
                    let sum = 0, maximum = 0;
                    for (let i = 0; i < actual.length; i++) if (i % 4 !== 3) {
                        const delta = Math.abs(actual[i] - baseline[i]); sum += delta; maximum = Math.max(maximum, delta);
                    }
                    samples.push({ worldX, halfSpan, meanDifference: sum / (64 * 64 * 3), maximum });
                    tileContext.putImageData(new ImageData(new Uint8ClampedArray(actual), 64, 64), 0, 0);
                    context.imageSmoothingEnabled = false; context.drawImage(tile, index * 256, row * 150, 256, 128);
                    context.fillStyle = '#eee'; context.font = '12px monospace';
                    context.fillText(`x=${worldX} ${row ? 'filtered' : 'close weave'}`, index * 256 + 4, row * 150 + 143);
                }
            }
            return { hardware, samples, image: sheet.toDataURL('image/png') };
        } finally { renderer.setRenderTarget(null); target.dispose(); geometry.dispose(); material.dispose(); reference.dispose(); renderer.dispose(); }
    });
    await testInfo.attach('canvas-filtering-contact-sheet', { body: Buffer.from(result.image.split(',')[1], 'base64'), contentType: 'image/png' });
    await writeFile(testInfo.outputPath('canvas-filtering.png'), Buffer.from(result.image.split(',')[1], 'base64'));
    expect(result.hardware).not.toMatch(/swiftshader|llvmpipe|software/i);
    for (const sample of result.samples) {
        if (sample.halfSpan < 1) expect(sample.meanDifference, JSON.stringify(sample)).toBeGreaterThan(.1);
        else expect(sample.maximum, JSON.stringify(sample)).toBe(0);
    }
    await testInfo.attach('canvas-filtering-samples', { body: JSON.stringify({ hardware: result.hardware, samples: result.samples }), contentType: 'application/json' });
    console.log('[canvas-thread-filter]', JSON.stringify({ hardware: result.hardware, samples: result.samples }));
    expect(failures).toEqual([]);
});
