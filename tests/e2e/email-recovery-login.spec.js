import { test, expect } from '@playwright/test';
import { cp, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bundleGameEngine } from '../../scripts/bundle-game-engine.mjs';
import { versionPagesRuntime } from '../../scripts/version-pages-runtime.mjs';
import { collectBrowserFailures } from './helpers.js';

// Synthetic proofs only. Disable recordings even for failures; backend
// persistence/session boundaries have separate source-specific checks.
test.use({ screenshot: 'off', trace: 'off', video: 'off' });
test.setTimeout(30000);
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';

for (const mode of ['verify', 'reset', 'setup']) {
    test(`email recovery real bootstrap and controls: ${mode}`, async ({ page }) => {
        await page.setViewportSize({ width: mode === 'reset' ? 390 : 1280, height: 844 });
        if (mode === 'reset') await page.addInitScript(() => {
            Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
        });
        await page.route('**/src/core/GameEngine.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'export class GameEngine {}' }));
        let requests = 0;
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            socket.onMessage(data => {
                const message = JSON.parse(data);
                if (message.type === 'login') {
                    socket.send(JSON.stringify({ type: 'login_success', payload: { gameplayProtocol: 'stationary-actions-roofs-v1', hasCharacter: true, characterType: 'Fighter', resumeToken: 'b'.repeat(64) } }));
                    return;
                }
                const action = mode === 'verify' ? 'confirm_recovery_email' : mode === 'reset' ? 'complete_password_recovery' : 'set_recovery_email';
                if (message.type !== action) return;
                requests++;
                if (mode === 'setup') {
                    expect(message.payload.currentPassword === 'synthetic-current').toBe(true);
                    expect(message.payload.email === 'owner@example.invalid').toBe(true);
                    expect(message.payload.username === undefined).toBe(true);
                } else {
                    expect(message.payload.username === 'synthetic-owner').toBe(true);
                    expect(message.payload.token === 'a'.repeat(64)).toBe(true);
                    if (mode === 'reset') expect(message.payload.newPassword === 'A synthetic recovery phrase').toBe(true);
                }
                socket.send(JSON.stringify({ type: 'email_recovery_result', payload: { action, requestId: message.payload.requestId, success: true,
                    message: mode === 'setup' ? 'Verification email requested.' : mode === 'verify' ? 'Recovery email verified.' : 'Password reset. Sign in normally.' } }));
            });
        });
        const fragment = mode === 'setup' ? '' : '#' + new URLSearchParams({ 'eidolon-recovery': mode, account: 'synthetic-owner', token: 'a'.repeat(64) });
        await page.goto('/' + fragment, { waitUntil: 'domcontentloaded' });
        let form;
        if (mode === 'setup') {
            await page.locator('#auth-username').fill('synthetic-owner'); await page.locator('#auth-password').fill('synthetic-current');
            await page.locator('#btn-login').click(); await expect(page.locator('#login-account-help')).toBeVisible(); await page.locator('#login-account-help').click();
            form = page.locator('#report-screen .email-recovery'); await form.locator('summary').click();
            await form.getByLabel('Recovery email', { exact: true }).fill('owner@example.invalid');
            await form.getByLabel('Current password', { exact: true }).fill('synthetic-current');
        } else {
            form = page.locator('#login-panel .email-recovery');
            await expect(form).toBeVisible();
            await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
            expect(await page.evaluate(() => window.__eidolonRecoveryHandoff === undefined && window.__eidolonRecoverySensitivePage === true)).toBe(true);
            expect(await page.evaluate(() => window.__eidolonGoogleTagInitialized === undefined)).toBe(true);
            expect(requests).toBe(0); // Opening a GET link never changes ownership.
            expect(await form.evaluate(element => !element.innerHTML.includes('a'.repeat(64)))).toBe(true);
            if (mode === 'reset') {
                await form.getByLabel('New password', { exact: true }).fill('A synthetic recovery phrase');
                await form.getByLabel('Confirm new password', { exact: true }).fill('A synthetic recovery phrase');
            }
        }
        const button = form.getByRole('button', { name: mode === 'setup' ? 'Send verification email' : mode === 'verify' ? 'Confirm email' : 'Reset password', exact: true });
        await expect(button).toBeEnabled(); await button.click();
        await expect.poll(() => requests).toBe(1);
        await expect(form.locator('[role="status"]')).toContainText(mode === 'setup' ? 'Verification email requested' : mode === 'verify' ? 'Recovery email verified' : 'Password reset');
        expect(await form.locator('input[type="password"]').evaluateAll(inputs => inputs.every(input => input.value === ''))).toBe(true);
        expect(await form.locator('input:visible').evaluateAll(inputs => inputs.every(input => { const r=input.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth; }))).toBe(true);
        expect(requests).toBe(1);
    });
}

