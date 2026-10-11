import { execFileSync } from 'node:child_process';
import { expect } from '@playwright/test';

export async function prepareDungeonRelicReference(page) {
    if (process.env.EIDOLON_E2E_DUNGEON_RELIC_COMPARE !== '1') return;
    const source = execFileSync('git', ['show', 'f37b035c:src/art/ProceduralDungeonInteriors.js'], { encoding: 'utf8' });
    await page.route('**/src/art/DungeonRelicInteriorsReference.js', route => route.fulfill({ body: source, contentType: 'text/javascript' }));
}

// Prepared motion beside both actual production motifs at ordinary camera
// distance. This observes art/materials, not server input or device performance.
export async function reviewDungeonRelics(page, testInfo, type, layout) {
    for (const side of [-1, 1]) {
        const report = await page.evaluate(async ({ type, room, side }) => {
            const state = window.__dungeonArtReview, { render, hero } = state;
            const radius = Math.max(8, Math.min(24, room.width * .2));
            const [x, z] = type === 'molten_core' ? [.56, .56] : type === 'tempest_spire' ? [.62, .52] : [.58, .55];
            // Equal X/Z offsets project behind the hero in this isometric
            // camera. Stand to one side so the physical construction is visible.
            const start = hero.position.clone().set(room.x + side * radius * x + 4, .1, room.z + radius * z);
            hero.position.copy(start); hero.mesh.position.copy(start);
            render.setEnvironmentContext(type, start, true); render.setCameraTarget(start); render.updateEnvironmentLighting(start, 0);
            const animation = hero.currentAnimationName || 'Idle';
            let skin; hero.mesh.traverse(part => { if (!skin && part.isSkinnedMesh) skin = part; });
            const pose = () => skin.skeleton.bones.flatMap(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()]);
            let previous = pose(), changed = false, last;
            const played = hero.playAnimation(hero.getMovementAnimationName(true), true, true), intervals = [];
            let calls = 0, triangles = 0;
            try {
                for (let i = 0; i < 36; i++) {
                    const now = await new Promise(requestAnimationFrame);
                    if (last !== undefined) intervals.push(now - last); last = now;
                    hero.position.x = start.x + (i + 1) * .025;
                    hero.mesh.position.copy(hero.position); hero.updateAnimationMixer(1 / 60);
                    const current = pose(); changed ||= previous.some((v, i) => Math.abs(v - current[i]) > 1e-5); previous = current;
                    render.setCameraTarget(hero.position); render.render();
                    calls = Math.max(calls, render.renderer.info.render.calls); triangles = Math.max(triangles, render.renderer.info.render.triangles);
                }
            } finally {
                hero.position.copy(start); hero.mesh.position.copy(start); hero.playAnimation(animation, true, true); hero.updateAnimationMixer(0);
                render.setCameraTarget(start); render.render();
            }
            const dressing = render.instanceEnvironmentGroup.children.find(part => part.userData.proceduralDungeonInterior && part.userData.roomIndex === 0);
            const sorted = [...intervals].sort((a, b) => a - b), gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { type, side, quality: render.graphicsQuality, zoom: render.currentZoom,
                relic: dressing?.userData.regionalRelic, batches: dressing?.userData.drawMeshCount,
                equipped: hero.mesh.userData.equipmentVisualItemCount, authoredClass: hero.mesh.userData.authoredClass,
                frames: 36, played, poseChanged: changed, calls, triangles, intervals,
                medianMs: sorted[17], p95Ms: sorted[33],
                gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
        }, { type, room: layout.rooms[0], side });
        await testInfo.attach(`${type}-${side}-regional-relic`, { body: JSON.stringify(report), contentType: 'application/json' });
        expect(report.relic).toEqual({ type, count: 2, channels: ['body', 'metal', 'glow'], quality: report.quality });
        expect(report.zoom).toBe(15); expect(report.authoredClass).toBe('Fighter'); expect(report.equipped).toBe(14);
        expect(report.played).toBe(true); expect(report.poseChanged).toBe(true); expect(report.batches).toBeLessThanOrEqual(8);
        expect(report.gpu).not.toMatch(/SwiftShader|llvmpipe|software/i);
        expect(report.calls).toBeLessThanOrEqual(report.quality === 'low' ? 200 : 350);
        expect(report.triangles).toBeLessThanOrEqual(report.quality === 'low' ? 85000 : 250000);
        expect(report.medianMs).toBeLessThanOrEqual(report.quality === 'low' ? 33.4 : 20);
        expect(report.p95Ms).toBeLessThanOrEqual(report.quality === 'low' ? 50 : 33.4);
        await page.screenshot({ path: testInfo.outputPath(`${type}-${side}-relic.png`), style: '#perf-overlay { visibility: hidden !important; }' });
        if (process.env.EIDOLON_E2E_DUNGEON_RELIC_COMPARE !== '1') continue;
        const control = await page.evaluate(async ({ type, room }) => {
            const { createProceduralDungeonInteriorKit } = await import('/src/art/DungeonRelicInteriorsReference.js');
            const state = window.__dungeonArtReview, { render } = state;
            const candidate = render.instanceEnvironmentGroup.children.find(part => part.userData.proceduralDungeonInterior && part.userData.roomIndex === 0);
            const previous = createProceduralDungeonInteriorKit(type, { quality: render.graphicsQuality }).createRoomDressing(room, 0);
            // Preserve exact current objective/crown visibility in the control.
            candidate.traverse(part => { if (!part.name) return; const match = previous.getObjectByName(part.name);
                if (match) { match.visible = part.visible; if (match.material && part.material) match.material.opacity = part.material.opacity; }
            });
            const index = render.instanceEnvironmentGroup.children.indexOf(candidate);
            render.instanceEnvironmentGroup.remove(candidate); render.instanceEnvironmentGroup.add(previous);
            state.restoreRelics = () => {
                render.instanceEnvironmentGroup.remove(previous); render.instanceEnvironmentGroup.add(candidate);
                const children = render.instanceEnvironmentGroup.children;
                children.splice(children.indexOf(candidate), 1); children.splice(index, 0, candidate);
                render.disposeObjectResources(previous);
            };
            render.render(); render.render();
            return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                batches: previous.userData.drawMeshCount, quality: render.graphicsQuality };
        }, { type, room: layout.rooms[0] });
        try {
            await testInfo.attach(`${type}-${side}-relic-control`, { body: JSON.stringify({ candidate: report, reference: control }), contentType: 'application/json' });
            expect(control.calls).toBeLessThanOrEqual(control.quality === 'low' ? 200 : 350);
            expect(control.triangles).toBeLessThanOrEqual(control.quality === 'low' ? 85000 : 250000);
            await page.screenshot({ path: testInfo.outputPath(`${type}-${side}-relic-reference.png`), style: '#perf-overlay { visibility: hidden !important; }' });
        } finally {
            await page.evaluate(() => { const state = window.__dungeonArtReview; state.restoreRelics(); delete state.restoreRelics; state.render.render(); });
        }
    }
}
