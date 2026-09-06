import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, actionTimeout: 12_000 });
for (const [width, height] of [[360, 800], [390, 844], [844, 390]]) {
    test(`${width}x${height}: phone settings and larger menu text stay reachable`, async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.body.classList.add('mobile-mode'); document.getElementById('start-screen').style.display = 'none';
            localStorage.setItem('eidolon.uiScale', '85');
            const ui = new UIManager(true); window.__phoneSettings = ui;
            ui.showHUD(); ui.toggleChat(true); ui.toggleEscMenu(); ui.toggleSettings();
        });
        const panel = page.locator('#settings-screen'), body = panel.locator('.support-window__body--settings');
        const tabs = panel.locator('.phone-settings-tabs');
        await expect(page.locator('#esc-menu')).not.toBeVisible();
        expect(await panel.locator('label[for="graphics-quality"]').evaluate(n => getComputedStyle(n).fontSize)).toBe('16px');
        const scale = page.locator('#ui-scale');
        await scale.scrollIntoViewIfNeeded();
        const box = await scale.boundingBox();
        await page.touchscreen.tap(box.x + box.width - 4, box.y + box.height / 2);
        await expect(scale).toHaveValue('125');
        expect(await page.evaluate(() => localStorage.getItem('eidolon.uiScale'))).toBe('85');
        expect(await panel.locator('label[for="ui-scale"]').evaluate(n => getComputedStyle(n).fontSize)).toBe('20px');
        const screenScroll = await body.evaluate(n => n.scrollTop);
        await tabs.getByRole('button', { name: 'Play', exact: true }).tap();
        const autoLoot = page.locator('#auto-loot-enabled');
        await autoLoot.scrollIntoViewIfNeeded();
        expect((await autoLoot.boundingBox()).width).toBeGreaterThanOrEqual(44);
        await autoLoot.tap(); await expect(autoLoot).toBeChecked();
        await tabs.getByRole('button', { name: 'Screen', exact: true }).tap();
        expect(await body.evaluate(n => n.scrollTop)).toBeCloseTo(screenScroll, 0);
        for (const route of ['Sound', 'Device', 'Screen']) {
            await tabs.getByRole('button', { name: route, exact: true }).tap();
            expect(await body.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
        }
        for (const button of await tabs.locator('button').all()) {
            await expect(button).toBeInViewport();
            expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
            expect(await button.evaluate(n => getComputedStyle(n).whiteSpace)).toBe('nowrap');
        }
        const bounds = await panel.boundingBox(), chat = await page.locator('#chat-box').boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(chat.y);
        await page.screenshot({ path: `/tmp/eidolon-phone-settings-${width}.png` });
        await page.locator('#chat-mobile-toggle').tap();
        await expect(panel).not.toBeVisible(); await expect(page.locator('#chat-input')).toBeVisible();
        await page.locator('#chat-mobile-toggle').tap();
        await page.evaluate(() => window.__phoneSettings.toggleSettings());
        await page.locator('#btn-close-settings-header').tap(); await expect(panel).not.toBeVisible();
        await page.evaluate(() => {
            const ui = window.__phoneSettings;
            ui.lastPlayerRef = { id: 'large-build', subType: 'Fighter', level: 100, selectedBranch: 'A', talentRanks: {}, skillRunes: {}, unlockedSkills: ['Charge', 'Iron Fortress'] };
            ui.skillTree.toggle(); ui.skillTree.skillTreeMode = 'runes'; ui.skillTree.renderSkillTree('Fighter');
        });
        expect(await page.locator('#skill-tree-content p').first().evaluate(n => getComputedStyle(n).fontSize)).toBe('20px');
        const equip = page.locator('button[data-build-action^="rune:"]').first();
        await equip.scrollIntoViewIfNeeded(); await expect(equip).toBeInViewport();
        expect(await page.locator('#skill-tree-content').evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
        await page.screenshot({ path: `/tmp/eidolon-phone-large-build-${width}.png` });
        await page.evaluate(() => window.__phoneSettings.characterPreview.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
