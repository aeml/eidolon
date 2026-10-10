import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bundleGameEngine } from '../../scripts/bundle-game-engine.mjs';
import { versionPagesRuntime } from '../../scripts/version-pages-runtime.mjs';
import { collectBrowserFailures } from './helpers.js';

const baselineScript = process.env.EIDOLON_E2E_BASELINE_BUNDLER;
const execute = promisify(execFile), release = 'addonparity20261010';
test('copied vendor add-ons preserve published equipped renders while removing separate add-on downloads', async ({ context }, testInfo) => {
    test.skip(!baselineScript, 'Explicit prior publishing script required for the paired control');
    test.setTimeout(180_000);
    const roots = [], servers = [], results = [];
    try {
        for (const baseline of [true, false]) {
            const root = await mkdtemp(path.join(tmpdir(), 'eidolon-addon-parity-')); roots.push(root);
            for (const filename of ['src', 'assets', 'vendor', 'index.html', 'release.json', 'sw.js'])
                await cp(path.resolve(filename), path.join(root, filename), { recursive: true });
            const metadata = baseline
                ? JSON.parse((await execute(process.execPath, [baselineScript, root])).stdout)
                : await bundleGameEngine(root);
            await versionPagesRuntime(root, release);
            const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
                '.ttf': 'font/ttf', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
            const server = createServer(async (request, response) => {
                const pathname = new URL(request.url, 'http://localhost').pathname;
                const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
                if (!filename.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
                try {
                    if (!(await stat(filename)).isFile()) throw new Error('Not a file');
                    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
                    response.end(await readFile(filename));
                } catch { response.writeHead(404).end(); }
            });
            servers.push(server); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            const origin = `http://127.0.0.1:${server.address().port}`, page = await context.newPage();
            await page.setViewportSize({ width: 960, height: 720 });
            const failures = collectBrowserFailures(page, origin), responses = [], scripts = [];
            page.on('response', response => {
                if (response.request().resourceType() !== 'script') return;
                responses.push(response.body().then(body => scripts.push({ path: new URL(response.url()).pathname,
                    bytes: body.byteLength })).catch(() => {}));
            });
            await page.goto(origin, { waitUntil: 'networkidle' });
            const loginScripts = scripts.length;
            const captures = await page.evaluate(async release => {
                const THREE = await import('three');
                const { GameEngine } = await import(`/src/core/GameEngine.bundle.js?release=${release}`);
                document.getElementById('start-screen').style.display = 'none';
                const game = new GameEngine('Fighter', false, true, '', '', null, 'flat-v1');
                const render = game.renderSystem, rows = [];
                const outfits = {
                    Fighter: { head: 'Iron Helm', chest: 'Plate Mail', legs: 'Plate Greaves', feet: 'Iron Boots', gloves: 'Iron Gauntlets', shoulders: 'Steel Pauldrons', belt: 'Plated Girdle', mainHand: 'Iron Sword', offHand: 'Wooden Shield' },
                    Rogue: { head: 'Leather Cap', chest: 'Leather Tunic', legs: 'Leather Pants', feet: 'Leather Boots', gloves: 'Leather Gloves', shoulders: 'Reinforced Spaulders', belt: 'Studded Belt', mainHand: 'Steel Dagger', offHand: 'Iron Sword' },
                    Wizard: { head: 'Silk Hood', chest: 'Robes', legs: 'Silk Skirt', feet: 'Sandals', gloves: 'Silk Gloves', shoulders: 'Velvet Mantle', belt: 'Silk Sash', mainHand: 'Wooden Staff', offHand: 'Spell Tome' },
                    Cleric: { head: 'Iron Helm', chest: 'Robes', legs: 'Leather Pants', feet: 'Iron Boots', gloves: 'Silk Gloves', shoulders: 'Steel Pauldrons', belt: 'Studded Belt', mainHand: 'Cleric Mace', offHand: 'Wooden Shield' }
                };
                const floor = new THREE.Mesh(new THREE.BoxGeometry(30, .2, 30), new THREE.MeshStandardMaterial({ color: '#30343b', roughness: .85 }));
                floor.position.y = -.1; floor.receiveShadow = true; render.scene.add(floor);
                try {
                    for (const quality of ['high', 'low']) for (const type of ['Fighter', 'Rogue', 'Wizard', 'Cleric']) {
                        render.setGraphicsQuality(quality);
                        const actor = game.createRemotePlayer('Player', `addon-${type}-${quality}`, type); actor.gameEngine = game;
                        await actor.ensureMesh(); const root = actor.mesh;
                        if (root.userData.authoredClass !== type || root.userData.authoredQuality !== quality) throw Error('Authored class/quality missing');
                        const gear = Object.fromEntries(Object.entries({ ...outfits[type], ring1: 'Ruby Ring', ring2: 'Silver Ring', neck: 'Necklace', trinket1: 'Amulet of Power', trinket2: 'Orb of Mana' })
                            .map(([slot, name]) => [slot, { id: `${type}-${quality}-${slot}`, name, baseName: name,
                                type: ['Iron Sword', 'Steel Dagger', 'Wooden Staff', 'Cleric Mace'].includes(name) ? 'WEAPON' : 'ARMOR',
                                slot: slot === 'offHand' && ['Iron Sword', 'Steel Dagger', 'Cleric Mace'].includes(name) ? 'mainHand' : slot,
                                rarity: quality === 'high' ? 'Legendary' : 'Rare', potency: 5 }]));
                        actor.syncEquipmentVisuals(gear); await root.userData.equipmentReady;
                        if (root.userData.equipmentVisualMissing?.length || root.userData.equipmentVisualFallback?.length) throw Error('Fitted equipment missing/fallback');
                        render.add(root); render.setCameraTarget(new THREE.Vector3(0, 1, 0));
                        const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
                        Object.defineProperty(performance, 'now', { configurable: true, value: () => 1000 });
                        try {
                            for (const pose of ['CombatIdle', 'Run', 'Attack', 'Blink']) for (const zoom of [5, 15]) {
                                actor.playAnimation(pose === 'Blink' ? 'CombatIdle' : pose, true, true); actor.updateAnimationMixer(.3);
                                root.traverse(mesh => {
                                    for (const [name, influence] of [['Blink_L', pose === 'Blink' ? .75 : 0], ['Blink_R', pose === 'Blink' ? .25 : 0]]) {
                                        const index = mesh.morphTargetDictionary?.[name];
                                        if (index !== undefined) mesh.morphTargetInfluences[index] = influence;
                                    }
                                });
                                render.setZoom(zoom); render.render(); render.render();
                                const gl = render.renderer.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                                gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                                const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].map(byte => byte.toString(16).padStart(2, '0')).join('');
                                rows.push({ type, quality, pose, zoom, hash, calls: render.renderer.info.render.calls,
                                    triangles: render.renderer.info.render.triangles, items: root.userData.equipmentVisualItemCount,
                                    bones: root.getObjectByName(`${type}_Body`).skeleton.bones.length, shadows: render.renderer.shadowMap.enabled });
                            }
                        } finally {
                            if (descriptor) Object.defineProperty(performance, 'now', descriptor); else delete performance.now;
                            root.removeFromParent(); actor.dispose();
                        }
                    }
                    return rows;
                } finally { floor.removeFromParent(); floor.geometry.dispose(); floor.material.dispose(); game.destroy(); }
            }, release);
            await Promise.all(responses);
            expect(failures, failures.join('\n')).toEqual([]);
            expect(captures).toHaveLength(64);
            for (const row of captures) { expect(row.items).toBe(14); expect(row.bones).toBe(53); }
            results.push({ baseline, metadata, loginScripts, scripts, captures }); await page.close();
        }
        await testInfo.attach('published-addon-parity', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
        const [baseline, candidate] = results;
        expect(candidate.captures).toEqual(baseline.captures);
        expect(baseline.scripts.filter(script => script.path.startsWith('/vendor/three/examples/')).length).toBeGreaterThan(0);
        expect(candidate.scripts.filter(script => script.path.startsWith('/vendor/three/examples/'))).toHaveLength(0);
        expect(candidate.metadata.externalImports).toContain('three');
        expect(candidate.metadata.externalImports.some(name => name.startsWith('three/addons/'))).toBe(false);
    } finally {
        for (const server of servers) await new Promise(resolve => server.close(resolve));
        for (const root of roots) await rm(root, { recursive: true, force: true });
    }
});
