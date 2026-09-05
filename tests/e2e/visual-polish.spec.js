import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

test.describe('visual polish entry flow', () => {
    test('keeps login reachable on desktop, narrow and short screens with reduced motion', async ({ page, baseURL }, testInfo) => {
        const failures = collectBrowserFailures(page, baseURL);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        for (const [name, width, height] of [
            ['desktop', 1440, 1000], ['narrow', 320, 720], ['mobile', 390, 844], ['short', 1280, 600]
        ]) {
            await page.setViewportSize({ width, height });
            await page.goto('/', { waitUntil: 'networkidle' });
            await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
            const layout = await page.locator('#start-screen').evaluate((element) => ({
                width: element.clientWidth, scrollWidth: element.scrollWidth,
                loginTop: element.querySelector('#login-panel').getBoundingClientRect().top,
                storyTop: element.querySelector('#start-flow-panel').getBoundingClientRect().top
            }));
            expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
            if (width <= 800) expect(layout.loginTop).toBeLessThan(layout.storyTop);
            for (const id of ['auth-username', 'auth-email', 'auth-password', 'btn-login', 'btn-register']) {
                const control = page.locator(`#${id}`);
                await control.scrollIntoViewIfNeeded();
                const box = await control.boundingBox();
                expect(box.x).toBeGreaterThanOrEqual(0);
                expect(box.x + box.width).toBeLessThanOrEqual(width);
                expect(box.y).toBeGreaterThanOrEqual(0);
                expect(box.y + box.height).toBeLessThanOrEqual(height);
            }
            await page.locator('#start-screen').evaluate((element) => { element.scrollTop = 0; });
            await page.screenshot({ path: testInfo.outputPath(`entry-${name}.png`) });
        }
        const notes = page.getByRole('button', { name: 'Patch notes', exact: true });
        await notes.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#patch-notes-screen')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('#patch-notes-screen')).toBeHidden();
        await expect(page.locator('#login-panel')).toBeVisible();
        expect(failures, failures.join('\n')).toEqual([]);
    });

    test('preserves returning and new-character layouts after mocked authentication', async ({ page }, testInfo) => {
        // No credentials or accounts are sent to a backend in this presentation test.
        let returning = false;
        await page.routeWebSocket(/\/ws(?:\?|$)/, (socket) => {
            socket.onMessage((message) => {
                if (JSON.parse(String(message)).type !== 'login') return;
                socket.send(JSON.stringify({ type: 'login_success', payload: {
                    hasCharacter: returning, characterType: 'Fighter', message: 'Presentation fixture'
                } }));
            });
        });
        for (const hasCharacter of [false, true]) {
            returning = hasCharacter;
            await page.setViewportSize({ width: 1280, height: 800 });
            await page.goto('/', { waitUntil: 'networkidle' });
            await page.locator('#auth-username').fill('visual-fixture');
            await page.locator('#auth-password').fill('local-fixture-only');
            await page.locator('#btn-login').click();
            await expect(page.locator('#login-panel')).toBeHidden();
            if (hasCharacter) {
                await expect(page.locator('#btn-play-character')).toBeVisible();
                await expect(page.locator('#btn-play-character')).toContainText('Fighter');
            } else {
                await expect(page.locator('#class-selection-container')).toBeVisible();
                await expect(page.locator('.class-btn')).toHaveCount(4);
                for (const button of await page.locator('.class-btn').all()) await expect(button).toBeInViewport();
                await expect(page.locator('#start-flow-copy')).toContainText('Chronicle starts automatically');
            }
            await page.screenshot({ path: testInfo.outputPath(hasCharacter ? 'returning-character.png' : 'choose-class.png') });
        }
    });
});
