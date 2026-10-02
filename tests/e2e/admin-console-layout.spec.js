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
                    ...(type === 'admin_chat_moderation_target' ? { target: {
                        accountId: 'abcdef012345678901234567', account: payload.target, revision: 2
                    } } : {}),
                    ...(type === 'admin_chat_moderation' ? { final: true,
                        message: 'Synthetic presentation result: chat decision recorded; case unchanged.' } : {}),
                    ...(type === 'admin_players' ? { players: Array.from({ length: 50 }, (_, index) => ({
                        account: `realm-warden-${index}`, name: `Lanternhold Defender ${index}`, class: 'Fighter', level: 70
                    })), next: 'realm-warden-49' } : {}),
                    ...(type === 'admin_history' ? { history: { entries: Array.from({ length: 50 }, (_, index) => ({
                        actor: 'realm-operator', action: 'admin_players', result: 'success', at: '2026-09-19T12:00:00Z',
                        summary: `Online players refreshed. Read ${index}.`
                    })), next: 'history-cursor', retentionDays: 90 } } : {}),
                    ...(type === 'admin_reports' ? { reports: { reports: Array.from({ length: 10 }, (_, index) => ({
                        id: String(index + (payload.before ? 10 : 0)).padStart(24, '0'), username: 'fixture-reporter',
                        reportType: payload.reportType || 'Bug Report', status: payload.status || 'open', createdAt: '2026-09-28T12:00:00Z',
                        text: '<img src=x onerror=alert(1)>\n' + 'long-text'.repeat(400)
                    })), next: payload.before ? '' : '000000000000000000000009' } } : {})
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
        await dialog.getByRole('button', {name: 'Player reports', exact: true}).click();
        await expect(dialog.locator('li')).toHaveCount(10);
        await dialog.locator('li summary').first().click();
        const json = dialog.locator('.administration-report-json').first();
        await expect(json).toBeVisible();
        expect(JSON.parse(await json.textContent()).status).toBe('open');
        await expect(dialog.locator('li img')).toHaveCount(0);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({path: testInfo.outputPath('administration-report-json.png')});
        const review = dialog.locator('.administration-review').nth(1);
        await review.locator('summary').click();
        await review.getByLabel('Private review reason', {exact: true}).fill('Inspected the supplied report evidence.');
        await review.getByRole('button', {name: 'Mark resolved', exact: true}).click();
        const keep = review.getByRole('button', {name: 'Keep unchanged', exact: true});
        await expect(keep).toBeFocused();
        const confirmReview = review.getByRole('button', {name: 'Confirm resolution', exact: true});
        await confirmReview.scrollIntoViewIfNeeded();
        expect((await confirmReview.boundingBox()).height).toBeGreaterThanOrEqual(44);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({path: testInfo.outputPath('administration-report-review.png')});
        await keep.click();
        await expect(review.getByRole('button', {name: 'Mark resolved', exact: true})).toBeVisible();
        await dialog.getByRole('button', {name: 'Next page', exact: true}).click();
        await expect(dialog.locator('li summary').first()).toContainText('000000000000000000000010');
        await expect(dialog.getByRole('button', {name: 'Next page', exact: true})).toBeHidden();
        await dialog.getByLabel('Report status').selectOption('resolved');
        await dialog.getByRole('button', {name: 'Refresh reports', exact: true}).click();
        await expect(dialog.locator('li strong').first()).toContainText('resolved');
        await dialog.getByRole('combobox', { name: 'Report category', exact: true }).selectOption('Moderation Appeal');
        await expect(dialog.getByRole('button', { name: 'Next page', exact: true })).toBeHidden();
        await expect(dialog.getByRole('status')).toContainText('Filters changed');
        await dialog.getByRole('button', { name: 'Refresh reports', exact: true }).click();
        await expect(dialog.locator('li strong').first()).toHaveText('Moderation Appeal · resolved');
        await dialog.getByRole('combobox', { name: 'Report category', exact: true }).scrollIntoViewIfNeeded();
        expect((await dialog.getByRole('combobox', { name: 'Report category', exact: true }).boundingBox()).height).toBeGreaterThanOrEqual(44);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('administration-report-triage.png') });
        if (viewport.width === 390) {
            await page.evaluate(() => {
                const admin = window.__adminLayout.admin;
                admin.chatModerationEnabled = true; // Prepared UI only; no live policy or account action.
                admin.list.replaceChildren(); // Match the normal refreshView replacement, not an appended second page.
                admin.renderReports({ reports: [{ id: '0123456789abcdef01234567', username: 'fixture-reporter',
                    reportType: 'Player Report', status: 'open', reviewRevision: 0, text: 'Synthetic conduct case.' }] });
            });
            const moderation = dialog.locator('.administration-review').filter({ has: page.locator('summary', { hasText: 'Moderation decision or reversal' }) });
            await moderation.locator('summary').click();
            await expect(moderation.getByLabel('Exact account to review')).toHaveValue('');
            await moderation.getByLabel('Exact account to review').fill('realm-warden-0');
            await moderation.getByRole('button', { name: 'Check this account', exact: true }).click();
            await expect(moderation).toContainText('revision 2');
            await moderation.getByLabel('Mute or suspension duration in minutes').fill('10');
            await moderation.getByLabel('Public explanation shown to the player').fill('Review of repeated abusive chat. You may appeal.');
            await moderation.getByLabel('Private staff evidence or reversal reason').fill('Reviewed the selected synthetic conduct case.');
            await moderation.getByRole('button', { name: 'Review temporary mute', exact: true }).click();
            await expect(moderation.getByRole('button', { name: 'Keep unchanged', exact: true })).toBeFocused();
            const confirmMute = moderation.getByRole('button', { name: 'Confirm decision', exact: true });
            await confirmMute.scrollIntoViewIfNeeded();
            expect((await confirmMute.boundingBox()).height).toBeGreaterThanOrEqual(44);
            expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
            await page.screenshot({ path: testInfo.outputPath('administration-chat-mute-confirmation.png') });
            await confirmMute.click();
            await expect(moderation.getByRole('status')).toContainText('case unchanged');
            await expect(dialog.locator('li strong').first()).toHaveText('Player Report · open');
            await expect(moderation.getByRole('button', { name: 'Review temporary mute', exact: true })).toBeDisabled();
            for (const [action, effect, screenshot] of [
                ['Review temporary suspension', 'private notice and appeal access remain available', 'administration-suspension-confirmation.png'],
                ['Review required name change', 'login identity and saved progress remain unchanged', 'administration-name-confirmation.png']
            ]) {
                await moderation.getByRole('button', { name: 'Check this account', exact: true }).click();
                await expect(moderation).toContainText('revision 2');
                await moderation.getByRole('button', { name: action, exact: true }).click();
                await expect(moderation).toContainText(effect);
                const confirmation = moderation.getByRole('button', { name: 'Confirm decision', exact: true });
                await confirmation.scrollIntoViewIfNeeded();
                expect((await confirmation.boundingBox()).height).toBeGreaterThanOrEqual(44);
                expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
                await page.screenshot({ path: testInfo.outputPath(screenshot) });
                await confirmation.click();
                await expect(moderation.getByRole('status')).toContainText('case unchanged');
                await expect(dialog.locator('li strong').first()).toHaveText('Player Report · open');
            }
        }
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
