import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { collectBrowserFailures } from './helpers.js';

// Real application boot and native Chrome downloads, with only synthetic
// account/transport/provider fixtures. No real login, mail or Google requests.
// Download files live in Playwright's temporary context and are not retained.
test.use({ screenshot: 'off', trace: 'off', video: 'off', serviceWorkers: 'block' });
const origin = 'https://play.eidolonrealms.com';
const reference = '0123456789abcdef01234567';
const nextCursor = '0123456789abcdef01234560';
const exportSummary = 'My approved data export — private download';
const proof = 'fixture-only-owner-proof';

async function installFixture(page, baseURL) {
    const fixture = { requests: [], downloads: [], providerRequests: [], approved: false, reply: true };
    fixture.failures = collectBrowserFailures(page, origin);
    page.on('download', download => fixture.downloads.push(download));
    // Serve repository assets from loopback under the allowed production
    // hostname. This exercises the production analytics host gate without
    // reaching the actual game or a third-party collector.
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) {
            const response = await route.fetch({ url: new URL(url.pathname + url.search, baseURL).href });
            await route.fulfill({ response });
        } else if (url.origin === new URL(baseURL).origin) {
            await route.continue();
        } else {
            fixture.providerRequests.push({ origin: url.origin, path: url.pathname });
            await route.fulfill({ contentType: 'text/javascript', body: '' });
        }
    });
    await page.routeWebSocket(/\/ws(?:\?.*)?$/, socket => {
        fixture.socket = socket;
        socket.onMessage(raw => {
            const message = JSON.parse(raw);
            fixture.requests.push(message);
            if (message.type === 'login') socket.send(JSON.stringify({ type: 'login_success', payload: {
                message: 'Authenticated synthetic fixture', hasCharacter: true,
                characterType: 'Wizard', terrainProfile: 'flat-v1'
            } }));
            if (message.type === 'report_status') socket.send(JSON.stringify({ type: 'report_status_result', payload: {
                requestId: message.payload.requestId, success: true,
                report: { id: message.payload.reportId, reportType: 'Account Data Export', status: 'resolved',
                    exportApproved: fixture.approved, exportApprovalRevision: fixture.approved ? 1 : 0,
                    createdAt: '2026-10-06T00:00:00Z', resolvedAt: '2026-10-06T00:01:00Z' }
            } }));
            if (message.type === 'owner_export_section' && fixture.reply) fixture.respond(message);
        });
    });
    fixture.respond = message => {
        const data = message.payload.before ? {
            format: 'eidolon-owner-report-submissions', version: 1, reports: [],
            coverage: { complete_account_export: false }
        } : {
            format: 'eidolon-owner-report-submissions', version: 1,
            reports: [{ submitted_text: 'Synthetic private report body', submitted_email: 'owner@example.invalid' }],
            next: nextCursor, coverage: { complete_account_export: false }
        };
        fixture.socket.send(JSON.stringify({ type: 'owner_export_section_result', payload: {
            requestId: message.payload.requestId, success: true, data
        } }));
        return data;
    };
    fixture.exports = () => fixture.requests.filter(request => request.type === 'owner_export_section');
    return fixture;
}

async function signInAndOpen(page) {
    await expect(page.locator('html')).toHaveAttribute('data-eidolon-ready', 'true');
    await page.locator('#auth-username').fill('codex-private-download-fixture');
    await page.locator('#auth-password').fill('fixture-only-login-proof');
    await page.locator('#btn-login').click();
    await expect(page.locator('#login-account-help')).toBeVisible();
    await page.locator('#login-account-help').click();
    const dialog = page.locator('#report-screen');
    await expect(dialog).toBeVisible();
    const widget = dialog.locator('details.support-field').filter({ has: page.getByText(exportSummary, { exact: true }) });
    await widget.getByText(exportSummary, { exact: true }).click();
    return { dialog, widget };
}

async function checkApproval(dialog) {
    const referenceInput = dialog.getByRole('textbox', { name: 'My report reference', exact: true });
    if (!await referenceInput.isVisible()) await dialog.getByText('Check a report I submitted', { exact: true }).click();
    await referenceInput.fill(reference);
    await dialog.getByRole('button', { name: 'Check status', exact: true }).click();
    await expect(dialog.locator('#report-lookup-status')).toContainText('Review finished');
}

