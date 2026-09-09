import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, jumpByGroundClick,
    loginAndEnterWorld, readPlayerState, returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const state = page => page.evaluate(() => {
    const p = window.game.player;
    return { bank: p.wellRestedSeconds, zone: p.safeZoneId, state: p.state,
        strength: p.stats.strength, maxHP: p.stats.maxHp, maxMana: p.stats.maxMana,
        hp: p.stats.hp, mana: p.stats.mana,
        aura: Boolean(p.attachedStatusEffects.get('well_rested')?.group.parent) };
});

test('earned rest expires outside town and its stats, icon and aura return only after reentry', async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires an ordinary disposable registration');
    test.setTimeout(180_000);
    const credentials = credentialsFromEnvironment();
    credentials.username += '-expiry';
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect((await readPlayerState(page)).level).toBe(1);
    await expect.poll(async () => (await state(page)).bank).toBeGreaterThanOrEqual(5);
    expect(await state(page)).toMatchObject({ zone: 'lanternhold', strength: 11, maxHP: 110, maxMana: 110, aura: true });
    // Stop just outside the east gate, not in an encounter or a prepared
    // invulnerability fixture. Every crossing uses ordinary Ctrl-click input.
    for (let step = 0; step < 12 && (await readPlayerState(page)).x < 101.5; step++) {
        const p = await readPlayerState(page);
        await jumpByGroundClick(page, Math.min(25, 102 - p.x), Math.max(-8, Math.min(8, 200 - p.z)));
    }
    const outside = await readPlayerState(page);
    expect(outside.x).toBeGreaterThan(100);
    expect(outside.x).toBeLessThan(104);
    await expect.poll(async () => (await state(page)).zone).toBe('');
    const departing = await state(page);
    expect(departing.bank).toBeGreaterThan(0);
    expect(departing.bank).toBeLessThan(90);
    await expect.poll(() => state(page).then(p => p.bank), {
        timeout: Math.ceil(departing.bank + 10) * 1000,
        message: 'the real earned bank must expire without clock or buff mutation'
    }).toBe(0);
    await expect.poll(() => state(page).then(p => p.aura)).toBe(false);
    const expired = await state(page);
    expect(expired).toMatchObject({ zone: '', strength: 10, maxHP: 100, maxMana: 100 });
    expect(expired.state).not.toBe('DEAD');
    expect(expired.hp).toBeGreaterThan(0);
    expect(expired.hp).toBeLessThanOrEqual(100);
    expect(expired.mana).toBeLessThanOrEqual(100);
    await expect(page.locator('.minimap-buff-icon[data-buff-id="well_rested"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('rest-expired-outside.png') });

    await returnToTown(page);
    await expect.poll(() => state(page).then(p => p.aura)).toBe(true);
    expect(await state(page)).toMatchObject({ zone: 'lanternhold', strength: 11, maxHP: 110, maxMana: 110 });
    await expect(page.locator('.minimap-buff-icon[data-buff-id="well_rested"]')).toHaveAttribute('aria-label', /Resting/);
    await page.screenshot({ path: testInfo.outputPath('rest-earned-again.png') });
    console.log('[rest-expiry]', JSON.stringify({ departing, expired, reentered: await state(page) }));
    expect(failures, failures.join('\n')).toEqual([]);
});
