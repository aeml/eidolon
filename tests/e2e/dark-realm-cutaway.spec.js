import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';
import { setupDarkRealmCutaway } from './darkRealmCutawayFixture.js';

for (const quality of ['high', 'low']) {
    test(`Dark district ${quality} cutaway reveals the equipped hero and restores its original surface`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.goto('/', { waitUntil: 'networkidle' });
        const initial = await page.evaluate(setupDarkRealmCutaway, quality);
        if (requiresHardwareWebGL()) { expect(initial.gpu).toBeTruthy(); expect(initial.gpu).not.toMatch(/software|swiftshader|llvmpipe|not exposed/i); }
        expect(initial.pendingGeometry).toBe(0);
        if (quality === 'high') expect(initial.ambientParticles).toBeGreaterThan(0);
        for (const outfit of initial.outfits) { expect(outfit.count).toBe(14); expect(outfit.missing).toEqual([]); expect(outfit.fallback).toEqual([]); }
        const views = [];
        for (let index = 1; index <= 4; index++) {
            const controls = await page.evaluate(async index => {
                const r = window.__darkCutaway, room = r.layout.rooms[index], original = r.root.children.filter(n => n.isMesh).map(n => ({ mesh: n, geometry: n.geometry, material: n.userData.sceneryOccluderPart ? null : n.material }));
                const gl = r.render.renderer.getContext(), read = () => {
                    r.game.render(1);
                    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels;
                };
                const difference = (a, b) => { let changed = 0, maximumDelta = 0; for (let i = 0; i < a.length; i++) { changed += Number(a[i] !== b[i]); maximumDelta = Math.max(maximumDelta, Math.abs(a[i] - b[i])); } return { changed, maximumDelta }; };
                r.root.userData.sceneryOccluder = false;
                for (let i = 0; i < 90; i++) await r.frame(room);
                const reference = read(), referencePNG = r.render.renderer.domElement.toDataURL('image/png'), referenceRepeat = difference(reference, read());
                r.game.player.mesh.visible = false; const referenceHidden = read(); r.game.player.mesh.visible = true;
                r.root.userData.sceneryOccluder = true;
                for (let i = 0; i < 90; i++) await r.frame(room);
                const candidate = read(), entry = r.render.sceneryVisibility.entries.get(r.root);
                r.game.player.mesh.visible = false; const candidateHidden = read(); r.game.player.mesh.visible = true;
                const result = { index, bytes: reference.length, opacity: entry.opacity, parts: entry.parts.length, focusError: r.render.sceneryFocus.distanceTo(r.game.player.mesh.position),
                    referenceRepeat, referenceHero: difference(reference, referenceHidden), candidateHero: difference(candidate, candidateHidden), window: difference(reference, candidate),
                    geometryExact: original.every(row => row.mesh.geometry === row.geometry), unrelatedMaterialsExact: original.every(row => !row.material || row.mesh.material === row.material),
                    shadowFlagsExact: entry.parts.every(part => part.mesh.castShadow === part.castShadow) };
                r.root.userData.sceneryOccluder = false;
                for (let i = 0; i < 90; i++) await r.frame(room);
                const restored = read(); result.restored = difference(reference, restored);
                result.restoredRepeat = difference(restored, read());
                if (result.restored.changed || referenceRepeat.changed) {
                    result.referencePNG = referencePNG; result.restoredPNG = r.render.renderer.domElement.toDataURL('image/png');
                    const bounds = [gl.drawingBufferWidth, gl.drawingBufferHeight, 0, 0];
                    for (let i = 0; i < reference.length; i += 4) if (reference.subarray(i, i + 4).some((value, channel) => value !== restored[i + channel])) {
                        const pixel = i / 4, x = pixel % gl.drawingBufferWidth, y = gl.drawingBufferHeight - 1 - Math.floor(pixel / gl.drawingBufferWidth);
                        bounds[0] = Math.min(bounds[0], x); bounds[1] = Math.min(bounds[1], y); bounds[2] = Math.max(bounds[2], x); bounds[3] = Math.max(bounds[3], y);
                    }
                    result.changedBounds = bounds;
                }
                r.root.userData.sceneryOccluder = true;
                for (let i = 0; i < 60; i++) await r.frame(room);
                return result;
            }, index);
            for (const key of ['referencePNG', 'restoredPNG']) if (controls[key]) {
                await writeFile(testInfo.outputPath(`district-${index}-${key}.png`), Buffer.from(controls[key].split(',')[1], 'base64')); delete controls[key];
            }
            views.push(controls); await page.screenshot({ path: testInfo.outputPath(`district-${index}.png`) });
            await writeFile(testInfo.outputPath('controls.json'), JSON.stringify({ initial, views }, null, 2));
            expect(controls.opacity).toBeLessThan(.005); expect(controls.parts).toBe(11); expect(controls.focusError).toBe(0);
            expect(controls.window.changed).toBeGreaterThan(1000);
            expect(controls.candidateHero.changed).toBeGreaterThan(controls.referenceHero.changed + 100);
            expect(controls.geometryExact).toBe(true); expect(controls.unrelatedMaterialsExact).toBe(true); expect(controls.shadowFlagsExact).toBe(true);
            expect(controls.referenceRepeat).toEqual({ changed: 0, maximumDelta: 0 }); expect(controls.restoredRepeat).toEqual({ changed: 0, maximumDelta: 0 });
            expect(controls.restored).toEqual({ changed: 0, maximumDelta: 0 });
        }
        await writeFile(testInfo.outputPath('controls.json'), JSON.stringify({ initial, views }, null, 2));
        await page.evaluate(() => { const r = window.__darkCutaway; for (const actor of r.actors) if (actor !== r.game.player) actor.dispose(); r.game.destroy(); });
        expect(failures).toEqual([]);
    });
}
