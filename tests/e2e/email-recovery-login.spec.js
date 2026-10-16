import { test, expect } from '@playwright/test';

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
                    socket.send(JSON.stringify({ type: 'login_success', payload: { hasCharacter: true, characterType: 'Fighter', resumeToken: 'b'.repeat(64) } }));
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
                    socket.send(JSON.stringify({ type: 'login_success', payload: { hasCharacter: true, characterType: 'Fighter', resumeToken: 'b'.repeat(64) } }));
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
