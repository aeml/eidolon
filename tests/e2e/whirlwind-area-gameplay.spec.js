import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { installWhirlwindAreaObserver } from './whirlwind-area-observer.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone Whirlwind area purchases match server and rendered geometry across saved login', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(300_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires the isolated Whirlwind area route');
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Fighter');
    // Explicit prepared-build fixture, not earned progression. No talent grants,
    // synthetic ranks, effect spawns or cooldown resets are used by this route.
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
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Whirlwind'))).toBeGreaterThanOrEqual(0);
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();
    const earnedPoints = await page.evaluate(() => window.game.player.talentPoints);

    async function buyUntil(id, lastRank) {
        await skills('Talents');
        const buy = page.locator(`button[data-build-action="talent:${id}"]`);
        const initial = await page.evaluate(id => window.game.player.talentRanks?.[id] || 0, id);
        for (let rank = initial + 1; rank <= lastRank; rank++) {
            const points = await page.evaluate(() => window.game.player.talentPoints);
            await buy.scrollIntoViewIfNeeded(); await buy.tap();
            await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id], id)).toBe(rank);
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
            expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points - 1);
            await page.waitForTimeout(1100); // Normal purchase request pacing.
        }
        if (lastRank === 5) await expect(buy).toBeDisabled();
        await page.locator('#btn-close-skills').tap();
    }

    async function cast(ranks, radius, quality, extended = false, screenshot = false) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
        if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        await expect.poll(() => page.evaluate(() => (window.game.player.cooldowns.Whirlwind || 0) <= 0 &&
            !window.game.player.whirlwindCastEffect?.isActive && window.game.player.stats.mana === window.game.player.stats.maxMana),
        { timeout: 20_000 }).toBe(true);
        await page.evaluate(installWhirlwindAreaObserver);
        const before = await page.evaluate(() => ({
            ranks: ['FTR_04', 'FTR_33', 'FTR_38'].map(id => window.game.player.talentRanks?.[id] || 0),
            rune: window.game.player.skillRunes?.Whirlwind || '', mana: window.game.player.stats.mana,
            slot: window.game.player.hotbar.indexOf('Whirlwind')
        }));
        expect(before.ranks).toEqual(ranks);
        expect(before.rune).toBe(extended ? 'whirlwind_extended' : '');
        expect(before.slot).toBeGreaterThanOrEqual(0);
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        await expect.poll(() => page.evaluate(() => window.__whirlwindArea.results.length), { intervals: [20] }).toBe(1);
        if (screenshot) await page.screenshot({ path: testInfo.outputPath(`whirlwind-area-${quality}-${extended ? 'extended' : 'base'}.png`) });
        await expect.poll(() => page.evaluate(() => window.__whirlwindArea.expired)).toBe(true);
        await expect.poll(() => page.evaluate(() => !window.game.player.whirlwindCastEffect &&
            !window.game.player.whirlwindActive && window.game.player.whirlwindRadius === 0)).toBe(true);
        const qa = await page.evaluate(() => window.__whirlwindArea);
        expect(qa.results).toHaveLength(1); expect(qa.results[0].accepted).toBe(true);
        expect(before.mana - qa.results[0].mana).toBe(30);
        expect(qa.casts).toHaveLength(1); expect(qa.casts[0].radius).toBeCloseTo(radius, 8);
        expect(qa.casts[0].arc).toBeCloseTo(2 * Math.PI, 8);
        expect(qa.states.length).toBeGreaterThan(0);
        for (const state of qa.states) {
            expect(state.radius).toBeCloseTo(radius, 5);
            expect(state.duration).toBeGreaterThan(0);
            expect(state.duration).toBeLessThanOrEqual(extended ? 2 : 1);
        }
        expect(qa.effects).toHaveLength(1);
        expect(qa.effects[0].duration).toBeCloseTo(extended ? 2 : 1, 1);
        const frames = qa.effects[0].frames.filter(frame => frame.active && frame.acknowledged);
        expect(frames.length).toBeGreaterThan(0);
        for (const frame of frames) {
            expect(frame).toMatchObject({ quality, visible: true, attached: true });
            expect(frame.radius).toBeCloseTo(radius, 5);
            expect(Math.hypot(frame.x - frame.sourceX, frame.z - frame.sourceZ)).toBeLessThan(.01);
        }
        await testInfo.attach(`whirlwind-${ranks.join('-')}-${quality}-${extended ? 'extended' : 'base'}`, {
            body: JSON.stringify(qa), contentType: 'application/json'
        });
    }
    await cast([0, 0, 0], 6, 'high');
    await buyUntil('FTR_04', 1); await cast([1, 0, 0], 6.12, 'low');
    await buyUntil('FTR_04', 5); await cast([5, 0, 0], 6.6, 'high');
    await buyUntil('FTR_33', 5); await cast([5, 5, 0], 7.5, 'low');
    await buyUntil('FTR_38', 5); await cast([5, 5, 5], 8.1, 'high', false, true);
    await skills('Runes'); await page.locator('#phone-rune-skill').selectOption('Whirlwind');
    const rune = page.locator('[data-build-action="rune:whirlwind_extended"]');
    await rune.scrollIntoViewIfNeeded(); await rune.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.skillRunes?.Whirlwind)).toBe('whirlwind_extended');
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();
    await cast([5, 5, 5], 8.1, 'low', true, true);
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(earnedPoints - 15);
    await loginAndEnterWorld(page, credentials); // Actual new document and saved build.
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(earnedPoints - 15);
    await cast([5, 5, 5], 8.1, 'high', true, true);
    await cast([5, 5, 5], 8.1, 'low', true, true);
    expect(failures, failures.join('\n')).toEqual([]);
});
