import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { installSmokeAreaObserver } from './smoke-area-observer.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('Smoke Bomb Fine Motor purchases change the paid footprint and persist through login', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_SMOKE_AREA !== '1', 'Explicit isolated Smoke Bomb training route');
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Rogue');
    let lastCommandAt = 0;
    async function command(value) {
        await page.waitForTimeout(Math.max(0, 1100 - (Date.now() - lastCommandAt)));
        lastCommandAt = Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value); await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    async function skills(tab) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button', { name: tab, exact: true }).tap();
    }
    // Only level/readiness are prepared in this disposable fixture. Branch and
    // all five ranks are purchased through normal touch controls, not assigned.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await skills('Skills');
    const branch = page.locator('[data-build-action="branch:C"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Smoke Bomb'))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();

    const receipts = [];
    async function cast(rank, quality) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
        if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command('/qa-animation-ready');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        await page.evaluate(installSmokeAreaObserver);
        const before = await page.evaluate(() => {
            const p = window.game.player;
            return { rank: p.talentRanks?.ROG_34 || 0, mana: p.stats.mana,
                x: p.position.x, z: p.position.z, slot: p.hotbar.indexOf('Smoke Bomb') };
        });
        expect(before.rank).toBe(rank); expect(before.slot).toBeGreaterThanOrEqual(0);
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        await expect.poll(() => page.evaluate(() => window.__smokeAreaNative.results.length)).toBe(1);
        await expect.poll(() => page.evaluate(() => window.__smokeAreaNative.casts.length)).toBe(1);
        const observation = await page.evaluate(() => window.__smokeAreaNative);
        expect(observation.results[0].accepted).toBe(true);
        expect(before.mana - observation.results[0].mana).toBe(35);
        const accepted = observation.casts[0], radius = 5 * (1 + .03 * rank);
        expect(accepted).toMatchObject({ attached: true, authoritative: true, quality });
        expect(accepted.radius).toBeCloseTo(radius, 8);
        expect(accepted.meshRadius).toBeCloseTo(radius, 8);
        expect(accepted.arc).toBeCloseTo(2 * Math.PI, 8);
        expect(accepted.x).toBeCloseTo(before.x, 2); expect(accepted.z).toBeCloseTo(before.z, 2);
        expect(accepted.meshX).toBeCloseTo(accepted.x, 8); expect(accepted.meshZ).toBeCloseTo(accepted.z, 8);
        receipts.push({ rank, ...observation });
        await page.screenshot({ path: testInfo.outputPath(`smoke-rank${rank}-${quality}.png`) });
        console.log(`[smoke-area] rank${rank}/${quality}: paid radius and attached boundary ${radius}`);
    }
    await cast(0, 'high');
    for (let rank = 1; rank <= 5; rank++) {
        await skills('Talents');
        const buy = page.locator('button[data-build-action="talent:ROG_34"]');
        await expect(page.locator('.phone-build-card').filter({ has: buy })).toContainText('+3% AoE radius per rank');
        const points = await page.evaluate(() => window.game.player.talentPoints);
        await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.ROG_34)).toBe(rank);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points - 1);
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
    await cast(5, 'high');
    await testInfo.attach('smoke-trained-paid-casts', { body: JSON.stringify(receipts), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
