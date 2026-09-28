import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

const fixtures = JSON.parse(fs.readFileSync('tests/fixtures/production-dungeon-layouts.json', 'utf8'));
const layouts = ['molten_core', 'earth_crystal_raid'].map(type => fixtures.find(f => f.dungeonType === type));

for (const [width, height] of [[1280, 800], [390, 844]]) {
    test(`Dark Realm camp and collection directions are searchable at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { WorldMap } = await import('/src/ui/WorldMap.js');
            const { darkRealmFixture } = await import('/tests/darkRealmFixture.js');
            const { darkRealmChapters } = await import('/src/data/chronicleCatalog.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', innerWidth < 600);
            const chapter = darkRealmChapters.find(q => q.type === 'COLLECT');
            const engine = { currentInstanceId: 'dark-realm', currentInstanceType: 'dark_realm',
                currentDungeonLayout: darkRealmFixture(), isMobile: innerWidth < 600,
                player: { id: 'dark-atlas-reader', level: 100, position: { x: 40000, z: 40800 }, quests: [] },
                uiManager: { partyData: { members: [] } }, remotePlayers: new Map(), chunkManager: { getActiveEntities: () => [] } };
            const map = new WorldMap(engine); engine.worldMap = map; map.toggle();
            window.__darkJourney = { engine, map, chapter };
        });
        const search = page.getByRole('searchbox', { name: 'Find a known location' });
        const detail = page.getByRole('region', { name: 'Selected destination' });
        for (const name of ['Artificer Maelin', 'Scout Ren', 'Archmage Ilyra · Resonant Projection']) {
            await search.fill(name);
            await page.getByRole('button', { name: `■ ${name}`, exact: true }).click();
            await expect(detail).toContainText('Resonant Foothold');
        }
        await expect(detail).toContainText('click Complete Quest');
        await expect(detail).toContainText('Resonance XP');
        await page.getByRole('button', { name: 'Set personal waypoint' }).click();
        expect(await page.evaluate(() => {
            const p = window.__darkJourney.map.navigation.waypoint; return [p.x, p.z, p.instanceId];
        })).toEqual([40012, 40800, 'dark-realm']);
        await page.screenshot({ path: testInfo.outputPath('dark-camp-ilyra.png') });
        await page.evaluate(() => {
            const { engine, map, chapter } = window.__darkJourney;
            engine.player.quests = [{ id: chapter.id, title: chapter.title, type: chapter.type,
                target: chapter.item, accepted: true, count: 0, maxCount: chapter.count }];
            map.update(engine.player);
        });
        await search.fill('A Fare Nobody Owes');
        await page.getByRole('button', { name: '! A Fare Nobody Owes · district', exact: true }).click();
        await expect(detail).toContainText('Dissonant Shade');
        await expect(detail).toContainText('chance drops');
        await expect(detail).toContainText('kills alone do not collect it');
        await page.getByRole('button', { name: 'Set personal waypoint' }).click();
        expect(await page.evaluate(() => {
            const p = window.__darkJourney.map.navigation.waypoint; return [p.x, p.z];
        })).toEqual([40000, 40400]);
        await page.screenshot({ path: testInfo.outputPath('dark-collection-directions.png') });
        const bounds = await detail.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        if (width === 390) {
            // Keep actual mobile mode while rotating; width alone is not a
            // substitute for the phone's persisted input/layout mode.
            await page.setViewportSize({ width: 844, height: 390 });
            const waypoint = page.getByRole('button', { name: 'Set personal waypoint' });
            await waypoint.scrollIntoViewIfNeeded();
            await waypoint.click();
            await expect.poll(async () => (await page.locator('#world-map-canvas').boundingBox()).height).toBeGreaterThan(150);
            const pane = await page.locator('.atlas-navigation').boundingBox();
            const mapBounds = await page.locator('#world-map-canvas').boundingBox();
            expect(mapBounds.x).toBeGreaterThanOrEqual(pane.x + pane.width - 1);
            expect(mapBounds.width).toBeGreaterThan(300);
            const action = await waypoint.boundingBox();
            expect(action.y).toBeGreaterThanOrEqual(0); expect(action.y + action.height).toBeLessThanOrEqual(390);
            await expect(page.locator('#btn-close-world-map')).toBeVisible();
            await page.screenshot({ path: testInfo.outputPath('dark-directions-landscape.png') });
        }
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test(`atlas follows dungeon, raid, expedition, casino floors and arena at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async layouts => {
            const { WorldMap } = await import('/src/ui/WorldMap.js');
            const { darkRealmFixture } = await import('/tests/darkRealmFixture.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', innerWidth < 600);
            const engine = { player: { id: 'self', position: { x: 0, y: 0, z: 200 }, quests: [] }, isMobile: innerWidth < 600,
                currentInstanceId: '', currentInstanceType: 'overworld', uiManager: { partyData: { members: [] } },
                remotePlayers: new Map(), chunkManager: { getActiveEntities: () => [] }, getDungeonRoomSummary() { return this.summary; } };
            const map = new WorldMap(engine); engine.worldMap = map; map.toggle();
            window.__interiorAtlas = { map, engine, layouts, dark: darkRealmFixture(), set(type) {
                engine.currentInstanceId = `fixture-${type === 'casino-vip' ? 'casino-public' : type}`;
                engine.currentInstanceType = type.startsWith('casino') ? 'casino' : type;
                engine.currentDungeonLayout = type === 'dark_realm' ? this.dark : type === 'pvp_arena'
                    ? { rooms: [], walkRects: [{ x: 0, z: 0, width: 50.5, height: 34.5 }] }
                    : this.layouts.find(f => f.dungeonType === type)?.layout;
                const rooms = engine.currentDungeonLayout?.rooms || [];
                engine.summary = ['molten_core', 'earth_crystal_raid'].includes(type) ? {
                    currentRoomIndex: 0, objectiveRoomIndex: 1,
                    rooms: rooms.map((r, index) => ({ ...r, index, explored: index < 2, cleared: index === 0 }))
                } : null;
                engine.casino = { floor: type === 'casino-vip' ? 'vip' : 'public', vipActive: true,
                    data: { tables: ['public', 'vip'].flatMap(floor => ['slots', 'blackjack', 'poker', 'roulette', 'baccarat'].map((game, i) =>
                        ({ id: `${floor}-${game}`, floor, game, x: i * 12 - 24, z: 152 }))) } };
                const p = type.startsWith('casino') ? { x: 0, z: 152 } : rooms[0] || { x: 0, z: 0 };
                engine.player.position = { x: p.x, z: p.z, y: type === 'casino-vip' ? 8 : 0 };
                map.update(engine.player); map.showWorldOverview();
            } };
        }, layouts);
        for (const type of ['molten_core', 'earth_crystal_raid', 'dark_realm', 'casino-public', 'casino-vip', 'pvp_arena']) {
            await page.evaluate(type => window.__interiorAtlas.set(type), type);
            await expect(page.getByRole('button', { name: 'Area overview' })).toBeEnabled();
            const before = await page.evaluate(() => window.__interiorAtlas.map.scale);
            await page.getByRole('button', { name: 'Zoom map in' }).click();
            expect(await page.evaluate(() => window.__interiorAtlas.map.scale)).toBeGreaterThan(before);
            await page.getByRole('button', { name: 'Area overview' }).click();
            const state = await page.evaluate(async () => {
                const { engine, map } = window.__interiorAtlas;
                const { getInstanceAtlas } = await import('/src/ui/InstanceAtlas.js');
                const model = getInstanceAtlas(engine), project = map._makeWorldToScreen(map.canvas.width / 2, map.canvas.height / 2);
                return { count: model.floors.length, title: model.title,
                    corners: model.floors.flatMap(r => [project(r.left, r.top), project(r.right, r.top), project(r.right, r.bottom), project(r.left, r.bottom)]),
                    width: map.canvas.width, height: map.canvas.height,
                    destinations: map.navigation.locations.map(p => ({ id: p.id, name: p.name, instanceId: p.instanceId })), instanceId: engine.currentInstanceId };
            });
            expect(state.count).toBeGreaterThan(0);
            expect(state.destinations.every(p => p.instanceId === state.instanceId)).toBe(true);
            expect(state.destinations.some(p => ['forge', 'stash', 'molten_core'].includes(p.id))).toBe(false);
            if (type === 'dark_realm') {
                expect(state.destinations.filter(p => p.id.startsWith('court-'))).toHaveLength(4);
                expect(await page.evaluate(async () => {
                    const {getInstanceAtlas} = await import('/src/ui/InstanceAtlas.js');
                    const model = getInstanceAtlas(window.__interiorAtlas.engine);
                    return {paths: model.paths.length, court: model.locations.find(p => p.id === 'court-shore')};
                })).toMatchObject({paths: 10, court: {x: 39900, z: 40552, category: 'places'}});
            }
            for (const p of state.corners) {
                expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(state.width);
                expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(state.height);
            }
            if (type === 'molten_core') {
                await page.setViewportSize({ width, height: height - 80 });
                await page.waitForFunction(oldHeight => window.__interiorAtlas.map.canvas.height !== oldHeight, state.height);
                expect(await page.evaluate(async () => {
                    const { engine, map } = window.__interiorAtlas;
                    const { getInstanceAtlas } = await import('/src/ui/InstanceAtlas.js');
                    const project = map._makeWorldToScreen(map.canvas.width / 2, map.canvas.height / 2);
                    return getInstanceAtlas(engine).floors.flatMap(r => [project(r.left, r.top), project(r.right, r.bottom)])
                        .every(p => p.x >= 0 && p.y >= 0 && p.x <= map.canvas.width && p.y <= map.canvas.height);
                })).toBe(true);
                await page.setViewportSize({ width, height });
                await page.waitForFunction(oldHeight => window.__interiorAtlas.map.canvas.height === oldHeight, state.height);
            }
            if (type.startsWith('casino')) {
                const floor = type.endsWith('vip') ? 'vip' : 'public';
                expect(state.destinations.filter(p => p.id.startsWith('table-')).every(p => p.id.startsWith(`table-${floor}-`))).toBe(true);
            }
            // Dimensions and projected geometry alone do not prove that the
            // browser retained the rendered bitmap after a resize.
            await expect.poll(() => page.evaluate(() => {
                const { map } = window.__interiorAtlas;
                const pixels = map.ctx.getImageData(8, 8, Math.min(250, map.canvas.width - 8), 24).data;
                let ink = 0, opaque = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i + 3] === 255) opaque++;
                    if (pixels[i] > 100 && pixels[i + 3] === 255) ink++;
                }
                return opaque > 1000 && ink > 30;
            }), { message: `${type} retains its opaque map and visible title` }).toBe(true);
            await page.screenshot({ path: testInfo.outputPath(`atlas-${type}.png`) });
        }
        await page.evaluate(() => {
            const { engine, map } = window.__interiorAtlas;
            engine.currentInstanceId = ''; engine.currentInstanceType = 'overworld'; engine.player.position = { x: 0, z: 200 };
            map.update(engine.player);
        });
        await expect(page.getByRole('button', { name: 'World overview' })).toBeEnabled();
        expect(await page.evaluate(() => window.__interiorAtlas.map.navigation.locations.some(p => p.id === 'forge'))).toBe(true);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
