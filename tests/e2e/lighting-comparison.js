import { expect } from '@playwright/test';

// Opt-in, same-instance comparison: no shipped configuration flag, changes to
// exposure/materials/lights/scene/quality, screenshots of different fixtures,
// or gameplay/account writes. Warmed samples are not a cold/device benchmark.
export async function compareFilmicLighting(page, testInfo, reviewKey, label) {
    if (process.env.EIDOLON_E2E_LIGHTING_COMPARE !== '1') return;
    const metrics = [];
    for (const curve of ['reference', 'filmic']) {
        metrics.push(await page.evaluate(async ({ reviewKey, curve }) => {
            const THREE = await import('three');
            const { render } = window[reviewKey];
            if (curve === 'reference' && render.renderer.toneMapping !== THREE.ACESFilmicToneMapping)
                throw new Error('Comparison requires actual filmic production default');
            render.renderer.toneMapping = curve === 'reference' ? THREE.LinearToneMapping : THREE.ACESFilmicToneMapping;
            render.render(); render.render();
            const samples = [];
            for (let i = 0; i < 60; i++) {
                const start = await new Promise(requestAnimationFrame);
                render.render();
                const end = await new Promise(requestAnimationFrame);
                samples.push(end - start);
            }
            samples.sort((a, b) => a - b);
            return { curve, medianMs: samples[30], p95Ms: samples[57],
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                geometries: render.renderer.info.memory.geometries, textures: render.renderer.info.memory.textures,
                quality: render.graphicsQuality, exposure: render.renderer.toneMappingExposure,
                postProcessing: render.usePostProcessing, lights: render.scene.children.filter(child => child.isLight)
                    .map(light => [light.type, light.color.getHex(), light.intensity]) };
        }, { reviewKey, curve }));
        await page.screenshot({ path: testInfo.outputPath(`${label}-${curve}.png`),
            style: '#perf-overlay { visibility: hidden !important; }' });
    }
    const [reference, filmic] = metrics;
    for (const key of ['calls', 'triangles', 'geometries', 'textures', 'exposure', 'lights', 'quality', 'postProcessing'])
        expect(filmic[key], `${label} unchanged ${key}`).toEqual(reference[key]);
    // Retain the existing quality frame limits, not a new permissive budget.
    expect(filmic.medianMs).toBeLessThanOrEqual(filmic.quality === 'high' ? 20 : 33.4);
    expect(filmic.p95Ms).toBeLessThanOrEqual(filmic.quality === 'high' ? 33.4 : 50);
    await testInfo.attach(`${label}-lighting`, { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
}
