import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, projectEntity, readPlayerState } from './helpers.js';
import { walkChronicleByTouch } from './chronicle-phone-inputs.js';

for (const mode of ['desktop', 'portrait', 'landscape']) {
    test.describe(mode, () => {
        const phone = mode !== 'desktop';
        test.use({ viewport: mode === 'portrait' ? { width: 390, height: 844 }
            : mode === 'landscape' ? { width: 844, height: 390 } : { width: 1280, height: 720 },
        hasTouch: phone, isMobile: phone,
        ...(phone ? { userAgent: devices['Pixel 7'].userAgent } : {}),
        trace: 'off', video: 'off', screenshot: 'off' });
        test('one stash interaction walks to its exposed face and opens storage', async ({ page, baseURL }, testInfo) => {
            test.setTimeout(120_000);
            const credentials = credentialsFromEnvironment();
            test.skip(!credentials.username || !credentials.password, 'Requires an isolated disposable account');
            const failures = collectBrowserFailures(page, baseURL);
            await loginAndEnterWorld(page, { ...credentials, username: `${credentials.username}-${mode}` });
            await expect.poll(() => page.evaluate(() => window.game.remotePlayers.has('stash-1'))).toBe(true);
            // On phones, ordinary joystick travel brings the west-side coffer
            // on screen. Leave enough distance to exercise tap-to-approach.
            if (phone) await walkChronicleByTouch(page, page.context(), -12, 197, 20_000);
            let target;
            await expect.poll(async () => {
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                target = await projectEntity(page, 'stash-1');
                return target?.visible === true;
            }).toBe(true);
            const before = await readPlayerState(page);
            expect(Math.hypot(before.x + 28, before.z - 193)).toBeGreaterThan(5);
            if (phone) await page.touchscreen.tap(target.x, target.y);
            else {
                await page.mouse.move(target.x, target.y);
                await expect.poll(() => page.evaluate(() => window.game.hoveredEntity?.id)).toBe('stash-1');
                await page.mouse.click(target.x, target.y);
            }
            try {
                await expect(page.locator('#stash-screen')).toBeVisible({ timeout: 20_000 });
                const after = await readPlayerState(page);
                expect(Math.hypot(after.x + 28, after.z - 193)).toBeLessThanOrEqual(5);
                await page.screenshot({ path: testInfo.outputPath(`stash-${mode}.png`) });
                console.log('[town-stash-approach]', JSON.stringify({ mode, before, after, inputs: 1 }));
                if (phone) await page.locator('#btn-close-stash').tap();
                else await page.locator('#btn-close-stash').click();
                await expect(page.locator('#stash-screen')).toBeHidden();
                expect(failures, failures.join('\n')).toEqual([]);
            } catch (error) {
                console.log('[town-stash-failure]', JSON.stringify(await page.evaluate(() => {
                    const g = window.game, p = g.player;
                    return { player: p.position.toArray(), state: p.state, pending: g.pendingInteraction?.id,
                        target: p.targetPosition?.toArray(), blocked: p.blockedTargetPosition,
                        stash: g.remotePlayers.get('stash-1')?.position.toArray() };
                })));
                throw error;
            }
        });
    });
}