for (const [width, height] of [[1280, 800], [390, 844]]) {
    test(`private owner export needs approval, proof and native Save at ${width}x${height}`, async ({ page, baseURL }) => {
        const fixture = await installFixture(page, baseURL);
        await page.setViewportSize({ width, height });
        await page.goto(`${origin}/?eidolon-private=account`, { waitUntil: 'networkidle' });
        await expect(page).toHaveURL(`${origin}/`);
        expect(await page.evaluate(() => [window.__eidolonRecoverySensitivePage, Boolean(window.__eidolonGoogleTagInitialized)])).toEqual([true, false]);
        const { dialog, widget } = await signInAndOpen(page);
        const prepare = widget.getByRole('button', { name: 'Prepare section', exact: true });
        const save = widget.getByRole('button', { name: 'Save section locally', exact: true });
        const next = widget.getByRole('button', { name: 'Choose next page', exact: true });
        const password = widget.getByLabel('Current password', { exact: true });
        const cursor = widget.getByLabel(/^Page cursor/);
        await expect(prepare).toBeDisabled();
        await checkApproval(dialog);
        await expect(widget.getByRole('status')).toContainText('Case review alone does not approve');
        await expect(prepare).toBeDisabled();
        expect(fixture.exports()).toHaveLength(0);
        fixture.approved = true;
        await checkApproval(dialog);
        await expect(prepare).toBeEnabled();
        await expect(save).toBeHidden();
        await widget.getByRole('combobox', { name: 'Section', exact: true }).selectOption('reports');
        await prepare.click();
        await expect(widget.getByRole('status')).toContainText('Enter your current password');
        expect(fixture.exports()).toHaveLength(0);
        await password.fill(proof);
        await prepare.click();
        await expect(password).toHaveValue('');
        await expect(save).toBeVisible();
        await expect(next).toBeDisabled();
        expect(fixture.exports()).toHaveLength(1);
        expect(fixture.exports()[0].payload).toMatchObject({ reportId: reference, approvalRevision: 1,
            currentPassword: proof, section: 'reports', characterName: '', before: '' });
        expect(fixture.downloads).toHaveLength(0);
        expect(await dialog.textContent()).not.toContain('owner@example.invalid');
        expect(await dialog.textContent()).not.toContain('Synthetic private report body');
        await save.scrollIntoViewIfNeeded();
        expect((await save.boundingBox()).height).toBeGreaterThanOrEqual(44);
        const bounds = await dialog.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
        expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
        const firstDownloadPromise = page.waitForEvent('download');
        await save.click();
        const firstDownload = await firstDownloadPromise;
        expect(firstDownload.suggestedFilename()).toBe('eidolon-reports-start-section.json');
        expect(await firstDownload.failure()).toBeNull();
        const firstData = JSON.parse(await readFile(await firstDownload.path(), 'utf8'));
        expect(firstData.reports[0].submitted_email).toBe('owner@example.invalid');
        expect(firstData.coverage.complete_account_export).toBe(false);
        expect(firstData.next).toBe(nextCursor);
        await expect(save).toBeHidden();
        await expect(next).toBeEnabled();
        await next.click();
        await expect(cursor).toHaveValue(nextCursor);
        await expect(password).toHaveValue('');
        expect(fixture.exports()).toHaveLength(1);
        await prepare.click();
        expect(fixture.exports()).toHaveLength(1);
        await password.fill(proof);
        await prepare.click();
        await expect(save).toBeVisible();
        expect(fixture.exports()).toHaveLength(2);
        expect(fixture.exports()[1].payload.before).toBe(nextCursor);
        expect(fixture.downloads).toHaveLength(1);
        const secondDownloadPromise = page.waitForEvent('download');
        await save.click();
        const secondDownload = await secondDownloadPromise;
        expect(secondDownload.suggestedFilename()).toBe(`eidolon-reports-${nextCursor}-section.json`);
        expect(JSON.parse(await readFile(await secondDownload.path(), 'utf8')).reports).toEqual([]);
        await expect(next).toBeHidden();
        const persisted = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
        for (const privateValue of [proof, reference, nextCursor, 'Synthetic private report body', 'owner@example.invalid']) expect(persisted).not.toContain(privateValue);
        await password.fill('unsent-fixture-proof');
        await widget.getByRole('button', { name: 'Close and discard', exact: true }).click();
        await widget.getByText(exportSummary, { exact: true }).click();
        await expect(password).toHaveValue('');
        await expect(cursor).toHaveValue('');
        await expect(save).toBeHidden();
        expect(await page.evaluate(() => Boolean(window.game))).toBe(false);
        expect(fixture.providerRequests).toEqual([]);
        expect(fixture.failures, fixture.failures.join('\n')).toEqual([]);
    });
}

