import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`${quality} flat party and PvP rings preserve both faces with one submission`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'high' ? 1100 : 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Entity } = await import('/src/entities/Entity.js');
        document.getElementById('start-screen').style.display = 'none';
        const system = new RenderSystem(quality === 'low'); system.setGraphicsQuality(quality);
        const entity = new Entity('flat-ring-component'); entity.mesh = new THREE.Group();
        entity.mesh.userData.bounds = { radius: 1.25 }; system.entityGroup.add(entity.mesh);
        entity.setPartyHighlight(true); entity.setPvPHostile(true);
        const rings = [entity.mesh.getObjectByName('PartyRing'), entity.mesh.getObjectByName('PvPHostileRing')];
        const canvas = system.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true }), samples = [], screenshots = [];
        let resourcesRetired = 0;
        for (const ring of rings) for (const resource of [ring.geometry, ring.material])
            resource.addEventListener('dispose', () => resourcesRetired++);
        const capture = (ring, single) => {
            ring.material.forceSinglePass = single; ring.material.needsUpdate = true;
            system.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: system.renderer.info.render.calls, triangles: system.renderer.info.render.triangles };
        };
        try {
            for (const [kind, ring] of rings.entries()) {
                for (const other of rings) other.visible = other === ring;
                for (const [view, position] of [['above', [0, 6, 7]], ['edge', [0, .3, 8]], ['below', [0, -6, 7]]]) {
                    system.camera.position.set(...position); system.camera.lookAt(0, .05, 0);
                    system.camera.left = -2; system.camera.right = 2;
                    system.camera.top = 2 * canvas.height / canvas.width; system.camera.bottom = -system.camera.top;
                    system.camera.updateProjectionMatrix(); system.camera.updateMatrixWorld(true);
                    ring.visible = false; system.render(); context.drawImage(canvas, 0, 0);
                    const background = context.getImageData(0, 0, copy.width, copy.height).data; ring.visible = true;
                    const baseline = capture(ring, false), candidate = capture(ring, true);
                    let changedPixels = 0, visiblePixels = 0;
                    for (let i = 0; i < candidate.pixels.length; i += 4) {
                        if ([0, 1, 2, 3].some(channel => baseline.pixels[i + channel] !== candidate.pixels[i + channel])) changedPixels++;
                        if ([0, 1, 2].some(channel => candidate.pixels[i + channel] !== background[i + channel])) visiblePixels++;
                    }
                    samples.push({ kind: kind === 0 ? 'party' : 'pvp', view, changedPixels, visiblePixels,
                        baselineCalls: baseline.calls, candidateCalls: candidate.calls,
                        baselineTriangles: baseline.triangles, candidateTriangles: candidate.triangles });
                    if (view === 'above') screenshots.push({ kind, png: canvas.toDataURL('image/png') });
                }
            }
        } finally {
            entity.setPartyHighlight(false); entity.setPvPHostile(false);
            system.entityGroup.remove(entity.mesh); system.dispose();
        }
        return { samples, resourcesRetired, canvasRetired: !canvas.isConnected, screenshots };
    }, quality);
    for (const row of result.samples) {
        expect(row.visiblePixels, `${row.kind}/${row.view} remains visible`).toBeGreaterThan(20);
        expect(row.changedPixels, `${row.kind}/${row.view} exact pixels`).toBe(0);
        expect(row.baselineCalls - row.candidateCalls).toBe(1);
        expect(row.baselineTriangles - row.candidateTriangles).toBe(64);
    }
    expect(result.samples).toHaveLength(6); expect(result.resourcesRetired).toBe(4); expect(result.canvasRetired).toBe(true);
    for (const capture of result.screenshots) {
        await writeFile(testInfo.outputPath(`${quality}-${capture.kind === 0 ? 'party' : 'pvp'}-ring.png`), Buffer.from(capture.png.split(',')[1], 'base64'));
    }
    delete result.screenshots;
    await writeFile(testInfo.outputPath('flat-ring-comparison.json'), JSON.stringify(result, null, 2));
    expect(failures, failures.join('\n')).toEqual([]);
});
