import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { installEarthshakerAreaObserver } from './earthshaker-area-observer.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone Earthshaker purchases and rune footprints survive saved login', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(300_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires the isolated Earthshaker area route');
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Fighter');
    // Prepared level only. All talent/rune purchases use the real phone UI;
    // no synthetic casts, effect spawns, rank grants or cooldown resets.
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
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Earthshaker'))).toBeGreaterThanOrEqual(0);
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();
    const initialPoints = await page.evaluate(() => window.game.player.talentPoints);
    async function buy(id, lastRank) {
        await skills('Talents');
        const button = page.locator(`button[data-build-action="talent:${id}"]`);
        const current = await page.evaluate(id => window.game.player.talentRanks?.[id] || 0, id);
        for (let rank = current+1; rank <= lastRank; rank++) {
            const points = await page.evaluate(() => window.game.player.talentPoints);
            await button.scrollIntoViewIfNeeded(); await button.tap();
            await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id], id)).toBe(rank);
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
            expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points-1);
            await page.waitForTimeout(1100);
        }
        if (lastRank === 5) await expect(button).toBeDisabled();
        await page.locator('#btn-close-skills').tap();
    }
    async function equip(rune) {
        await skills('Runes'); await page.locator('#phone-rune-skill').selectOption('Earthshaker');
        const button = page.locator(`[data-build-action="rune:${rune}"]`);
        await button.scrollIntoViewIfNeeded(); await button.tap();
        await expect.poll(() => page.evaluate(() => window.game.player.skillRunes?.Earthshaker)).toBe(rune);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        await page.locator('#btn-close-skills').tap();
    }
    let castIndex = 0;
    async function cast(ranks, radius, quality, rune = '') {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
        if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        await expect.poll(() => page.evaluate(() => (window.game.player.cooldowns.Earthshaker || 0) <= 0 &&
            window.game.player.stats.mana === window.game.player.stats.maxMana &&
            !window.game.effects.some(effect => effect.isActive && effect.abilityShape?.skillName === 'Earthshaker')),
        { timeout: 20_000 }).toBe(true);
        await page.evaluate(installEarthshakerAreaObserver);
        const before = await page.evaluate(() => ({ mana: window.game.player.stats.mana,
            ranks: ['FTR_14', 'FTR_33', 'FTR_38'].map(id => window.game.player.talentRanks?.[id] || 0),
            rune: window.game.player.skillRunes?.Earthshaker || '', slot: window.game.player.hotbar.indexOf('Earthshaker') }));
        expect(before.ranks).toEqual(ranks); expect(before.rune).toBe(rune);
        expect(before.slot).toBeGreaterThanOrEqual(0);
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        const aftershock = rune === 'earthshaker_aftershock';
        let qa;
        try {
            await expect.poll(() => page.evaluate(() => window.__earthshakerArea.casts.length), { intervals: [20] }).toBe(aftershock ? 2 : 1);
            await page.screenshot({ path: testInfo.outputPath(`earthshaker-${castIndex++}-${quality}-${rune || 'base'}.png`) });
            await expect.poll(() => page.evaluate(() => window.__earthshakerArea.effects.length > 0 &&
                window.__earthshakerArea.effects.every(effect => effect.frames.at(-1)?.active === false))).toBe(true);
        } finally {
            // Timeouts and assertion failures retain the same raw observations.
            qa = await page.evaluate(() => window.__earthshakerArea).catch(() => ({ unavailable: true }));
            await testInfo.attach(`earthshaker-${castIndex}-${ranks.join('-')}-${quality}`, { body: JSON.stringify(qa), contentType: 'application/json' });
        }
        expect(qa.results).toHaveLength(1); expect(qa.results[0].accepted).toBe(true);
        expect(before.mana - qa.results[0].mana).toBe(40);
        for (const event of qa.casts) {
            const phase = event.phase || '', expectedRadius = phase ? radius * 3.5/6 : radius;
            const shapeKind = !phase && rune === 'earthshaker_fissure' ? 'line' : 'circle';
            expect(['', 'aftershock']).toContain(phase);
            expect(event.shapeKind).toBe(shapeKind); expect(event.shapeResolved).toBe(true);
            expect(event.radius).toBeCloseTo(expectedRadius, 8);
            const dx = event.targetX-event.origin.x, dz = event.targetZ-event.origin.z;
            expect(Math.hypot(dx, dz)).toBeCloseTo(1, 8);
            const frames = qa.effects.filter(effect => (effect.phase || '') === phase)
                .flatMap(effect => effect.frames.filter(frame => frame.active && frame.acknowledged));
            expect(frames.length).toBeGreaterThan(0);
            for (const frame of frames) {
                expect(frame).toMatchObject({ quality, kind: shapeKind, visible: true, attached: true, boundaryCount: shapeKind === 'line' ? 4 : 1 });
                expect(frame.radius).toBeCloseTo(expectedRadius, 5);
                expect(frame.origin[0]).toBeCloseTo(event.origin.x, 5); expect(frame.origin[2]).toBeCloseTo(event.origin.z, 5);
                if (shapeKind === 'line') {
                    expect(frame.halfWidth).toBeCloseTo(expectedRadius/4, 5);
                    expect(frame.ends[1][0]-frame.ends[0][0]).toBeCloseTo(dx*expectedRadius, 5);
                    expect(frame.ends[1][2]-frame.ends[0][2]).toBeCloseTo(dz*expectedRadius, 5);
                }
            }
        }
        expect(qa.casts.map(event => event.phase || '')).toEqual(aftershock ? ['', 'aftershock'] : ['']);
        if (aftershock) expect(qa.casts[1].origin).toEqual(qa.casts[0].origin);
    }
    await cast([0,0,0], 6, 'high');
    await buy('FTR_14', 1); await cast([1,0,0], 6.12, 'low');
    await buy('FTR_14', 5); await cast([5,0,0], 6.6, 'high');
    await buy('FTR_33', 5); await cast([5,5,0], 7.5, 'low');
    await buy('FTR_38', 5); await cast([5,5,5], 8.1, 'high');
    await equip('earthshaker_fissure');
    await cast([5,5,5], 8.1, 'high', 'earthshaker_fissure');
    await cast([5,5,5], 8.1, 'low', 'earthshaker_fissure');
    await equip('earthshaker_aftershock');
    await cast([5,5,5], 8.1, 'high', 'earthshaker_aftershock');
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(initialPoints-15);
    await loginAndEnterWorld(page, credentials);
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(initialPoints-15);
    await cast([5,5,5], 8.1, 'low', 'earthshaker_aftershock');
    await equip('earthshaker_seismic');
    await cast([5,5,5], 8.1, 'high', 'earthshaker_seismic');
    expect(failures, failures.join('\n')).toEqual([]);
});
