import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { installIronFortressObserver } from './iron-fortress-observer.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('Iron Fortress Mastery purchases extend visible protection and persist with Extended through login', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(300_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires the isolated Iron Fortress route');
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Fighter');
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
    // Existing allowlisted fixture commands prepare level/readiness only.
    // Training, specialization, rune selection and casts use ordinary touch UI.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await skills('Skills');
    const branch = page.locator('[data-build-action="branch:A"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Iron Fortress'))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();

    async function cast(rank, rune, quality, verifyExpiry) {
        // Do not clear an active buff with preparation commands or alter clocks.
        await expect.poll(() => page.evaluate(() => window.game.player.ironFortressTimer <= 0 &&
            !window.game.player.attachedStatusEffects.has('iron_fortress')), { timeout: 65_000 }).toBe(true);
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
        if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command('/qa-animation-ready');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        await page.evaluate(installIronFortressObserver);
        const before = await page.evaluate(() => {
            const p = window.game.player;
            return { rank: p.talentRanks?.FTR_07 || 0, rune: p.skillRunes?.['Iron Fortress'] || '',
                generic: [p.talentRanks?.FTR_30 || 0, p.talentRanks?.FTR_37 || 0],
                mana: p.stats.mana, slot: p.hotbar.indexOf('Iron Fortress') };
        });
        expect(before).toMatchObject({ rank, rune, generic: [0, 0] });
        expect(before.slot).toBeGreaterThanOrEqual(0);
        const baseDuration = rune === 'ironfortress_extended' ? 45 : 30;
        const expected = baseDuration * (1 + .04 * rank), startedAt = Date.now();
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        await expect.poll(() => page.evaluate(() => window.__fortressNative.results.length)).toBe(1);
        const result = await page.evaluate(() => window.__fortressNative.results[0]);
        expect(result.accepted).toBe(true);
        expect(before.mana - result.mana).toBe(40);
        await expect.poll(() => page.evaluate(() => window.__fortressNative.maxDuration)).toBeGreaterThan(expected - .75);
        expect(await page.evaluate(() => window.__fortressNative.maxDuration)).toBeLessThanOrEqual(expected + .1);
        await expect.poll(() => page.evaluate(() => window.game.player.attachedStatusEffects
            .get('iron_fortress')?.quality)).toBe(quality);
        await page.locator('#btn-phone-status').tap();
        const badge = page.locator('#phone-status-panel [data-buff-id="iron_fortress"]');
        await expect(badge).toBeVisible();
        await expect(badge.locator('h3')).toHaveText('Iron Fortress');
        await expect(badge.locator('.phone-status-remaining')).toHaveText(/^\d+\.\ds left$/);
        const countdown = await badge.locator('.phone-status-remaining').evaluate(node => ({
            text: node.textContent, timer: window.game.player.ironFortressTimer
        }));
        const shownSeconds = Number(countdown.text.match(/(\d+\.\d)s/)[1]);
        expect(Math.abs(shownSeconds - countdown.timer)).toBeLessThan(1);
        await page.screenshot({ path: testInfo.outputPath(`fortress-rank${rank}-${rune || 'base'}-${quality}.png`) });
        if (verifyExpiry) {
            await page.waitForTimeout(Math.max(0, startedAt + (baseDuration + 1) * 1000 - Date.now()));
            expect(await page.evaluate(() => window.game.player.ironFortressTimer > 0 &&
                window.game.player.attachedStatusEffects.has('iron_fortress'))).toBe(true);
            await expect(badge).toBeVisible();
            await expect.poll(() => page.evaluate(() => window.__fortressNative.expired), { timeout: 15_000 }).toBe(true);
            await expect.poll(() => page.evaluate(() => window.game.player.ironFortressTimer <= 0 &&
                !window.game.player.attachedStatusEffects.has('iron_fortress'))).toBe(true);
            await expect(badge).toHaveCount(0);
            await expect(page.locator('#phone-status-panel [data-buff-id="well_rested"]')).toBeVisible();
        }
        await page.locator('#btn-close-phone-status').tap();
        await expect(page.locator('#phone-status-panel')).toBeHidden();
        console.log(`[fortress-native] rank=${rank}, rune=${rune || 'none'}, quality=${quality}, expected=${expected}, naturalExpiry=${verifyExpiry}`);
    }

    await cast(0, '', 'high', false);
    await skills('Talents');
    const buy = page.locator('button[data-build-action="talent:FTR_07"]');
    await expect(page.locator('.phone-build-card').filter({ has: buy }))
        .toContainText('+4% Iron Fortress duration per rank (20% max)');
    for (let rank = 1; rank <= 5; rank++) {
        const points = await page.evaluate(() => window.game.player.talentPoints);
        await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.FTR_07)).toBe(rank);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points - 1);
        await page.waitForTimeout(1100); // Ordinary request pacing, no hidden retry or rank assignment.
    }
    await expect(buy).toBeDisabled();
    await page.locator('#btn-close-skills').tap();
    await cast(5, '', 'high', true);
    await skills('Runes');
    await page.locator('#phone-rune-skill').selectOption('Iron Fortress');
    const extended = page.locator('button[data-build-action="rune:ironfortress_extended"]');
    await extended.scrollIntoViewIfNeeded(); await extended.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.skillRunes?.['Iron Fortress'])).toBe('ironfortress_extended');
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    const points = await page.evaluate(() => window.game.player.talentPoints);
    await page.locator('#btn-close-skills').tap();
    await loginAndEnterWorld(page, credentials); // A new document, not a synthetic state reset.
    await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.FTR_07)).toBe(5);
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points);
    await page.setViewportSize({ width: 844, height: 390 });
    await cast(5, 'ironfortress_extended', 'low', true);
    expect(failures, failures.join('\n')).toEqual([]);
});
