import { expect, test } from '@playwright/test';
import { credentialsFromEnvironment, openGame } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('one login click recovers after the real server reply is lost', async ({ page }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_AUTH_RECOVERY !== '1', 'Disposable auth interruption route only');
    test.setTimeout(180_000);
    const endpoint = new URL(process.env.EIDOLON_E2E_WS_URL);
    expect(endpoint.hostname).toBe('127.0.0.1');
    expect(endpoint.protocol).toBe('ws:');
    const credentials = credentialsFromEnvironment();
    const evidence = { connections: 0, loginRequests: 0, droppedReplies: 0, deliveredReplies: 0 };
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.setDefaultTimeout(30_000);
    await page.routeWebSocket(endpoint.href, socket => {
        evidence.connections++;
        const server = socket.connectToServer();
        socket.onMessage(message => {
            if (typeof message === 'string' && JSON.parse(message).type === 'login') evidence.loginRequests++;
            server.send(message); // Actual credentials go only to the disposable server.
        });
        server.onMessage(async message => {
            const type = typeof message === 'string' ? JSON.parse(message).type : null;
            if (type === 'login_success') {
                if (!evidence.droppedReplies) {
                    evidence.droppedReplies++;
                    await Promise.all([socket.close({ code: 1011, reason: 'QA lost auth reply' }), server.close()]);
                    return;
                }
                evidence.deliveredReplies++;
            }
            socket.send(message);
        });
    });
    await openGame(page);
    await page.locator('#auth-username').fill(credentials.username);
    await page.locator('#auth-email').fill(`${credentials.username}@example.invalid`);
    await page.locator('#auth-password').fill(credentials.password);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    // No retry helper, navigation, extra click or synthetic login packet.
    await page.locator('#btn-login').click();
    await expect(page.locator('#class-selection-container')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#login-panel')).toBeHidden();
    expect(evidence).toEqual({ connections: 2, loginRequests: 2, droppedReplies: 1, deliveredReplies: 1 });
    expect(pageErrors).toEqual([]);
    await testInfo.attach('auth-recovery-counts', { body: JSON.stringify(evidence), contentType: 'application/json' });
});
