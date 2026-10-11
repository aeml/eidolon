import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { expect } from '@playwright/test';

const compare = process.env.EIDOLON_E2E_DUNGEON_COMPOSITION_COMPARE === '1';

export async function prepareDungeonFloorCompositionReference(page) {
    if (!compare) return;
    const revision = process.env.EIDOLON_E2E_DUNGEON_COMPOSITION_REFERENCE || '5ee21689';
    const source = execFileSync('git', ['show', `${revision}:src/art/ProceduralDungeonInteriors.js`], { encoding: 'utf8' });
    await page.route('**/src/art/DungeonCompositionReference.js', route => route.fulfill({ body: source, contentType: 'text/javascript' }));
}

export async function reviewDungeonFloorComposition(page, testInfo, key, type, layout) {
    const rooms = await page.evaluate(async layout => {
        const { getDungeonRoomIdentityTag } = await import('/src/utils/dungeonRoomMetadata.js');
        const { getDungeonFloorCompositionPlan } = await import('/src/art/DungeonFloorComposition.js');
        const selected = new Map();
        layout.rooms.forEach((room, index) => {
            const plan = getDungeonFloorCompositionPlan(getDungeonRoomIdentityTag(room));
            if (!selected.has(plan)) selected.set(plan, { room, index, plan });
        });
        return [...selected.values()];
    }, layout);
    const reports = [];
    for (const { room, index, plan } of rooms) {
        const report = await page.evaluate(async ({ key, type, room, index, plan, compare }) => {
            const { applyDungeonRoomStatePresentation } = await import('/src/art/ProceduralDungeonInteriors.js');
            const state = window[key], { render, hero } = state;
            const candidate = render.instanceEnvironmentGroup.children.find(part =>
                part.userData.proceduralDungeonInterior && part.userData.roomIndex === index);
            if (!candidate) throw new Error('Missing actual production room dressing');
            const roomState = candidate.children.find(part => part.userData.proceduralDungeonRoomState);
            applyDungeonRoomStatePresentation(roomState, { cleared: false }, { currentRoomIndex: index, objectiveRoomIndex: index });
            hero.position.set(room.x, .1, room.z + (plan === 'arena' ? 17 : 8));
            hero.mesh.position.copy(hero.position);
            render.setEnvironmentContext(type, hero.position, true);
            render.setCameraTarget(hero.position); render.updateEnvironmentLighting(hero.position, 0);
            const skin = hero.mesh.getObjectByProperty('isSkinnedMesh', true);
            const pose = () => skin.skeleton.bones.flatMap(bone => [...bone.quaternion.toArray(), ...bone.position.toArray()]);
            const before = pose();
            const clip = hero.getMovementAnimationName(true);
            const played = Boolean(clip && hero.playAnimation(clip, true, true));
            let calls = 0, triangles = 0;
            for (let frame = 0; frame < 24; frame++) {
                await new Promise(requestAnimationFrame);
                hero.position.x += .025; hero.mesh.position.copy(hero.position); hero.updateAnimationMixer(1 / 60);
                render.setCameraTarget(hero.position); render.render();
                calls = Math.max(calls, render.renderer.info.render.calls);
                triangles = Math.max(triangles, render.renderer.info.render.triangles);
            }
            const after = pose(), poseChanged = before.some((value, i) => value !== after[i]);
            hero.playAnimation('Idle', true, true); hero.updateAnimationMixer(.2); render.render();
            let previous;
            if (compare) {
                const { createProceduralDungeonInteriorKit } = await import('/src/art/DungeonCompositionReference.js');
                previous = createProceduralDungeonInteriorKit(type, { quality: render.graphicsQuality }).createRoomDressing(room, index);
                applyDungeonRoomStatePresentation(previous.children.find(part => part.userData.proceduralDungeonRoomState),
                    { cleared: false }, { currentRoomIndex: index, objectiveRoomIndex: index });
            }
            const sum = object => { let count = 0; object.traverse(part => {
                if (part.geometry) count += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3;
            }); return count; };
            const childIndex = render.instanceEnvironmentGroup.children.indexOf(candidate);
            if (previous) state.showCompositionReference = () => {
                render.instanceEnvironmentGroup.remove(candidate); render.instanceEnvironmentGroup.add(previous); render.render();
                return { calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            };
            if (previous) state.restoreComposition = () => {
                render.instanceEnvironmentGroup.remove(previous); render.instanceEnvironmentGroup.add(candidate);
                const children = render.instanceEnvironmentGroup.children;
                children.splice(children.indexOf(candidate), 1); children.splice(childIndex, 0, candidate);
                render.disposeObjectResources(previous); render.render();
            };
            return { type, plan, index, quality: render.graphicsQuality, zoom: render.currentZoom,
                composition: candidate.userData.floorComposition, frames: 24, played, poseChanged,
                equipped: hero.mesh.userData.equipmentVisualItemCount, calls, triangles,
                referenceCompared: compare,
                addedTriangles: previous ? sum(candidate) - sum(previous) : null,
                addedBatches: previous ? candidate.userData.drawMeshCount - previous.userData.drawMeshCount : null,
                resources: { ...render.renderer.info.memory } };
        }, { key, type, room, index, plan, compare });
        try {
            expect(report.zoom).toBe(15); expect(report.equipped).toBe(14);
            expect(report.played).toBe(true); expect(report.poseChanged).toBe(true);
            expect(report.composition).toMatchObject({ plan, visualOnly: true });
            if (compare) {
                expect(report.addedTriangles).toBe(report.composition.stones * 10);
                expect(report.addedBatches).toBe(plan === 'nave' || plan === 'court' ? 0 : 1);
            }
            expect(report.calls).toBeLessThanOrEqual(report.quality === 'low' ? 200 : 350);
            expect(report.triangles).toBeLessThanOrEqual(report.quality === 'low' ? 85000 : 250000);
            await page.screenshot({ path: testInfo.outputPath(`${type}-composition-${plan}.png`),
                style: '#perf-overlay { visibility: hidden !important; }' });
            if (compare) {
                report.reference = await page.evaluate(key => window[key].showCompositionReference(), key);
                await page.screenshot({ path: testInfo.outputPath(`${type}-composition-${plan}-reference.png`),
                    style: '#perf-overlay { visibility: hidden !important; }' });
            }
            reports.push(report);
        } finally {
            await page.evaluate(key => {
                const state = window[key]; state.restoreComposition?.();
                delete state.restoreComposition; delete state.showCompositionReference;
            }, key);
        }
    }
    await writeFile(testInfo.outputPath(`${type}-floor-composition.json`), JSON.stringify({
        scope: 'Actual production layouts at normal zoom with equipped Fighter/HUD and prepared mixer/render updates. Historical parent controls only when explicitly enabled. No live gameplay cadence, server combat, physical device or owner art acceptance.',
        compareParent: compare,
        reports
    }, null, 2));
}
