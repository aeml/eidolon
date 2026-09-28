import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const width of [1280, 390]) test(`optional world reading is usable at ${width}px`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { WorldReading } = await import('/src/entities/WorldReading.js');
        const { WORLD_READINGS } = await import('/src/data/worldPopulation.js');
        const { requestNearbyChronicleInspection } = await import('/src/core/ChronicleInspection.js');
        const { InputManager } = await import('/src/core/InputManager.js');
        document.getElementById('start-screen').style.display = 'none';
        const engine = { isMultiplayer: true, currentInstanceId: '', currentInstanceType: 'overworld',
            player: { id: 'reader-fixture', state: 'IDLE', position: new THREE.Vector3(), quests: [] }, sent: [] };
        engine.network = { send: (...args) => engine.sent.push(args) };
        engine.inputManager = new InputManager();
        let entity;
        engine.chunkManager = { getActiveEntities: () => entity ? [entity] : [] };
        engine.inputManager.subscribe('onInspect', () => requestNearbyChronicleInspection(engine));
        window.__readingFixture = { engine, select(index) {
            entity?.dispose(); const site = WORLD_READINGS[index]; entity = new WorldReading(site.id);
            entity.position.set(site.x, 0, site.z); entity.gameEngine = engine;
            engine.player.position.set(site.x, 0, site.z + 4);
            return site.reading.title;
        }, update: () => entity.update(), dispose() { entity?.dispose(); engine.inputManager.dispose(); } };
    });
    for (let i = 0; i < 2; i++) {
        const title = await page.evaluate(i => window.__readingFixture.select(i), i);
        await page.keyboard.press('e');
        const dialog = page.getByRole('dialog', { name: title });
        await expect(dialog).toBeVisible();
        const box = await dialog.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y + box.height).toBeLessThanOrEqual(844);
        await page.keyboard.press('Tab');
        await expect(dialog.getByRole('button', { name: 'Close reading' })).toBeFocused();
        await page.keyboard.press('w');
        expect(await page.evaluate(() => Boolean(window.__readingFixture.engine.inputManager.keys.w))).toBe(false);
        await dialog.evaluate(node => { node.scrollTop = 0; node.focus(); });
        const closeBox = await dialog.getByRole('button', { name: 'Close reading' }).boundingBox();
        expect(closeBox.y).toBeGreaterThanOrEqual(box.y);
        expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(box.y + box.height);
        await page.screenshot({ path: testInfo.outputPath(`reading-${i}.png`) });
        await dialog.getByRole('button', { name: 'Close reading' }).click();
        await expect(dialog).toHaveCount(0);
        await page.keyboard.press('e');
        await expect(dialog).toBeVisible();
        await page.evaluate(() => { window.__readingFixture.engine.player.state = 'DEAD'; window.__readingFixture.update(); });
        await expect(dialog).toHaveCount(0);
        await page.evaluate(() => { window.__readingFixture.engine.player.state = 'IDLE'; });
    }
    expect(await page.evaluate(() => window.__readingFixture.engine.sent)).toEqual([]);
    await page.evaluate(() => window.__readingFixture.dispose());
    expect(failures).toEqual([]);
});
