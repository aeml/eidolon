import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('phone shield duration training changes server timers and visible expiry', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(180_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires a disposable duration route');
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');

    let lastCommandAt = 0;
    async function command(value) {
        await page.waitForTimeout(Math.max(0, 1100 - (Date.now() - lastCommandAt)));
        lastCommandAt = Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    // Prepared functional fixture, not earned progression. Only the existing
    // level and readiness commands prepare the account; ranks/casts use touch.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Skills', exact: true }).tap();
    const branch = page.locator('[data-build-action="branch:C"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar?.[1])).toBe('Arcane Shield');
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();

    async function verifyShield(rank, label, verifyExpiry = false) {
        await page.evaluate(() => {
            window.__durationQA = { results: [], snapshots: [] };
            if (window.__durationObserverInstalled) return;
            window.__durationObserverInstalled = true;
            const game = window.game, original = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                if (message.type === 'ability_result' && message.payload?.skillName === 'Arcane Shield') {
                    window.__durationQA.results.push(message.payload);
                }
                const states = message.type === 'state' ? message.payload : message.type === 'delta' ? message.payload?.u : null;
                for (const state of Object.values(states || {})) {
                    if (state.id === game.player.id && state.arcaneShieldActive !== undefined) {
                        window.__durationQA.snapshots.push({ at: Date.now(), active: state.arcaneShieldActive,
                            duration: state.arcaneShieldDuration, hp: state.arcaneShieldHp });
                    }
                }
                return original(message);
            };
        });
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command('/qa-animation-ready');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        expect(await page.evaluate(() => window.game.player.talentRanks?.WIZ_32 || 0)).toBe(rank);
        const expected = 20 * (1 + rank * .05);
        const castAt = Date.now();
        await page.locator('#hotbar-container .hotbar-slot').nth(1).tap();
        await expect.poll(() => page.evaluate(() => window.__durationQA.results.length)).toBe(1);
        expect(await page.evaluate(() => window.__durationQA.results[0].accepted)).toBe(true);
        const shieldAcknowledgedAt = Date.now();
        await expect.poll(() => page.evaluate(() => Math.max(0, ...window.__durationQA.snapshots
            .filter(snapshot => snapshot.active).map(snapshot => snapshot.duration || 0)))).toBeGreaterThan(expected - 1);
        const maximum = await page.evaluate(() => Math.max(0, ...window.__durationQA.snapshots
            .filter(snapshot => snapshot.active).map(snapshot => snapshot.duration || 0)));
        expect(maximum).toBeLessThanOrEqual(expected + .1);
        await page.locator('#btn-phone-status').tap();
        const panel = page.locator('#phone-status-panel');
        await expect(panel).toBeVisible();
        const badge = panel.locator('[data-buff-id="arcane_shield"]');
        await expect(badge).toBeVisible();
        await expect(badge.locator('h3')).toHaveText('Arcane Shield');
        await expect(badge.locator('.phone-status-kind')).toHaveText('Buff');
        await expect(badge.locator('.phone-status-detail')).not.toBeEmpty();
        const remaining = badge.locator('.phone-status-remaining');
        await expect(remaining).toHaveText(/^\d+\.\ds left$/);
        const badgeSeconds = Number((await remaining.textContent()).match(/(\d+\.\d)s/)[1]);
        expect(badgeSeconds).toBeGreaterThan(expected - 2);
        expect(badgeSeconds).toBeLessThanOrEqual(expected + .1);
        await expect.poll(() => page.evaluate(() => {
            const p = window.game.player;
            return p.arcaneShieldActive && p.arcaneShieldTimer > 0 && p.shieldHP > 0 && p.attachedStatusEffects.has('arcane_shield');
        })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`duration-${label}.png`) });
        if (verifyExpiry) {
            // Wait past the original 20-second deadline without changing clocks,
            // HP, effects or server state. The ranked shield must still exist.
            await page.waitForTimeout(Math.max(0, castAt + 21_000 - Date.now()));
            expect(await page.evaluate(() => window.game.player.arcaneShieldActive &&
                window.game.player.shieldHP > 0 && window.game.player.attachedStatusEffects.has('arcane_shield'))).toBe(true);
            await expect.poll(() => page.evaluate(since => window.__durationQA.snapshots.some(snapshot =>
                snapshot.at > since && snapshot.active === false), castAt + 21_000), { timeout: 8_000 }).toBe(true);
            await expect.poll(() => page.evaluate(() => window.game.player.arcaneShieldActive === false &&
                window.game.player.shieldHP === 0 && !window.game.player.attachedStatusEffects.has('arcane_shield'))).toBe(true);
            await expect(badge).toHaveCount(0);
            await expect(panel).toBeVisible();
            // The shield expired, not the independently earned sanctuary buff.
            await expect.poll(() => page.evaluate(() => window.game.player.safeZoneId === 'lanternhold' &&
                window.game.player.wellRestedSeconds > 0)).toBe(true);
            const rested = panel.locator('[data-buff-id="well_rested"]');
            await expect(rested).toBeVisible();
            await expect(rested.locator('h3')).toHaveText('Well Rested');
            await expect(rested.locator('.phone-status-remaining')).toContainText('Resting');
            await expect(panel.locator('.phone-status-empty')).toBeHidden();
        }
        // The reading panel is non-modal: the ordinary Skill button still reaches
        // the server while it is open. No timer or combat state is modified.
        await page.evaluate(() => {
            window.__statusCastResults = [];
            const game = window.game, original = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                if (message.type === 'ability_result') window.__statusCastResults.push(message.payload);
                return original(message);
            };
        });
        // The server enforces a 500ms global cooldown after every accepted
        // spell. Fast screenshots must not turn this panel test into a race
        // against that independent combat rule. Wait in real time after ACK.
        await page.waitForTimeout(Math.max(0, shieldAcknowledgedAt + 600 - Date.now()));
        await page.locator('#btn-mobile-ability').tap();
        await expect.poll(() => page.evaluate(() => window.__statusCastResults
            .filter(result => result.skillName === 'Fireball'))).not.toEqual([]);
        expect(await page.evaluate(() => window.__statusCastResults.find(result =>
            result.skillName === 'Fireball'))).toMatchObject({ accepted: true });
        await expect(panel).toBeVisible();
        await page.locator('#chat-mobile-toggle').tap();
        await expect(panel).toBeHidden();
        await expect(page.locator('#chat-input')).toBeVisible();
        await page.locator('#chat-mobile-toggle').tap();
        console.log(`[talent-duration] ${JSON.stringify({ label, rank, expected, maximum, verifiedExpiry: verifyExpiry })}`);
    }

    await verifyShield(0, 'portrait-baseline');
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Talents', exact: true }).tap();
    for (let rank = 1; rank <= 5; rank++) {
        const buy = page.locator('button[data-build-action="talent:WIZ_32"]');
        await buy.scrollIntoViewIfNeeded(); await buy.tap();
        await expect.poll(() => page.evaluate(() => window.game.player.talentRanks?.WIZ_32)).toBe(rank);
        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    }
    await page.locator('#btn-close-skills').tap();
    await verifyShield(5, 'portrait-trained', true);
    await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);
    await page.setViewportSize({ width: 844, height: 390 });
    await verifyShield(5, 'landscape-saved');
    expect(failures, failures.join('\n')).toEqual([]);
});
