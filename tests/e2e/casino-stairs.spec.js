import { expect, test } from '@playwright/test';

// Real Actor locomotion/collisions in a prepared venue; not a connected wager.
test('VIP guard dialogue and blocked stairs on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { Fighter } = await import('/src/entities/Fighter.js');
        const { CasinoController } = await import('/src/core/CasinoController.js');
        const { CollisionManager } = await import('/src/core/CollisionManager.js');
        const { createCasinoInterior } = await import('/src/art/ProceduralCasino.js');
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
        const collision = new CollisionManager();
        const shell = createCasinoInterior(scene, collision);
        const player = new Fighter('stairs-fighter'); player.position.set(0, 0, 154); player.mesh = createProceduralFighter(); scene.add(player.mesh);
        const engine = { currentInstanceId: 'lanternhold-casino', player, renderSystem: { scene, renderer, camera }, collisionManager: collision, network: { send() {} }, uiManager: { addChatMessage() {} } };
        const controller = new CasinoController(engine);
        window.__stairsQA = { player, controller, shell };
        let previous = performance.now();
        renderer.setAnimationLoop(now => {
            const dt = Math.min(.05, (now - previous) / 1000); previous = now;
            controller.beforeUpdate(dt); player.update(dt, collision, null, null);
            player.mesh.position.copy(player.position);
            camera.position.set(16, 24, 184); camera.lookAt(0, 2, 150);
            renderer.render(scene, camera);
        });
    });
    const guard = page.getByRole('button', { name: 'Talk to VIP Guard', exact: true });
    await expect(guard).toBeVisible();
    expect((await guard.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await guard.click();
    await expect(page.locator('.casino-entry-dialogue')).toContainText('You must be a VIP to enter');
    await page.screenshot({ path: '/tmp/eidolon-casino-vip-guard-phone-20260913.png' });
    await page.locator('.casino-entry-dialogue').getByRole('button', { name: 'Close', exact: true }).click();
    await page.evaluate(() => {
        const { player } = window.__stairsQA;
        const point = player.position.clone(); point.z = 130; player.move(point);
    });
    await expect.poll(() => page.evaluate(() => window.__stairsQA.player.position.z)).toBeLessThan(153);
    expect(await page.evaluate(() => window.__stairsQA.player.position.z)).toBeGreaterThanOrEqual(148);
    expect(await page.evaluate(() => window.__stairsQA.player.position.y)).toBe(0);
});
