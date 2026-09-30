import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Actual input/settings and shipped styles; prepared callbacks, no economy writes.
for (const [width, height] of [[1280, 800], [390, 844]]) {
    test(`${width}: account fields remain named and keyboard navigable without disabling browser zoom`, async ({ page, baseURL }) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.getByLabel('Username', { exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect(page.locator('#auth-email')).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Register', exact: true })).toBeFocused();
        await expect(page.locator('#auth-status')).toHaveAttribute('aria-live', 'polite');
        const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
        expect(viewport).not.toContain('user-scalable=no');
        expect(viewport).not.toContain('maximum-scale=1');
        // Viewing only: no login/registration/account mutation is submitted.
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test(`${width}: keyboard remapping preserves native controls and survives a reload`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.setViewportSize({ width, height });
        const boot = async () => page.evaluate(async mobile => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            const { InputManager } = await import('/src/core/InputManager.js');
            document.body.classList.toggle('mobile-mode', mobile);
            document.getElementById('start-screen').style.display = 'none';
            const ui = new UIManager(mobile), input = new InputManager(null, null), casts = [];
            input.subscribe('onHotbar', slot => casts.push(slot));
            input.subscribe('onEscape', () => ui.handleEscape());
            ui.showHUD(); ui.toggleChat(true); ui.toggleSettings();
            if (mobile) ui.phoneSettings.show('play');
            window.__keyboardReview = { ui, input, casts };
        }, width < 600);
        await page.goto('/', { waitUntil: 'networkidle' });
        await boot();
        await page.locator('#motion-preference').selectOption('reduced');
        expect(await page.evaluate(async () => {
            const { prefersReducedMotion } = await import('/src/core/MotionPreference.js');
            return prefersReducedMotion();
        })).toBe(true);
        const controls = page.locator('#keyboard-bindings');
        await controls.locator('summary').click();
        const slot = controls.locator('[data-binding-action="hotbar0"]');
        await slot.selectOption('q');
        await expect(controls.getByRole('status')).toContainText('saved for this device');
        await expect(page.locator('.hotbar-key').first()).toHaveText('Q');
        await slot.focus(); await page.keyboard.press('q');
        expect(await page.evaluate(() => window.__keyboardReview.casts)).toEqual([]);
        await slot.selectOption('c');
        await expect(controls.getByRole('status')).toContainText('already used for Character');
        await expect(slot).toHaveValue('q');
        expect(await slot.evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        expect(await controls.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('keyboard-bindings.png') });
        await page.locator('#btn-close-settings-header').click();
        await expect(page.locator('#settings-screen')).toBeHidden();
        await page.keyboard.press('q'); await page.keyboard.press('1');
        expect(await page.evaluate(() => window.__keyboardReview.casts)).toEqual([0]);
        await page.evaluate(() => {
            const { input, ui } = window.__keyboardReview;
            input.dispose(); ui.characterPreview.dispose();
        });
        await page.reload({ waitUntil: 'networkidle' });
        await boot();
        await expect(page.locator('#motion-preference')).toHaveValue('reduced');
        expect(await page.evaluate(() => window.__keyboardReview.input.keyboardBindings.hotbar0)).toBe('q');
        await controls.locator('summary').click();
        await expect(slot).toHaveValue('q');
        await controls.getByRole('button', { name: 'Restore default bindings' }).click();
        await expect(slot).toHaveValue('1');
        await expect(page.locator('.hotbar-key').first()).toHaveText('1');
        await page.evaluate(() => { const { input, ui } = window.__keyboardReview; input.dispose(); ui.characterPreview.dispose(); });
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
