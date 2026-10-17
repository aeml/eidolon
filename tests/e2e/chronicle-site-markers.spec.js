import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

test.use({ serviceWorkers: 'block', trace: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: elemental story sites keep ordinary party markers`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_CHRONICLE_MARKER_REVIEW !== '1', 'Explicit bounded elemental-site marker review');
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL), rows = [];
    let cleanup, failure;
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Entity } = await import('/src/entities/Entity.js');
        const { createChronicleSiteModel } = await import('/src/art/ChronicleSiteModels.js');
        const { chronicleInvestigations } = await import('/src/data/chronicleCatalog.js');
        document.getElementById('start-screen').style.display = 'none';
        const system = new RenderSystem(quality === 'low'); system.setGraphicsQuality(quality);
        await system.preloadEnvironment();
        const stage = new THREE.Group(); system.instanceEnvironmentGroup.add(stage);
        const actor = new Entity('elemental-record-marker-audit'); actor.mesh = new THREE.Group(); actor.mesh.userData.bounds = { radius: 1.25 };
        actor.setPartyHighlight(true); system.entityGroup.add(actor.mesh);
        const marker = actor.mesh.getObjectByName('PartyRing');
        const sites = chronicleInvestigations.filter(chapter => chapter.realm !== 'dark')
            .flatMap(chapter => chapter.sites.filter(site => site.kind === 'inspect').map(site => ({ ...site, realm: chapter.realm })));
        let model;
        const retire = () => { if (model) { model.mesh.removeFromParent(); model.dispose(); model = null; } };
        const read = () => {
            system.render(); const gl = system.renderer.getContext();
            const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            return pixels;
        };
        window.__elementalMarkerAudit = {
            ids: sites.map(site => site.id),
            view(id) {
                retire(); const site = sites.find(site => site.id === id);
                model = createChronicleSiteModel(site, site.realm); model.mesh.position.set(site.x, 0, site.z); stage.add(model.mesh);
                const house = model.walls.length > 0;
                const local = new THREE.Vector3(house ? -1 : 0, 0, house ? 1 : 0);
                const target = local.clone().add(new THREE.Vector3(site.x, 0, site.z));
                actor.mesh.position.copy(target); system.setEnvironmentContext(null, target, true);
                system.setZoom(18); system.setCameraTarget(target); system.updateEnvironmentLighting(target, 0);
                marker.visible = false; read(); const before = read(); marker.visible = true; const after = read();
                let changedPixels = 0;
                for (let index = 0; index < after.length; index += 4)
                    if (before[index] !== after[index] || before[index + 1] !== after[index + 1] || before[index + 2] !== after[index + 2]) changedPixels++;
                const gl = system.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                return { id, realm: site.realm, model: site.model, house, target: target.toArray(), changedPixels,
                    clearOfSiteWalls: !model.walls.some(wall => wall.clone().expandByScalar(1.25).containsPoint(local)),
                    markerY: marker.getWorldPosition(new THREE.Vector3()).y, depthTest: marker.material.depthTest,
                    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
            },
            dispose() {
                retire(); actor.setPartyHighlight(false); actor.mesh.removeFromParent();
                system.disposeObjectResources(stage); stage.removeFromParent();
                const canvas = system.renderer.domElement; system.dispose(); return { canvasRetired: !canvas.isConnected };
            }
        };
    }, quality);
    const persist = () => writeFile(testInfo.outputPath('elemental-marker-audit.json'), JSON.stringify({ quality, rows, cleanup,
        complete: !failure && rows.length === 54 && cleanup?.canvasRetired === true,
        scope: 'All54 elemental inspectable story models over production flat realm ground, ordinary zoom18/Y0 actor. Native component depth evidence; no populated-world, gameplay, device, raised-profile or final-art acceptance.' }, null, 2));
    try {
        const ids = await page.evaluate(() => window.__elementalMarkerAudit.ids);
        expect(ids).toHaveLength(54);
        for (const id of ids) {
            rows.push(await page.evaluate(id => window.__elementalMarkerAudit.view(id), id));
            await persist();
        }
        for (const row of rows) {
            expect(row.clearOfSiteWalls).toBe(true);
            expect(row.depthTest).toBe(true); expect(row.markerY).toBeCloseTo(.05, 5);
            if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(row.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        }
        expect(rows.filter(row => row.changedPixels <= 100).map(({ id, realm, model, changedPixels }) => ({ id, realm, model, changedPixels }))).toEqual([]);
        expect(failures, failures.join('\n')).toEqual([]);
    } catch (error) { failure = error; }
    finally {
        try { cleanup = await page.evaluate(() => window.__elementalMarkerAudit.dispose()); }
        catch (error) { failure ||= error; cleanup = { canvasRetired: false, unavailable: true }; }
        await persist();
    }
    if (failure) throw failure;
    expect(cleanup.canvasRetired).toBe(true);
});
