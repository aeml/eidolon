import { writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';

// A bounded prepared art review in the actual generated layout, not gameplay
// completion, a new room layout, or a floating model/alternative light rig.
export async function reviewDungeonProps(page, testInfo, key, type, layout) {
    if (process.env.EIDOLON_E2E_DUNGEON_PROPS !== '1') return;
    const reports = [];
    for (const label of ['vigil', 'cache', 'font']) {
        const index = label === 'vigil' ? 0 : layout.rooms.findIndex(room => room.hook === (label === 'cache' ? 'chest' : 'shrine'));
        expect(index, `${type} production ${label} room`).toBeGreaterThanOrEqual(0);
        const report = await page.evaluate(async ({ key, type, room, index, label }) => {
            const { applyDungeonRoomStatePresentation } = await import('/src/art/ProceduralDungeonInteriors.js');
            const { render, hero } = window[key];
            const radius = Math.max(8, Math.min(24, Math.max(40, room.width || 80) * .2));
            hero.position.set(room.x + (label === 'vigil' ? -radius * .62 + 3 : 2), .1,
                room.z + (label === 'vigil' ? -radius * .42 + 3 : radius * (label === 'cache' ? .2 : .12) + 3));
            hero.mesh.position.copy(hero.position);
            render.instanceEnvironmentGroup.traverse(part => {
                if (part.userData.proceduralDungeonRoomState)
                    applyDungeonRoomStatePresentation(part, { cleared: false }, { currentRoomIndex: index, objectiveRoomIndex: index });
            });
            render.setEnvironmentContext(type, hero.position, true);
            render.setCameraTarget(hero.position); render.updateEnvironmentLighting(hero.position, 0);
            render.render(); render.render();
            const samples = [];
            for (let i = 0; i < 60; i++) {
                const start = await new Promise(requestAnimationFrame); render.render();
                samples.push((await new Promise(requestAnimationFrame)) - start);
            }
            samples.sort((a, b) => a - b);
            const dressing = render.instanceEnvironmentGroup.children.find(part =>
                part.userData.proceduralDungeonInterior && part.userData.roomIndex === index);
            const gl = render.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
            return { type, label, index, quality: render.graphicsQuality, zoom: render.currentZoom,
                visualOnly: dressing?.userData.visualOnly, batched: dressing?.userData.renderBatched,
                batches: dressing?.userData.drawMeshCount, parts: dressing?.userData.sourceMeshCount,
                frames: samples.length, medianMs: samples[30], p95Ms: samples[57],
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
        }, { key, type, room: layout.rooms[index], index, label });
        expect(report.visualOnly).toBe(true); expect(report.batched).toBe(true);
        expect(report.parts).toBeGreaterThan(report.batches); expect(report.batches).toBeLessThanOrEqual(8);
        expect(report.zoom).toBe(15); expect(report.frames).toBe(60);
        expect(report.renderer).not.toBe('unavailable'); expect(report.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
        expect(report.medianMs).toBeLessThanOrEqual(report.quality === 'high' ? 20 : 33.4);
        expect(report.p95Ms).toBeLessThanOrEqual(report.quality === 'high' ? 33.4 : 50);
        expect(report.calls).toBeLessThanOrEqual(report.quality === 'high' ? 350 : 200);
        expect(report.triangles).toBeLessThanOrEqual(report.quality === 'high' ? 250000 : 85000);
        reports.push(report);
        await page.screenshot({ path: testInfo.outputPath(`${type}-${label}.png`),
            style: '#perf-overlay { visibility: hidden !important; }' });
    }
    await writeFile(testInfo.outputPath(`${type}-props.json`), JSON.stringify(reports, null, 2));
}
