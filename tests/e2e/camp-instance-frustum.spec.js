import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: camp clipping preserves exact source color and shadows`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { createLanternholdCampPlacements, createProceduralLanternholdCampField } = await import('/src/art/ProceduralLanternholdArchitecture.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        if (!render.renderer.extensions.has('WEBGL_multi_draw')) throw Error('Native camp qualification requires multi-draw');
        const placements = createLanternholdCampPlacements(0, 200);
        const original = createProceduralLanternholdCampField(placements);
        const selected = createProceduralLanternholdCampField(placements, { perInstanceFrustum: true });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: 0x44463d, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2; floor.position.set(0, .025, 200); floor.receiveShadow = true;
        render.instanceEnvironmentGroup.add(original, selected, floor);
        render.applyLightingPreset('town', true);
        const canvas = render.renderer.domElement, copy = document.createElement('canvas');
        copy.width = canvas.width; copy.height = canvas.height;
        const context = copy.getContext('2d', { willReadFrequently: true });
        const descriptor = Object.getOwnPropertyDescriptor(performance, 'now'), frozen = performance.now();
        const capture = candidate => {
            original.visible = !candidate; selected.visible = candidate;
            render.render(); context.drawImage(canvas, 0, 0);
            return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        const rows = [], lifetimes = []; let selectedDisposed = false;
        const memory = () => ({ ...render.renderer.info.memory });
        const bytes = mesh => Object.values(mesh.geometry.attributes).reduce((sum, attr) => sum + attr.array.byteLength, mesh.geometry.index?.array.byteLength || 0) +
            mesh._matricesTexture.image.data.byteLength + mesh._indirectTexture.image.data.byteLength;
        const ownedBytes = selected.children.reduce((sum, mesh) => sum + bytes(mesh), 0);
        try {
            Object.defineProperty(performance, 'now', { configurable: true, value: () => frozen });
            const views = [{ label: 'town-center', x: -1.25, z: 200, zoom: 15 },
                ...placements.map((p, index) => ({ label: `camp-${index}`, x: p.x + 4, z: p.z + 4, zoom: 15 })),
                { label: 'wide', x: 0, z: 200, zoom: 60 },
                { label: 'close', x: placements[3].x + 6, z: placements[3].z + 2, zoom: 5 },
                { label: 'edge-west', x: placements[0].x - 20, z: placements[0].z, zoom: 15 },
                { label: 'edge-east', x: placements[0].x + 20, z: placements[0].z, zoom: 15 },
                { label: 'far-origin', x: placements[3].x + 50004, z: placements[3].z + 20004, zoom: 15, far: true }];
            for (const view of views) {
                const offset = view.far ? new THREE.Vector3(50000, 0, 20000) : new THREE.Vector3();
                original.position.copy(offset); selected.position.copy(offset); floor.position.set(offset.x, .025, offset.z + 200);
                render.setZoom(view.zoom); render.setCameraTarget(new THREE.Vector3(view.x, 0, view.z));
                render.updateEnvironmentLighting(new THREE.Vector3(view.x, 0, view.z), 0);
                capture(false); capture(true); capture(false);
                const reference = capture(false), candidate = capture(true), again = capture(false);
                let changedRGB = 0, unstableRGB = 0, maximumChannelError = 0;
                for (let i = 0; i < reference.pixels.length; i += 4) for (let c = 0; c < 3; c++) {
                    const error = Math.abs(reference.pixels[i + c] - candidate.pixels[i + c]);
                    changedRGB += error > 0 ? 1 : 0; maximumChannelError = Math.max(maximumChannelError, error);
                    unstableRGB += reference.pixels[i + c] !== again.pixels[i + c] ? 1 : 0;
                }
                rows.push({ view, reference: { calls: reference.calls, triangles: reference.triangles },
                    candidate: { calls: candidate.calls, triangles: candidate.triangles }, changedRGB, unstableRGB, maximumChannelError });
            }
            selected.removeFromParent(); selected.children.forEach(mesh => mesh.dispose()); selectedDisposed = true;
            original.visible = true; render.render(); const baseline = memory();
            for (let cycle = 0; cycle < 4; cycle++) {
                const field = createProceduralLanternholdCampField(placements, { perInstanceFrustum: true });
                field.position.set(50000, 0, 20000); render.instanceEnvironmentGroup.add(field); render.render();
                const during = memory(); field.removeFromParent(); field.children.forEach(mesh => mesh.dispose()); render.render();
                lifetimes.push({ cycle, baseline, during, after: memory() });
            }
            return { quality, rows, lifetimes, ownedBytes, camps: placements.length, materialBuckets: selected.children.length,
                scope: 'Exact original instancing versus stock per-camp clipping at every15original placement, town center, wide/close/edges/far origin; each pass uses its actual camera. Source vertices, material hooks, shadows and camp order retained. Owned derivative buffers/textures measured and four replacement/disposal cycles; no FPS or zero-VRAM claim.' };
        } finally {
            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
            selected.removeFromParent(); original.removeFromParent(); original.children.forEach(mesh => mesh.dispose());
            if (!selectedDisposed) selected.children.forEach(mesh => mesh.dispose());
            render.dispose();
        }
    }, quality);
    await writeFile(testInfo.outputPath('camp-instance-frustum.json'), JSON.stringify(result, null, 2));
    expect(result.camps).toBe(15); expect(result.materialBuckets).toBe(9); expect(result.rows).toHaveLength(21);
    for (const row of result.rows) {
        expect(row.changedRGB, row.view.label).toBe(0); expect(row.unstableRGB, row.view.label).toBe(0);
        expect(row.candidate.triangles, row.view.label).toBeLessThanOrEqual(row.reference.triangles);
        expect(row.candidate.calls, row.view.label).toBeLessThanOrEqual(row.reference.calls);
    }
    expect(result.rows.some(row => row.candidate.triangles < row.reference.triangles)).toBe(true);
    for (const cycle of result.lifetimes) expect(cycle.after).toEqual(cycle.baseline);
    expect(failures, failures.join('\n')).toEqual([]);
});
