import { expect, test } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true });

test('phone HUD keeps thumb targets and expandable permanent chat usable in both orientations', async ({ page }, testInfo) => {
    for (const [width, height] of [[390, 844], [844, 390]]) {
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            const { Minimap } = await import('/src/ui/Minimap.js');
            document.body.classList.add('mobile-mode');
            document.getElementById('start-screen').style.display = 'none';
            window.__phoneUI = new UIManager(true);
            window.__phoneMinimap = new Minimap();
            window.__phoneInput = new InputManager(null, null);
            window.__phoneInput.setupMobileControls();
            window.__phoneInput.subscribe('onEscape', () => window.__phoneUI.handleEscape());
            window.__phoneUI.showHUD();
            window.__phoneUI.toggleChat(true);
        });
        await page.screenshot({ path: testInfo.outputPath(`phone-hud-${width}-${height}.png`) });
        const targets = page.locator('#mobile-ui .mobile-btn, #hotbar-container .hotbar-slot');
        for (const target of await targets.all()) {
            await expect(target).toBeInViewport();
            const bounds = await target.boundingBox();
            expect(bounds.width).toBeGreaterThanOrEqual(44);
            expect(bounds.height).toBeGreaterThanOrEqual(44);
            expect(await target.evaluate(element => {
                const rect = element.getBoundingClientRect();
                return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
            })).toBe(true);
        }
        const toggle = page.getByRole('button', { name: 'Open chat history' });
        await expect(toggle).toBeVisible();
        expect((await page.locator('#chat-box').boundingBox()).height).toBeLessThanOrEqual(56);
        await page.evaluate(() => window.__phoneUI.chat.addMessage('Ilyra', 'The crystals need you.'));
        await expect(toggle).toContainText('1 new');
        await toggle.tap();
        await expect(page.locator('#chat-messages')).toBeVisible();
        await expect(page.locator('#chat-messages')).toContainText('The crystals need you.');
        await expect(page.locator('#chat-input')).toBeInViewport();
        await page.getByRole('button', { name: 'Collapse chat history' }).tap();
        await expect(toggle).toBeVisible();
        await expect(page.locator('#chat-box')).toBeVisible();
        await page.getByRole('button', { name: 'Menu', exact: true }).tap();
        await expect(page.locator('#esc-menu')).toBeVisible();
        await page.getByRole('button', { name: 'Skills & Runes', exact: true }).tap();
        await expect(page.locator('#esc-menu')).toBeHidden();
        await expect(page.locator('#skill-tree-window')).toBeVisible();
        await page.locator('#btn-close-skills').tap();
        await expect(page.locator('#skill-tree-window')).toBeHidden();
        await page.evaluate(() => {
            window.__phoneUI.onMobileTargetClear = () => {
                window.__targetCleared = true;
                document.getElementById('combat-intent-panel').style.display = 'none';
            };
            document.getElementById('combat-intent-name').textContent = 'Selected Skeleton';
            document.getElementById('combat-intent-status').textContent = 'In range';
            document.getElementById('combat-intent-panel').style.display = 'block';
        });
        await page.screenshot({ path: testInfo.outputPath(`phone-target-${width}-${height}.png`) });
        const clearTarget = page.getByRole('button', { name: 'Clear target and cancel pursuit' });
        const clearBounds = await clearTarget.boundingBox();
        expect(clearBounds.width).toBeGreaterThanOrEqual(44);
        expect(clearBounds.height).toBeGreaterThanOrEqual(44);
        await clearTarget.tap();
        expect(await page.evaluate(() => window.__targetCleared)).toBe(true);
        await expect(page.locator('#combat-intent-panel')).toBeHidden();
        await page.evaluate(() => window.__phoneInput.dispose());
    }
});
