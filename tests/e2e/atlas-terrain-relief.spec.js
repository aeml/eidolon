import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1280, 800], [390, 844]]) {
    test(`terrain-profile atlas relief and registered rocks at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        const result = await page.evaluate(async () => {
            const { AtlasCartography } = await import('/src/ui/AtlasCartography.js');
            const { WorldMap } = await import('/src/ui/WorldMap.js');
            const mobile = innerWidth < 600;
            const art = ['flat-v1', 'earth-elevation-v1', 'earth-elevation-rocks-v1'].map(terrainProfile =>
                new AtlasCartography({ mobile, terrainProfile }));
            const pixels = tile => tile.getContext('2d').getImageData(0, 0, tile.width, tile.height).data;
            const differences = (a, b) => {
                let changed = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2]) changed++;
                return changed;
            };
            const earth = art.map(a => pixels(a.tile('earth')));
            const others = ['town', 'water', 'fire', 'air'].map(id => {
                const tiles = art.map(a => pixels(a.tile(id)));
                return { id, changed: differences(tiles[0], tiles[1]) + differences(tiles[0], tiles[2]) };
            });
            const state = { hillPixels: differences(earth[0], earth[1]), rockPixels: differences(earth[1], earth[2]), others,
                width: art[2].tile('earth').width, cached: art[2].tile('earth') === art[2].tile('earth') };
            art.forEach(a => a.dispose());
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const game = { isMobile: mobile, terrainProfile: 'earth-elevation-rocks-v1',
                player: { id: 'atlas-only', position: { x: -100, z: -300 } }, uiManager: { partyData: null } };
            const map = new WorldMap(game);
            map.toggle(); map.scale = mobile ? .8 : 1.3; map.draw(game.player);
            window.__atlasRelief = map;
            return state;
        });
        expect(result.hillPixels).toBeGreaterThan(10000);
        expect(result.rockPixels).toBeGreaterThan(100);
        expect(result.others.every(r => r.changed === 0)).toBe(true);
        expect(result.width).toBe(width < 600 ? 512 : 1024); expect(result.cached).toBe(true);
        const dialog = page.getByRole('dialog', { name: 'World atlas' });
        await expect(dialog).toBeVisible();
        await dialog.locator('summary').click();
        await expect(dialog.locator('[data-atlas-terrain-legend]')).toBeVisible();
        await expect(dialog.locator('[data-atlas-terrain-legend]')).toContainText('3m elevation intervals');
        await dialog.locator('summary').click();
        const box = await dialog.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(height);
        await page.screenshot({ path: testInfo.outputPath('grove-relief-atlas.png') });
        await page.evaluate(() => window.__atlasRelief.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
