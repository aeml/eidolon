import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { installBladeStormAreaObserver } from './blade-storm-area-observer.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone Blade Storm purchases and saved training match five real flight endpoints to the cone', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_BLADE_STORM_AREA !== '1' || process.env.EIDOLON_E2E_REGISTER !== '1',
        'Explicit disposable Blade Storm route only');
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Rogue');
    await page.locator('#chat-mobile-toggle').tap();
    await page.locator('#chat-input').fill('/level 100'); await page.locator('#chat-input').press('Enter');
    await page.locator('#chat-mobile-toggle').tap();
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    async function skills(tab) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button', { name: tab, exact: true }).tap();
    }
    await skills('Skills');
    const branch = page.locator('[data-build-action="branch:B"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Blade Storm'))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();
    const receipts = [];
    async function cast(rank, quality, saved = false) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
        if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        // Use real town healing and natural cooldown recovery, not a locally
        // predicted readiness refill. This is cast QA, not earned progression.
        await expect.poll(() => page.evaluate(() => {
            const p = window.game.player;
            return Boolean(p.safeZoneId) && p.stats.mana === p.stats.maxMana && (p.cooldowns['Blade Storm'] || 0) <= 0;
        }), { timeout: 25_000 }).toBe(true);
        await page.evaluate(installBladeStormAreaObserver);
        const before = await page.evaluate(() => {
            const p = window.game.player;
            return { mana: p.stats.mana, rank: p.talentRanks?.ROG_34 || 0, points: p.talentPoints,
                x: p.position.x, z: p.position.z, slot: p.hotbar.indexOf('Blade Storm') };
        });
        expect(before.rank).toBe(rank); expect(before.slot).toBeGreaterThanOrEqual(0);
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        let qa;
        try {
            await expect.poll(() => page.evaluate(() => window.__bladeStormArea.casts.length), { intervals: [20] }).toBe(1);
            await page.screenshot({ path: testInfo.outputPath(`blade-storm-${rank}-${quality}-${saved ? 'saved' : 'normal'}.png`) });
            await expect.poll(() => page.evaluate(() => window.__bladeStormArea.terminals.length)).toBe(5);
            await expect.poll(() => page.evaluate(() => window.__bladeStormArea.results.length)).toBe(1);
        } finally {
            qa = await page.evaluate(() => window.__bladeStormArea).catch(() => ({ unavailable: true }));
            await testInfo.attach(`blade-storm-${rank}-${quality}-${saved}`, {
                body: JSON.stringify({ before, qa }), contentType: 'application/json' });
        }
        const radius = 10 * (1 + .03 * rank), cast = qa.casts[0];
        expect(qa.results[0].accepted).toBe(true); expect(before.mana - qa.results[0].mana).toBe(30);
        expect(cast).toMatchObject({ attached: true, authoritative: true, visible: true, quality });
        expect(cast.radius).toBeCloseTo(radius, 8); expect(cast.meshRadius).toBeCloseTo(radius, 8);
        expect(cast.arc).toBeCloseTo(Math.PI / 2, 8);
        expect(cast.meshX).toBeCloseTo(before.x, 2); expect(cast.meshZ).toBeCloseTo(before.z, 2);
        expect(new Set(qa.terminals.map(p => p.projectileId)).size).toBe(5);
        for (const endpoint of qa.terminals) {
            expect(Math.hypot(endpoint.x - before.x, endpoint.z - before.z)).toBeCloseTo(radius, 2);
        }
        const ids = qa.terminals.map(p => p.projectileId);
        await expect.poll(() => page.evaluate(ids => ids.every(id => !window.game.remotePlayers.has(id)), ids)).toBe(true);
        receipts.push({ rank, quality, saved, before, qa });
        console.log(`[blade-storm-area] rank${rank}/${quality}/saved${saved}: paid30, cone and five endpoints ${radius}`);
    }
    await cast(0, 'high');
    for (let rank = 1; rank <= 5; rank++) {
        await skills('Talents');
        const buy = page.locator('button[data-build-action="talent:ROG_34"]');
        const points = await page.evaluate(() => window.game.player.talentPoints);
        await page.evaluate(installBladeStormAreaObserver);
        await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(() => page.evaluate(() => window.__bladeStormArea.ranks?.ROG_34)).toBe(rank);
        await expect.poll(() => page.evaluate(() => window.__bladeStormArea.points)).toBe(points - 1);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        if (rank === 5) await expect(buy).toBeDisabled();
        await page.locator('#btn-close-skills').tap();
        if (rank === 1 || rank === 5) await cast(rank, rank === 1 ? 'high' : 'low');
        await page.waitForTimeout(1100);
    }
    const points = await page.evaluate(() => window.game.player.talentPoints);
    await loginAndEnterWorld(page, credentials);
    await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.ROG_34)).toBe(5);
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points);
    await page.setViewportSize({ width: 844, height: 390 });
    await cast(5, 'high', true);
    await testInfo.attach('blade-storm-paid-saved-receipts', { body: JSON.stringify(receipts), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
