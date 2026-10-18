import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, exerciseMovement, exerciseMenus, loginAndEnterWorld } from './helpers.js';
import { requiresHardwareWebGL } from './browserLaunchPolicy.js';

test('Meshy play link delivers independently skinned High/Low Fighters with equipment, skills and pooling', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.goto('/?fighterModel=meshy', { waitUntil: 'networkidle' });
    const result = await page.evaluate(async () => {
        const THREE = await import('three');
        const { Actor } = await import('/src/entities/Actor.js');
        const { MeshFactory } = await import('/src/utils/MeshFactory.js');
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(1280, 900); renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.domElement.id = 'meshy-alpha-review';
        Object.assign(renderer.domElement.style, { position: 'fixed', inset: 0, zIndex: 10000 });
        document.body.append(renderer.domElement);
        const scene = new THREE.Scene(); scene.background = new THREE.Color('#1b202a');
        scene.add(new THREE.HemisphereLight('#d1dfee', '#534537', 2.4));
        const light = new THREE.DirectionalLight('#ffe1ba', 3); light.position.set(4, 8, 6); scene.add(light);
        const camera = new THREE.PerspectiveCamera(35, 1280 / 900, .1, 100); camera.position.set(0, 5, 21); camera.lookAt(0, 2, 0);
        const actors = [];
        for (const [index, quality] of ['high', 'low'].entries()) {
            const actor = new Actor(`meshy-${quality}`, {}); actor.meshType = 'Fighter'; actor.isRemote = true;
            actor.gameEngine = { renderSystem: { graphicsQuality: quality, isMobile: false } };
            actor.position.x = index ? 3 : -3;
            await actor.ensureMesh();
            if (!actor.mesh.userData.meshyPilot || actor.mesh.userData.authoredQuality !== quality) throw new Error('Meshy play link did not select the requested quality');
            actor.render(1); scene.add(actor.mesh); actors.push(actor);
        }
        const gear = { mainHand: { id: 'pilot-sword', name: 'Iron Sword', baseName: 'Iron Sword', slot: 'mainHand', type: 'WEAPON', rarity: 'Common' },
            offHand: { id: 'pilot-shield', name: 'Wooden Shield', baseName: 'Wooden Shield', slot: 'offHand', type: 'ARMOR', rarity: 'Common' },
            chest: { id: 'pilot-armor', name: 'Plate Mail', baseName: 'Plate Mail', slot: 'chest', type: 'ARMOR', rarity: 'Common' } };
        const equipment = actors.map(actor => actor.syncEquipmentVisuals(gear, { force: true }));
        const snapshots = [];
        for (const clip of ['Idle', 'Walk', 'Run', 'Attack', 'HitReaction', 'Death', 'Cast', 'Channel', 'Guard', 'Shout', 'Bless']) {
            for (const actor of actors) {
                actor.state = 'IDLE'; actor.mixer.stopAllAction(); actor.mesh.userData.resetRestPose();
                if (!actor.playAnimation(clip, false, true)) throw new Error('Missing runtime clip ' + clip);
                actor.updateAnimationMixer(.25); actor.render(1);
                actor.mesh.traverse(part => { if (!part.matrixWorld.elements.every(Number.isFinite)) throw new Error('Invalid animated transform'); });
            }
            renderer.render(scene, camera);
            snapshots.push(clip);
        }
        const first = actors[0].mesh.getObjectByName('Fighter_Body'), second = actors[1].mesh.getObjectByName('Fighter_Body');
        const independent = first.skeleton.bones.every(bone => !second.skeleton.bones.includes(bone));
        const position = actors[0].position.clone();
        actors[0].state = 'IDLE'; actors[0].playAnimation('Idle', true, true);
        actors[0].playHitReaction(new THREE.Vector3(-8, 0, 0), 10);
        const hitClip = actors[0].currentAction.getClip().name;
        actors[0].update(.1);
        const hitSurvivesIdleUpdate = actors[0].currentAction.getClip().name === 'HitReaction';
        actors[0].update(.3);
        const hitRecovered = actors[0].currentAction.getClip().name === 'Idle';
        const unchangedPosition = position.equals(actors[0].position);
        const root = actors[0].mesh;
        actors[0].dispose();
        const pooled = await MeshFactory.createMeshForType('Fighter', { quality: 'high' });
        const poolCorrect = pooled === root && pooled.userData.meshPoolKey === 'Fighter:high:meshy';
        MeshFactory.releaseMesh('Fighter', pooled);
        actors[1].playAnimation('Idle', true, true); actors[1].updateAnimationMixer(.1); renderer.render(scene, camera);
        window.meshyAlphaReview = { renderer, actors };
        const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { independent, snapshots, equipment, hitClip, hitSurvivesIdleUpdate, hitRecovered, unchangedPosition, poolCorrect, bones: first.skeleton.bones.length,
            gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'not exposed' };
    });
    expect(result.independent).toBe(true); expect(result.bones).toBe(24);
    expect(result.equipment.every(entry => entry.supported && entry.items === 3 && !entry.missing.length)).toBe(true);
    expect(result.hitClip).toBe('HitReaction'); expect(result.unchangedPosition).toBe(true); expect(result.poolCorrect).toBe(true);
    expect(result.hitSurvivesIdleUpdate).toBe(true); expect(result.hitRecovered).toBe(true);
    if (requiresHardwareWebGL()) {
        expect(result.gpu).toMatch(/AMD|Radeon|NVIDIA|Intel/i);
        expect(result.gpu).not.toMatch(/SwiftShader|llvmpipe|software/i);
    }
    await page.locator('#meshy-alpha-review').screenshot({ path: testInfo.outputPath('equipped-meshy-fighter.png') });
    expect(failures).toEqual([]);
});

test('Meshy Fighter loads in the authoritative world and retains movement and menus', async ({ page, baseURL }) => {
    test.skip(process.env.EIDOLON_E2E_MESHY_PLAYTEST !== '1', 'Dedicated disposable Fighter playtest');
    test.setTimeout(240_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.isNavigationRequest() && url.pathname === '/' && url.searchParams.get('fighterModel') !== 'meshy') {
            url.searchParams.set('fighterModel', 'meshy');
            return route.fulfill({ status: 302, headers: { location: url.href }, body: '' });
        }
        return route.continue();
    });
    await loginAndEnterWorld(page, credentialsFromEnvironment());
    await page.waitForFunction(() => window.game?.player?.mesh?.userData.meshyPilot === true);
    expect(new URL(page.url()).searchParams.get('fighterModel')).toBe('meshy');
    const before = await page.evaluate(() => ({ type: window.game.player.meshType, multiplayer: window.game.isMultiplayer,
        hp: window.game.player.stats.hp, pool: window.game.player.mesh.userData.meshPoolKey }));
    expect(before.type).toBe('Fighter'); expect(before.multiplayer).toBe(true); expect(before.hp).toBeGreaterThan(0);
    expect(before.pool).toMatch(/^Fighter:(?:high|low):meshy$/);
    await exerciseMovement(page);
    await exerciseMenus(page);
    expect(await page.evaluate(() => window.game.player.mesh.userData.meshyPilot)).toBe(true);
    expect(failures).toEqual([]);
});
