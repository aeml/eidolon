import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collectBrowserFailures } from './helpers.js';

const referenceFiles = ['src/core/RenderSystem.js', 'src/world/WorldGenerator.js', 'src/art/ProceduralDarkRealm.js',
    'src/art/ProceduralDungeonInteriors.js', 'src/art/DungeonFloorComposition.js', 'src/art/DungeonProcessionalPaving.js',
    'src/art/DungeonDaisMasonry.js', 'src/art/DungeonEntryWard.js'];
const views = ['dark-camp', 'dark-court-bronze', 'dark-court-stone', 'crypt',
    'verdant_bastion_catacombs', 'molten_core', 'tempest_spire', 'abyssal_well', 'umbral_nexus', 'boss-dais', 'entry-threshold'];

test.use({ serviceWorkers: 'block', trace: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality}: server-grounded instance floors preserve party and hostile markers`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_INSTANCE_GROUND_REVIEW !== '1', 'Explicit bounded native ground-depth component check');
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL), served = new Set();
    const reference = process.env.EIDOLON_INSTANCE_GROUND_REFERENCE_DIR;
    if (reference) for (const file of referenceFiles) {
        const body = readFileSync(`${reference}/${file.split('/').at(-1)}`, 'utf8');
        await page.route(`**/${file}*`, route => {
            served.add(file); return route.fulfill({ body, contentType: 'text/javascript' });
        });
        await testInfo.attach(`reference-${file.split('/').at(-1)}`, { body: JSON.stringify({ file,
            sha256: createHash('sha256').update(body).digest('hex') }), contentType: 'application/json' });
    }
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { WorldGenerator } = await import('/src/world/WorldGenerator.js');
        const { Entity } = await import('/src/entities/Entity.js');
        const { createDarkRealmScene } = await import('/src/art/ProceduralDarkRealm.js');
        const { createProceduralDungeonInteriorKit } = await import('/src/art/ProceduralDungeonInteriors.js');
        const { darkRealmFixture } = await import('/tests/darkRealmFixture.js');
        const { DARK_REALM_COURTS } = await import('/src/data/darkRealmPopulation.js');
        document.getElementById('start-screen').style.display = 'none';
        const render = new RenderSystem(quality === 'low'); render.setGraphicsQuality(quality);
        await render.preloadEnvironment();
        const actor = new Entity('instance-marker-depth'); actor.mesh = new THREE.Group();
        actor.mesh.userData.bounds = { radius: 1.25 }; actor.setPartyHighlight(true); actor.setPvPHostile(true);
        render.entityGroup.add(actor.mesh);
        const markers = ['PartyRing', 'PvPHostileRing'].map(name => actor.mesh.getObjectByName(name));
        let stage, stageKey, generator;
        const retire = () => {
            if (stage) { render.disposeObjectResources(stage); stage.removeFromParent(); }
            generator?.floorTexture?.dispose(); generator?.wallTexture?.dispose(); stage = generator = null;
        };
        const pixels = () => {
            render.render();
            const gl = render.renderer.getContext(), result = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, result);
            return { result, calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles };
        };
        window.__instanceMarkerReview = {
            async view(view, markerName) {
                const key = view.startsWith('dark-') ? 'dark' : view;
                if (stageKey !== key) {
                    retire(); stageKey = key; stage = new THREE.Group(); render.instanceEnvironmentGroup.add(stage);
                    if (key === 'dark') createDarkRealmScene(stage, darkRealmFixture(), null, { quality });
                    else {
                        generator = new WorldGenerator(stage, { addCollider() {} }, { graphicsQuality: quality });
                        if (key === 'crypt') {
                            // Prepared component scene: fixed corner pillars avoid random obstruction
                            // of the floor probe. Actual crypt gameplay owns ordinary layout evidence.
                            const random = Math.random, corners = [.1, .1, .9, .9, .1, .9, .9, .1]; let index = 0;
                            try { Math.random = () => corners[index++ % corners.length]; await generator.createDungeon(0, 0, 100); }
                            finally { Math.random = random; }
                        } else {
                            const type = ['boss-dais', 'entry-threshold'].includes(key) ? 'umbral_nexus' : key;
                            generator.dungeonInteriorKit = createProceduralDungeonInteriorKit(type, { quality });
                            const room = { x: 20000, z: 20000, width: 120, height: 120, type: key === 'boss-dais' ? 'boss' : 'start' };
                            generator.createCanonicalLayoutDungeon({ rooms: [room], walkRects: [{ ...room }] });
                        }
                    }
                }
                const court = DARK_REALM_COURTS[0];
                const target = new THREE.Vector3(...({ 'dark-camp': [40000, 0, 40830],
                    'dark-court-bronze': [court.x + 5, 0, court.z + 6], 'dark-court-stone': [court.x + 9, 0, court.z + 11],
                    crypt: [0, 0, 0], 'boss-dais': [20000, 0, 20000], 'entry-threshold': [20000, 0, 19989.92]
                }[view] || [19990, 0, 19990]));
                const context = key === 'dark' ? 'dark_realm' : ['boss-dais', 'entry-threshold'].includes(key) ? 'umbral_nexus' : key;
                actor.mesh.position.copy(target); render.setEnvironmentContext(context, target, true);
                render.setZoom(10); render.setCameraTarget(target); render.updateEnvironmentLighting(target, 0);
                markers.forEach(marker => { marker.visible = false; }); pixels(); pixels(); const off = pixels();
                const marker = actor.mesh.getObjectByName(markerName); marker.visible = true; const on = pixels();
                let changedPixels = 0;
                for (let i = 0; i < on.result.length; i += 4)
                    if (on.result[i] !== off.result[i] || on.result[i + 1] !== off.result[i + 1] || on.result[i + 2] !== off.result[i + 2]) changedPixels++;
                const floors = []; stage.traverse(part => {
                    if (part.geometry?.type === 'PlaneGeometry' && !part.material.transparent)
                        floors.push(part.getWorldPosition(new THREE.Vector3()).y);
                });
                const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
                return { view, marker: markerName, target: target.toArray(), floorHeights: floors,
                    depthTest: marker.material.depthTest, markerY: marker.getWorldPosition(new THREE.Vector3()).y,
                    changedPixels, callsAdded: on.calls - off.calls, trianglesAdded: on.triangles - off.triangles,
                    overworldVisible: render.staticEnvironmentGroup.visible,
                    cameraOffset: render.camera.position.clone().sub(render.cameraTarget).toArray(), zoom: render.currentZoom,
                    renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
            },
            dispose() {
                retire(); actor.setPartyHighlight(false); actor.setPvPHostile(false); actor.mesh.removeFromParent();
                const canvas = render.renderer.domElement; render.dispose(); return { canvasRetired: !canvas.isConnected };
            }
        };
    }, quality);
    const rows = []; let cleanup;
    try {
        for (const view of views) for (const marker of ['PartyRing', 'PvPHostileRing']) {
            const row = await page.evaluate(({ view, marker }) => window.__instanceMarkerReview.view(view, marker), { view, marker });
            rows.push(row); await page.screenshot({ path: testInfo.outputPath(`${quality}-${view}-${marker}.png`) });
            expect(row.depthTest).toBe(true); expect(row.callsAdded).toBe(1); expect(row.trianglesAdded).toBe(64);
            expect(row.cameraOffset.map(v => Math.round(v))).toEqual([100, 100, 100]); expect(row.zoom).toBe(10);
            expect(row.floorHeights.length).toBeGreaterThan(0);
            expect(row.floorHeights.every(y => Math.abs(y - (reference ? .1 : 0)) < 1e-8)).toBe(true);
            if (view === 'crypt') expect(row.overworldVisible).toBe(Boolean(reference));
            if (reference) expect(row.changedPixels).toBe(0); else expect(row.changedPixels).toBeGreaterThan(100);
            if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(row.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        }
        if (reference) expect([...served].sort()).toEqual([...referenceFiles].sort());
    } finally {
        cleanup = await page.evaluate(() => window.__instanceMarkerReview.dispose());
        await writeFile(testInfo.outputPath('instance-ground-markers.json'), JSON.stringify({ quality, reference: Boolean(reference), rows, cleanup,
            scope: 'Native component depth proof: ordinary Entity party/hostile marker off/on framebuffer reads at standard100/100/100 camera and zoom10. Three Dark Realm positions, five dungeon themes, boss dais, entry threshold and a crypt with fixed prepared corner pillars. Same scenes/markers/camera with immutable prior8-module reference; no actors/earned progression/network capacity/physical phone/frame-time/whole-game acceptance.' }, null, 2));
    }
    expect(cleanup.canvasRetired).toBe(true); expect(failures, failures.join('\n')).toEqual([]);
});
