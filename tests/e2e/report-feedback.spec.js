import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1280, 800], [390, 844]]) {
    test(`report form preserves drafts and previews consent at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
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
                reportScreen: document.getElementById('report-screen'), reportText: document.getElementById('report-text'),
                reportType: document.getElementById('report-type'), btnSubmitReport: document.getElementById('btn-submit-report'),
                requests: [], getReportContext: include => collectReportContext({ isMobile: innerWidth < 600, player: { position: { x: 4, z: 200 } }, renderSystem: { graphicsQuality: 'high' } }, include) });
            ui.onReportSubmit = (type, text, requestId) => { ui.requests.push({ type, text, requestId }); return true; };
            ui.report = new ReportUI(ui);
            ui.registerWindowLayouts();
            document.getElementById('btn-close-report-header').onclick = () => ui.toggleReport();
            document.getElementById('btn-cancel-report').onclick = () => ui.toggleReport();
            ui.toggleReport();
            window.__reportFixture = ui;
        });
        const dialog = page.getByRole('dialog', { name: 'SUBMIT REPORT' });
        const text = page.getByLabel('What happened, what you expected, and steps to reproduce');
        await expect(dialog).toBeVisible(); await expect(text).toBeFocused();
        await text.fill('The casino doorway is blocked when approaching from the east.');
        await expect(page.locator('#report-diagnostics')).not.toBeChecked();
        await page.locator('.report-context-preview summary').click();
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
        const bounds = await dialog.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
        await page.screenshot({ path: testInfo.outputPath('report-context-confirmation.png') });
        const submit = page.getByRole('button', { name: 'Submit', exact: true });
        await submit.focus(); await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Close report form' })).toBeFocused();
        await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
        expect(await page.evaluate(() => window.__reportFixture.requests.length)).toBe(2);
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
