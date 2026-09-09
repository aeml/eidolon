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
        const projected = new THREE.Vector3(0, .12, 0).project(camera);
        return { x: (projected.x + 1) * innerWidth / 2, y: (1 - projected.y) * innerHeight / 2 };
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
    expect(Math.hypot(result.moves[0][0], result.moves[0][2])).toBeLessThan(.5);
    await page.mouse.click(point.x, point.y);
    expect(await page.evaluate(() => window.__moveOnlyFixture.records.interactions)).toHaveLength(2);
    await page.screenshot({ path: testInfo.outputPath('move-only-chronicle-marker.png') });
});
