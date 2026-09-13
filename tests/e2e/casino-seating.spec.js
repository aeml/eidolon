import { expect, test } from '@playwright/test';

// Focused rendered interaction fixture, not a multiplayer/wagering campaign.
test('physical chair picking, seated equipment pose, phone panel and clean exit', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { CasinoController } = await import('/src/core/CasinoController.js');
        const { createCasinoShell } = await import('/src/art/ProceduralCasino.js');
        const { createProceduralFighter, createProceduralWizard } = await import('/src/art/ProceduralHumanoid.js');
        document.getElementById('start-screen').style.display = 'none';
        document.querySelectorAll('canvas').forEach(canvas => { canvas.hidden = true; });
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(innerWidth, innerHeight); renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:2';
        document.body.append(renderer.domElement);
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x1b2530);
        scene.add(new THREE.HemisphereLight(0xffe5bc, 0x394968, 2.8));
        const light = new THREE.DirectionalLight(0xffdb9a, 3); light.position.set(8, 18, 185); scene.add(light);
        const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, .1, 500);
        camera.position.set(12, 18, 189); camera.lookAt(0, 0, 171);
        scene.add(createCasinoShell());
        const table = { id: 'public-blackjack', name: 'Lanternhold Blackjack', game: 'blackjack', floor: 'public', x: -4.3, z: 171,
            seats: Array.from({ length: 6 }, (_, index) => { const angle = index * Math.PI / 3; return { x: -4.3 + Math.sin(angle) * 2.2, z: 171 + Math.cos(angle) * 2.2, rotation: angle + Math.PI, exitX: -4.3 + Math.sin(angle) * 3.4, exitZ: 171 + Math.cos(angle) * 3.4 }; }) };
        const mesh = createProceduralFighter(); scene.add(mesh);
        const otherMesh = createProceduralWizard(); otherMesh.position.set(table.seats[3].x, 0, table.seats[3].z); otherMesh.rotation.y = table.seats[3].rotation; scene.add(otherMesh);
        const player = { mesh, position: new THREE.Vector3(-4.3, 0, 174.4), rotation: new THREE.Quaternion(), velocity: new THREE.Vector3(), state: 'IDLE', move(point) { this.position.copy(point); } };
        const other = { mesh: otherMesh, state: 'SEATED' };
        const sent = [];
        const engine = { player, cameraLocked: true, network: { send(type, payload) { sent.push({ type, payload }); } },
            renderSystem: { renderer, scene, camera, cameraTarget: new THREE.Vector3(0, 0, 171), setCameraTarget(target) { camera.lookAt(target); } },
            inputManager: { clearInputState() {} }, uiManager: { addChatMessage() {} } };
        const controller = new CasinoController(engine);
        controller.updateState({ tables: [table], occupants: [{ tableId: table.id, seat: 3, name: 'Wizard', connected: true }] });
        controller.beforeUpdate(.1); scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
        renderer.domElement.addEventListener('pointerdown', event => controller.handlePrimaryClick(event));
        const loop = () => {
            if (engine.stopped) return;
            controller.beforeUpdate(1 / 60); mesh.position.copy(player.position); mesh.quaternion.copy(player.rotation);
            controller.render([player, other]); renderer.render(scene, camera); requestAnimationFrame(loop);
        };
        loop();
        window.__casino = { engine, controller, table, sent, camera, renderer };
    });
    const chairPoint = await page.evaluate(async () => {
        const THREE = await import('three'); const { table, camera } = window.__casino;
        const point = new THREE.Vector3(table.seats[0].x, 1.4, table.seats[0].z).project(camera);
        return { x: (point.x + 1) * innerWidth / 2, y: (-point.y + 1) * innerHeight / 2 };
    });
    await page.mouse.click(chairPoint.x, chairPoint.y);
    await expect.poll(() => page.evaluate(() => window.__casino.sent.some(message => message.payload.action === 'sit'))).toBe(true);
    await page.evaluate(() => {
        const { controller, table } = window.__casino;
        controller.updateState({ tables: [table], occupants: [{ tableId: table.id, seat: 0, name: 'Fighter', connected: true }, { tableId: table.id, seat: 3, name: 'Wizard', connected: true }],
            yourSeat: { tableId: table.id, seat: 0, sessionId: 'fixture-seat', exitX: -4.3, exitZ: 174.4 } });
    });
    await expect(page.getByRole('button', { name: 'Leave table', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__casino.controller.blend)).toBe(1);
    await page.screenshot({ path: '/tmp/eidolon-casino-seat-view-20260913.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    const panel = page.getByRole('region', { name: 'Casino table' });
    await expect(panel).toBeVisible();
    expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    expect((await page.getByRole('button', { name: 'Leave table', exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: 'Leave table', exact: true }).click();
    expect(await page.evaluate(() => window.__casino.sent.at(-1).payload)).toEqual({ action: 'leave', sessionId: 'fixture-seat' });
    await page.evaluate(() => { const { controller, table } = window.__casino; controller.updateState({ tables: [table], occupants: [], yourSeat: null }); });
    await expect(panel).toBeHidden();
    expect(await page.evaluate(() => ({ locked: window.__casino.engine.cameraLocked, z: window.__casino.engine.player.position.z }))).toEqual({ locked: true, z: 174.4 });
});
