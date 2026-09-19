import { test, expect } from '@playwright/test';

// Presentation fixture only: real component/window layout, synthetic responses.
// Authorization is covered separately by the server tests, not by this fixture.
test.use({ launchOptions: { executablePath: '/usr/bin/google-chrome',
    args: ['--disable-gpu', '--disable-webgl', '--disable-software-rasterizer'] } });

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    test(`administration is scrollable and bounded at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
        page.setDefaultTimeout(10_000);
        await page.route('**/src/main.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize(viewport);
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { AdminUI } = await import('/src/ui/AdminUI.js');
            const { installUIManagerWindows } = await import('/src/ui/UIManagerWindows.js');
            class LayoutUI { playUICue() {} }
            installUIManagerWindows(LayoutUI);
            const ui = new LayoutUI();
            ui.uiLayer = document.getElementById('ui-layer');
            ui.isMobile = window.innerWidth < 900;
            document.body.classList.toggle('mobile-mode', ui.isMobile);
            document.getElementById('start-screen').style.display = 'none';
            document.getElementById('esc-menu').style.display = 'block';
            ui.admin = new AdminUI({ host: ui.uiLayer, launcher: document.getElementById('btn-administration'),
                send: (type, payload) => setTimeout(() => ui.admin.handleResult(`${type}_result`, {
                    id: payload.id, success: true, authorized: true,
                    ...(type === 'admin_status' ? { account: 'realm-operator', items: [
                        { id: 'iron-sword', name: 'Iron Sword', material: false },
                        { id: 'eidolic-shard', name: 'Eidolic Shard', material: true }
                    ] } : {}),
                    ...(['admin_grant_gold', 'admin_grant_item', 'admin_teleport'].includes(type) ? {
                        final: true, message: 'Synthetic presentation result: change saved.'
                    } : {}),
                    ...(type === 'admin_players' ? { players: Array.from({ length: 50 }, (_, index) => ({
                        account: `realm-warden-${index}`, name: `Lanternhold Defender ${index}`, class: 'Fighter', level: 70
                    })), next: 'realm-warden-49' } : {}),
                    ...(type === 'admin_history' ? { history: { entries: Array.from({ length: 50 }, (_, index) => ({
                        actor: 'realm-operator', action: 'admin_players', result: 'success', at: '2026-09-19T12:00:00Z',
                        summary: `Online players refreshed. Read ${index}.`
                    })), next: 'history-cursor', retentionDays: 90 } } : {})
                }), 0),
                openWindow: element => ui.toggleStaticModal(element, 'flex'),
                closeWindow: element => ui.closeStaticModal(element) });
            ui.registerWindowLayouts();
            ui.admin.connectionState('connected');
            window.__adminLayout = ui;
        });
        await page.getByRole('button', { name: 'Administration', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Administration', exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('li')).toHaveCount(50);
        const box = await dialog.boundingBox();
        const header = await dialog.locator('.window-header').boundingBox();
        const body = await dialog.locator('.administration-body').boundingBox();
        expect(body.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await dialog.locator('li').last().scrollIntoViewIfNeeded();
        await expect(dialog.locator('li').last()).toBeInViewport();
        await dialog.getByRole('button', { name: 'Refresh players' }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('administration.png') });
        await dialog.getByRole('button', { name: 'Activity history', exact: true }).click();
        await expect(dialog.locator('li')).toHaveCount(50);
        await expect(dialog.locator('li').first()).toContainText('admin_players · success');
        await expect(dialog.getByLabel('Exact account')).toBeVisible();
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('administration-history.png') });
        const operations = dialog.locator('.administration-operations');
        await operations.locator('summary').click();
        await operations.getByLabel('Target account', { exact: true }).fill('realm-warden-0');
        await operations.getByLabel('Reason', { exact: true }).fill('Restore a verified missing quest reward.');
        await operations.getByRole('button', { name: 'Review change', exact: true }).click();
        const confirm = operations.getByRole('button', { name: 'Confirm change', exact: true });
        await expect(confirm).toBeFocused();
        await expect(operations.locator('[data-summary]')).toContainText('100 Gold to realm-warden-0');
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const target = await confirm.boundingBox();
        expect(target.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: testInfo.outputPath('administration-confirm.png') });
        await confirm.click();
        await expect(operations.locator('[data-result]')).toContainText('change saved');
        await operations.getByRole('combobox', { name: 'Operation', exact: true }).selectOption('item');
        await operations.getByRole('combobox', { name: 'Item', exact: true }).selectOption('eidolic-shard');
        await expect(operations.getByRole('combobox', { name: 'Rarity', exact: true })).toHaveValue('Eidolic');
        await expect(operations.getByLabel('Quantity', { exact: true })).toHaveAttribute('max', '1000');
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await dialog.getByRole('button', { name: 'Close administration' }).click();
        await expect(dialog).toBeHidden();
        await page.evaluate(() => window.__adminLayout.admin.connectionState('reconnecting'));
        await expect(page.getByRole('button', { name: 'Administration', exact: true })).toBeHidden();
    });
}
