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
                player: { id: 'local', level: 30, position: { x: 0, z: 200 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
                uiManager: { partyData: { members: [] } }, chunkManager: { getActiveEntities: () => [] },
                inputManager: { clearInputState() { engine.clears++; } }, clears: 0, worldEvents: [] };
            const map = new WorldMap(engine); engine.worldMap = map;
            document.getElementById('btn-close-world-map').onclick = () => map.toggle();
            for (const name of ['keydown', 'pointerdown', 'click', 'touchstart', 'touchmove', 'touchend']) window.addEventListener(name, () => engine.worldEvents.push(name));
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
        await search.fill('Bellkeeper');
        await page.getByRole('button', { name: '▤ Bellkeeper’s Cairn', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('not a saved quest discovery');
        await page.getByRole('button', { name: 'Set personal waypoint' }).click();
        expect(await page.evaluate(() => {
            const waypoint = window.__atlas.map.navigation.waypoint;
            return [waypoint.x, waypoint.z];
        })).toEqual([-314, -186]);
        await page.screenshot({ path: testInfo.outputPath('atlas-public-lore.png') });
        await page.locator('.atlas-directory > summary').click();
        await page.getByRole('checkbox', { name: '◇ Places & lore' }).uncheck();
        await expect(page.getByRole('button', { name: '▤ Bellkeeper’s Cairn', exact: true })).toHaveCount(0);
        await page.getByRole('checkbox', { name: '◇ Places & lore' }).check();
        await page.evaluate(async () => {
            const { engine, map } = window.__atlas;
            const { QuestUI } = await import('/src/ui/QuestUI.js');
            engine.player.quests = [{ id: 'chronicle_earth_returning_scar', category: 'chronicle', type: 'INVESTIGATE',
                title: 'The Scar That Grows Back', accepted: true, count: 2, maxCount: 3, investigationMask: 5 }];
            engine.uiManager.quest = new QuestUI({ getLastPlayer: () => engine.player, isMobile: engine.isMobile });
            map.update(engine.player);
        });
        await search.fill('new growth');
        await page.getByRole('button', { name: '! New growth', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('Tracked · The Scar That Grows Back');
        await expect(page.getByRole('region', { name: 'Selected destination' })).not.toContainText('neighbor’s hand');
        await page.getByRole('button', { name: 'Set personal waypoint' }).click();
        await expect(page.getByLabel('Waypoint guidance')).toContainText('New growth');
        await page.screenshot({ path: testInfo.outputPath('atlas-tracked-discovery.png') });
        await page.evaluate(() => {
            const { engine, map } = window.__atlas;
            engine.uiManager.quest.setQuestTracked(engine.player.quests[0], false); map.update(engine.player);
        });
        await expect(page.getByRole('region', { name: 'Selected destination' })).toBeHidden();
        await search.fill('severed root');
        await page.getByRole('button', { name: '✓ Severed root', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('Recorded discovery');
        await page.evaluate(() => {
            const { engine, map } = window.__atlas, q = engine.player.quests[0];
            q.count = 3; q.investigationMask = 7; engine.uiManager.quest.setQuestTracked(q, true); map.update(engine.player);
        });
        await search.fill('turn in');
        await page.getByRole('button', { name: '? Turn in · The Scar That Grows Back', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('Complete Quest');
        await page.screenshot({ path: testInfo.outputPath('atlas-ready-turnin.png') });
        await page.evaluate(() => {
            const { engine, map } = window.__atlas;
            engine.player.quests = [{ id: 'chronicle_earth_kept_watch', category: 'chronicle',
                title: 'Those Who Kept the Watch', type: 'KILL', target: 'ChronicleHunt:chronicle_earth_kept_watch',
                accepted: true, count: 0, maxCount: 40 }];
            engine.uiManager.quest.setQuestTracked(engine.player.quests[0], true); map.update(engine.player);
        });
        await search.fill('Those Who Kept');
        await page.getByRole('button', { name: '! Those Who Kept the Watch · Earth Realm area', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('level 3 or higher');
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('not a specific spawn');
        await page.getByRole('button', { name: 'Set personal waypoint' }).click();
        expect(await page.evaluate(() => {
            const { x, z } = window.__atlas.map.navigation.waypoint; return [x, z];
        })).toEqual([175, 200]);
        await page.screenshot({ path: testInfo.outputPath('atlas-earth-hunt.png') });
        await page.evaluate(() => {
            const { engine, map } = window.__atlas;
            engine.player.quests = [{ id: 'chronicle_water_unmastered_current', category: 'chronicle',
                title: 'An Unmastered Current', type: 'KILL', target: 'ChronicleHunt:chronicle_water_unmastered_current',
                accepted: true, count: 0, maxCount: 50 }];
            engine.uiManager.quest.setQuestTracked(engine.player.quests[0], true); map.update(engine.player);
        });
        await search.fill('Unmastered');
        await page.getByRole('button', { name: '! An Unmastered Current · Water Realm area', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('Aqua Golem enemies of level 55 or higher');
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('before the Abyssal Well');
        await page.getByRole('button', { name: 'Set personal waypoint' }).click();
        expect(await page.evaluate(() => {
            const { x, z } = window.__atlas.map.navigation.waypoint; return [x, z];
        })).toEqual([0, -1200]);
        await page.screenshot({ path: testInfo.outputPath('atlas-water-hunt.png') });
        await page.evaluate(() => {
            const { engine, map } = window.__atlas;
            engine.player.quests = [{ id: 'chronicle_fire_unending_war', category: 'chronicle',
                title: 'Fuel for an Unending War', type: 'KILL', target: 'ChronicleHunt:chronicle_fire_unending_war',
                accepted: true, count: 0, maxCount: 35 }];
            engine.uiManager.quest.setQuestTracked(engine.player.quests[0], true); map.update(engine.player);
        });
        await search.fill('Unending');
        await page.getByRole('button', { name: '! Fuel for an Unending War · Fire Realm area', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('Magma Golem enemies of level 75 or higher');
        await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('do not need to reach the Molten Core');
        await page.getByRole('button', { name: 'Set personal waypoint' }).click();
        expect(await page.evaluate(() => {
            const { x, z } = window.__atlas.map.navigation.waypoint; return [x, z];
        })).toEqual([-1600, 200]);
        await page.screenshot({ path: testInfo.outputPath('atlas-fire-hunt.png') });
        for (const [quest, query, label, expected, waypoint] of [
            [{ id: 'chronicle_air_unstolen_hours', title: 'The Hours We Refuse to Lose', type: 'KILL',
                target: 'ChronicleHunt:chronicle_air_unstolen_hours' }, 'Hours We', 'The Hours We Refuse to Lose',
            'Thunder Roc enemies of level 80 or higher', [2000, 200]],
            [{ id: 'chronicle_08_feathers_thunder', title: 'Feathers of Thunder', type: 'COLLECT',
                target: 'Stormglass Pinion' }, 'Feathers', 'Feathers of Thunder', 'Begin with Storm Harpies', [1200, 200]]
        ]) {
            await page.evaluate(quest => {
                const { engine, map } = window.__atlas;
                engine.player.quests = [{ ...quest, category: 'chronicle', accepted: true, count: 0, maxCount: 8 }];
                engine.uiManager.quest.setQuestTracked(engine.player.quests[0], true); map.update(engine.player);
            }, quest);
            await search.fill(query);
            await page.getByRole('button', { name: `! ${label} · Air Realm area`, exact: true }).click();
            await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText(expected);
            await expect(page.getByRole('region', { name: 'Selected destination' })).toContainText('not a safe path');
            await page.getByRole('button', { name: 'Set personal waypoint' }).click();
            expect(await page.evaluate(() => {
                const { x, z } = window.__atlas.map.navigation.waypoint; return [x, z];
            })).toEqual(waypoint);
        }
        await page.screenshot({ path: testInfo.outputPath('atlas-air-collection.png') });
        if (width < 600) {
            const box = await canvas.boundingBox(), x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height * .6);
            const cdp = await page.context().newCDPSession(page);
            await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
            const initial = await page.evaluate(() => ({ scale: window.__atlas.map.scale, offset: window.__atlas.map.mapOffsetX }));
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 25, y }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            expect(await page.evaluate(() => window.__atlas.map.mapOffsetX)).toBeGreaterThan(initial.offset);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 20, y, id: 1 }, { x: x + 20, y, id: 2 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 40, y, id: 1 }, { x: x + 40, y, id: 2 }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            expect(await page.evaluate(() => window.__atlas.map.scale)).toBeGreaterThan(initial.scale);
            await cdp.detach();
        }
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