test('closed and disconnected account support discards pending files and rejects late replies', async ({ page, baseURL }) => {
    const fixture = await installFixture(page, baseURL);
    fixture.approved = true; fixture.reply = false;
    await page.goto(`${origin}/?eidolon-private=account`, { waitUntil: 'networkidle' });
    const { dialog, widget } = await signInAndOpen(page);
    await checkApproval(dialog);
    const password = widget.getByLabel('Current password', { exact: true });
    const prepare = widget.getByRole('button', { name: 'Prepare section', exact: true });
    const save = widget.getByRole('button', { name: 'Save section locally', exact: true });
    await widget.getByRole('combobox', { name: 'Section', exact: true }).selectOption('reports');
    await password.fill(proof); await prepare.click();
    await expect.poll(() => fixture.exports().length).toBe(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    fixture.respond(fixture.exports()[0]);
    await page.locator('#login-account-help').click();
    await expect(save).toBeHidden();
    await expect(password).toHaveValue('');
    await password.fill(proof); await prepare.click();
    await expect.poll(() => fixture.exports().length).toBe(2);
    // Capture only the existing UI owner for post-disposal observation; the
    // disconnect itself travels through the native application's real socket.
    await page.evaluate(() => { window.__discardedExportFixture = document.querySelector('#report-screen').__eidolonReportUI.exportDownload; });
    fixture.socket.close({ code: 1000, reason: 'Synthetic disconnect' });
    await expect(dialog).toBeHidden();
    await expect(page.locator('#login-account-help')).toBeHidden();
    expect(await page.evaluate(() => {
        const owner = window.__discardedExportFixture;
        return { disposed: owner.disposed, pending: owner.pending, prepared: owner.prepared, proof: owner.password.value };
    })).toEqual({ disposed: true, pending: null, prepared: null, proof: '' });
    expect(fixture.downloads).toHaveLength(0);
    expect(fixture.providerRequests).toEqual([]);
    expect(fixture.failures, fixture.failures.join('\n')).toEqual([]);
});

test('already-tagged account support requires a fresh private document before export proof', async ({ page, baseURL }) => {
    const fixture = await installFixture(page, baseURL);
    await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
    expect(await page.evaluate(() => Boolean(window.__eidolonGoogleTagInitialized))).toBe(true);
    expect(fixture.providerRequests).toEqual([{ origin: 'https://www.googletagmanager.com', path: '/gtag/js' }]);
    const { widget } = await signInAndOpen(page);
    await expect(widget.locator('input[type=password]')).toHaveCount(0);
    const link = widget.getByRole('link', { name: 'Open private account support', exact: true });
    await expect(link).toHaveAttribute('href', '/?eidolon-private=account');
    await link.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(`${origin}/`);
    expect(await page.evaluate(() => [window.__eidolonRecoverySensitivePage, Boolean(window.__eidolonGoogleTagInitialized)])).toEqual([true, false]);
    const fresh = await signInAndOpen(page);
    await expect(fresh.widget.getByLabel('Current password', { exact: true })).toBeDisabled();
    expect(fixture.exports()).toHaveLength(0);
    expect(fixture.providerRequests).toHaveLength(1);
    expect(fixture.failures, fixture.failures.join('\n')).toEqual([]);
});