for (const mode of ['invited-desktop', 'invited-phone', 'existing-login', 'required-code']) {
    test(`invitation registration real bootstrap and controls: ${mode}`, async ({ page }) => {
        await page.setViewportSize({ width: mode === 'invited-phone' ? 390 : 1280, height: 844 });
        await page.route('**/src/core/GameEngine.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'export class GameEngine {}' }));
        const name = 'Synthetic invitee 雨';
        const code = `v1.${Buffer.from(JSON.stringify({ username: name, cohort: 'qa', expires: 2000000000, id: 'A'.repeat(22) })).toString('base64url')}.${'A'.repeat(43)}`;
        let registrations = 0, logins = 0, analytics = 0;
        page.on('request', request => { if (/google-analytics|googletagmanager/.test(request.url())) analytics++; });
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            socket.onMessage(data => {
                const message = JSON.parse(data);
                if (message.type === 'login') {
                    logins++;
                    expect(message.payload.invitation === undefined).toBe(true);
                    socket.send(JSON.stringify({ type: 'login_success', payload: { gameplayProtocol: 'stationary-actions-roofs-v1', hasCharacter: true, characterType: 'Fighter', resumeToken: 'b'.repeat(64) } }));
                }
                if (message.type !== 'register') return;
                registrations++;
                if (mode === 'required-code' && registrations === 1) {
                    expect(message.payload.invitation === undefined).toBe(true);
                    socket.send(JSON.stringify({ type: 'registration_status', payload: { mode: 'invitation' } }));
                    socket.send(JSON.stringify({ type: 'error', payload: 'Registration failed: A valid invitation is required to create a new account. Existing accounts can sign in normally.' }));
                    return;
                }
                expect(message.payload.invitation === code).toBe(true);
                expect(message.payload.username === name).toBe(true);
                socket.send(JSON.stringify({ type: 'error', payload: 'Registration successful! Please login.' }));
            });
        });
        await page.goto('/' + (mode === 'required-code' ? '' : '#invite=' + code), { waitUntil: 'domcontentloaded' });
        const input = page.locator('#auth-invitation');
        await expect(page.locator('#btn-register')).toBeEnabled();
        expect(registrations).toBe(0); expect(logins).toBe(0);
        if (mode === 'required-code') {
            await expect(input).toBeHidden();
            await page.locator('#auth-username').fill(name);
        } else {
            await expect(input).toBeVisible();
            expect(await input.evaluate((element, expected) => element.value === expected, code)).toBe(true);
            await expect(page.locator('#auth-username')).toHaveValue(name);
            expect(await page.evaluate(() => location.hash === '' && window.__eidolonInvitationHandoff === undefined && window.__eidolonRecoverySensitivePage === true)).toBe(true);
            expect(await page.evaluate(() => window.__eidolonGoogleTagInitialized === undefined)).toBe(true);
            expect(analytics).toBe(0);
        }
        await page.locator('#auth-password').fill('A synthetic invited account phrase 93!');
        if (mode === 'existing-login') {
            await page.locator('#btn-login').click();
            await expect.poll(() => logins).toBe(1);
            expect(registrations).toBe(0);
        } else {
            await page.locator('#auth-email').fill('invitee@example.invalid');
            if (mode === 'required-code') {
                await page.locator('#btn-register').click();
                await expect(input).toBeVisible();
                await input.fill(code);
            }
            expect(await page.locator('#login-panel input:visible').evaluateAll(inputs => inputs.every(input => {
                const r = input.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth;
            }))).toBe(true);
            await input.press('Enter');
            await expect.poll(() => registrations).toBe(mode === 'required-code' ? 2 : 1);
        }
        await expect(input).toBeHidden();
        expect(await input.evaluate(element => element.value === '')).toBe(true);
    });
}

