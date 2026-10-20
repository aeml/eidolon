import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test('realm walls use timber fences and continuous ground in High and Low', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_NATIVE_COVERAGE_PENDING === 'true', 'Required native predeploy realm fence coverage');
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width: 1280, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const setup = await page.evaluate(async () => {
        const THREE = await import('three');
        const { GameEngine } = await import('/src/core/GameEngine.js');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { WORLD_REGIONS, REALM_FENCE_NAMES, getRegionFencePosts } = await import('/src/data/worldGeography.js');
        document.getElementById('start-screen').style.display = 'none';
        const game = new GameEngine('Fighter', false, true, '', 'realm-fence-review');
        const render = game.renderSystem;
        await render.preloadEnvironment();
        game.worldGenerator.createRealmPerimeters();
        game.player = new Fighter('fence-review-player'); game.player.gameEngine = game;
        await game.player.ensureMesh(); game.addEntity(game.player);
        // Exercise the production network creation path after the environment
        // is ready, rather than hiding legacy meshes in the test fixture.
        for (const id of Object.keys(REALM_FENCE_NAMES)) {
            const [x, z, rotation] = getRegionFencePosts(WORLD_REGIONS[id])[10];
            game.entityCreationQueue.push({ id: `fence-review-${id}`, type: 'Fence', x, z, rotation });
        }
        game.update(0, false);
        const actors = [...game.remotePlayers.values()].map(actor => ({ id: actor.id, owned: actor.environmentOwned, mesh: Boolean(actor.mesh) }));
        const roots = Object.fromEntries(Object.entries(REALM_FENCE_NAMES).map(([id, name]) => [id, render.instanceEnvironmentGroup.getObjectByName(name).uuid]));
        const context = render.renderer.getContext(), extension = context.getExtension('WEBGL_debug_renderer_info');
        const renderer = extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
        window.__realmFenceReview = { THREE, game, roots, REALM_FENCE_NAMES };
        return { actors, roots, renderer };
    });
    expect(setup.actors).toHaveLength(4);
    expect(setup.actors.every(actor => actor.owned && !actor.mesh)).toBe(true);
    if (process.env.EIDOLON_E2E_REQUIRE_NATIVE_GPU === '1') expect(setup.renderer).not.toMatch(/swiftshader|llvmpipe|software/i);
    const samples = [];
    for (const quality of ['high', 'low']) for (const [id, x, z, axis, inside] of [
        ['earth', 80, 1000, 'z', -1], ['water', 80, -2200, 'z', 1],
        ['fire', -3000, 200, 'x', 1], ['air', 3000, 200, 'x', -1]
    ]) {
        const sample = await page.evaluate(({ quality, id, x, z, axis, inside }) => {
            const { THREE, game, roots, REALM_FENCE_NAMES } = window.__realmFenceReview;
            const render = game.renderSystem, renderer = render.renderer;
            render.setGraphicsQuality(quality); render.applyLightingPreset(id, true);
            const focus = new THREE.Vector3(x + (axis === 'x' ? inside * 4 : 0), 0, z + (axis === 'z' ? inside * 4 : 0));
            game.player.position.copy(focus); game.player.mesh.position.copy(focus);
            render.setZoom(5); render.setCameraTarget(focus); render.updateShadowFocus(focus);
            const root = render.instanceEnvironmentGroup.getObjectByName(REALM_FENCE_NAMES[id]);
            const counts = { timber: 0, iron: 0 };
            const parts = new Map(root.children.map(mesh => [mesh, mesh.material.name.split(':').at(-1)]));
            const before = renderer.renderBufferDirect;
            const observe = function (...args) {
                const name = parts.get(args[4]); if (name in counts) counts[name]++;
                return before.apply(this, args);
            };
            renderer.renderBufferDirect = observe;
            try { render.render(); }
            finally { if (renderer.renderBufferDirect === observe) renderer.renderBufferDirect = before; }
            render.scene.updateMatrixWorld(true);
            const ray = new THREE.Raycaster(), floor = render[{ earth: 'groundEarth', water: 'groundSnow', fire: 'groundFire', air: 'groundAir' }[id]];
            const ground = [-.35, .05, .35, .7].map(distance => {
                ray.set(new THREE.Vector3(x + (axis === 'x' ? inside * distance : 0), 20, z + (axis === 'z' ? inside * distance : 0)), new THREE.Vector3(0, -1, 0));
                return { distance, covered: ray.intersectObject(floor).length > 0 };
            });
            return { id, quality, counts, ground, sameOwner: roots[id] === root.uuid, restored: renderer.renderBufferDirect === before };
        }, { quality, id, x, z, axis, inside });
        samples.push(sample);
        await page.screenshot({ path: testInfo.outputPath(`${id}-fence-ground-${quality}.png`) });
    }
    await testInfo.attach('realm-fence-ground', { body: JSON.stringify({ setup, samples }), contentType: 'application/json' });
    for (const sample of samples) {
        expect(sample.ground.every(point => point.covered), JSON.stringify(sample)).toBe(true);
        expect(sample.counts.timber, JSON.stringify(sample)).toBeGreaterThan(0);
        expect(sample.counts.iron, JSON.stringify(sample)).toBeGreaterThan(0);
        expect(sample.sameOwner && sample.restored).toBe(true);
    }
    await page.evaluate(() => window.__realmFenceReview.game.destroy());
    expect(failures, failures.join('\n')).toEqual([]);
});
