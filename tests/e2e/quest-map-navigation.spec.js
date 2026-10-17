import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, mobile] of [[1280, false], [390, true]]) test.describe(`Quest map ${width}`, () => {
    test.use({ viewport: { width, height: 844 }, hasTouch: mobile, isMobile: mobile });
    test('journal quest focus preserves tracking and the previous atlas view', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { WorldMap } = await import('/src/ui/WorldMap.js');
            const { UIBindings } = await import('/src/core/UIBindings.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const THREE = await import('three');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', mobile);
            const quests = [
                { id: 'chronicle_earth_returning_scar', category: 'chronicle', chapter: 2, type: 'INVESTIGATE',
                    title: 'The Scar That Grows Back', accepted: true, count: 2, maxCount: 3, investigationMask: 5 },
                { id: 'daily_skeleton', title: 'Road patrol', type: 'KILL', target: 'Skeleton', accepted: true, count: 0, maxCount: 10 },
                { id: 'chronicle_15_dark_king', category: 'chronicle', chapter: 15, title: 'UNSEEN FUTURE', accepted: false }
            ];
            const ui = new UIManager(mobile);
            const player = { id: 'quest-map-reader', level: 30, position: { x: 0, y: 0, z: 200 },
                rotation: { x: 0, y: 0, z: 0, w: 1 }, quests };
            const engine = { isMobile: mobile, player, uiManager: ui, currentInstanceId: '', currentInstanceType: 'overworld',
                chunkManager: { getActiveEntities: () => [] }, inputManager: { clearInputState() {} } };
            window.game = engine; ui.lastPlayerRef = player; ui.showHUD();
            const input = new InputManager(new THREE.OrthographicCamera(), new THREE.Scene(), document.getElementById('world-map-canvas'));
            input.subscribe('onEscape', () => ui.handleEscape()); input.subscribe('onMap', () => ui.toggleWorldMap());
            input.subscribe('onQuest', () => ui.toggleJournal()); if (mobile) input.setupMobileControls();
            engine.inputManager = input;
            engine.worldMap = new WorldMap(engine); new UIBindings(engine).bindMapCallbacks();
            ui.quest.updateJournal(quests);
            window.__questMap = { engine, ui, input, map: engine.worldMap, saved: JSON.stringify(quests) };
        }, mobile);
        const activate = async locator => mobile ? locator.tap() : locator.click();
        const openMenu = async name => {
            if (mobile) { await page.locator('#btn-mobile-menu').tap(); await page.locator(`#btn-mobile-${name}`).tap(); }
            else await page.locator(`#btn-menu-${name}`).click();
        };
        await openMenu('map');
        const atlas = page.getByRole('dialog', { name: 'World atlas' });
        const search = atlas.getByRole('searchbox', { name: 'Find a known location' });
        await search.fill('Forge');
        await atlas.getByRole('checkbox', { name: '! Quests', exact: true }).uncheck();
        await activate(page.locator('#btn-close-world-map'));
        await openMenu('quest');
        await page.locator('#quest-journal [data-quest-track="chronicle_earth_returning_scar"]').uncheck();
        await activate(page.getByRole('button', { name: 'Lore Book', exact: true }));
        const book = page.getByRole('region', { name: 'Lore book', exact: true });
        const show = book.getByRole('button', { name: 'Show quest on map', exact: true });
        if (mobile) await show.tap(); else { await show.focus(); await page.keyboard.press('Enter'); }
        await expect(atlas).toBeVisible();
        const detail = atlas.getByRole('region', { name: 'Selected destination' });
        await expect(detail.getByRole('heading', { name: 'New growth', exact: true })).toBeFocused();
        await expect(detail).toContainText('Selected · The Scar That Grows Back');
        await expect(atlas).not.toContainText('UNSEEN FUTURE');
        const before = await page.evaluate(() => {
            const { ui, engine, map } = window.__questMap;
            return { stored: localStorage.getItem(ui.quest.trackingStorageKey), tracked: ui.quest.getTrackedObjectives().map(q => q.id),
                waypoint: map.navigation.waypoint, quests: JSON.stringify(engine.player.quests), focus: map.navigation.questFocusId };
        });
        expect(before.tracked).toEqual(['daily_skeleton']); expect(JSON.parse(before.stored)).toEqual(['daily_skeleton']);
        expect(before.waypoint).toBeNull(); expect(before.focus).toBe('chronicle_earth_returning_scar');
        await page.screenshot({ path: testInfo.outputPath('quest-selected-map.jpg'), type: 'jpeg', quality: 90 });

        // Controlled personal-state refresh exercises the production projection;
        // this fixture does not claim an earned discovery or a server reward.
        await page.evaluate(() => {
            const { ui, engine, map } = window.__questMap;
            engine.player.quests[0].count = 3; engine.player.quests[0].investigationMask = 7;
            ui.quest.updateJournal(engine.player.quests); map.update(engine.player);
        });
        await expect(detail.getByRole('heading', { name: 'Turn in · The Scar That Grows Back', exact: true })).toBeFocused();
        await expect(detail).toContainText('Complete Quest');
        expect(await page.evaluate(() => window.__questMap.engine.player.quests[0].completed)).not.toBe(true);
        await page.screenshot({ path: testInfo.outputPath('quest-turn-in-map.jpg'), type: 'jpeg', quality: 90 });
        await activate(atlas.getByRole('button', { name: 'Return to map', exact: true }));
        await expect(search).toHaveValue('Forge'); await expect(search).toBeFocused();
        expect(await page.evaluate(() => window.__questMap.map.navigation.filters.has('quests'))).toBe(false);
        expect(await page.evaluate(() => window.__questMap.ui.quest.getTrackedObjectives().map(q => q.id))).toEqual(['daily_skeleton']);
        await activate(page.locator('#btn-close-world-map'));
        await openMenu('map');
        expect(await page.evaluate(() => {
            const { map, engine } = window.__questMap;
            return { focused: map.navigation.questFocusId, centered: map.cameraX === engine.player.position.x && map.cameraZ === engine.player.position.z };
        })).toEqual({ focused: null, centered: true });
        const bounds = await atlas.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1); expect(bounds.y + bounds.height).toBeLessThanOrEqual(845);
        await activate(page.locator('#btn-close-world-map'));
        await page.evaluate(() => {
            const { engine, ui } = window.__questMap;
            engine.player.quests.push({ id: 'chronicle_earth_keepers_house', title: 'The Keeper’s Empty House', category: 'chronicle',
                legacyOptional: true, type: 'INVESTIGATE', accepted: true, count: 0, maxCount: 1, investigationMask: 0 });
            ui.quest.updateJournal(engine.player.quests);
        });
        await openMenu('quest');
        await activate(page.getByRole('button', { name: 'Story', exact: true }));
        const optional = page.locator('[data-quest-map="chronicle_earth_keepers_house"]');
        if (mobile) await optional.tap(); else { await optional.focus(); await page.keyboard.press('Enter'); }
        await expect(atlas).toBeVisible();
        expect(await page.evaluate(() => window.__questMap.map.navigation.questFocusId)).toBe('chronicle_earth_keepers_house');
        expect(await page.evaluate(() => window.__questMap.ui.quest.getTrackedObjectives().map(q => q.id))).toEqual(['daily_skeleton']);
        await expect(detail).toContainText('Selected · The Keeper’s Empty House');
        await page.screenshot({ path: testInfo.outputPath('optional-quest-map.jpg'), type: 'jpeg', quality: 90 });
        await activate(page.locator('#btn-close-world-map'));
        // A controlled Dark Realm snapshot checks the same visible control in
        // an instance map. It does not claim earned admission or completion.
        await page.evaluate(async () => {
            const { darkRealmFixture } = await import('/tests/darkRealmFixture.js');
            const { engine, ui } = window.__questMap;
            engine.currentInstanceId = 'dark-realm'; engine.currentInstanceType = 'dark_realm';
            engine.currentDungeonLayout = darkRealmFixture(); engine.player.level = 100;
            engine.player.position = { x: 40000, y: 0, z: 40800 };
            engine.player.quests = [
                { id: 'chronicle_dark_shore_collectors', title: 'Shore collectors', category: 'chronicle', chapter: 100,
                    type: 'KILL', accepted: true, completed: false, count: 3, maxCount: 3 },
                engine.player.quests.find(quest => quest.id === 'daily_skeleton')
            ];
            ui.quest.updateJournal(engine.player.quests);
        });
        await openMenu('quest');
        const dark = page.locator('.chronicle-journal [data-quest-map="chronicle_dark_shore_collectors"]');
        if (mobile) await dark.tap(); else { await dark.focus(); await page.keyboard.press('Enter'); }
        await expect(atlas).toBeVisible();
        await expect(detail.getByRole('heading', { name: 'Turn in · Shore collectors', exact: true })).toBeFocused();
        await expect(detail).toContainText('Resonant Projection');
        expect(await page.evaluate(() => {
            const { engine, ui, map } = window.__questMap;
            return { instance: map.navigation.locations.find(p => p.id === map.navigation.selectedId).instanceId,
                tracked: ui.quest.getTrackedObjectives().map(quest => quest.id), completed: engine.player.quests[0].completed,
                waypoint: map.navigation.waypoint };
        })).toEqual({ instance: 'dark-realm', tracked: ['daily_skeleton'], completed: false, waypoint: null });
        await page.screenshot({ path: testInfo.outputPath('dark-quest-turn-in-map.jpg'), type: 'jpeg', quality: 90 });
        await page.evaluate(() => {
            const { ui, map, input } = window.__questMap; map.dispose(); input.dispose(); ui.dispose(); delete window.__questMap; delete window.game;
        });
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
