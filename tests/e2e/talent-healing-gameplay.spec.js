import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone healing talent purchases change actual healing and feedback after fresh login', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires the disposable healing route');
    const credentials = credentialsFromEnvironment();
    // Retries must start untrained, not reuse the saved build from attempt one.
    // The isolated runner explicitly allowlists this second disposable account.
    expect(testInfo.retry, 'isolated healing route supports the configured single retry').toBeLessThanOrEqual(1);
    if (testInfo.retry > 0) credentials.username += `-retry${testInfo.retry}`;
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Cleric');
    expect(await page.evaluate(() => window.game.player.talentRanks?.CLR_03 || 0)).toBe(0);

    let lastCommandAt = 0;
    async function command(value) {
        const delay = Math.max(0, 1100 - (Date.now() - lastCommandAt));
        if (delay > 0) await page.waitForTimeout(delay);
        lastCommandAt = Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    // Prepared functional fixture, NOT earned progression: existing allowlisted
    // commands grant level 100 and reset health/mana/cooldowns before each cast.
    // Skills and talent ranks are selected normally; healing is a real dispatch.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Skills', exact: true }).tap();
    const branch = page.locator('[data-build-action="branch:A"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar?.[0])).toBe('Healing Light');
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();

    async function verifyHeal(rank, label) {
        await page.evaluate(() => {
            window.__talentHealing = { results: [], heals: [] };
            if (window.__talentHealingObserver) return;
            window.__talentHealingObserver = true;
            const game = window.game, original = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                if (message.type === 'ability_result' && message.payload?.skillName === 'Healing Light') {
                    window.__talentHealing.results.push(message.payload);
                }
                if (message.type === 'heal' && message.payload?.sourceId === game.player.id &&
                    message.payload?.targetId === game.player.id && message.payload?.kind === 'holy') {
                    window.__talentHealing.heals.push(message.payload.amount);
                }
                return original(message);
            };
        });
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command('/qa-animation-ready low-health');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        await expect.poll(() => page.evaluate(() => window.game.player.stats.hp / window.game.player.stats.maxHp)).toBeLessThan(0.4);
        const state = await page.evaluate(() => {
            const p = window.game.player;
            return { wisdom: p.stats.wisdom, equipmentHealing: p.stats.healingDoneBonus || 0,
                missing: p.stats.maxHp - p.stats.hp, rank: p.talentRanks?.CLR_03 || 0, maxMana: p.stats.maxMana };
        });
        expect(state.rank).toBe(rank);
        const expected = Math.floor(Math.floor((30 + 3 * state.wisdom) * (1 + state.equipmentHealing)) * (1 + rank * 0.04) + 1e-9);
        expect(state.missing, 'The prepared cast must not be capped by missing health').toBeGreaterThan(expected + 10);
        await page.locator('#hotbar-container .hotbar-slot').first().tap();
        await expect.poll(() => page.evaluate(() => window.__talentHealing.results.length)).toBe(1);
        const result = await page.evaluate(() => window.__talentHealing.results[0]);
        expect(result.accepted).toBe(true);
        expect(state.maxMana - result.mana).toBe(25);
        await expect.poll(() => page.evaluate(() => window.__talentHealing.heals)).toEqual([expected]);
        await expect.poll(() => page.evaluate(amount => window.game.floatingTextManager.texts.some(text => {
            const bounds = text.el.getBoundingClientRect();
            return text.el.textContent === `+${amount}` && Number(getComputedStyle(text.el).opacity) > 0 &&
                bounds.width > 0 && bounds.right > 0 && bounds.left < innerWidth && bounds.bottom > 0 && bounds.top < innerHeight;
        }), expected)).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`healing-${label}.png`) });
        console.log(`[talent-healing] ${JSON.stringify({ label, rank, expected, received: result.accepted })}`);
    }

    await verifyHeal(0, 'portrait-baseline');
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Talents', exact: true }).tap();
    for (let rank = 1; rank <= 5; rank++) {
        const buy = page.locator('button[data-build-action="talent:CLR_03"]');
        await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.CLR_03)).toBe(rank);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    }
    await page.locator('#btn-close-skills').tap();
    await verifyHeal(5, 'portrait-mastery');
    await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.selectedBranch)).toBe('A');
    await page.setViewportSize({ width: 844, height: 390 });
    await verifyHeal(5, 'landscape-saved');
    expect(failures, failures.join('\n')).toEqual([]);
    if (process.env.EIDOLON_E2E_HEALING_RETRY_PROBE === '1' && testInfo.retry === 0) {
        // Opt-in fault injection after all saved-build checks pass. This tests
        // the real Playwright retry without relaxing any gameplay assertion.
        throw new Error('Intentional healing retry probe after successful saved-build verification');
    }
});
