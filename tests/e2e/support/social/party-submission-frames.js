import { expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// This separate diagnostic interval follows the uninstrumented performance
// sample. Renderer-boundary hooks preserve object callbacks and batch eligibility.
export async function capturePartySubmissionFrames(page, testInfo, filename = 'party-submission-frames.json') {
    const evidence = await page.evaluate(() => new Promise((resolve, reject) => {
        const game = window.game, render = game.renderSystem, renderer = render.renderer;
        const direct = renderer.renderBufferDirect, draw = render.render;
        const directDescriptor = Object.getOwnPropertyDescriptor(renderer, 'renderBufferDirect');
        const drawDescriptor = Object.getOwnPropertyDescriptor(render, 'render');
        const boundaries = new Set([render.scene, render.staticEnvironmentGroup, render.instanceEnvironmentGroup,
            render.entityGroup, render.actorInstances?.group].filter(Boolean));
        const frames = [], lights = new Map();
        let rows, cameras, closed = false;
        const finish = error => {
            if (closed) return;
            closed = true; clearTimeout(timer);
            const owned = renderer.renderBufferDirect === observedDirect && render.render === observedDraw;
            if (renderer.renderBufferDirect === observedDirect) {
                if (directDescriptor) Object.defineProperty(renderer, 'renderBufferDirect', directDescriptor);
                else delete renderer.renderBufferDirect;
            }
            if (render.render === observedDraw) {
                if (drawDescriptor) Object.defineProperty(render, 'render', drawDescriptor);
                else delete render.render;
            }
            if (error || !owned) reject(error || Error('Submission diagnostic lost hook ownership'));
            else resolve({ frames, lights: [...lights.values()], restored: true, quality: render.graphicsQuality,
                zoom: render.currentZoom, scope: 'Twelve actual game renders after the normal180frame sample; live animation/network and camera unchanged. Instrumented interval establishes submission identity/counts only, never frame timing or performance acceptance. No per-object callbacks, visibility, render policy, materials, geometry or actor state changed.' });
        };
        function observedDirect(camera, scene, geometry, material, object, group) {
            const before = renderer.info.render.calls;
            const result = direct.call(this, camera, scene, geometry, material, object, group);
            if (!rows) return result;
            let root = object;
            while (root.parent && !boundaries.has(root.parent) && !root.userData.authoredClass) root = root.parent;
            const family = root.userData.authoredClass ? `Equipped ${root.userData.authoredClass}`
                : object.parent === render.actorInstances?.group ? 'OpaqueActorInstances'
                    : root.userData.tiledRealmGround ? 'Canonical terrain tiles' : root.name || root.type;
            const pass = camera === render.camera ? 'color' : cameras.get(camera)?.pass || 'auxiliary';
            const key = `${pass}:${object.uuid}:${material.uuid}:${group?.start ?? 0}`;
            let row = rows.get(key);
            if (!row) {
                row = { family, pass, mesh: object.name, geometry: geometry.uuid, material: material.uuid,
                    sourceMaterial: Array.isArray(object.material) ? null : object.material?.uuid,
                    type: object.type, submittedCalls: 0, callbacks: 0,
                    instances: object.isInstancedMesh ? object.count : null,
                    origin: object.isInstancedMesh ? [object.matrixWorld.elements[12], object.matrixWorld.elements[13], object.matrixWorld.elements[14]] : null,
                    sourceKinds: object.parent === render.actorInstances?.group ? [...render.actorInstances.roots.keys()]
                        .filter(root => render.actorInstances.roster.some(entry => entry.root === root && entry.geometry === geometry && entry.material === object.material))
                        .map(root => root.userData.proceduralActorType || 'ProceduralHumanoid') : null };
                rows.set(key, row);
            }
            row.submittedCalls += renderer.info.render.calls - before;
            row.callbacks++;
            return result;
        }
        function observedDraw(...args) {
            rows = new Map(); cameras = new Map();
            render.scene.traverse(light => {
                if (!light.isLight || !light.shadow?.camera) return;
                if (!lights.has(light)) lights.set(light, { pass: `shadow-${lights.size}`, type: light.type,
                    visible: light.visible, castShadow: light.castShadow, intensity: light.intensity });
                cameras.set(light.shadow.camera, lights.get(light));
            });
            try {
                const result = draw.apply(this, args);
                frames.push({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
                    activeEntities: game.activeEntitiesCache?.length || 0, rows: [...rows.values()] });
                rows = null;
                if (frames.length === 12) finish();
                return result;
            } catch (error) { finish(error); throw error; }
        }
        const timer = setTimeout(() => finish(Error(`Submission diagnostic timed out after ${frames.length} frames`)), 10_000);
        renderer.renderBufferDirect = observedDirect;
        render.render = observedDraw;
    }));
    await writeFile(testInfo.outputPath(filename), JSON.stringify(evidence, null, 2));
    expect(evidence.restored).toBe(true); expect(evidence.frames).toHaveLength(12);
    for (const frame of evidence.frames) {
        expect(frame.rows.reduce((total, row) => total + row.submittedCalls, 0)).toBe(frame.calls);
        expect(frame.calls).toBeGreaterThan(0);
    }
}
