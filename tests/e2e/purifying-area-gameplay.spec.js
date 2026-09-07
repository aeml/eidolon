import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone Ministry purchases expand the accepted Purifying Wave and rendered ring across login', async ({ page, baseURL }) => {
    test.setTimeout(180_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires the disposable cleanse-area route');
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Cleric');
    let lastCommandAt = 0;
    async function command(value) {
        const delay = Math.max(0, 1100 - (Date.now() - lastCommandAt));
        if (delay > 0) await page.waitForTimeout(delay);
        lastCommandAt = Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value); await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    // Prepared functional fixture, not earned progression. These existing
    // isolated allowlisted commands only prepare level/resources/cooldowns.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Skills', exact: true }).tap();
    const branch = page.locator('[data-build-action="branch:A"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Purifying Wave'))).toBeGreaterThanOrEqual(0);
    await page.locator('#btn-close-skills').tap();

    async function verifyCast(rank, quality) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality);
        await page.locator('#btn-close-settings').tap();
        // Closing settings leaves the phone menu open; its toggle returns to play.
        if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command('/qa-animation-ready');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        await page.evaluate(() => {
            window.__waveArea = { casts: [], results: [] };
            if (window.__waveAreaObserver) return;
            window.__waveAreaObserver = true;
            const game = window.game, receive = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const result = receive(message);
                if (message.type === 'ability_result' && message.payload?.skillName === 'Purifying Wave') window.__waveArea.results.push(message.payload);
                if (message.type === 'ability' && message.payload?.sourceId === game.player.id && message.payload.skillName === 'Purifying Wave') {
                    const effect = game.effects.find(effect => effect.isActive && effect.abilityShape?.sourceId === game.player.id && effect.abilityShape?.skillName === 'Purifying Wave');
                    const root = effect?.meshes?.[0];
                    const boundary = root?.children.find(part => part.userData.normalizedGameplayRadius === 1);
                    window.__waveArea.casts.push({ radius: message.payload.radius, arc: message.payload.arc,
                        meshRadius: boundary?.scale.x, attached: root?.parent === game.renderSystem.effectGroup,
                        authoritative: effect?.abilityShape.authoritative, quality: game.uiManager.getGraphicsQuality() });
                }
                return result;
            };
        });
        const state = await page.evaluate(() => ({ mana: window.game.player.stats.mana, rank: window.game.player.talentRanks?.CLR_34 || 0,
            slot: window.game.player.hotbar.indexOf('Purifying Wave') }));
        expect(state.rank).toBe(rank);
        await page.locator('#hotbar-container .hotbar-slot').nth(state.slot).tap();
        await expect.poll(() => page.evaluate(() => window.__waveArea.casts.length)).toBe(1);
        await expect.poll(() => page.evaluate(() => window.__waveArea.results.length)).toBe(1);
        const observation = await page.evaluate(() => window.__waveArea);
        expect(observation.results[0].accepted).toBe(true);
        expect(state.mana - observation.results[0].mana).toBe(30);
        const cast = observation.casts[0];
        expect(cast).toMatchObject({ attached: true, authoritative: true, quality });
        expect(cast.radius).toBeCloseTo(rank ? 9.2 : 8, 8);
        expect(cast.meshRadius).toBeCloseTo(cast.radius, 8);
        expect(cast.arc).toBeCloseTo(2 * Math.PI, 8);
        console.log(`[purifying-area] rank ${rank}, ${quality}: accepted radius ${cast.radius} matches actual mesh`);
    }
    await verifyCast(0, 'high');
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Talents', exact: true }).tap();
    for (let rank = 1; rank <= 5; rank++) {
        const buy = page.locator('button[data-build-action="talent:CLR_34"]');
        await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.CLR_34 || 0)).toBe(rank);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    }
    await page.locator('#btn-close-skills').tap();
    await verifyCast(5, 'low');
    await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);
    await page.setViewportSize({ width: 844, height: 390 });
    await verifyCast(5, 'high');
    expect(failures, failures.join('\n')).toEqual([]);
});
