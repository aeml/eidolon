import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collectBrowserFailures } from './helpers.js';

test.use({ serviceWorkers: 'block', trace: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: Dark record rooms retain entrances, markers and owned resources`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_DARK_RECORD_REVIEW !== '1', 'Explicit bounded native record architecture review');
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL);
    const source = readFileSync(process.env.EIDOLON_DARK_RECORD_REFERENCE_FILE, 'utf8');
    await testInfo.attach('reference-source', { body: JSON.stringify({ sha256: createHash('sha256').update(source).digest('hex') }), contentType: 'application/json' });
    let referenceServed = false;
    await page.route('**/src/art/ChronicleSiteModels.js?record-reference', route => {
        referenceServed = true;
        return route.fulfill({ body: source, contentType: 'text/javascript' });
    });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Entity } = await import('/src/entities/Entity.js');
        const { createDarkRealmScene } = await import('/src/art/ProceduralDarkRealm.js');
        const { darkRealmFixture } = await import('/tests/darkRealmFixture.js');
        const { darkRealmChapters } = await import('/src/data/chronicleCatalog.js');
        const { createChronicleSiteModel: current } = await import('/src/art/ChronicleSiteModels.js');
        const { createChronicleSiteModel: reference } = await import('/src/art/ChronicleSiteModels.js?record-reference');
        document.getElementById('start-screen').style.display = 'none';
        const system = new RenderSystem(quality === 'low'); system.setGraphicsQuality(quality);
        await system.preloadEnvironment();
        const stage = new THREE.Group(); system.instanceEnvironmentGroup.add(stage);
        createDarkRealmScene(stage, darkRealmFixture(), null, { quality });
        const actor = new Entity('record-floor-marker'); actor.mesh = new THREE.Group();
        actor.mesh.userData.bounds = { radius: 1.25 }; actor.setPartyHighlight(true);
        system.entityGroup.add(actor.mesh);
        const marker = actor.mesh.getObjectByName('PartyRing');
        const sites = darkRealmChapters.flatMap(chapter => chapter.sites || [])
            .filter(site => ['flood_shelter', 'observatory', 'cold_kiln'].includes(site.model));
        const capture = () => {
            system.render(); const gl = system.renderer.getContext();
            const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return { pixels, calls: system.renderer.info.render.calls, triangles: system.renderer.info.render.triangles,
                memory: { ...system.renderer.info.memory } };
        };
        const changed = (a, b) => {
            let count = 0;
            for (let i = 0; i < a.length; i += 4)
                if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) count++;
            return count;
        };
        let before, after;
        const retire = () => {
            for (const model of [before, after]) if (model) { model.mesh.removeFromParent(); model.dispose(); }
            before = after = null;
        };
        window.__darkRecordArchitecture = {
            ids: sites.map(site => site.id),
            view(id) {
                retire(); const site = sites.find(site => site.id === id);
                const target = new THREE.Vector3(site.x - 1, 0, site.z + 1);
                actor.mesh.position.copy(target); system.setEnvironmentContext('dark_realm', target, true);
                system.setZoom(18); system.setCameraTarget(target); system.updateEnvironmentLighting(target, 0);
                // Warm the existing ring before measuring the scene baseline;
                // its first GPU upload belongs to the marker, not either room.
                marker.visible = true; capture(); marker.visible = false; capture();
                const baseline = capture().memory;
                before = reference(site, 'dark'); after = current(site, 'dark');
                for (const model of [before, after]) {
                    model.mesh.position.set(site.x, 0, site.z); stage.add(model.mesh); model.mesh.visible = false;
                }
                before.mesh.visible = true; capture(); const old = capture();
                marker.visible = true; const oldMarker = capture(); marker.visible = false;
                const referencePng = system.renderer.domElement.toDataURL('image/png');
                before.mesh.visible = false; after.mesh.visible = true; capture(); const now = capture();
                marker.visible = true; const newMarker = capture();
                const currentPng = system.renderer.domElement.toDataURL('image/png');
                const gl = system.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                const row = { id, model: site.model, quality, zoom: system.currentZoom,
                    changedPixels: changed(old.pixels, now.pixels), referenceMarkerPixels: changed(old.pixels, oldMarker.pixels),
                    currentMarkerPixels: changed(now.pixels, newMarker.pixels), markerDepthTest: marker.material.depthTest,
                    markerY: marker.getWorldPosition(new THREE.Vector3()).y,
                    sameColliders: JSON.stringify(before.walls) === JSON.stringify(after.walls),
                    beforeCalls: old.calls, afterCalls: now.calls, beforeTriangles: old.triangles, afterTriangles: now.triangles,
                    baseline, renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
                retire(); marker.visible = false; row.restored = capture().memory;
                return { row, referencePng, currentPng };
            },
            dispose() {
                retire(); actor.setPartyHighlight(false); actor.mesh.removeFromParent();
                system.disposeObjectResources(stage); stage.removeFromParent();
                const canvas = system.renderer.domElement; system.dispose(); return { canvasRetired: !canvas.isConnected };
            }
        };
    }, quality);
    const rows = []; let cleanup;
    try {
        const ids = await page.evaluate(() => window.__darkRecordArchitecture.ids);
        expect(ids).toHaveLength(14);
        for (const id of ids) {
            const { row, referencePng, currentPng } = await page.evaluate(id => window.__darkRecordArchitecture.view(id), id);
            rows.push(row);
            for (const [name, data] of [['prior', referencePng], ['current', currentPng]])
                await writeFile(testInfo.outputPath(`${quality}-${id}-${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
            expect(row.zoom).toBe(18); expect(row.changedPixels).toBeGreaterThan(200);
            expect(row.sameColliders).toBe(true); expect(row.restored).toEqual(row.baseline);
            expect(row.markerDepthTest).toBe(true); expect(row.markerY).toBeCloseTo(.05, 5);
            expect(row.referenceMarkerPixels).toBe(0); expect(row.currentMarkerPixels).toBeGreaterThan(100);
            expect(row.afterCalls).toBeLessThanOrEqual(quality === 'high' ? 350 : 200);
            expect(row.afterTriangles).toBeLessThanOrEqual(quality === 'high' ? 250000 : 85000);
            if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(row.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        }
        expect(referenceServed).toBe(true);
    } finally {
        cleanup = await page.evaluate(() => window.__darkRecordArchitecture.dispose());
        await writeFile(testInfo.outputPath('record-architecture.json'), JSON.stringify({ quality, rows, cleanup,
            scope: 'Paired static native component views at fourteen existing Dark Realm records, ordinary zoom18. Exact colliders and per-site GPU memory restoration; shallow floor/marker depth. No gameplay progression, frame timing, supported-device, capacity or final-art acceptance.' }, null, 2));
    }
    expect(cleanup.canvasRetired).toBe(true); expect(failures, failures.join('\n')).toEqual([]);
});
