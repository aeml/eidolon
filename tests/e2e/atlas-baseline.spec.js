import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

let tables;
test.beforeAll(() => {
    const output = execFileSync('go', ['test', './internal/game', '-run', '^TestCasinoBrowserFixtureCatalog$', '-count=1', '-v'],
        { cwd: 'server', encoding: 'utf8', timeout: 120000,
            env: { ...process.env, EIDOLON_CASINO_FIXTURE_CATALOG: '1' } });
    const line = output.split('\n').find(line => line.startsWith('[casino-fixture-catalog]'));
    if (!line) throw new Error('Missing canonical casino table catalog');
    tables = JSON.parse(line.slice('[casino-fixture-catalog]'.length));
});

for (const [width, height] of [[1440, 1000], [390, 844]]) {
    test(`${width}: world baseline and both expanded casino floor maps`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async ({ tables, phone }) => {
            const { WorldMap } = await import('/src/ui/WorldMap.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', phone);
            const game = { isMobile: phone, player: { id: 'atlas-review', position: { x: 0, y: 0, z: 200 } },
                uiManager: { partyData: null }, casino: { floor: 'public', vipActive: true, data: { tables } } };
            const map = new WorldMap(game);
            map.container.style.display = 'flex'; map.resize(); map.centerOnPlayer();
            // Fit the old world overview as a baseline, not a new atlas claim.
            map.scale = .15; map.draw(game.player);
            window.__atlasReview = { map, game };
        }, { tables, phone: width < 600 });
        const map = page.locator('#world-map');
        await expect(map).toBeVisible();
        const coloredPixels = await page.evaluate(async () => {
            // The ordinary start-screen UI also observes this canvas. Let its
            // resize notifications settle before rendering this isolated map.
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const { map, game } = window.__atlasReview;
            map.draw(game.player);
            const pixels = map.ctx.getImageData(0, 0, map.canvas.width, map.canvas.height).data;
            let colored = 0;
            for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i+1], pixels[i+2])
                - Math.min(pixels[i], pixels[i+1], pixels[i+2]) > 10) colored++;
            return colored;
        });
        expect(coloredPixels).toBeGreaterThan(5000);
        await page.screenshot({ path: testInfo.outputPath('world-baseline.png') });
        for (const floor of ['public', 'vip']) {
            const state = await page.evaluate(async floor => {
                const { getCasinoMapState } = await import('/src/ui/CasinoMap.js');
                const { map, game } = window.__atlasReview;
                game.currentInstanceType = 'casino'; game.casino.floor = floor;
                game.player.position.y = floor === 'vip' ? 8 : 0;
                map.draw(game.player);
                const state = getCasinoMapState(game);
                return { floor: state.floor, tables: state.tables.length, types: [...new Set(state.tables.map(table => table.label))],
                    labels: state.landmarks.map(marker => marker.label) };
            }, floor);
            expect(state.tables).toBe(46); expect(state.types).toHaveLength(5);
            expect(state.labels).toEqual(floor === 'vip' ? ['Return downstairs'] : ['VIP Guard · Upstairs access', 'Exit to Lanternhold']);
            const box = await map.boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(0); expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(width); expect(box.y + box.height).toBeLessThanOrEqual(height);
            await page.screenshot({ path: testInfo.outputPath(`casino-${floor}.png`) });
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
