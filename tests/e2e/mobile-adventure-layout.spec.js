import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, actionTimeout: 12_000 });
for (const [width, height] of [[360, 800], [390, 844], [844, 390]]) {
    test(`${width}x${height}: phone adventure choices remain readable with reachable deliberate actions`, async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.body.classList.add('mobile-mode'); document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true); window.__phoneAdventure = ui;
            ui.showHUD(); ui.toggleChat(true); ui.setUiScale(125);
            window.__adventureSent = [];
            window.game = { socket: { send: message => window.__adventureSent.push(JSON.parse(message)) },
                network: { send: (type, payload) => window.__adventureSent.push({ type, payload }) } };
            ui.showDungeonMenu({ playerLevel: 100, isLeader: true, hasInstance: false, elementalRaidAccess: { earth_crystal_raid: true } });
        });
        const menu = page.locator('#dungeon-menu'), scroll = menu.locator('.adventure-scroll');
        const enter = page.locator('#btn-enter-dungeon');
        const checkFrame = async () => {
            const bounds = await menu.boundingBox(), chat = await page.locator('#chat-box').boundingBox();
            expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(chat.y);
            expect(await scroll.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
            expect((await scroll.boundingBox()).height).toBeGreaterThan(60);
            await expect(page.locator('#btn-close-dungeon-menu')).toBeInViewport();
        };
        await checkFrame(); await expect(enter).toBeInViewport();
        expect(await page.locator('label[for="dungeon-type-select"]').evaluate(n => getComputedStyle(n).fontSize)).toBe('20px');
        await page.locator('#dungeon-type-select').selectOption('abyssal_well');
        await page.locator('#dungeon-run-level-select').selectOption('60');
        await page.locator('#diff-btn-heroic').tap();
        await expect(menu.locator('.phone-adventure-summary')).toHaveText('Abyssal Well · Heroic · Level 60');
        await menu.locator('summary').filter({ hasText: 'Difficulty & rewards' }).tap();
        await expect(page.locator('#difficulty-info-box')).toContainText('Heroic Mode');
        const remembered = await scroll.evaluate(n => n.scrollTop);
        await page.getByRole('tab', { name: 'Raids', exact: true }).tap();
        await expect(enter).toBeHidden();
        await expect(page.locator('[data-raid-type="water_crystal_raid"] button').first()).toBeDisabled();
        const earth = page.locator('[data-raid-type="earth_crystal_raid"]');
        await earth.getByRole('button', { name: 'Form Elemental Raid' }).tap();
        expect(await page.evaluate(() => window.__adventureSent)).toEqual([{ type: 'raid_convert', payload: { raidType: 'earth_crystal_raid' } }]);
        await checkFrame();
        await page.screenshot({ path: `/tmp/eidolon-phone-adventure-raids-${width}.png` });
        await page.getByRole('tab', { name: 'Dungeons', exact: true }).tap();
        expect(await scroll.evaluate(n => n.scrollTop)).toBeCloseTo(remembered, 0);
        await expect(enter).toBeInViewport();
        expect((await enter.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await checkFrame();
        await page.screenshot({ path: `/tmp/eidolon-phone-adventure-dungeons-${width}.png` });
        await enter.tap();
        expect(await page.evaluate(() => window.__adventureSent.at(-1))).toEqual({ type: 'enter_dungeon',
            payload: { dungeonType: 'abyssal_well', difficulty: 'heroic', runLevel: 60 } });

        await page.evaluate(() => window.__phoneAdventure.showDungeonMenu({ playerLevel: 100, isLeader: true, hasInstance: true,
            activeRun: { dungeonType: 'verdant_bastion_catacombs', difficulty: 'normal', runLevel: 30 } }));
        await page.locator('#btn-reset-dungeon').tap();
        await expect(page.locator('#btn-cancel-dungeon-reset')).toBeInViewport();
        await expect(page.locator('#btn-confirm-dungeon-reset')).toBeInViewport();
        await page.screenshot({ path: `/tmp/eidolon-phone-adventure-reset-${width}.png` });
        await page.locator('#btn-cancel-dungeon-reset').tap();
        expect(await page.evaluate(() => window.__adventureSent.some(m => m.type === 'reset_dungeon'))).toBe(false);
        await page.locator('#btn-reset-dungeon').tap(); await page.locator('#btn-confirm-dungeon-reset').tap();
        await expect(menu).toHaveCount(0);
        expect(await page.evaluate(() => window.__adventureSent.at(-1))).toEqual({ type: 'reset_dungeon', payload: {} });
        await page.evaluate(() => window.__phoneAdventure.showDungeonMenu({ playerLevel: 30, isLeader: true }));
        await page.locator('#chat-mobile-toggle').tap(); await expect(menu).toHaveCount(0);
        await expect(page.locator('#chat-input')).toBeVisible();
        await page.evaluate(() => window.__phoneAdventure.characterPreview.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
