import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

// Synthetic credentials only. Do not record credential-entry pixels or socket
// traffic, even on failure. Persistence was checked by separate backend tests.
test.use({ screenshot: 'off', trace: 'off', video: 'off' });

for (const mode of ['closed-help', 'world-handoff', 'blocked-storage', 'uncertain', 'import-gap', 'import-gap-uncertain']) {
    test(`password receipt keeps session token coherent: ${mode}`, async ({ page }) => {
        const blocked = mode === 'blocked-storage';
        await page.setViewportSize({ width: blocked ? 390 : 1280, height: 844 });
        if (blocked) await page.addInitScript(() => {
            Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = () => {
                throw new DOMException('Storage unavailable', 'SecurityError');
            };
        });
        const importGap = mode.startsWith('import-gap');
        let engineRequested = false, releaseEngine;
        const engineBarrier = new Promise(resolve => { releaseEngine = resolve; });
        await page.route('**/src/core/GameEngine.js*', async route => {
            engineRequested = true;
            if (importGap) await engineBarrier;
            await route.fulfill({ contentType: 'text/javascript', body: `
            import { NetworkManager } from '/src/core/NetworkManager.js';
            export class GameEngine {
                constructor(type, mobile, multiplayer, address, username, socket) {
                    this.network = new NetworkManager(socket); this.network.connect(type);
                    this.renderSystem = { enablePerfOverlay() {} };
                }
                async loadGame(progress) { progress(100, 'Ready'); }
                destroy() { this.isDestroyed = true; }
            }` });
        });
        let activeSocket, requestId, changes = 0;
        await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
            activeSocket = socket;
            socket.onMessage(data => {
                const message = JSON.parse(data);
                if (message.type === 'login') socket.send(JSON.stringify({ type: 'login_success', payload: {
                    hasCharacter: true, characterType: 'Fighter', resumeToken: 'a'.repeat(64)
                } }));
                if (message.type === 'change_password') {
                    changes++; requestId = message.payload.requestId;
                    // Never include credential payloads in test failure output.
                    expect(message.payload.currentPassword === 'synthetic-old').toBe(true);
                    expect(message.payload.newPassword === 'Synthetic updated phrase').toBe(true);
                    expect(Object.keys(message.payload).sort()).toEqual(['currentPassword', 'newPassword', 'requestId']);
                }
            });
        });
        await openGame(page);
        await page.locator('#auth-username').fill('synthetic-session');
        await page.locator('#auth-password').fill('synthetic-old');
        await page.locator('#btn-login').click();
        await page.locator('#login-account-help').click();
        const form = page.locator('#report-screen .password-change');
        await form.locator('summary').click();
        await form.getByLabel('Current password', { exact: true }).fill('synthetic-old');
        await form.getByLabel('New password', { exact: true }).fill('Synthetic updated phrase');
        await form.getByLabel('Confirm new password', { exact: true }).fill('Synthetic updated phrase');
        await form.getByRole('button', { name: 'Change password', exact: true }).click();
        await expect.poll(() => changes).toBe(1);
        expect(await form.locator('input').evaluateAll(inputs => inputs.every(input => input.value === '' && input.disabled))).toBe(true);
        const fits = await form.locator('input').evaluateAll(inputs => inputs.every(input => {
            const rect = input.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth;
        }));
        expect(fits).toBe(true);
        await page.locator('#btn-close-report-header').click();
        const handoff = mode === 'world-handoff' || blocked || importGap;
        if (handoff) {
            await page.locator('#btn-play-character').click();
            await expect(page.locator('#start-screen')).toBeHidden();
            if (importGap) {
                await expect.poll(() => engineRequested).toBe(true);
                expect(await page.evaluate(() => Boolean(window.game))).toBe(false);
            } else {
                await expect.poll(() => page.evaluate(() => typeof window.game?.network?.getResumeToken)).toBe('function');
            }
        }
        const uncertain = mode === 'uncertain' || mode === 'import-gap-uncertain';
        activeSocket.send(JSON.stringify({ type: 'password_change_result', payload: {
            requestId, success: !uncertain, message: uncertain ? 'Change not confirmed.' : 'Password changed.',
            ...(uncertain ? { resumeInvalidated: true } : { resumeToken: 'b'.repeat(64) })
        } }));
        if (!blocked) await expect.poll(() => page.evaluate(() => localStorage.getItem('eidolon_resume_token'))).toBe(uncertain ? null : 'b'.repeat(64));
        if (importGap) {
            // The auth transport must consume this receipt while the engine
            // module is still absent, then hand its RAM token to the new one.
            expect(await page.evaluate(() => Boolean(window.game))).toBe(false);
            releaseEngine();
        }
        if (!handoff) {
            await page.locator('#btn-play-character').click();
            await expect(page.locator('#start-screen')).toBeHidden();
        }
        // Hiding login begins asynchronous entry; it does not mean the engine
        // and its transport callbacks have been constructed yet.
        await expect.poll(() => page.evaluate(() => typeof window.game?.network?.getResumeToken)).toBe('function');
        await expect.poll(() => page.evaluate(() => window.game.network.getResumeToken())).toBe(uncertain ? null : 'b'.repeat(64));
        expect(changes).toBe(1);
        // Token consumption is owned by the current transport, not by a form
        // that has been disposed on world entry. No bearer enters the UI queue.
        expect(await page.evaluate(() => window.game.network.messageQueue.every(message => !message.payload?.resumeToken))).toBe(true);
        await page.evaluate(() => window.game.network.dispose());
    });
}
