import { test, expect } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

for (const [width, height] of [[1280, 800], [390, 844], [844, 390]]) {
    test(`optional local playtest summary remains opt-in at ${width}x${height}`, async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.route('**/src/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
        await page.setViewportSize({ width, height });
        await page.goto('/', { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
            const { UIManager } = await import('/src/ui/UIManager.js');
            document.getElementById('start-screen').style.display = 'none';
            document.body.classList.toggle('mobile-mode', innerWidth < 600 || innerHeight < 500);
            const ui = new UIManager(innerWidth < 600 || innerHeight < 500);
            ui.getPlaytestContext = () => ({ connected: true, level: 4 });
            ui.requests = [];
            ui.onReportSubmit = (...args) => { ui.requests.push(args); return true; };
            ui.toggleHelp(); window.__playtestUI = ui;
        });
        const help = page.locator('#help-screen');
        const summary = page.getByLabel('Local playtest summary');
        await page.getByText('Optional playtest timer · local only', { exact: true }).click();
        await expect(summary).toHaveText('No observations recorded.');
        const start = page.getByRole('button', { name: 'Start timer', exact: true });
        const stop = page.getByRole('button', { name: 'Stop timer', exact: true });
        await page.getByLabel('Current activity').selectOption('grouping');
        await page.getByLabel('Receiving outside help (gear, gifts or carries)', { exact: true }).check();
        await start.click(); await expect(start).toBeDisabled();
        await expect.poll(() => page.evaluate(() => window.__playtestUI.playtest.session.elapsed())).toBeGreaterThan(0);
        await stop.click(); await expect(stop).toBeDisabled();
        await expect(summary).toContainText('Levels: 4 → 4');
        await expect(summary).toContainText('Active time marked assisted');
        await summary.scrollIntoViewIfNeeded();
        const bounds = await help.boundingBox(), close = await page.locator('#btn-close-help').boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
        expect(close.y + close.height).toBeLessThanOrEqual(bounds.y + bounds.height);
        expect(await summary.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('local-playtest-summary.png') });
        await page.evaluate(() => { window.__playtestUI.reportText.value = 'My original report.'; });
        await page.getByRole('button', { name: 'Append summary to report draft' }).click();
        await expect(help).toBeHidden();
        await expect(page.locator('#report-screen')).toBeVisible();
        await expect(page.locator('#report-text')).toHaveValue(/^My original report\.\n\nVoluntary playtest summary/);
        await expect(page.locator('#report-status')).toContainText('Submit only when ready');
        expect(await page.evaluate(() => window.__playtestUI.requests)).toEqual([]);
        await page.evaluate(() => window.__playtestUI.playtest.dispose());
        expect(await page.evaluate(() => document.querySelector('[data-start]'))).toBeNull();
        expect(failures, failures.join('\n')).toEqual([]);
    });
}
