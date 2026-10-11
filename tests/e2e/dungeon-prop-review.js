import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { expect } from '@playwright/test';

export async function prepareDungeonPropReference(page) {
    if (process.env.EIDOLON_E2E_DUNGEON_PAVING_COMPARE === '1') {
        const source = execFileSync('git', ['show', 'f3adbbf0:src/art/ProceduralDungeonInteriors.js'], { encoding: 'utf8' });
        await page.route('**/src/art/DungeonPavingInteriorsReference.js', route => route.fulfill({ body: source, contentType: 'text/javascript' }));
    }
    if (process.env.EIDOLON_E2E_DUNGEON_PROP_COMPARE !== '1') return;
    const revision = process.env.EIDOLON_E2E_DUNGEON_PROP_REFERENCE || '9ff955b4';
    const source = execFileSync('git', ['show', `${revision}:src/art/ProceduralDungeonInteriors.js`], { encoding: 'utf8' });
    await page.route('**/src/art/DungeonPropInteriorsReference.js', route => route.fulfill({ body: source, contentType: 'text/javascript' }));
}

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
                if (part.userData.proceduralDungeonRoomState && Number.isInteger(part.userData.roomIndex))
                    applyDungeonRoomStatePresentation(part, { cleared: false }, { currentRoomIndex: index, objectiveRoomIndex: index });
            });
            render.setEnvironmentContext(type, hero.position, true);
            render.setCameraTarget(hero.position); render.updateEnvironmentLighting(hero.position, 0);
            render.render(); render.render();
            const samples = [];
            const startPosition = hero.position.clone(), originalAnimation = hero.currentAnimationName || 'Idle';
            let skin; hero.mesh.traverse(part => { if (!skin && part.isSkinnedMesh) skin = part; });
            const pose = () => skin.skeleton.bones.flatMap(bone => [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()]);
            let previous = pose(), poseChanged = false;
            const played = hero.playAnimation(hero.getMovementAnimationName(true), true, true);
            try {
                for (let i = 0; i < 60; i++) {
                    const start = await new Promise(requestAnimationFrame);
                    hero.position.x = startPosition.x + (i + 1) * .02;
                    hero.mesh.position.copy(hero.position); hero.updateAnimationMixer(1 / 60);
                    const current = pose(); poseChanged ||= previous.some((value, index) => Math.abs(value - current[index]) > 1e-5); previous = current;
                    render.setCameraTarget(hero.position); render.render();
                    samples.push((await new Promise(requestAnimationFrame)) - start);
                }
            } finally {
                hero.position.copy(startPosition); hero.mesh.position.copy(startPosition);
                hero.playAnimation(originalAnimation, true, true); hero.updateAnimationMixer(0);
                render.setCameraTarget(startPosition); render.render();
            }
            samples.sort((a, b) => a - b);
            const dressing = render.instanceEnvironmentGroup.children.find(part =>
                part.userData.proceduralDungeonInterior && part.userData.roomIndex === index);
            const propMaps = new Map();
            render.instanceEnvironmentGroup.traverse(part => {
                const role = part.material?.userData.dungeonPropSurface;
                if (role) propMaps.set(role, part.material.map.image.width);
            });
            const gl = render.renderer.getContext(), extension = gl.getExtension('WEBGL_debug_renderer_info');
            return { type, label, index, quality: render.graphicsQuality, zoom: render.currentZoom,
                visualOnly: dressing?.userData.visualOnly, batched: dressing?.userData.renderBatched,
                batches: dressing?.userData.drawMeshCount, parts: dressing?.userData.sourceMeshCount,
                paving: dressing?.userData.processionalPaving,
                equipped: hero.mesh.userData.equipmentVisualItemCount, authoredClass: hero.mesh.userData.authoredClass,
                played, poseChanged, propMaps: Object.fromEntries(propMaps), frameSamples: samples,
                frames: samples.length, medianMs: samples[30], p95Ms: samples[57],
                calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : 'unavailable' };
        }, { key, type, room: layout.rooms[index], index, label });
        await testInfo.attach(`${type}-${label}-prop-sample`, { body: JSON.stringify(report), contentType: 'application/json' });
        expect(report.visualOnly).toBe(true); expect(report.batched).toBe(true);
        expect(report.paving).toMatchObject({ identity: label === 'vigil' ? 'entry_gate'
            : label === 'cache' ? 'treasure_cache' : 'restorative_shrine', visualOnly: true });
        expect(report.paving.stones).toBeGreaterThan(15);
        expect(report.parts).toBeGreaterThan(report.batches); expect(report.batches).toBeLessThanOrEqual(8);
        expect(report.zoom).toBe(15); expect(report.frames).toBe(60);
        expect(report.equipped).toBe(14); expect(report.authoredClass).toBe('Fighter');
        expect(report.played).toBe(true); expect(report.poseChanged).toBe(true);
        expect(report.propMaps).toEqual({ stone: report.quality === 'low' ? 64 : 128, metal: report.quality === 'low' ? 64 : 128 });
        expect(report.renderer).not.toBe('unavailable'); expect(report.renderer).not.toMatch(/SwiftShader|llvmpipe/i);
        expect(report.medianMs).toBeLessThanOrEqual(report.quality === 'high' ? 20 : 33.4);
        expect(report.p95Ms).toBeLessThanOrEqual(report.quality === 'high' ? 33.4 : 50);
        expect(report.calls).toBeLessThanOrEqual(report.quality === 'high' ? 350 : 200);
        expect(report.triangles).toBeLessThanOrEqual(report.quality === 'high' ? 250000 : 85000);
        reports.push(report);
        await page.screenshot({ path: testInfo.outputPath(`${type}-${label}.png`),
            style: '#perf-overlay { visibility: hidden !important; }' });
        if (process.env.EIDOLON_E2E_DUNGEON_PAVING_COMPARE === '1') {
            const reference = await page.evaluate(async ({ key, type, room, index }) => {
                const { createProceduralDungeonInteriorKit } = await import('/src/art/DungeonPavingInteriorsReference.js');
                const { applyDungeonRoomStatePresentation } = await import('/src/art/ProceduralDungeonInteriors.js');
                const state = window[key], { render } = state;
                const candidate = render.instanceEnvironmentGroup.children.find(part =>
                    part.userData.proceduralDungeonInterior && part.userData.roomIndex === index);
                const kit = createProceduralDungeonInteriorKit(type, { quality: render.graphicsQuality });
                const previous = kit.createRoomDressing(room, index);
                applyDungeonRoomStatePresentation(previous.children.find(part => part.userData.proceduralDungeonRoomState),
                    { cleared: false }, { currentRoomIndex: index, objectiveRoomIndex: index });
                const sum = object => { let triangles = 0; object.traverse(part => {
                    if (part.geometry) triangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3;
                }); return triangles; };
                const counts = { candidateTriangles: sum(candidate), referenceTriangles: sum(previous),
                    candidateBatches: candidate.userData.drawMeshCount, referenceBatches: previous.userData.drawMeshCount,
                    identity: previous.userData.roomIdentity };
                const childIndex = render.instanceEnvironmentGroup.children.indexOf(candidate);
                render.instanceEnvironmentGroup.remove(candidate); render.instanceEnvironmentGroup.add(previous);
                state.restorePaving = () => {
                    render.instanceEnvironmentGroup.remove(previous); render.instanceEnvironmentGroup.add(candidate);
                    // Restore ordering too, so later controls retain the same scene.
                    const children = render.instanceEnvironmentGroup.children;
                    children.splice(children.indexOf(candidate), 1); children.splice(childIndex, 0, candidate);
                    render.disposeObjectResources(previous);
                };
                render.render(); render.render();
                return { ...counts, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            }, { key, type, room: layout.rooms[index], index });
            try {
                await testInfo.attach(`${type}-${label}-paving-control`, { body: JSON.stringify({ candidate: report, reference }), contentType: 'application/json' });
                expect(reference.candidateTriangles - reference.referenceTriangles).toBe(report.paving.stones * 24);
                expect(reference.candidateBatches - reference.referenceBatches).toBe(1);
                expect(reference.calls).toBeLessThanOrEqual(report.quality === 'high' ? 350 : 200);
                expect(reference.triangles).toBeLessThanOrEqual(report.quality === 'high' ? 250000 : 85000);
                await page.screenshot({ path: testInfo.outputPath(`${type}-${label}-paving-reference.png`),
                    style: '#perf-overlay { visibility: hidden !important; }' });
            } finally {
                await page.evaluate(key => { const state = window[key]; state.restorePaving(); delete state.restorePaving; state.render.render(); }, key);
            }
        }
        if (process.env.EIDOLON_E2E_DUNGEON_PROP_COMPARE === '1') {
            const reference = await page.evaluate(async ({ key, type, room }) => {
                const { createProceduralDungeonInteriorKit } = await import('/src/art/DungeonPropInteriorsReference.js');
                const { render } = window[key];
                const kit = createProceduralDungeonInteriorKit(type, { quality: render.graphicsQuality });
                const root = kit.createRoomDressing({ ...room, type: 'start', hook: '', identity: 'entry_gate', roomIdentity: 'entry_gate' }, 0, { optimized: false });
                const materials = { stone: root.getObjectByName('entry:left-vigil:base').material,
                    metal: root.getObjectByName('entry:left-vigil:shaft').material };
                const changed = [];
                render.instanceEnvironmentGroup.traverse(part => {
                    const role = part.material?.userData.dungeonPropSurface;
                    if (role) { changed.push([part, part.material]); part.material = materials[role]; }
                });
                window[key].restoreProps = () => {
                    for (const [part, material] of changed) part.material = material;
                    render.disposeObjectResources(root);
                };
                render.render(); render.render();
                return { changed: changed.length, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
            }, { key, type, room: layout.rooms[index] });
            try {
                expect(reference.changed).toBeGreaterThan(0);
                expect(reference.calls).toBe(report.calls); expect(reference.triangles).toBe(report.triangles);
                await page.screenshot({ path: testInfo.outputPath(`${type}-${label}-reference.png`),
                    style: '#perf-overlay { visibility: hidden !important; }' });
                await testInfo.attach(`${type}-${label}-prop-control`, { body: JSON.stringify({ candidate: report, reference }), contentType: 'application/json' });
            } finally {
                await page.evaluate(key => { const state = window[key]; state.restoreProps(); delete state.restoreProps; state.render.render(); }, key);
            }
        }
    }
    await writeFile(testInfo.outputPath(`${type}-props.json`), JSON.stringify(reports, null, 2));
}
