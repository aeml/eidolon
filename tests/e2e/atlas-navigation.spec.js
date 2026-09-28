import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1280, 800], [390, 844]]) {
    test(`atlas destination and waypoint controls at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { WorldMap } = await import('/src/ui/WorldMap.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', innerWidth < 600);
            const engine = { isMobile: innerWidth < 600, currentInstanceId: '', currentInstanceType: '',
                player: { id: 'local', level: 30, position: { x: 0, z: 200 } },
                uiManager: { partyData: { members: [] } }, chunkManager: { getActiveEntities: () => [] },
                inputManager: { clearInputState() { engine.clears++; } }, clears: 0, worldEvents: [] };
            const map = new WorldMap(engine); engine.worldMap = map;
            document.getElementById('btn-close-world-map').onclick = () => map.toggle();
            for (const name of ['keydown', 'pointerdown', 'click']) window.addEventListener(name, () => engine.worldEvents.push(name));
            window.__atlas = { engine, map };
            map.toggle();
        });
        const dialog = page.getByRole('dialog', { name: 'World atlas' });
        const search = page.getByRole('searchbox', { name: 'Find a known location' });
        await expect(dialog).toBeVisible(); await expect(search).toBeFocused();
        await search.fill('molten');
        await page.getByRole('button', { name: '◆ Molten Core', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Molten Core' })).toBeFocused();
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('Minimum level 70');
        await page.getByRole('button', { name: 'Set personal waypoint' }).click();
        await expect(page.getByLabel('Waypoint guidance')).toContainText('2400m W');
        const canvas = page.locator('#world-map-canvas');
        await canvas.focus();
        const before = await page.evaluate(() => window.__atlas.map.mapOffsetX);
        await page.keyboard.press('ArrowRight');
        expect(await page.evaluate(() => window.__atlas.map.mapOffsetX)).toBe(before - 60);
        await page.getByRole('button', { name: 'World overview' }).click();
        expect(await page.evaluate(() => window.__atlas.map.scale)).toBeLessThan(.1);
        const bounds = await dialog.boundingBox(), canvasBounds = await canvas.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
        expect(canvasBounds.height).toBeGreaterThan(100);
        const art = await page.evaluate(() => {
            const map = window.__atlas.map, tile = map.cartography.tiles.get('fire');
            const point = map._makeWorldToScreen(map.canvas.width / 2, map.canvas.height / 2)(-2700, 600);
            return { tile: [...tile.getContext('2d').getImageData(10, 10, 1, 1).data],
                land: [...map.ctx.getImageData(Math.round(point.x), Math.round(point.y), 1, 1).data],
                cache: [...map.cartography.tiles].map(([id, canvas]) => ({ id, width: canvas.width, height: canvas.height,
                    lost: canvas.getContext('2d').isContextLost(), pixel: [...canvas.getContext('2d').getImageData(10, 10, 1, 1).data] })) };
        });
        expect(art.tile[3], JSON.stringify(art)).toBe(255);
        expect(art.land.slice(0, 3)).not.toEqual([17, 28, 36]);
        await page.screenshot({ path: testInfo.outputPath('atlas-navigation.png') });
        await page.evaluate(() => window.__atlas.map.navigation.select('forge'));
        await page.screenshot({ path: testInfo.outputPath('atlas-town.png') });
        await page.evaluate(() => {
            const { engine, map } = window.__atlas;
            engine.currentInstanceId = 'private-dungeon'; engine.currentInstanceType = 'molten_core'; map.update(engine.player);
        });
        await expect(page.getByLabel('Waypoint guidance')).toContainText('waypoint in the overworld');
        await expect(page.getByRole('region', { name: 'Selected destination' })).toBeHidden();
        await page.getByRole('button', { name: 'Clear waypoint' }).click();
        await expect(page.getByLabel('Waypoint guidance')).toContainText('No personal waypoint');
        await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
        expect(await page.evaluate(() => window.__atlas.engine.clears)).toBe(1);
        expect(await page.evaluate(() => window.__atlas.engine.worldEvents)).toEqual([]);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
