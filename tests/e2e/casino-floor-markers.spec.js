import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collectBrowserFailures } from './helpers.js';

test.use({ serviceWorkers: 'block', trace: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: casino medallions preserve ordinary party and hostile markers on both floors`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_CASINO_MARKER_REVIEW !== '1', 'Explicit native floor-depth regression review');
    const failures = collectBrowserFailures(page, baseURL);
    const reference = process.env.EIDOLON_CASINO_MARKER_REFERENCE_FILE;
    let referenceServed = false;
    if (reference) {
        const body = readFileSync(reference, 'utf8');
        await page.route('**/src/art/ProceduralCasino.js*', route => {
            referenceServed = true;
            return route.fulfill({ body, contentType: 'text/javascript' });
        });
        await testInfo.attach('casino-marker-reference', { body: JSON.stringify({ file: reference,
            sha256: createHash('sha256').update(body).digest('hex') }), contentType: 'application/json' });
    }
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Entity } = await import('/src/entities/Entity.js');
        const { createCasinoInterior, disposeCasinoObject } = await import('/src/art/ProceduralCasino.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low');
        render.setGraphicsQuality(quality);
        const interior = createCasinoInterior(render.scene, { addCollider() {} });
        const actor = new Entity('floor-depth'); actor.mesh = new THREE.Group();
        actor.mesh.userData.bounds = { radius: 1.25 };
        actor.setPartyHighlight(true); actor.setPvPHostile(true);
        render.entityGroup.add(actor.mesh);
        const markers = ['PartyRing', 'PvPHostileRing'].map(name => actor.mesh.getObjectByName(name));
        const pixels = () => {
            render.render();
            const gl = render.renderer.getContext(), result = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, result);
            return { result, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        window.__casinoMarkerReview = {
            view(floor, markerName) {
                const y = floor === 'vip' ? 8 : 0;
                for (const [name, group] of Object.entries(interior.userData.floors)) group.visible = name === floor;
                actor.mesh.position.set(0, y, 110);
                const target = actor.mesh.position.clone();
                render.setEnvironmentContext('casino', target, true); render.setZoom(10); render.setCameraTarget(target);
                render.updateEnvironmentLighting(target, 0);
                markers.forEach(marker => { marker.visible = false; });
                pixels(); pixels(); const off = pixels();
                const marker = actor.mesh.getObjectByName(markerName); marker.visible = true;
                const on = pixels();
                let changedPixels = 0;
                for (let i = 0; i < on.result.length; i += 4)
                    if (on.result[i] !== off.result[i] || on.result[i + 1] !== off.result[i + 1] || on.result[i + 2] !== off.result[i + 2]) changedPixels++;
                const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                return { floor, marker: markerName, y: marker.getWorldPosition(new THREE.Vector3()).y,
                    depthTest: marker.material.depthTest, changedPixels, callsAdded: on.calls - off.calls,
                    trianglesAdded: on.triangles - off.triangles, overworldVisible: render.staticEnvironmentGroup.visible,
                    cameraOffset: render.camera.position.clone().sub(render.cameraTarget).toArray(), zoom: render.currentZoom,
                    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
            },
            dispose() {
                actor.setPartyHighlight(false); actor.setPvPHostile(false); actor.mesh.removeFromParent();
                disposeCasinoObject(interior); const canvas = render.renderer.domElement; render.dispose();
                return { canvasRetired: !canvas.isConnected };
            }
        };
    }, quality);
    if (reference) expect(referenceServed).toBe(true);
    const rows = []; let cleanup;
    try {
        for (const floor of ['public', 'vip']) for (const marker of ['PartyRing', 'PvPHostileRing']) {
            const row = await page.evaluate(({ floor, marker }) => window.__casinoMarkerReview.view(floor, marker), { floor, marker });
            rows.push(row);
            await page.screenshot({ path: testInfo.outputPath(`${quality}-${floor}-${marker}.png`) });
            expect(row.depthTest).toBe(true); expect(row.overworldVisible).toBe(false);
            expect(row.cameraOffset.map(v => Math.round(v))).toEqual([100, 100, 100]); expect(row.zoom).toBe(10);
            expect(row.callsAdded).toBe(1); expect(row.trianglesAdded).toBe(64);
            if (reference) expect(row.changedPixels).toBe(0);
            else expect(row.changedPixels).toBeGreaterThan(100);
            if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(row.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        }
    } finally {
        cleanup = await page.evaluate(() => window.__casinoMarkerReview.dispose());
        await writeFile(testInfo.outputPath('casino-floor-markers.json'), JSON.stringify({ quality, reference: Boolean(reference), rows, cleanup,
            scope: 'Native component depth proof at standard camera angle/zoom10: only ordinary Entity party/hostile marker visibility changes between synchronous framebuffer reads. Both public/VIP medallions; immutable prior floor source is the occluded negative control. No character, wagering, phone, timing or whole-game acceptance.' }, null, 2));
    }
    expect(cleanup.canvasRetired).toBe(true); expect(failures, failures.join('\n')).toEqual([]);
});
