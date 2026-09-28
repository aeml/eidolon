import { test, expect } from '@playwright/test';
import { openGame } from './helpers.js';

for (const blockedStorage of [false, true]) test(`failed resume returns to usable login, storage blocked=${blockedStorage}`, async ({ page }) => {
    const alerts = [];
    page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.dismiss(); });
    await page.setViewportSize({ width: blockedStorage ? 390 : 1280, height: 844 });
    if (blockedStorage) await page.addInitScript(() => {
        Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = () => {
            throw new DOMException('Storage unavailable', 'SecurityError');
        };
    });
    // Real bootstrap/network/login DOM, lightweight engine lifecycle: this test
    // exercises recovery wiring, not world rendering or server persistence.
    await page.route('**/src/core/GameEngine.js*', route => route.fulfill({ contentType: 'text/javascript', body: `
        import { NetworkManager } from '/src/core/NetworkManager.js';
        export class GameEngine {
            constructor(type, mobile, multiplayer, address, username, socket) {
                this.network = new NetworkManager(socket); this.network.connect(type);
                this.renderSystem = { enablePerfOverlay() {} };
            }
            async loadGame(progress) {
                progress(100, 'Ready');
                if (window.__holdLoad) await new Promise((resolve, reject) => { window.__rejectOldLoad = reject; });
            }
            destroy() { this.isDestroyed = true; }
        }` }));
    let activeSocket, logins = 0, resumes = 0;
    await page.routeWebSocket(/\/ws(?:\?|$)/, socket => {
        activeSocket = socket;
        socket.onMessage(data => {
            const message = JSON.parse(data);
            if (message.type === 'login') {
                logins++;
                socket.send(JSON.stringify({ type: 'login_success', payload: {
                    hasCharacter: true, characterType: 'Fighter', resumeToken: 'fixture-resume-only' } }));
            }
            if (message.type === 'resume_session') {
                resumes++; expect(message.payload.token).toBe('fixture-resume-only');
                socket.send(JSON.stringify({ type: 'error', payload: 'Session token invalid or expired. Please log in again.' }));
            }
        });
    });
    await openGame(page);
    await page.locator('#auth-username').fill('session-fixture');
    await page.locator('#auth-password').fill('not-real-credentials');
    await page.locator('#btn-login').click();
    if (blockedStorage) await page.evaluate(() => { window.__holdLoad = true; });
    await page.locator('#btn-play-character').click();
    await expect(page.locator('#start-screen')).toBeHidden();
    await page.evaluate(() => { window.__oldFailure = window.game.network.onReconnectFailed; window.__retired = window.game; });
    await activeSocket.close({ code: 1011, reason: 'fixture transport interruption' });
    await expect(page.locator('#start-screen')).toBeVisible();
    await expect(page.locator('#login-panel')).toBeVisible();
    await expect(page.locator('#auth-status')).toContainText('log in again');
    await expect(page.locator('#play-container')).toBeHidden();
    await expect(page.locator('#loading-screen')).toBeHidden();
    await expect(page.locator('#auth-password')).toHaveValue('');
    expect(await page.evaluate(() => ({ game: window.game, socket: window.__retired.network.socket,
        destroyed: window.__retired.isDestroyed }))).toEqual({ game: null, socket: null, destroyed: true });
    if (blockedStorage) await page.evaluate(() => {
        window.__holdLoad = false; window.__rejectOldLoad(new Error('Retired load'));
    });
    await page.locator('#auth-password').fill('not-real-credentials');
    await page.locator('#btn-login').click();
    await page.locator('#btn-play-character').click();
    await expect(page.locator('#start-screen')).toBeHidden();
    await page.evaluate(() => window.__oldFailure());
    expect(await page.evaluate(() => Boolean(window.game && !window.game.isDestroyed))).toBe(true);
    expect({ logins, resumes }).toEqual({ logins: 2, resumes: 1 });
    expect(alerts).toEqual([]);
    await page.evaluate(() => window.game.network.dispose());
});
