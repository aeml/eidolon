import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { collectBrowserFailures } from './helpers.js';

test.use({ serviceWorkers: 'block', trace: 'off', video: 'off' });
for (const quality of ['high', 'low']) test(`${quality} arena stone stays readable with equipped classes and combat markers`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_ARENA_ART_REVIEW !== '1', 'Explicit controlled arena art review; connected practice owns gameplay evidence');
    test.setTimeout(120_000);
    const failures = collectBrowserFailures(page, baseURL);
    let referenceServed = false;
    const referenceFile = process.env.EIDOLON_ARENA_ART_REFERENCE_FILE;
    if (referenceFile) {
        const source = readFileSync(referenceFile, 'utf8');
        await page.route('**/src/art/ProceduralPvPArena.js*', route => {
            referenceServed = true;
            return route.fulfill({ body: source, contentType: 'text/javascript' });
        });
        await testInfo.attach('arena-art-reference', { body: JSON.stringify({ file: referenceFile,
            sha256: createHash('sha256').update(source).digest('hex') }), contentType: 'application/json' });
    }
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: quality === 'high' ? 1280 : 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const setup = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { UIManager } = await import('/src/ui/UIManager.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const { BASE_ITEMS } = await import('/src/core/ItemSystem.js');
        const { createProceduralPvPArena } = await import('/src/art/ProceduralPvPArena.js');
        const mobile = quality === 'low';
        document.getElementById('start-screen').style.display = 'none';
        document.body.classList.toggle('mobile-mode', mobile);
        const render = new RenderSystem(mobile), ui = new UIManager(mobile), actors = [];
        render.setGraphicsQuality(quality);
        await render.preloadEnvironment();
        // Matches the canonical server court footprint; actual network layout,
        // input, reward and floor admission remain separate practice evidence.
        const court = createProceduralPvPArena({ walkRects: [{ width: 50.5, height: 34.5 }] });
        render.instanceEnvironmentGroup.add(court);
        render.setEnvironmentContext('pvp_arena', new THREE.Vector3(), true);
        const outfits = {
            Fighter: ['Iron Helm', 'Plate Mail', 'Plate Greaves', 'Iron Boots', 'Iron Gauntlets', 'Steel Pauldrons', 'Plated Girdle', 'Iron Sword', 'Wooden Shield'],
            Rogue: ['Leather Cap', 'Leather Tunic', 'Leather Pants', 'Leather Boots', 'Leather Gloves', 'Reinforced Spaulders', 'Studded Belt', 'Steel Dagger', 'Iron Sword'],
            Wizard: ['Silk Hood', 'Robes', 'Silk Skirt', 'Sandals', 'Silk Gloves', 'Velvet Mantle', 'Silk Sash', 'Wooden Staff', 'Spell Tome'],
            Cleric: ['Iron Helm', 'Robes', 'Leather Pants', 'Iron Boots', 'Silk Gloves', 'Steel Pauldrons', 'Studded Belt', 'Cleric Mace', 'Wooden Shield']
        };
        const slots = ['head', 'chest', 'legs', 'feet', 'gloves', 'shoulders', 'belt', 'mainHand', 'offHand', 'ring1', 'ring2', 'neck', 'trinket1', 'trinket2'];
        for (const [type, names] of Object.entries(outfits)) {
            const Actor = (await import(`/src/entities/${type}.js`))[type], actor = new Actor(`arena-${type}`);
            const root = await MeshFactory.createMeshForType(type, { quality });
            if (root.userData.authoredClass !== type || root.userData.assetFallback) throw Error(`Arena needs supplied ${type}/${quality}`);
            actor.setMesh(root); actor.meshType = type; actor.setName(type);
            const gear = Object.fromEntries([...names, 'Ruby Ring', 'Silver Ring', 'Necklace', 'Amulet of Power', 'Orb of Mana'].map((name, index) => {
                const base = BASE_ITEMS.find(item => item.name === name);
                if (!base) throw Error(`Missing arena review gear ${name}`);
                return [slots[index], { ...base, id: `arena-${type}-${slots[index]}`, baseName: name, name,
                    rarity: 'Rare', level: 30, potency: 3, sockets: 0, gems: [], stats: {} }];
            }));
            actor.syncEquipmentVisuals(gear); await root.userData.equipmentReady;
            actor.setPartyHighlight(type === 'Fighter' || type === 'Cleric');
            actor.setPvPHostile(type === 'Rogue' || type === 'Wizard');
            render.entityGroup.add(root); actors.push(actor);
        }
        ui.showHUD(); ui.toggleChat(true); ui.updatePlayerStats(actors[0]);
        const resources = { geometry: new Set(), material: new Set(), texture: new Set() }, disposed = { geometry: 0, material: 0, texture: 0 };
        court.traverse(part => {
            if (part.geometry) resources.geometry.add(part.geometry);
            if (part.material) {
                resources.material.add(part.material);
                if (part.material.map) resources.texture.add(part.material.map);
            }
        });
        for (const [kind, set] of Object.entries(resources)) for (const resource of set)
            resource.addEventListener('dispose', () => disposed[kind]++);
        const frame = (state, focus = [0, 0], time = .3) => {
            for (const [index, actor] of actors.entries()) {
                actor.mixer.stopAllAction(); actor.mesh.userData.resetRestPose(); actor.currentAction = null;
                actor.playAnimation(state, state === 'Run' || state === 'CombatIdle', true);
                actor.updateAnimationMixer(time);
                // Prepared scene positions only; no network/simulation claim.
                actor.position.set(focus[0] + (index % 2 ? 3 : -3), 0, focus[1] + (index < 2 ? -3 : 3));
                actor.mesh.position.copy(actor.position); actor.mesh.updateMatrixWorld(true);
            }
            const target = new THREE.Vector3(focus[0], 0, focus[1]);
            render.setZoom(18); render.setCameraTarget(target);
            render.updateEnvironmentLighting(target, 0); render.render();
            const gl = render.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
            return { state, focus, zoom: render.currentZoom, calls: render.renderer.info.render.calls,
                triangles: render.renderer.info.render.triangles, floorY: court.getObjectByName('PvPArenaFloor').position.y,
                cameraOffset: render.camera.position.clone().sub(render.cameraTarget).toArray(),
                renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
                actors: actors.map(actor => ({ type: actor.mesh.userData.authoredClass, quality: actor.mesh.userData.authoredQuality,
                    items: actor.mesh.userData.equipmentVisualItemCount, missing: actor.mesh.userData.equipmentVisualMissing?.length || 0,
                    fallback: actor.mesh.userData.equipmentVisualFallback?.length || 0, nameVisible: actor.nameTag?.visible === true,
                    finite: actor.mesh.matrixWorld.elements.every(Number.isFinite), y: actor.mesh.position.y })) };
        };
        window.__arenaArtReview = { render, ui, actors, court, frame,
            async walk() {
                frame('Run');
                const rows = []; let previous;
                for (let index = 0; index < 90; index++) {
                    const time = await new Promise(resolve => requestAnimationFrame(resolve));
                    const dt = previous === undefined ? 1 / 60 : Math.min(.1, (time - previous) / 1000);
                    previous = time;
                    for (const [i, actor] of actors.entries()) {
                        actor.updateAnimationMixer(dt);
                        actor.position.x = (i % 2 ? 3 : -3) + Math.sin(index / 45) * .8;
                        actor.mesh.position.copy(actor.position);
                    }
                    render.updateEnvironmentLighting(new THREE.Vector3(), dt); render.render();
                    rows.push({ index, time, visibility: document.visibilityState,
                        calls: render.renderer.info.render.calls, triangles: render.renderer.info.render.triangles,
                        positions: actors.map(actor => actor.mesh.position.toArray()),
                        clipTimes: actors.map(actor => actor.currentAction?.time) });
                }
                return rows;
            },
            dispose() {
                actors.forEach(actor => { actor.setPartyHighlight(false); actor.setPvPHostile(false); actor.dispose(); });
                court.removeFromParent();
                for (const set of Object.values(resources)) for (const resource of set) resource.dispose();
                ui.dispose(); const canvas = render.renderer.domElement; render.dispose();
                return { expected: Object.fromEntries(Object.entries(resources).map(([kind, set]) => [kind, set.size])),
                    disposed, canvasRetired: !canvas.isConnected };
            } };
        return { actors: actors.length, courtMeshes: court.children.length };
    }, quality);
    if (referenceFile) expect(referenceServed).toBe(true);
    expect(setup).toEqual({ actors: 4, courtMeshes: 17 });
    const rows = [];
    let cleanup, motion;
    const captures = [], writes = [];
    try {
        for (const [label, state, focus] of [
            ['idle', 'CombatIdle', [0, 0]], ['run', 'Run', [0, 0]], ['attack', 'Attack', [0, 0]],
            ['cast', 'Cast', [0, 0]], ['boundary', 'CombatIdle', [20, 12]]
        ]) {
            const row = await page.evaluate(({ state, focus }) => window.__arenaArtReview.frame(state, focus), { state, focus });
            rows.push({ label, ...row });
            await page.screenshot({ path: testInfo.outputPath(`arena-${quality}-${label}.png`) });
            expect(row.zoom).toBe(18); expect(row.cameraOffset.map(v => Math.round(v))).toEqual([100, 100, 100]);
            for (const actor of row.actors) {
                expect(actor.quality).toBe(quality);
                expect(actor.items).toBe(14); expect(actor.missing).toBe(0); expect(actor.fallback).toBe(0);
                expect(actor.nameVisible).toBe(true); expect(actor.finite).toBe(true); expect(actor.y).toBe(0);
            }
            if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(row.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
        }
        const session = await page.context().newCDPSession(page);
        let recording = true;
        session.on('Page.screencastFrame', event => {
            if (recording && captures.length < 45) {
                const name = `arena-${quality}-motion-${String(captures.length).padStart(3, '0')}.jpg`;
                captures.push({ name, timestamp: event.metadata.timestamp });
                writes.push(writeFile(testInfo.outputPath(name), Buffer.from(event.data, 'base64')));
            }
            session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
        });
        try {
            await session.send('Page.startScreencast', { format: 'jpeg', quality: 70, maxWidth: 1280, maxHeight: 844, everyNthFrame: 3 });
            motion = await page.evaluate(() => window.__arenaArtReview.walk());
        } finally {
            recording = false;
            try { await session.send('Page.stopScreencast'); }
            finally { await session.detach(); await Promise.all(writes); }
        }
        expect(motion).toHaveLength(90); expect(captures.length).toBeGreaterThan(4);
        expect(motion.every(row => row.visibility === 'visible')).toBe(true);
        expect(motion[89].positions[0][0]).not.toBe(motion[0].positions[0][0]);
    } finally {
        cleanup = await page.evaluate(() => window.__arenaArtReview.dispose());
        await writeFile(testInfo.outputPath('arena-art-review.json'), JSON.stringify({ quality, setup, rows, motion, captures, cleanup,
            scope: 'Controlled canonical-footprint scene, supplied four-class fourteen-slot outfits, standard camera/zoom18, names and team/hostile markers;90normalRAF Run frames with explicit screencast outside timing acceptance. Server arena Y0 and existing visual floorY.1 retained. Prepared poses/positions, not earned/network practice, physical-phone, frame-time or whole-game acceptance.' }, null, 2));
    }
    expect(cleanup.disposed).toEqual(cleanup.expected); expect(cleanup.canvasRetired).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
