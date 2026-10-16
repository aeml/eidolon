import { expect, test } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`${quality} western service paving keeps geometry and follows the clear lane`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    // CI has a shallow checkout. Frozen code-owned reference bytes keep this
    // comparison independent of Git history and external network requests.
    const reference = JSON.parse(await readFile(new URL('../fixtures/town-composition-1-79-66.json', import.meta.url), 'utf8'));
    expect(reference.source).toBe('ac430ab8be589cddc3643c9befaf1651b3b05eda');
    const variant = reference.variants[quality], bytes = inflateSync(Buffer.from(variant.deflateBase64, 'base64'));
    expect(bytes.length).toBe(variant.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(variant.sha256);
    await page.route('**/tests/fixtures/town-mask-reference.bin', route => route.fulfill({ body: bytes, contentType: 'application/octet-stream' }));
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async ({ quality, size }) => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const system = new RenderSystem(quality === 'low'); system.setGraphicsQuality(quality);
        await system.preloadEnvironment();
        const world = new WorldGenerator(system.instanceEnvironmentGroup, new CollisionManager(), { graphicsQuality: quality });
        await world.loadBuildings(0, 200); system.applyLightingPreset('town', true);
        const mask = system.groundTown.material.userData.townGroundComposition.mask;
        const data = await (await fetch('/tests/fixtures/town-mask-reference.bin')).arrayBuffer();
        const sourceData = mask.image.data, referenceMask = new THREE.DataTexture(new Uint8Array(data), size, size);
        if (mask.image.width !== referenceMask.image.width) throw new Error('Matched composition resolutions required');
        let changedMaskTexels = 0, ownedMasksRetired = 0;
        for (let i = 0; i < sourceData.length; i += 4)
            if ([0, 1, 2, 3].some(c => sourceData[i + c] !== referenceMask.image.data[i + c])) changedMaskTexels++;
        for (const texture of [mask, referenceMask]) texture.addEventListener('dispose', () => ownedMasksRetired++);
        const canvas = system.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true }), rows = [], images = [];
        const capture = data => {
            // Swap this owned texture's upload buffer. Do not mutate either
            // cached raster or the reference bytes; restore the original pointer.
            mask.image.data = data; mask.needsUpdate = true; system.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: system.renderer.info.render.calls, triangles: system.renderer.info.render.triangles };
        };
        const changed = (a, b) => {
            let pixels = 0;
            for (let i = 0; i < a.length; i += 4) if ([0, 1, 2].some(c => a[i + c] !== b[i + c])) pixels++;
            return pixels;
        };
        try {
            for (const [site, x, z, zoom] of [['service-lane', -20, 224, 10], ['residential-lane', -61, 205, 10],
                ['west-gate', -82, 200, 10], ['west-district', -55, 215, 30]]) {
                system.setZoom(zoom); system.setCameraTarget(new THREE.Vector3(x, 0, z));
                capture(referenceMask.image.data); const before = capture(referenceMask.image.data);
                const after = capture(sourceData); images.push({ site, png: canvas.toDataURL('image/png') });
                const restored = capture(referenceMask.image.data);
                rows.push({ site, zoom, changedPixels: changed(before.pixels, after.pixels),
                    referenceRestoredPixels: changed(before.pixels, restored.pixels),
                    beforeCalls: before.calls, afterCalls: after.calls,
                    beforeTriangles: before.triangles, afterTriangles: after.triangles });
            }
        } finally {
            mask.image.data = sourceData; mask.needsUpdate = true;
            referenceMask.dispose(); system.dispose();
        }
        return { rows, images, worldQuality: world.graphicsQuality, changedMaskTexels, maskBytes: sourceData.byteLength, ownedMasksRetired,
            originalUploadBufferRestored: mask.image.data === sourceData, canvasRetired: !canvas.isConnected };
    }, { quality, size: variant.size });
    for (const capture of result.images) await writeFile(testInfo.outputPath(`${capture.site}-${quality}.png`), Buffer.from(capture.png.split(',')[1], 'base64'));
    delete result.images;
    await writeFile(testInfo.outputPath('western-service-paving.json'), JSON.stringify(result, null, 2));
    expect(result.changedMaskTexels).toBeGreaterThan(0);
    expect(result.worldQuality).toBe(quality);
    expect(result.rows.find(row => row.site === 'west-gate').changedPixels).toBeGreaterThan(100);
    for (const row of result.rows) {
        expect(row.beforeCalls, row.site).toBe(row.afterCalls);
        expect(row.beforeTriangles, row.site).toBe(row.afterTriangles);
        expect(row.referenceRestoredPixels, row.site).toBe(0);
    }
    expect(result.ownedMasksRetired).toBe(2); expect(result.originalUploadBufferRestored).toBe(true); expect(result.canvasRetired).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
