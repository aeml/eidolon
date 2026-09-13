import { expect, test } from '@playwright/test';

// Real Actor locomotion/collisions in a prepared venue; not a connected wager.
test('walk upstairs and back using the physical landing control', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { CasinoController } = await import('/src/core/CasinoController.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        const { createCasinoShell } = await import('/src/art/ProceduralCasino.js');
        const { createProceduralFighter } = await import('/src/art/ProceduralHumanoid.js');
        document.getElementById('start-screen').style.display = 'none';
        document.querySelectorAll('canvas').forEach(canvas => { canvas.hidden = true; });
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(innerWidth, innerHeight); renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:2';
        document.body.append(renderer.domElement);
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x182029);
        scene.add(new THREE.HemisphereLight(0xffe4bc, 0x394968, 3));
        const sun = new THREE.DirectionalLight(0xffefd7, 3); sun.position.set(-10, 30, 190); scene.add(sun);
        const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 300);
        const shell = createCasinoShell(); scene.add(shell);
        const collision = new CollisionManager(); collision.casinoNavigation = true;
        for (const wall of shell.userData.casinoWalls) collision.addCollider(new THREE.Box3().setFromCenterAndSize(
            new THREE.Vector3(wall.position[0], wall.position[1], 170 + wall.position[2]), new THREE.Vector3(...wall.size)));
        const player = new Fighter('stairs-fighter'); player.position.set(7.5, 0, 176.4); player.mesh = createProceduralFighter(); scene.add(player.mesh);
        const engine = { player, renderSystem: { scene, renderer, camera }, collisionManager: collision, network: { send() {} }, uiManager: { addChatMessage() {} } };
        const controller = new CasinoController(engine);
        window.__stairsQA = { player, controller, shell };
        let previous = performance.now();
        renderer.setAnimationLoop(now => {
            const dt = Math.min(.05, (now - previous) / 1000); previous = now;
            controller.beforeUpdate(dt); player.update(dt, collision, null, null);
            player.mesh.position.copy(player.position);
            camera.position.set(16, player.position.y + 24, 199); camera.lookAt(2, player.position.y, 170);
            renderer.render(scene, camera);
        });
    });
    const upstairs = page.getByRole('button', { name: 'Walk upstairs · VIP lounge', exact: true });
    await expect(upstairs).toBeVisible();
    expect((await upstairs.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await upstairs.click();
    await expect.poll(() => page.evaluate(() => window.__stairsQA.player.position.y), { timeout: 15000 }).toBe(6);
    const downstairs = page.getByRole('button', { name: 'Walk downstairs · Public casino', exact: true });
    await expect(downstairs).toBeVisible();
    expect(await page.evaluate(() => window.__stairsQA.shell.userData.casinoUpstairs.visible)).toBe(true);
    await page.screenshot({ path: '/tmp/eidolon-casino-vip-stairs-20260913.png' });
    await downstairs.click();
    await expect(upstairs).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => window.__stairsQA.player.position.y)).toBe(0);
    expect(await page.evaluate(() => window.__stairsQA.shell.userData.casinoUpstairs.visible)).toBe(false);
});
