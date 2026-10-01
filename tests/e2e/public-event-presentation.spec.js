import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
test(`atlas discovers scheduled realm events and preserves the waypoint at ${viewport.width}px`, async ({ page, baseURL }, testInfo) => {
    test.setTimeout(45_000);
    const failures = collectBrowserFailures(page, baseURL);
    await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const { WorldMap } = await import('/src/ui/WorldMap.js');
        document.getElementById('start-screen').style.display = 'none';
        document.body.classList.toggle('mobile-mode', innerWidth < 600);
        const engine = { isMobile: innerWidth < 600, currentInstanceId: '', currentInstanceType: '',
            player: { id: 'local', level: 30, position: { x: 0, z: 200 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
            uiManager: { partyData: { members: [] } }, chunkManager: { getActiveEntities: () => [] },
            inputManager: { clearInputState() {} }, publicEvents: { data: { id: 'disturbance-1', phase: 'defending',
                site: { title: 'The Road That Remembers', realm: 'earth', x: -750, z: 200, level: 35, objective: 'Keep the central stone clear and stand within its ward.' },
                startsAt: '2026-10-01T00:01:00Z', endsAt: '2026-10-01T00:08:00Z',
                upcoming: [
                    { id: 'disturbance-2', site: { title: 'The Unmoored Chorus', realm: 'water', x: 0, z: -900, level: 55,
                        objective: 'Follow the active tide rune as it alternates between the river-stones.', lore: 'Fragments of Tidestar’s memory drift between two river-stones.' }, startsAt: '2026-10-01T00:11:00Z', endsAt: '2026-10-01T00:18:00Z' },
                    { id: 'disturbance-3', site: { title: 'Ashes Without a Hearth', realm: 'fire', x: -1250, z: 200, level: 72 }, startsAt: '2026-10-01T00:21:00Z', endsAt: '2026-10-01T00:28:00Z' },
                    { id: 'disturbance-4', site: { title: 'The Stolen Horizon', realm: 'air', x: 1250, z: 200, level: 72 }, startsAt: '2026-10-01T00:31:00Z', endsAt: '2026-10-01T00:38:00Z' }
                ] } } };
        const map = new WorldMap(engine); engine.worldMap = map;
        window.__eventAtlas = { engine, map }; map.toggle();
    });
    const dialog = page.getByRole('dialog', { name: 'World atlas' });
    const search = dialog.getByRole('searchbox', { name: 'Find a known location' });
    await search.fill('Unmoored');
    await dialog.getByRole('button', { name: '◷ The Unmoored Chorus', exact: true }).click();
    const detail = dialog.getByRole('region', { name: 'Selected destination' });
    await expect(detail).toContainText('Scheduled · water realm · recommended level 55');
    await expect(detail).toContainText('2026-10-01 00:11 UTC');
    await expect(detail).toContainText('Follow the active tide rune');
    await expect(detail).toContainText('no Gold purse or reward claim');
    await detail.getByRole('button', { name: 'Set personal waypoint' }).click();
    await expect(dialog.getByLabel('Waypoint guidance')).toContainText('1100m N');
    await detail.getByRole('button', { name: 'Set personal waypoint' }).scrollIntoViewIfNeeded();
    await expect(detail.getByRole('button', { name: 'Set personal waypoint' })).toBeInViewport();
    expect(await detail.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await dialog.locator('#world-map-canvas').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(100);
    await dialog.screenshot({ path: testInfo.outputPath('event-atlas.png') });
    await page.evaluate(() => {
        const { engine, map } = window.__eventAtlas;
        engine.publicEvents.data = { ...engine.publicEvents.data.upcoming[0], phase: 'announced', upcoming: [] };
        map.update(engine.player);
    });
    await expect(detail).toContainText('Gather at the ward');
    expect(await page.evaluate(() => window.__eventAtlas.map.navigation.waypoint)).toMatchObject({ id: 'public-event-disturbance-2', x: 0, z: -900 });
    await page.evaluate(() => { const { engine, map } = window.__eventAtlas; engine.currentInstanceId = 'dungeon-private'; map.update(engine.player); });
    await expect(detail).toBeHidden();
    expect(failures, failures.join('\n')).toEqual([]);
});
}

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
