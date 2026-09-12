import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone Roar area purchases reach the authoritative ring and survive login', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires the isolated Guardian Roar route');
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Fighter');
    let lastCommandAt = 0;
    async function command(value) {
        const delay = Math.max(0, 1100 - (Date.now() - lastCommandAt));
        if (delay) await page.waitForTimeout(delay);
        lastCommandAt = Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value); await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    // Isolated allowlisted level/resources fixture, not earned progression.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Skills', exact: true }).tap();
    const branch = page.locator('[data-build-action="branch:A"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Guardian Roar'))).toBeGreaterThanOrEqual(0);
    await page.locator('#btn-close-skills').tap();

    async function verifyCast(ranks, radius, quality) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality);
        await page.locator('#btn-close-settings').tap();
        if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command('/qa-animation-ready');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        await page.evaluate(() => {
            window.__roarArea = { casts: [], results: [] };
            if (window.__roarAreaObserver) return;
            window.__roarAreaObserver = true;
            const game = window.game, receive = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const result = receive(message);
                if (message.type === 'ability_result' && message.payload?.skillName === 'Guardian Roar') window.__roarArea.results.push(message.payload);
                if (message.type === 'ability' && message.payload?.sourceId === game.player.id && message.payload.skillName === 'Guardian Roar') {
                    const effect = game.effects.find(effect => effect.isActive && effect.abilityShape?.sourceId === game.player.id && effect.abilityShape?.skillName === 'Guardian Roar');
                    const root = effect?.meshes?.[0];
                    const boundary = root?.children.find(part => part.userData.normalizedGameplayRadius === 1);
                    window.__roarArea.casts.push({ radius: message.payload.radius, arc: message.payload.arc,
                        x: message.payload.targetX, z: message.payload.targetZ, meshX: root?.position.x, meshZ: root?.position.z,
                        meshRadius: boundary?.scale.x, attached: root?.parent === game.renderSystem.effectGroup,
                        authoritative: effect?.abilityShape.authoritative, quality: game.uiManager.getGraphicsQuality() });
                }
                return result;
            };
        });
        const state = await page.evaluate(() => ({ mana: window.game.player.stats.mana,
            ranks: ['FTR_10', 'FTR_33', 'FTR_38'].map(id => window.game.player.talentRanks?.[id] || 0),
            slot: window.game.player.hotbar.indexOf('Guardian Roar') }));
        expect(state.ranks).toEqual(ranks);
        await page.locator('#hotbar-container .hotbar-slot').nth(state.slot).tap();
        await expect.poll(() => page.evaluate(() => window.__roarArea.casts.length)).toBe(1);
        await expect.poll(() => page.evaluate(() => window.__roarArea.results.length)).toBe(1);
        const observation = await page.evaluate(() => window.__roarArea);
        expect(observation.results[0].accepted).toBe(true);
        expect(state.mana - observation.results[0].mana).toBe(35);
        const cast = observation.casts[0];
        expect(cast).toMatchObject({ attached: true, authoritative: true, quality });
        expect(cast.radius).toBeCloseTo(radius, 8);
        expect(cast.meshRadius).toBeCloseTo(radius, 8);
        expect(cast.meshX).toBeCloseTo(cast.x, 8); expect(cast.meshZ).toBeCloseTo(cast.z, 8);
        expect(cast.arc).toBeCloseTo(2 * Math.PI, 8);
        console.log(`[guardian-roar-area] ranks ${ranks.join('/')}, ${quality}: accepted radius ${radius} matches attached ring`);
    }
    async function buyFive(talentId) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button', { name: 'Talents', exact: true }).tap();
        for (let rank = 1; rank <= 5; rank++) {
            const buy = page.locator(`button[data-build-action="talent:${talentId}"]`);
            try {
                for (let attempt = 0; attempt < 3; attempt++) {
                    const points = await page.evaluate(() => window.game.player.talentPoints);
                    await buy.scrollIntoViewIfNeeded(); await buy.tap();
                    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
                    const actualRank = await page.evaluate(id => window.game.player.talentRanks?.[id] || 0, talentId);
                    if (actualRank === rank) {
                        expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points - 1);
                        break;
                    }
                    expect(actualRank).toBe(rank - 1);
                    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points);
                    await expect(page.locator('.phone-build-feedback')).toContainText('rate limit');
                    await expect(buy).toBeEnabled();
                    console.log(`[roar-purchase] ${talentId} rank ${rank}: rate rejection unlocked controls without spending`);
                    // Another deliberate user tap after the visible rejection;
                    // the game itself must never retry a purchase automatically.
                    await page.waitForTimeout(1100);
                }
                await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id] || 0, talentId)).toBe(rank);
            } catch (error) {
                console.log('[roar-purchase-failure]', JSON.stringify(await page.evaluate(({ talentId, rank }) => ({
                    talentId, expectedRank: rank, ranks: window.game.player.talentRanks,
                    points: window.game.player.talentPoints,
                    pending: window.game.uiManager.skillTree.mobile.pending,
                    feedback: window.game.uiManager.skillTree.mobile.feedback
                }), { talentId, rank })));
                await page.screenshot({ path: testInfo.outputPath('roar-purchase-failure.png') });
                throw error;
            }
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        }
        await page.locator('#btn-close-skills').tap();
    }
    await verifyCast([0, 0, 0], 15, 'high');
    await buyFive('FTR_10'); await verifyCast([5, 0, 0], 16.5, 'low');
    await buyFive('FTR_33'); await verifyCast([5, 5, 0], 18.75, 'low');
    await buyFive('FTR_38'); await verifyCast([5, 5, 5], 20.25, 'low');
    await loginAndEnterWorld(page, credentials);
    await page.setViewportSize({ width: 844, height: 390 });
    await verifyCast([5, 5, 5], 20.25, 'high');
    expect(failures, failures.join('\n')).toEqual([]);
});
