import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone build actions receive authoritative confirmation and survive reconnect', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password || process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires a fresh disposable character');
    test.setTimeout(180_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    // Explicit level fixture exposes level-gated build choices; no skill/rank/rune
    // is granted by a QA command. This is not leveling or balance evidence.
    await page.locator('#chat-mobile-toggle').tap();
    await page.locator('#chat-input').fill('/level 100'); await page.locator('#chat-input').press('Enter');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.locator('#chat-mobile-toggle').tap();
    let lastRank, lastRune;
    for (const [width, height, branch] of [[390, 844, 'B'], [844, 390, 'A']]) {
        await page.setViewportSize({ width, height });
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
        const tabs = page.locator('.phone-build-tabs');
        await tabs.getByRole('button', { name: 'Skills', exact: true }).tap();
        const choose = page.locator(`[data-build-action="branch:${branch}"]`);
        await choose.scrollIntoViewIfNeeded(); await choose.tap();
        await expect.poll(() => page.evaluate(() => window.game.player.selectedBranch)).toBe(branch);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        await expect(page.locator('.phone-build-feedback')).toContainText('Confirmed');

        await tabs.getByRole('button', { name: 'Talents', exact: true }).tap();
        const rank = page.locator('button[data-build-action^="talent:"]').first();
        const talentId = (await rank.getAttribute('data-build-action')).slice(7);
        const before = await page.evaluate(id => window.game.player.talentRanks?.[id] || 0, talentId);
        await rank.scrollIntoViewIfNeeded(); await rank.tap();
        await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id], talentId)).toBe(before + 1);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        lastRank = { id: talentId, rank: before + 1 };

        await tabs.getByRole('button', { name: 'Runes', exact: true }).tap();
        const select = page.locator('#phone-rune-skill');
        const skill = branch === 'B' ? 'Earthshaker' : 'Iron Fortress';
        await select.selectOption(skill);
        const equip = page.locator('button[data-build-action^="rune:"]').first();
        const runeId = (await equip.getAttribute('data-build-action')).slice(5);
        await equip.scrollIntoViewIfNeeded(); await equip.tap();
        await expect.poll(() => page.evaluate(name => window.game.player.skillRunes?.[name], skill)).toBe(runeId);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        lastRune = { skill, runeId };
        if (branch === 'A') {
            await tabs.getByRole('button', { name: 'Talents', exact: true }).tap();
            const reset = page.getByRole('button', { name: 'Reset talents', exact: true });
            await reset.scrollIntoViewIfNeeded(); await reset.tap();
            await page.getByRole('button', { name: 'Cancel reset', exact: true }).tap();
            expect(await page.evaluate(id => window.game.player.talentRanks?.[id], talentId)).toBe(before + 1);
            await reset.tap(); await page.getByRole('button', { name: 'Confirm reset', exact: true }).tap();
            await expect.poll(() => page.evaluate(() => Object.keys(window.game.player.talentRanks || {}).length)).toBe(0);
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
            const restore = page.locator(`button[data-build-action="talent:${talentId}"]`);
            await restore.scrollIntoViewIfNeeded(); await restore.tap();
            await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id], talentId)).toBe(1);
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
            lastRank.rank = 1;
            // Fault injection exercises transport resume with the menu still open.
            await page.evaluate(() => window.game.network.socket.close());
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.disconnected)).toBe(true);
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.disconnected), { timeout: 30_000 }).toBe(false);
            await expect(restore).toBeEnabled();
            expect(await page.evaluate(id => window.game.player.talentRanks?.[id], talentId)).toBe(1);
            console.log('[phone-build] canceled/confirmed reset and open-menu transport resume retained authoritative state');
        }
        console.log(`[phone-build] ${width}x${height}: branch, one talent rank and rune confirmed by server`);
        await page.locator('#btn-close-skills').tap();
    }
    await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.selectedBranch)).toBe('A');
    expect(await page.evaluate(id => window.game.player.talentRanks?.[id], lastRank.id)).toBe(lastRank.rank);
    expect(await page.evaluate(skill => window.game.player.skillRunes?.[skill], lastRune.skill)).toBe(lastRune.runeId);
    console.log('[phone-build] specialization, rank and rune persisted after reconnect');
    expect(failures, failures.join('\n')).toEqual([]);
});
