import { expect, test } from '@playwright/test';

// Prepared rendered encounter view; not evidence of an earned combat clear.
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
test(`nearby ward, readable objective and instance cleanup at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { PublicEventController } = await import('/src/core/PublicEventController.js');
        const { createProceduralFighter } = await import('/src/art/ProceduralHumanoid.js');
        document.getElementById('start-screen').style.display = 'none';
        document.querySelectorAll('canvas').forEach(canvas => { canvas.hidden = true; });
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(innerWidth, innerHeight); renderer.domElement.style.cssText = 'position:fixed;inset:0;z-index:2';
        document.body.append(renderer.domElement);
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x261e1b);
        scene.add(new THREE.HemisphereLight(0xffe4bc, 0x46392e, 3));
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ color: 0x49322a }));
        ground.rotation.x = -Math.PI / 2; scene.add(ground);
        const hero = createProceduralFighter(); hero.position.set(0, 0, 17); scene.add(hero);
        const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, .1, 300);
        camera.position.set(0, 58, 53); camera.lookAt(0, 0, 0);
        const engine = { player: { position: hero.position }, renderSystem: { scene } };
        const controller = new PublicEventController(engine);
        controller.updateState({ id: 'render-ember', site: { x: 0, z: 0, title: 'Ashes Without a Hearth', realm: 'fire',
            objective: 'Clear the outer ring and vent the ward from its rim, not its center.',
            lore: 'The Ember Crown once warmed the caravan road. A buried fracture now hoards that warmth.', level: 72 },
            phase: 'defending', wave: 2, runeX: 0, runeZ: 0, radius: 22, innerRadius: 12,
            charge: 11, chargeNeeded: 20, participants: 4, remaining: 3, endsAt: new Date(Date.now() + 180000).toISOString() });
        window.__eventQA = { controller, engine };
        renderer.setAnimationLoop(() => { controller.update(1 / 60); renderer.render(scene, camera); });
    });
    const panel = page.locator('.public-event');
    await expect(panel).toBeVisible();
    await panel.locator('summary').click();
    await expect(panel).toContainText('Ward 11/20');
    expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    const box = await panel.boundingBox();
    expect(box.width).toBeLessThan(viewport.width);
    expect(box.y + box.height).toBeLessThan(viewport.height - 60);
    if (viewport.width >= 1024) {
        expect(box.x).toBeGreaterThan(viewport.width * .7);
        expect(box.y).toBeGreaterThanOrEqual(220);
        expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, innerHeight * .4)?.tagName))
            .toBe('CANVAS');
    }
    await page.screenshot({ path: testInfo.outputPath('event-expanded.png') });
    await page.evaluate(() => { window.__eventQA.engine.currentInstanceId = 'dungeon'; });
    await expect(panel).toBeHidden();
    expect(await page.evaluate(() => window.__eventQA.controller.marker.visible)).toBe(false);
});
}
