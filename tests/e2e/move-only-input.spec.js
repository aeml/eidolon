import { expect, test } from '@playwright/test';

// Native pointer-routing fixture, not a server movement/pacing acceptance test.
test('Shift-click ignores a rendered Chronicle marker while ordinary clicks still select it', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const point = await page.evaluate(async () => {
        const THREE = await import('three');
        const { InputManager } = await import('/src/core/InputManager.js');
        const { installGameEngineMovement } = await import('/src/core/GameEngineMovement.js');
        const { ChronicleSite } = await import('/src/entities/ChronicleSite.js');
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999';
        document.body.appendChild(canvas);
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(innerWidth, innerHeight);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#17242d');
        scene.add(new THREE.HemisphereLight(0xffffff, 0x867049, 3));
        const aspect = innerWidth / innerHeight;
        const camera = new THREE.OrthographicCamera(-10 * aspect, 10 * aspect, 10, -10, .1, 1000);
        camera.position.set(20, 22, 20);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld(true);
        class Harness {}
        installGameEngineMovement(Harness);
        const records = { interactions: [], moves: [], jumps: [] };
        const engine = Object.assign(new Harness(), {
            isMobile: false, player: { position: new THREE.Vector3(-8, 0, 0), quests: [],
                move: point => records.moves.push(point.toArray()) },
            uiManager: { isEscMenuOpen: false, isPatchNotesOpen: false, reportScreen: { style: { display: 'none' } } },
            renderSystem: { camera, environmentGroup: new THREE.Group() },
            abilityController: { pendingAbilityTarget: { id: 'old-target' }, pendingAbilitySkill: 'Fireball' },
            pendingInteraction: { id: 'old-target' },
            isHostileActorTarget: () => false, isInteractableEntity: e => e.type === 'ChronicleSite',
            refreshDungeonEntranceHint() {}, refreshCombatIntentState() {},
            moveToAndInteract: e => records.interactions.push(e.id),
            requestPlayerJump: point => records.jumps.push(point.toArray())
        });
        const site = new ChronicleSite('chronicle-site-new_growth');
        site.gameEngine = engine;
        await site.ensureMesh();
        scene.add(site.mesh);
        engine.activeEntitiesCache = [site];
        engine.inputManager = new InputManager(camera, scene, canvas);
        engine.inputManager.subscribe('onClick', event => engine.handlePrimaryClick(event));
        scene.updateMatrixWorld(true);
        renderer.render(scene, camera);
        window.__moveOnlyFixture = { engine, records };
        // The remodeled clue is a bending sapling, not the old stone disk.
        // Click its visible trunk and verify a genuine geometry hit first.
        const projected = new THREE.Vector3(-.08, .92, -.14).project(camera);
        // Native MouseEvent coordinates are integer CSS pixels. Probe exactly
        // that pixel, not a different fractional ray, for the ground assertion.
        const x = Math.round((projected.x + 1) * innerWidth / 2);
        const y = Math.round((1 - projected.y) * innerHeight / 2);
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), camera);
        if (!ray.intersectObject(site.mesh, true).some(hit => hit.object.userData.entityId === site.id)) {
            throw new Error('The chosen visible sapling point must hit its rendered geometry');
        }
        const ground = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
        return { x, y, ground: ground.toArray() };
    });
    await page.mouse.click(point.x, point.y);
    expect(await page.evaluate(() => window.__moveOnlyFixture.records.interactions)).toEqual(['chronicle-site-new_growth']);
    await page.keyboard.down('Shift');
    try { await page.mouse.click(point.x, point.y); }
    finally { await page.keyboard.up('Shift'); }
    const result = await page.evaluate(() => {
        const { engine, records } = window.__moveOnlyFixture;
        return { ...records, pending: engine.pendingInteraction, target: engine.abilityController.pendingAbilityTarget,
            skill: engine.abilityController.pendingAbilitySkill, shift: Boolean(engine.inputManager.keys.shift) };
    });
    expect(result).toMatchObject({ interactions: ['chronicle-site-new_growth'], jumps: [],
        pending: null, target: null, skill: null, shift: false });
    expect(result.moves).toHaveLength(1);
    expect(result.moves[0][1]).toBeCloseTo(0);
    for (const axis of [0, 2]) expect(result.moves[0][axis]).toBeCloseTo(point.ground[axis], 2);
    await page.mouse.click(point.x, point.y);
    expect(await page.evaluate(() => window.__moveOnlyFixture.records.interactions)).toHaveLength(2);
    await page.screenshot({ path: testInfo.outputPath('move-only-chronicle-marker.png') });
});
