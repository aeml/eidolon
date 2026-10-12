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
        // Exercise the real shared material on one mixed batch. The left
        // work surface must remain byte-exact while right building vertices
        // reveal, then the entire target must restore exactly.
        const maskedSurface = await page.evaluate(async () => {
            const { THREE, root, render } = window.__darkCutaway;
            const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
            const { SceneryVisibility } = await import('/src/core/SceneryVisibility.js');
            const source = render.sceneryVisibility.entries.get(root).parts.find(part =>
                part.mesh.geometry.getAttribute('sceneryOccluderMask').array.includes(0) && part.material.metalness === .55);
            const halves = [-.8, .8].map((x, index) => {
                const geometry = new THREE.PlaneGeometry(1.4, 1.4).toNonIndexed(); geometry.translate(x, 0, 0);
                geometry.setAttribute('sceneryOccluderMask', new THREE.Uint8BufferAttribute(
                    new Uint8Array(geometry.attributes.position.count).fill(index), 1)); return geometry;
            });
            const geometry = mergeGeometries(halves); halves.forEach(part => part.dispose());
            const mesh = new THREE.Mesh(geometry, source.material); mesh.userData.sceneryOccluderPart = true;
            const batch = new THREE.Group(); batch.userData.sceneryOccluderMasked = true; batch.add(mesh);
            const scene = new THREE.Scene(); scene.background = new THREE.Color(0x101020); scene.add(batch, new THREE.AmbientLight(0xffffff, 3));
            const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 20); camera.position.z = 10; camera.lookAt(0, 0, 0);
            const target = new THREE.WebGLRenderTarget(128, 128), renderer = render.renderer, previousTarget = renderer.getRenderTarget();
            const controller = new SceneryVisibility(), entry = controller.createEntry(batch);
            const capture = () => { renderer.setRenderTarget(target); renderer.render(scene, camera);
                const pixels = new Uint8Array(128 * 128 * 4); renderer.readRenderTargetPixels(target, 0, 0, 128, 128, pixels); return pixels; };
            try {
                const original = capture(); entry.uniforms.focus.value.set(0, 0, 10); entry.opacity = 0; controller.applyOpacity(entry);
                const revealed = capture(); let workChanged = 0, buildingChanged = 0;
                for (let i = 0; i < original.length; i++) {
                    if (original[i] === revealed[i]) continue;
                    if (Math.floor(i / 4) % 128 < 64) workChanged++; else buildingChanged++;
                }
                controller.release(entry); const restored = capture();
                return { workChanged, buildingChanged, restoredChanged: original.reduce((count, value, index) => count + Number(value !== restored[index]), 0) };
            } finally { controller.release(entry); renderer.setRenderTarget(previousTarget); target.dispose(); geometry.dispose(); }
        });
        await writeFile(testInfo.outputPath('masked-work-surface.json'), JSON.stringify(maskedSurface, null, 2));
        expect(maskedSurface.workChanged).toBe(0); expect(maskedSurface.buildingChanged).toBeGreaterThan(100);
        expect(maskedSurface.restoredChanged).toBe(0);
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
