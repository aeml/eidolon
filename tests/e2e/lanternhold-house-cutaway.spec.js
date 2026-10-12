import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';
import { setupLanternholdCutaway } from './lanternholdCutawayFixture.js';

for (const quality of ['high', 'low']) {
    test(`Lanternhold ${quality} homes reveal the equipped hero and restore their original surfaces`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        const initial = await page.evaluate(setupLanternholdCutaway, quality);
        if (requiresHardwareWebGL()) { expect(initial.gpu).toBeTruthy(); expect(initial.gpu).not.toMatch(/software|swiftshader|llvmpipe|not exposed/i); }
        expect(initial.pendingGeometry).toBe(0);
        for (const outfit of initial.outfits) { expect(outfit.count).toBe(14); expect(outfit.missing).toEqual([]); expect(outfit.fallback).toEqual([]); }
        const controls = [];
        for (let index = 0; index < 2; index++) {
            const result = await page.evaluate(async index => {
                const r = window.__lanternholdCutaway, view = r.views[index], source = r.root.children.map(mesh => ({ mesh, geometry: mesh.geometry, material: mesh.material, castShadow: mesh.castShadow }));
                const renderer = r.render.renderer, gl = renderer.getContext();
                const capture = () => {
                    r.game.render(1); const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    const map = r.render.keyLight?.shadow?.map; let shadow = null;
                    if (renderer.shadowMap.enabled && map) { shadow = new Uint8Array(map.width * map.height * 4); renderer.readRenderTargetPixels(map, 0, 0, map.width, map.height, shadow); }
                    return { pixels, shadow, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
                };
                const changed = (a, b) => a ? a.reduce((sum, value, i) => sum + Number(value !== b[i]), 0) : 0;
                r.root.userData.sceneryOccluder = false; for (let i = 0; i < 60; i++) await r.frame(view);
                const reference = capture(); r.game.player.mesh.visible = false; const referenceHidden = capture(); r.game.player.mesh.visible = true;
                r.root.userData.sceneryOccluder = true; for (let i = 0; i < 75; i++) await r.frame(view);
                const candidate = capture(), entry = r.render.sceneryVisibility.entries.get(r.root);
                r.game.player.mesh.visible = false; const candidateHidden = capture(); r.game.player.mesh.visible = true;
                const result = { view: view.name, opacity: entry.opacity, parts: entry.parts.length, focusError: r.render.sceneryFocus.distanceTo(r.game.player.mesh.position),
                    referenceHero: changed(reference.pixels, referenceHidden.pixels), candidateHero: changed(candidate.pixels, candidateHidden.pixels), changedColor: changed(reference.pixels, candidate.pixels),
                    changedShadow: changed(reference.shadow, candidate.shadow), geometryExact: source.every(s => s.mesh.geometry === s.geometry), shadowFlagsExact: source.every(s => s.mesh.castShadow === s.castShadow),
                    foundationExact: source.filter(s => !s.mesh.userData.sceneryOccluderPart).every(s => s.mesh.material === s.material), reference: { calls: reference.calls, triangles: reference.triangles }, candidate: { calls: candidate.calls, triangles: candidate.triangles } };
                r.root.userData.sceneryOccluder = false; const restored = capture();
                result.changedRestored = changed(reference.pixels, restored.pixels); result.changedRestoredShadow = changed(reference.shadow, restored.shadow);
                result.materialsRestored = source.every(s => s.mesh.material === s.material);
                r.root.userData.sceneryOccluder = true; for (let i = 0; i < 60; i++) await r.frame(view);
                return result;
            }, index);
            controls.push(result); await page.screenshot({ path: testInfo.outputPath(`${result.view}.png`) });
            await writeFile(testInfo.outputPath('controls.json'), JSON.stringify({ initial, controls }, null, 2));
            expect(result.opacity).toBeLessThan(.005); expect(result.parts).toBe(5); expect(result.focusError).toBe(0);
            expect(result.changedColor).toBeGreaterThan(1000); expect(result.candidateHero).toBeGreaterThan(result.referenceHero + 100);
            expect(result.changedShadow).toBe(0); expect(result.changedRestored).toBe(0); expect(result.changedRestoredShadow).toBe(0);
            expect(result.geometryExact && result.shadowFlagsExact && result.foundationExact && result.materialsRestored).toBe(true);
            expect(result.candidate).toEqual(result.reference);
        }
        await page.evaluate(() => { const r = window.__lanternholdCutaway; for (const actor of r.actors) if (actor !== r.game.player) actor.dispose(); r.game.destroy(); });
        expect(failures).toEqual([]);
    });
}
