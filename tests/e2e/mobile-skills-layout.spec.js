import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.use({ hasTouch: true, isMobile: true, actionTimeout: 12_000 });
for (const [width, height] of [[360, 800], [390, 844], [844, 390]]) {
    test(`${width}x${height}: phone build sections stay readable with deliberate confirmed actions`, async ({ page, context, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        // Layout fixture only. Acknowledgements below are simulated, not earned progression.
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(true);
            const player = { id: 'phone-build-layout', subType: 'Fighter', level: 100, selectedBranch: 'A', talentRanks: {}, skillRunes: {},
                unlockedSkills: ['Charge', 'Whirlwind', 'Shield Slam', 'Iron Fortress', 'Guardian Roar'] };
            ui.lastPlayerRef = player; ui.showHUD(); ui.toggleChat(true); ui.skillTree.toggle();
            const calls = [];
            ui.skillTree.onSelectBranch = (branch, requestId) => calls.push({ branch, requestId });
            window.__phoneBuild = { ui, player, calls };
        });
        const windowPanel = page.locator('#skill-tree-window'), content = page.locator('#skill-tree-content');
        const tabs = page.locator('.phone-build-tabs');
        for (const button of await tabs.locator('button').all()) {
            expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
            await expect(button).toBeInViewport();
        }
        expect(await content.locator('p').first().evaluate(n => getComputedStyle(n).fontSize)).toBe('16px');
        const cdp = await context.newCDPSession(page), box = await content.boundingBox();
        try {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 91, x: box.x + 80, y: box.y + box.height - 20 }] });
            for (let i = 1; i <= 6; i++) {
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 91, x: box.x + 80, y: box.y + box.height - 20 - i * (box.height - 40) / 6 }] });
                await page.waitForTimeout(25);
            }
        } finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach(); }
        await expect.poll(() => content.evaluate(n => n.scrollTop)).toBeGreaterThan(10);
        await tabs.getByRole('button', { name: 'Talents', exact: true }).tap();
        await expect(content).toContainText('Talent training');
        await tabs.getByRole('button', { name: 'Runes', exact: true }).tap();
        await page.locator('#phone-rune-skill').selectOption('Iron Fortress');
        await expect(content.locator('article')).toHaveCount(3);
        const firstEquip = content.getByRole('button', { name: 'Equip rune', exact: true }).first();
        await firstEquip.scrollIntoViewIfNeeded();
        expect((await firstEquip.boundingBox()).height).toBeGreaterThanOrEqual(44);
        expect(await firstEquip.evaluate(node => {
            const box = node.getBoundingClientRect();
            return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
        }), 'Rune action is not clipped or covered').toBe(true);
        await page.screenshot({ path: `/tmp/eidolon-phone-skills-runes-${width}.png` });
        await tabs.getByRole('button', { name: 'Skills', exact: true }).tap();
        const choose = page.locator('[data-build-action="branch:B"]');
        await choose.scrollIntoViewIfNeeded(); await choose.tap();
        await expect(choose).toBeDisabled(); await expect(page.locator('.phone-build-feedback')).toContainText('Waiting for the server');
        await page.evaluate(() => {
            const { ui, player, calls } = window.__phoneBuild;
            player.selectedBranch = 'B'; ui.skillTree.handleBuildActionResult({ requestId: calls[0].requestId, ok: true });
        });
        await expect(page.locator('.phone-build-feedback')).toContainText('Confirmed');
        expect(await content.evaluate(n => n.scrollWidth <= n.clientWidth)).toBe(true);
        const chat = await page.locator('#chat-box').boundingBox(), panel = await windowPanel.boundingBox();
        expect(panel.y + panel.height).toBeLessThanOrEqual(chat.y);
        await page.screenshot({ path: `/tmp/eidolon-phone-skills-branch-${width}.png` });
        await page.locator('#btn-close-skills').tap(); await expect(windowPanel).not.toBeVisible();
        await page.evaluate(() => window.__phoneBuild.ui.characterPreview.dispose());
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
