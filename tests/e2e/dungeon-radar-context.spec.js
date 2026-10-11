import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

const fixtures = JSON.parse(fs.readFileSync('tests/fixtures/production-dungeon-layouts.json', 'utf8'));

for (const width of [1280, 390]) {
    test(`dungeon radar shows room edges at entry and keeps a stable walking scale at ${width}px`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { Minimap } = await import('/src/ui/Minimap.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', innerWidth < 600);
            const radar = new Minimap();
            window.__dungeonRadar = radar;
        });
        const results = [];
        for (const [fixtureIndex, fixture] of fixtures.entries()) {
            const result = await page.evaluate(fixture => {
                const radar = window.__dungeonRadar, entry = fixture.layout.rooms[0];
                const player = { id: 'radar-reader', quests: [], position: { x: entry.x, z: entry.z } };
                const summary = { rooms: fixture.layout.rooms.map((room, index) => ({ ...room, index, explored: index === 0 })),
                    currentRoomIndex: 0, objectiveRoomIndex: 1 };
                const engine = { player, currentInstanceId: `radar-${fixture.dungeonType}`, currentInstanceType: fixture.dungeonType,
                    currentDungeonLayout: fixture.layout, getDungeonRoomSummary: () => summary, uiManager: {}, isMobile: innerWidth < 600 };
                radar.setGameEngine(engine); radar.update(player, []);
                const data = radar.ctx.getImageData(0, 0, 200, 200).data;
                let edgePixels = 0;
                for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
                    const radius = Math.hypot(x - 100, y - 100), i = (y * 200 + x) * 4;
                    if (radius > 45 && radius < 83 && data[i] > 120 && data[i + 1] > 110 && data[i + 2] > 80) edgePixels++;
                }
                const scale = radar.renderScale ?? radar.scale;
                const steps = [];
                for (let x = -3; x <= 3; x++) {
                    player.position.x = entry.x + x; radar.update(player, []);
                    steps.push(radar.renderScale ?? radar.scale);
                }
                summary.currentRoomIndex = 1;
                player.position.x = summary.rooms[1].x; player.position.z = summary.rooms[1].z;
                radar.update(player, []);
                steps.push(radar.renderScale ?? radar.scale);
                player.position.x = entry.x; player.position.z = entry.z;
                summary.currentRoomIndex = 0; radar.update(player, []);
                return { type: fixture.dungeonType, scale, steps, edgePixels, entryRadius: Math.hypot(entry.width, entry.height) / 2 * scale };
            }, fixture);
            results.push(result);
            if (fixture.dungeonType === 'verdant_bastion_catacombs') {
                await page.locator('#minimap-canvas').screenshot({ path: testInfo.outputPath(`verdant-radar-${fixtureIndex}.png`) });
            }
        }
        await testInfo.attach('radar-measurements', { body: JSON.stringify(results), contentType: 'application/json' });
        for (const result of results) {
            expect(result.entryRadius, result.type).toBeLessThanOrEqual(80.001);
            expect(result.edgePixels, result.type).toBeGreaterThan(50);
            expect(result.steps.every(scale => scale === result.scale), result.type).toBe(true);
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
