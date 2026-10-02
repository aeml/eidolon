import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1280, 800], [390, 844]]) {
    test(`login account notices and appeals work before world entry at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL), requests = [];
        await page.setViewportSize({ width, height });
        await page.routeWebSocket(/\/ws(?:\?.*)?$/, socket => {
            socket.onMessage(raw => {
                const message = JSON.parse(raw); requests.push(message);
                if (message.type === 'login') socket.send(JSON.stringify({ type: 'login_success', payload: { message: 'Authenticated fixture', hasCharacter: true, characterType: 'Wizard', terrainProfile: 'flat-v1' } }));
                if (message.type === 'moderation_notice') socket.send(JSON.stringify({ type: 'moderation_notice_result', payload: { requestId: message.payload.requestId, success: true, notices: [{ kind: 'suspend', id: 'd'.repeat(64), reason: 'Public explanation for this prepared fixture.', startedAt: '2026-10-02T01:00:00Z', expiresAt: '2026-10-02T02:00:00Z' }] } }));
                if (message.type === 'report') socket.send(JSON.stringify({ type: 'report_result', payload: { requestId: message.payload.requestId, success: true, reportId: 'e'.repeat(24) } }));
            });
        });
        await page.goto('/', { waitUntil: 'networkidle' });
        await expect(page.locator('#login-account-help')).toBeHidden();
        await page.locator('#auth-username').fill('prepared-appellant');
        await page.locator('#auth-password').fill('fixture-only-not-a-real-password');
        await page.locator('#btn-login').click();
        await expect(page.locator('#login-account-help')).toBeVisible();
        expect(requests.map(request => request.type)).toEqual(['login']);
        await page.locator('#login-account-help').click();
        const dialog = page.locator('#report-screen');
        await expect(dialog).toBeVisible();
        await expect(page.locator('#report-type')).toHaveValue('Moderation Appeal');
        const bounds = await dialog.boundingBox();
        const header = await dialog.locator('.window-header').boundingBox();
        const body = await dialog.locator('.support-window__body').boundingBox();
        expect(header.width).toBeGreaterThan(bounds.width * .8);
        expect(header.y + header.height).toBeLessThanOrEqual(body.y + 1);
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
        await dialog.getByText('My moderation notices and appeals', { exact: true }).click();
        await dialog.getByRole('button', { name: 'Check my moderation notices', exact: true }).click();
        await expect(dialog.locator('#moderation-notice-status')).toContainText('Public explanation');
        await expect(dialog.locator('#moderation-notice-status')).toContainText('does not automatically reverse');
        const focusedHeader = await dialog.locator('.window-header').boundingBox();
        expect(focusedHeader.y).toBeGreaterThanOrEqual(bounds.y);
        expect(focusedHeader.y + focusedHeader.height).toBeLessThanOrEqual(bounds.y + bounds.height);
        await page.screenshot({ path: testInfo.outputPath('login-account-notice.png') });
        await dialog.getByRole('button', { name: 'Start appeal draft', exact: true }).click();
        await expect(page.locator('#report-text')).toHaveValue(/Moderation notice: d{64}/);
        await page.locator('#report-text').fill('Please review this decision and my explanation.');
        expect(requests.some(request => request.type === 'report')).toBe(false);
        await dialog.getByRole('button', { name: 'Submit', exact: true }).click();
        await expect(dialog.locator('#report-status')).toContainText('Report saved for operator review');
        await expect(page.locator('#report-text')).toHaveValue('');
        expect(requests.map(request => request.type)).toEqual(['login', 'moderation_notice', 'report']);
        expect(await page.evaluate(() => Boolean(window.game))).toBe(false);
        await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
        await expect(page.locator('#login-account-help')).toBeFocused();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}

for (const [width, height] of [[1280, 800], [390, 844], [844, 390]]) {
    test(`report form preserves drafts and previews consent at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        test.setTimeout(45_000);
        page.setDefaultTimeout(10_000);
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { ReportUI, collectReportContext } = await import('/src/ui/ReportUI.js');
            const { installUIManagerWindows } = await import('/src/ui/UIManagerWindows.js');
            const { installUIManagerSettings } = await import('/src/ui/UIManagerSettings.js');
            class Host { playUICue() {} }
            installUIManagerWindows(Host); installUIManagerSettings(Host);
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', innerWidth < 600);
            const ui = new Host();
            Object.assign(ui, { uiLayer: document.getElementById('ui-layer'), isMobile: innerWidth < 600,
                helpScreen: document.getElementById('help-screen'),
                reportScreen: document.getElementById('report-screen'), reportText: document.getElementById('report-text'),
                reportType: document.getElementById('report-type'), btnSubmitReport: document.getElementById('btn-submit-report'),
                requests: [], getReportContext: include => collectReportContext({ isMobile: innerWidth < 600, player: { position: { x: 4, z: 200 } }, renderSystem: { graphicsQuality: 'high' } }, include) });
            ui.onReportSubmit = (type, text, requestId) => { ui.requests.push({ type, text, requestId }); return true; };
            ui.lookups = [];
            ui.onReportLookup = (reportId, requestId) => { ui.lookups.push({reportId, requestId}); return true; };
            ui.noticeLookups = [];
            ui.onModerationNoticeLookup = requestId => { ui.noticeLookups.push({ requestId }); return true; };
            ui.report = new ReportUI(ui);
            ui.registerWindowLayouts();
            document.getElementById('btn-close-report-header').onclick = () => ui.toggleReport();
            document.getElementById('btn-cancel-report').onclick = () => ui.toggleReport();
            ui.toggleHelp();
            window.__reportFixture = ui;
        });
        const help = page.locator('#help-screen');
        const disclosure = page.locator('#help-alpha-status > summary');
        await expect(help).toBeVisible();
        await expect(page.locator('#help-alpha-status')).not.toHaveAttribute('open');
        await disclosure.focus(); await page.keyboard.press('Enter');
        await expect(page.locator('#help-alpha-status')).toHaveAttribute('open', '');
        await expect(help).toContainText('Closed beta waits until the game is nearly complete');
        await expect(help).toContainText('optional diagnostics stay off');
        const helpBounds = await help.boundingBox();
        expect(helpBounds.x).toBeGreaterThanOrEqual(0); expect(helpBounds.y).toBeGreaterThanOrEqual(0);
        expect(helpBounds.x + helpBounds.width).toBeLessThanOrEqual(width + 1);
        expect(helpBounds.y + helpBounds.height).toBeLessThanOrEqual(height + 1);
        expect(await help.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        const closeBounds = await page.locator('#btn-close-help').boundingBox();
        expect(closeBounds.y).toBeGreaterThanOrEqual(helpBounds.y);
        expect(closeBounds.y + closeBounds.height).toBeLessThanOrEqual(helpBounds.y + helpBounds.height);
        const body = help.locator('.support-window__body');
        await body.evaluate(el => { el.scrollTop = el.scrollHeight; });
        await expect(help.getByText('Together, or a quieter evening:', { exact: true })).toBeInViewport();
        await disclosure.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath('alpha-help-limits.png') });
        await disclosure.press('Enter');
        await expect(page.locator('#help-alpha-status')).not.toHaveAttribute('open');
        await page.evaluate(() => { window.__reportFixture.toggleHelp(); window.__reportFixture.toggleReport(); });
        await expect(help).toBeHidden();
        const dialog = page.getByRole('dialog', { name: 'SUBMIT REPORT' });
        const text = page.getByLabel('What happened, what you expected, and steps to reproduce');
        await expect(dialog).toBeVisible(); await expect(text).toBeFocused();
        await text.fill('The casino doorway is blocked when approaching from the east.');
        await page.getByLabel('Report type').selectOption('Moderation Appeal');
        await expect(page.locator('#report-guidance')).toContainText('moderation notice or report reference');
        await expect(page.locator('#report-guidance')).toContainText('does not automatically cancel a sanction');
        await expect(text).toHaveValue('The casino doorway is blocked when approaching from the east.');
        await dialog.screenshot({ path: testInfo.outputPath('appeal-guidance.png') });
        await page.getByLabel('Report type').selectOption('Bug Report');
        await expect(page.locator('#report-diagnostics')).not.toBeChecked();
        await dialog.getByText('Context included with this report', {exact: true}).click();
        await expect(page.locator('#report-context')).toContainText('area: Lanternhold');
        await expect(page.locator('#report-context')).not.toContainText('position:');
        await page.locator('#report-diagnostics').check();
        await expect(page.locator('#report-context')).toContainText('position: 4, 200');
        await expect(page.locator('#report-context')).toContainText(`controls: ${width < 600 ? 'touch' : 'desktop'}`);
        await page.getByRole('button', { name: 'Submit', exact: true }).click();
        await expect(text).toHaveValue(/casino doorway/);
        await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
        await page.evaluate(() => {
            const ui = window.__reportFixture;
            ui.report.handleResult({ requestId: ui.requests.at(-1).requestId, success: false });
        });
        await expect(page.locator('#report-status')).toContainText('draft is retained');
        await page.getByRole('button', { name: 'Submit', exact: true }).click();
        await page.evaluate(() => {
            const ui = window.__reportFixture;
            ui.report.handleResult({ requestId: ui.requests.at(-1).requestId, success: true, reportId: '0123456789abcdef01234567' });
        });
        await expect(text).toHaveValue('');
        await expect(page.locator('#report-status')).toContainText('operator review');
        await dialog.getByText('Check a report I submitted', {exact: true}).click();
        await expect(dialog.getByLabel('My report reference', {exact: true})).toHaveValue('0123456789abcdef01234567');
        const check = dialog.getByRole('button', {name: 'Check status', exact: true});
        await check.scrollIntoViewIfNeeded();
        expect((await check.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await check.click();
        await page.evaluate(() => {
            const ui = window.__reportFixture, request = ui.lookups.at(-1);
            ui.report.lookup.handleResult({requestId: request.requestId, success: true,
                report: {id: request.reportId, reportType: 'Bug Report', status: 'resolved',
                    createdAt: '2026-10-01T12:00:00Z', resolvedAt: '2026-10-01T13:00:00Z'}});
        });
        await expect(page.locator('#report-lookup-status')).toContainText('Review finished');
        await expect(page.locator('#report-lookup-status')).toContainText('not a promised fix');
        const statusBounds = await page.locator('#report-lookup-status').boundingBox();
        const reportBody = await dialog.locator('.support-window__body').boundingBox();
        expect(statusBounds.y + statusBounds.height).toBeLessThanOrEqual(reportBody.y + reportBody.height + 1);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await page.screenshot({path: testInfo.outputPath('own-report-status.png')});
        await dialog.getByText('Check a report I submitted', {exact: true}).click();
        const bounds = await dialog.boundingBox();
        if (width === 390) {
            const disclosure = dialog.getByText('My moderation notices and appeals', { exact: true });
            await disclosure.click();
            const checkNotice = dialog.getByRole('button', { name: 'Check my moderation notices', exact: true });
            await checkNotice.scrollIntoViewIfNeeded();
            expect((await checkNotice.boundingBox()).height).toBeGreaterThanOrEqual(44);
            await checkNotice.click();
            await page.evaluate(() => {
                const ui = window.__reportFixture;
                ui.noticeReportCount = ui.requests.length;
                ui.report.notice.handleResult({ requestId: ui.noticeLookups.at(-1).requestId, success: true,
                    notices: [{ id: 'a'.repeat(64), reason: 'Temporary chat restriction. You may request a review.',
                        startedAt: new Date(Date.now()-60000).toISOString(), expiresAt: new Date(Date.now()+540000).toISOString() },
                    { id: 'b'.repeat(64), kind: 'suspend', reason: 'Temporary suspension. You may request a review.',
                        startedAt: new Date(Date.now()-60000).toISOString(), expiresAt: new Date(Date.now()+540000).toISOString() },
                    { id: 'c'.repeat(64), kind: 'require_name_change', reason: 'Please choose a corrected public name.',
                        startedAt: new Date(Date.now()-60000).toISOString(), expiresAt: '0001-01-01T00:00:00Z' }] });
            });
            const noticeStatus = page.locator('#moderation-notice-status');
            await expect(noticeStatus).toContainText('Temporary chat restriction');
            await expect(noticeStatus).toContainText('does not automatically reverse');
            const selection = dialog.getByRole('combobox', { name: 'Notice to appeal', exact: true });
            await selection.selectOption('c'.repeat(64));
            await selection.scrollIntoViewIfNeeded();
            expect((await selection.boundingBox()).height).toBeGreaterThanOrEqual(44);
            expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
            await page.screenshot({ path: testInfo.outputPath('own-moderation-notice.png') });
            await dialog.getByRole('button', { name: 'Start appeal draft', exact: true }).click();
            await expect(page.getByLabel('Report type')).toHaveValue('Moderation Appeal');
            await expect(text).toHaveValue(/Moderation notice: c{64}/);
            await expect(text).toBeFocused();
            expect(await page.evaluate(() => window.__reportFixture.requests.length - window.__reportFixture.noticeReportCount)).toBe(0);
            await text.fill('');
            await page.getByLabel('Report type').selectOption('Bug Report');
            await disclosure.click();
        }
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
        await page.screenshot({ path: testInfo.outputPath('report-context-confirmation.png') });
        const submit = page.getByRole('button', { name: 'Submit', exact: true });
        await submit.focus(); await page.keyboard.press('Tab');
        await expect(dialog.getByText('Check a report I submitted', {exact: true})).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(dialog.getByText('My moderation notices and appeals', {exact: true})).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Close report form' })).toBeFocused();
        await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
        expect(await page.evaluate(() => window.__reportFixture.requests.length)).toBe(2);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
