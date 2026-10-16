import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

for (const quality of ['high', 'low']) test(`${quality} roads stay behind player names, mob names and Well Rested`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async quality => {
        const THREE = await import('three');
        const { RenderSystem } = await import('/src/core/RenderSystem.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { Skeleton } = await import('/src/entities/Skeleton.js');
        const { createWorldPathNetwork } = await import('/src/art/ProceduralWorldPaths.js');
        const { EARTH_PATHS } = await import('/src/data/worldPopulation.js');
        const { WATER_PATHS, FIRE_PATHS, AIR_PATHS } = await import('/src/data/elementalPopulation.js');
        document.getElementById('start-screen').style.display = 'none';
        const system = new RenderSystem(quality === 'low'); system.setGraphicsQuality(quality);
        const renderer = system.renderer; renderer.shadowMap.enabled = false;
        system.scene.background = null; renderer.setClearColor(0x253128, 1);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x394137 }));
        ground.rotation.x = -Math.PI / 2; ground.position.y = -.01; system.staticEnvironmentGroup.add(ground);
        const actors = [new Fighter('road-player'), new Skeleton('road-mob')];
        for (const [index, actor] of actors.entries()) {
            actor.gameEngine = { renderSystem: system };
            await actor.ensureMesh(); actor.setName(index ? 'Skeleton' : 'Traveler');
            // Isolate the production name sprite: body transparency would make
            // a two-pass reference differ at unrelated antialiased body edges.
            actor.mesh.traverse(part => { if (part.isMesh) part.visible = false; });
            actor.position.set(index ? 1.25 : -1.25, 0, 0); actor.mesh.position.copy(actor.position);
            system.entityGroup.add(actor.mesh);
        }
        actors[0].wellRestedSeconds = 30; actors[0].syncAttachedStatusEffects(1.8);
        const aura = actors[0].attachedStatusEffects.get('well_rested');
        const target = new THREE.WebGLRenderTarget(384, 384);
        const camera = new THREE.PerspectiveCamera(45, 1, .1, 2000), samples = [];
        const read = () => {
            const pixels = new Uint8Array(384 * 384 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 384, 384, pixels); return pixels;
        };
        const changed = (a, b) => {
            let count = 0;
            for (let i = 0; i < a.length; i += 4) if ([0, 1, 2].some(c => a[i + c] !== b[i + c])) count++;
            return count;
        };
        const networks = [];
        try {
            renderer.setRenderTarget(target);
            for (const [realm, paths] of Object.entries({ Earth: EARTH_PATHS, Water: WATER_PATHS, Fire: FIRE_PATHS, Air: AIR_PATHS })) {
                // Actual authored ribbon/material, translated only to share the
                // same prepared actors. No opacity, depth or geometry overrides.
                const path = paths[0], [a, b] = path.points;
                const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
                const network = createWorldPathNetwork([path], { name: realm, quality }); networks.push(network);
                network.position.set(-a[0] - dx / length * 20, 0, -a[1] - dz / length * 20);
                system.staticEnvironmentGroup.add(network);
                const road = network.children[0], productionOrder = road.renderOrder;
                for (const direction of [1, -1]) {
                    camera.position.set(direction * dx / length * 10 + dz / length * 3, 8,
                        direction * dz / length * 10 - dx / length * 3);
                    camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
                    for (const mode of ['player-name', 'mob-name', 'well-rested']) {
                        actors.forEach((actor, index) => { actor.mesh.visible = mode === (index ? 'mob-name' : 'player-name'); });
                        aura.group.visible = mode === 'well-rested';
                        renderer.autoClear = true; road.renderOrder = productionOrder;
                        renderer.render(system.scene, camera); const actual = read();
                        // Independent foreground reference: draw the ground and
                        // road first, retain depth, then draw the actual overlay.
                        const visible = actors.map(actor => actor.mesh.visible), auraVisible = aura.group.visible;
                        actors.forEach(actor => { actor.mesh.visible = false; }); aura.group.visible = false;
                        renderer.render(system.scene, camera); const background = read();
                        actors.forEach((actor, index) => { actor.mesh.visible = visible[index]; }); aura.group.visible = auraVisible;
                        ground.visible = false; network.visible = false; renderer.autoClear = false;
                        renderer.render(system.scene, camera); const reference = read();
                        ground.visible = true; network.visible = true; renderer.autoClear = true;
                        road.renderOrder = 0; renderer.render(system.scene, camera); const legacy = read();
                        road.renderOrder = productionOrder;
                        network.visible = false; renderer.render(system.scene, camera); const noRoad = read(); network.visible = true;
                        samples.push({ realm, direction, mode, changedPixels: changed(actual, reference),
                            legacyChangedPixels: changed(legacy, reference), roadSignal: changed(actual, noRoad),
                            overlaySignal: changed(actual, background),
                            depthTest: road.material.depthTest, depthWrite: road.material.depthWrite });
                    }
                }
                network.visible = false;
            }
        } finally {
            renderer.autoClear = true; renderer.setRenderTarget(null);
            actors.forEach(actor => actor.dispose()); target.dispose();
            const materials = new Set(), textures = new Set();
            for (const group of [...networks, ground]) group.traverse(part => {
                if (!part.isMesh) return; part.geometry.dispose(); materials.add(part.material);
                for (const value of Object.values(part.material)) if (value?.isTexture) textures.add(value);
            });
            textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); system.dispose();
        }
        return { samples, canvasRetired: !renderer.domElement.isConnected };
    }, quality);
    await writeFile(testInfo.outputPath('road-overlay-order.json'), JSON.stringify(result, null, 2));
    for (const row of result.samples) {
        expect(row.changedPixels, `${row.realm}/${row.direction}/${row.mode}`).toBe(0);
        expect(row.roadSignal).toBeGreaterThan(100);
        expect(row.overlaySignal).toBeGreaterThan(20);
        expect(row.depthTest).toBe(true); expect(row.depthWrite).toBe(false);
    }
    for (const mode of ['player-name', 'mob-name', 'well-rested'])
        expect(result.samples.filter(row => row.mode === mode).some(row => row.legacyChangedPixels > 20), mode).toBe(true);
    expect(result.samples).toHaveLength(24); expect(result.canvasRetired).toBe(true);
    expect(failures, failures.join('\n')).toEqual([]);
});
