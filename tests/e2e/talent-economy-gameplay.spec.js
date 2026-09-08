import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { castResourceBounds } from '../castResourceBounds.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone talent purchases reduce real cast cost and cooldown, including after fresh login', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires the disposable talent route');
    const credentials = credentialsFromEnvironment();
    expect(testInfo.retry).toBeLessThanOrEqual(1);
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    // Prepared functional fixture only. Every talent rank is purchased normally.
    await page.locator('#chat-mobile-toggle').tap();
    await page.locator('#chat-input').fill('/level 100'); await page.locator('#chat-input').press('Enter');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.locator('#chat-mobile-toggle').tap();

    async function verifyCast(expectedCost, skillMultiplier) {
        await page.evaluate(() => {
            window.__talentCastResults = [];
            if (window.__talentCastObserver) return;
            window.__talentCastObserver = true;
            const original = window.game.handleServerMessage.bind(window.game);
            window.game.handleServerMessage = message => {
                if (message.type === 'ability_result' && message.payload?.skillName === 'Fireball') {
                    window.__talentCastResults.push(message.payload);
                }
                return original(message);
            };
        });
        await expect.poll(() => page.evaluate(cost => window.game.player.stats.mana >= cost, expectedCost), { timeout: 30_000 }).toBe(true);
        await expect.poll(() => page.evaluate(() => (window.game.player.cooldowns.Fireball || 0) <= 0)).toBe(true);
        const before = await page.evaluate(() => ({ mana: window.game.player.stats.mana,
            maxMana: window.game.player.stats.maxMana, manaRegen: window.game.player.stats.manaRegen,
            cdr: window.game.player.stats.cooldownReduction }));
        const castStarted = Date.now();
        await page.locator('#btn-mobile-ability').tap();
        await expect.poll(() => page.evaluate(() => window.__talentCastResults.length)).toBeGreaterThan(0);
        const result = await page.evaluate(() => window.__talentCastResults.at(-1));
        expect(result.accepted).toBe(true);
        const bounds = castResourceBounds(before, expectedCost, Date.now() - castStarted);
        expect(result.mana).toBeGreaterThanOrEqual(bounds.minimum);
        expect(result.mana).toBeLessThanOrEqual(bounds.maximum);
        expect(result.cooldownRemaining).toBeCloseTo(2 * (1 - before.cdr) * skillMultiplier, 5);
        console.log('[talent-economy-cast]', JSON.stringify({ expectedCost, before, receivedMana: result.mana, bounds }));
    }
    expect(await page.evaluate(() => [window.game.player.talentRanks?.WIZ_02 || 0,
        window.game.player.talentRanks?.WIZ_27 || 0])).toEqual([0, 0]);
    await verifyCast(30, 1);
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Talents', exact: true }).tap();
    for (const id of ['WIZ_02', 'WIZ_27']) {
        for (let rank = 1; rank <= 5; rank++) {
            const button = page.locator(`button[data-build-action="talent:${id}"]`);
            await button.scrollIntoViewIfNeeded(); await button.tap();
            await expect.poll(() => page.evaluate(key => window.game.player.talentRanks?.[key], id)).toBe(rank);
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        }
    }
    await page.locator('#btn-close-skills').tap();
    await verifyCast(21, 0.85);
    if (process.env.EIDOLON_E2E_ECONOMY_RETRY_PROBE === '1' && testInfo.retry === 0) {
        throw new Error('Intentional retry-isolation probe after saved talent purchases');
    }
    await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => ({ technique: window.game.player.talentRanks.WIZ_02, efficiency: window.game.player.talentRanks.WIZ_27 })))
        .toEqual({ technique: 5, efficiency: 5 });
    await page.setViewportSize({ width: 844, height: 390 });
    await verifyCast(21, 0.85);
    expect(failures, failures.join('\n')).toEqual([]);
    console.log('[talent-economy] normal phone purchases, Fireball cost 30→21, skill cooldown reduction and fresh-login cast passed');
});