// A virtual production origin exercises the actual hostname/privacy policy.
// All HTTP, the provider and sockets are fulfilled locally: no external mail,
// analytics collection, production account or real invitation is involved.
test.describe('copied published analytics', () => {
    test.use({ serviceWorkers: 'block' });
    let root;
    test.beforeAll(async () => {
        root = await mkdtemp(path.join(tmpdir(), 'eidolon-published-analytics-'));
        for (const filename of ['src', 'assets', 'vendor', 'index.html', 'release.json', 'sw.js'])
            await cp(filename === 'vendor' ? await realpath(filename) : path.resolve(filename), path.join(root, filename), { recursive: true });
        await bundleGameEngine(root);
        await versionPagesRuntime(root, 'analyticsfixture20261016');
    });
    test.afterAll(async () => { if (root) await rm(root, { recursive: true, force: true }); });
    for (const mode of ['public', 'invitation', 'recovery']) test(`closed module graph and private-link policy: ${mode}`, async ({ page }) => {
        const production = 'https://play.eidolonrealms.com';
        const failures = collectBrowserFailures(page, production);
        let providerRequests = 0, oldModuleRequests = 0, bundleRequests = 0;
        await page.setViewportSize({ width: mode === 'invitation' ? 390 : 1280, height: 844 });
        await page.addInitScript(() => {
            window.__analyticsFixtureTime = 0;
            Object.defineProperty(performance, 'now', { configurable: true, value: () => window.__analyticsFixtureTime });
        });
        await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
        await page.route('https://www.googletagmanager.com/**', route => {
            providerRequests++;
            return route.fulfill({ contentType: 'text/javascript', body: 'window.__analyticsProviderFixture = true;' });
        });
        await page.route(`${production}/**`, async route => {
            const pathname = new URL(route.request().url()).pathname;
            if (/\/src\/analytics\/(?:GameSessionObserver|GameSessionTracker|GoogleAnalytics)\.js$/.test(pathname)) {
                oldModuleRequests++;
                return route.fulfill({ status: 408, body: 'Owned unavailable-submodule control' });
            }
            if (pathname === '/src/analytics/game.bundle.js') bundleRequests++;
            const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
            if (!filename.startsWith(`${root}${path.sep}`)) throw Error('Invalid private fixture request');
            const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json',
                '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf' };
            return route.fulfill({ contentType: mime[path.extname(filename)] || 'application/octet-stream', body: await readFile(filename) });
        });
        const fragment = mode === 'invitation' ? `#invite=v1.eyJ1c2VybmFtZSI6IkFub24ifQ.${'A'.repeat(43)}` :
            mode === 'recovery' ? `#eidolon-recovery=reset&account=private-owner&token=${'a'.repeat(64)}` : '';
        await page.goto(production + '/' + fragment, { waitUntil: 'networkidle' });
        await page.bringToFront();
        await expect.poll(() => bundleRequests).toBe(1);
        expect(oldModuleRequests).toBe(0);
        if (mode !== 'public') {
            expect(await page.evaluate(() => location.hash === '' && window.__eidolonRecoverySensitivePage === true)).toBe(true);
            expect(providerRequests).toBe(0);
        } else await expect.poll(() => providerRequests).toBe(1);
        await page.evaluate(() => {
            window.game = { _firstStateReceived: true, playerType: 'Fighter', player: { hasSyncedLevel: true, username: 'must-not-leak' },
                network: { socket: { readyState: 1 }, _reconnecting: false, token: 'must-not-leak' } };
        });
        if (mode === 'public') {
            await expect.poll(() => page.evaluate(() => window.dataLayer?.some(row => row[1] === 'gameplay_start'))).toBe(true);
            await page.evaluate(() => { window.__analyticsFixtureTime = 31000; });
            await expect.poll(() => page.evaluate(() => window.dataLayer?.some(row => row[1] === 'gameplay_engagement'))).toBe(true);
            await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
            const events = await page.evaluate(() => window.dataLayer.map(row => [...row]).filter(row => row[0] === 'event'));
            expect(events.map(row => row[1])).toEqual(['gameplay_start', 'gameplay_engagement', 'gameplay_end']);
            expect(events[1][2].active_play_seconds).toBe(31);
            expect(JSON.stringify(events)).not.toContain('must-not-leak');
        } else {
            // Advance the real interval after a simulated successful world
            // entry: private-page suppression must also hold for later play.
            await page.evaluate(() => { window.__analyticsFixtureTime = 31000; });
            await page.waitForTimeout(1200);
            expect(await page.evaluate(() => window.dataLayer === undefined && window.__eidolonGoogleTagInitialized === undefined)).toBe(true);
            expect(providerRequests).toBe(0);
        }
        expect(bundleRequests).toBe(1); expect(oldModuleRequests).toBe(0);
        expect(failures, failures.join('\n')).toEqual([]);
    });
});
