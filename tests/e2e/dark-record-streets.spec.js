import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collectBrowserFailures } from './helpers.js';

const views = ['dark_shelter_cups', 'dark_expedition_signal', 'dark_returned_petitions', 'dark_fuel_order',
    'dark_water_conduit', 'dark_release_fire', 'dark_waiting_table', 'dark_citizens_memorial'];
const referenceFiles = ['src/data/darkRealmPopulation.js', 'src/art/ProceduralDarkRealm.js'];

test.use({ trace: 'off', video: 'off', serviceWorkers: 'block' });
for (const quality of ['high', 'low']) test(`${quality}: existing Dark Realm records have visible street approaches`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_DARK_STREETS_REVIEW !== '1', 'Explicit bounded native street composition check');
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL), served = new Set();
    const reference = process.env.EIDOLON_DARK_STREETS_REFERENCE_DIR;
    if (reference) for (const file of referenceFiles) {
        const body = readFileSync(`${reference}/${file.split('/').at(-1)}`, 'utf8');
        await page.route(`**/${file}*`, route => { served.add(file); return route.fulfill({ body, contentType: 'text/javascript' }); });
        await testInfo.attach(`reference-${file.split('/').at(-1)}`, { body: JSON.stringify({ file,
            sha256: createHash('sha256').update(body).digest('hex') }), contentType: 'application/json' });
    }
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'low' ? 390 : 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Entity } = await import('/src/entities/Entity.js');
        const { createDarkRealmScene } = await import('/src/art/ProceduralDarkRealm.js');
        const { createChronicleSiteModel } = await import('/src/art/ChronicleSiteModels.js');
        const { darkRealmFixture } = await import('/tests/darkRealmFixture.js');
        const { darkRealmChapters } = await import('/src/data/chronicleCatalog.js');
        document.getElementById('start-screen').style.display = 'none';
        const system = new RenderSystem(quality === 'low'); system.setGraphicsQuality(quality);
        await system.preloadEnvironment();
        const stage = new THREE.Group(); system.instanceEnvironmentGroup.add(stage);
        const root = createDarkRealmScene(stage, darkRealmFixture(), null, { quality });
        const paths = root.getObjectByName('Dark Realm authored paths');
        const actor = new Entity('street-depth-marker'); actor.mesh = new THREE.Group(); actor.mesh.userData.bounds = { radius: 1.25 };
        actor.setPartyHighlight(true); system.entityGroup.add(actor.mesh);
        const marker = actor.mesh.getObjectByName('PartyRing');
        const sites = darkRealmChapters.flatMap(chapter => chapter.sites || []);
        let model;
        const retireModel = () => { if (model) { model.mesh.removeFromParent(); model.dispose(); model = null; } };
        const read = crop => {
            system.render();
            const gl = system.renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
            const size = crop ? 64 : null, x = crop ? Math.max(0, Math.min(w - size, Math.floor(w / 2 - size / 2))) : 0;
            const y = crop ? Math.max(0, Math.min(h - size, Math.floor(h / 2 - size / 2))) : 0;
            const pixels = new Uint8Array((size || w) * (size || h) * 4);
            gl.readPixels(x, y, size || w, size || h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return pixels;
        };
        const changed = (a, b) => {
            let result = 0;
            for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) result++;
            return result;
        };
        window.__recordStreetReview = {
            view(id) {
                retireModel(); const site = sites.find(site => site.id === id);
                model = createChronicleSiteModel(site, 'dark'); model.mesh.position.set(site.x, 0, site.z); stage.add(model.mesh);
                const target = new THREE.Vector3(site.x, 0, site.z + 12); actor.mesh.position.copy(target);
                system.setEnvironmentContext('dark_realm', target, true); system.setZoom(18); system.setCameraTarget(target);
                system.updateEnvironmentLighting(target, 0);
                marker.visible = false; paths.visible = false; read(true); read(true); const off = read(true);
                paths.visible = true; const on = read(true), noMarker = read(false);
                marker.visible = true; const withMarker = read(false);
                const gl = system.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                return { id, target: target.toArray(), streetSignal: changed(off, on), markerSignal: changed(noMarker, withMarker),
                    roadMeshes: paths.children.length, roadOrders: paths.children.map(mesh => mesh.renderOrder),
                    depthTest: marker.material.depthTest, calls: system.renderer.info.render.calls,
                    triangles: system.renderer.info.render.triangles, zoom: system.currentZoom,
                    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
            },
            dispose() {
                retireModel(); actor.setPartyHighlight(false); actor.mesh.removeFromParent();
                system.disposeObjectResources(stage); stage.removeFromParent();
                const canvas = system.renderer.domElement; system.dispose(); return { canvasRetired: !canvas.isConnected };
            }
        };
    }, quality);
    const rows = []; let cleanup;
    try {
        for (const id of views) {
            const row = await page.evaluate(id => window.__recordStreetReview.view(id), id);
            rows.push(row); await page.screenshot({ path: testInfo.outputPath(`${quality}-${id}.png`) });
            expect(row.roadMeshes).toBe(10); expect(row.roadOrders.every(order => order === -.5)).toBe(true);
            expect(row.depthTest).toBe(true); expect(row.markerSignal).toBeGreaterThan(100); expect(row.zoom).toBe(18);
            if (reference) expect(row.streetSignal).toBe(0); else expect(row.streetSignal).toBeGreaterThan(100);
            if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(row.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        }
        if (reference) expect([...served].sort()).toEqual([...referenceFiles].sort());
    } finally {
        cleanup = await page.evaluate(() => window.__recordStreetReview.dispose());
        await writeFile(testInfo.outputPath('record-streets.json'), JSON.stringify({ quality, reference: Boolean(reference), rows, cleanup,
            scope: 'Native component composition at eight existing records across four districts. Standard camera/zoom18, current/prior street visibility in fixed64px center crops, actual record models and ordinary Entity party marker. No earned progress, live party, physical phone, frame timing, capacity or final-art acceptance.' }, null, 2));
    }
    expect(cleanup.canvasRetired).toBe(true); expect(failures, failures.join('\n')).toEqual([]);
});
