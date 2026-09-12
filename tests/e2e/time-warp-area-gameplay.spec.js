import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, moveByGroundClick, projectGroundOffset } from './helpers.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000, trace: 'off', screenshot: 'off', video: 'off' });

test('Time Warp training reaches a walked ally beyond the original radius and expires on both clients', async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires isolated registered actors');
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
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
    // Functional setup only; branch, training, travel and casts use ordinary UI.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await skills('Skills');
    const branch = page.locator('[data-build-action="branch:C"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.indexOf('Time Warp'))).toBeGreaterThanOrEqual(0);
    await page.locator('#btn-close-skills').tap();

    const peerBrowser = await browser.browserType().launch({ executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
        headless: true, args: hardwareWebGLBrowserArgs() });
    try {
        // BrowserType's test defaults include this spec's phone user agent and
        // touch mode even for a separately launched browser. Override the full
        // device, not just its viewport, for desktop click-to-move input.
        const ally = await (await peerBrowser.newContext({ ...devices['Desktop Chrome'], baseURL,
            viewport: { width: 1280, height: 720 } })).newPage();
        const allyFailures = collectBrowserFailures(ally, baseURL);
        await loginAndEnterWorld(ally, { ...credentials, username: `${credentials.username}-warp-view`, characterClass: 'Fighter' });
        expect(await ally.evaluate(() => window.game.isMobile)).toBe(false);
        expect(await page.evaluate(() => window.game.isMobile)).toBe(true);
        const source = await page.evaluate(() => ({ id: window.game.player.id, x: window.game.player.position.x, z: window.game.player.position.z }));
        await expect.poll(() => ally.evaluate(id => window.game.remotePlayers.has(id), source.id)).toBe(true);
        console.log('[time-warp-position-source]', JSON.stringify(source));
        for (let step = 0; step < 4; step++) {
            const offset = await ally.evaluate(source => ({ dx: source.x + 18.5 - window.game.player.position.x,
                dz: source.z - window.game.player.position.z }), source);
            if (Math.hypot(offset.dx, offset.dz) < .8) break;
            const scale = Math.min(1, 12 / Math.hypot(offset.dx, offset.dz));
            console.log('[time-warp-position-step]', JSON.stringify({ step, offset,
                projection: await projectGroundOffset(ally, offset.dx * scale, offset.dz * scale) }));
            await moveByGroundClick(ally, offset.dx * scale, offset.dz * scale,
                { moveOnly: true, allowJumpFallback: false, allowAlternatePaths: false });
            await expect.poll(() => ally.evaluate(() => !window.game.player.targetPosition)).toBe(true);
            console.log('[time-warp-position-arrival]', JSON.stringify(await ally.evaluate(() => {
                const p = window.game.player;
                return { x: p.position.x, z: p.position.z, blockedStops: p.movementMetrics?.blockedStops };
            })));
        }
        const distance = () => ally.evaluate(source => Math.hypot(window.game.player.position.x - source.x,
            window.game.player.position.z - source.z), source);
        expect(await distance()).toBeGreaterThan(16.5);
        expect(await distance()).toBeLessThan(19.75);
        for (const actor of [page, ally]) {
            await expect.poll(() => actor.evaluate(() => window.game.player.wellRestedSeconds > 0)).toBe(true);
            await actor.evaluate(() => {
                const g = window.game, receive = g.handleServerMessage.bind(g);
                window.__timeWarpNative = { casts: [], results: [], maxDuration: 0 };
                g.handleServerMessage = message => {
                    const result = receive(message);
                    if (message.type === 'ability' && message.payload?.skillName === 'Time Warp') {
                        const shape = g.effects?.findLast(effect => effect.abilityShape?.skillName === 'Time Warp' &&
                            effect.abilityShape.sourceId === message.payload.sourceId);
                        const boundary = shape?.meshes?.[0]?.children.find(part => part.userData.normalizedGameplayRadius === 1);
                        window.__timeWarpNative.casts.push({ ...message.payload, visibleRadius: boundary?.scale.x });
                    }
                    if (message.type === 'ability_result' && message.payload?.skillName === 'Time Warp') window.__timeWarpNative.results.push(message.payload);
                    if (message.type === 'state' || message.type === 'delta') window.__timeWarpNative.maxDuration =
                        Math.max(window.__timeWarpNative.maxDuration, g.player.hasteTimer || 0);
                    return result;
                };
            });
        }
        const baseline = await ally.evaluate(() => ({ speed: window.game.player.stats.speed,
            cooldown: window.game.player.stats.cooldownReduction, attack: window.game.player.stats.attackSpeed }));
        async function cast(trained, quality, mastery = 0) {
            await expect.poll(() => page.evaluate(() => window.game.player.hasteTimer <= 0), { timeout: 15_000 }).toBe(true);
            await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
            await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
            if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
            await ally.keyboard.press('Escape');
            await ally.locator('#btn-settings').click();
            await ally.locator('#graphics-quality').selectOption(quality);
            await ally.locator('#btn-close-settings').click();
            if (await ally.locator('#esc-menu').isVisible()) await ally.keyboard.press('Escape');
            const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
            await command('/qa-animation-ready');
            await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
            for (const actor of [page, ally]) await actor.evaluate(() => { window.__timeWarpNative = { casts: [], results: [], maxDuration: 0 }; });
            const slot = await page.evaluate(() => window.game.player.hotbar.indexOf('Time Warp'));
            await page.locator('#hotbar-container .hotbar-slot').nth(slot).tap();
            await expect.poll(() => page.evaluate(() => window.__timeWarpNative.results.length)).toBe(1);
            expect(await page.evaluate(() => window.__timeWarpNative.results[0].accepted)).toBe(true);
            for (const actor of [page, ally]) {
                await expect.poll(() => actor.evaluate(() => window.__timeWarpNative.casts.length)).toBe(1);
                const observed = await actor.evaluate(() => window.__timeWarpNative.casts[0]);
                expect(observed.radius).toBeCloseTo(trained ? 18.75 : 15, 6);
                expect(observed.visibleRadius).toBeCloseTo(observed.radius, 6);
                expect(observed.targetX).toBeCloseTo(source.x, 2);
                expect(observed.targetZ).toBeCloseTo(source.z, 2);
            }
            if (trained) {
                const duration = 9.6 + 8 * .04 * mastery;
                for (const actor of [page, ally]) {
                    await expect.poll(() => actor.evaluate(() => window.__timeWarpNative.maxDuration)).toBeGreaterThan(duration - .6);
                    expect(await actor.evaluate(() => window.__timeWarpNative.maxDuration)).toBeLessThanOrEqual(duration + .1);
                }
                const state = await ally.evaluate(() => ({ speed: window.game.player.stats.speed,
                    cooldown: window.game.player.stats.cooldownReduction, attack: window.game.player.stats.attackSpeed }));
                expect(state.speed).toBeCloseTo(baseline.speed * 1.5, 4);
                expect(state.attack).toBeCloseTo(baseline.attack / 1.5, 4);
                expect(state.cooldown).toBeCloseTo(Math.min(.8, (baseline.cooldown / 1.1 + .2) * 1.1), 4);
            } else {
                await ally.waitForTimeout(500);
                expect(await ally.evaluate(() => window.game.player.hasteTimer)).toBe(0);
            }
            await page.screenshot({ path: testInfo.outputPath(`time-warp-${trained ? 'trained' : 'base'}-mastery${mastery}-${quality}.png`) });
            for (const actor of [page, ally]) await expect.poll(() => actor.evaluate(() =>
                window.game.player.hasteTimer <= 0 && !window.game.player.attachedStatusEffects.has('time_warp')), { timeout: 15_000 }).toBe(true);
            const expired = await ally.evaluate(() => ({ speed: window.game.player.stats.speed,
                cooldown: window.game.player.stats.cooldownReduction, attack: window.game.player.stats.attackSpeed }));
            expect(expired).toEqual(baseline);
            console.log(`[time-warp-native] ${quality}, trained=${trained}, mastery=${mastery}: walked boundary, cast shape, recipient and expiry verified`);
        }
        async function buyFive(id) {
            await skills('Talents');
            for (let rank = 1; rank <= 5; rank++) {
                const buy = page.locator(`button[data-build-action="talent:${id}"]`);
                try {
                    for (let attempt = 0; attempt < 3; attempt++) {
                        const points = await page.evaluate(() => window.game.player.talentPoints);
                        await buy.scrollIntoViewIfNeeded(); await buy.tap();
                        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
                        if (await page.evaluate(id => window.game.player.talentRanks?.[id] || 0, id) === rank) {
                            expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points - 1);
                            break;
                        }
                        // A legitimate rate rejection must release the actual
                        // menu without spending a point. Retry with another
                        // deliberate tap only after its visible rejection.
                        expect(await page.evaluate(id => window.game.player.talentRanks?.[id] || 0, id)).toBe(rank - 1);
                        expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points);
                        await expect(page.locator('.phone-build-feedback')).toContainText('rate limit');
                        await expect(buy).toBeEnabled();
                        console.log(`[time-warp-training] ${id} rank ${rank}: rate rejection released controls without spending`);
                        await page.waitForTimeout(1100);
                    }
                    await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id] || 0, id)).toBe(rank);
                } catch (error) {
                    console.log('[time-warp-training-failure]', JSON.stringify(await page.evaluate(({ id, rank }) => ({
                        id, expectedRank: rank, ranks: window.game.player.talentRanks,
                        points: window.game.player.talentPoints,
                        pending: window.game.uiManager.skillTree.mobile.pending,
                        feedback: window.game.uiManager.skillTree.mobile.feedback
                    }), { id, rank })));
                    await page.screenshot({ path: testInfo.outputPath('time-warp-training-failure.png') });
                    throw error;
                }
                await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
                console.log(`[time-warp-training] ${id} rank ${rank} confirmed`);
            }
            await page.locator('#btn-close-skills').tap();
        }
        await cast(false, 'high');
        for (const id of ['WIZ_36', 'WIZ_38', 'WIZ_34']) await buyFive(id);
        await cast(true, 'low');
        await cast(true, 'high');
        await buyFive('WIZ_25');
        await cast(true, 'low', 5);
        await loginAndEnterWorld(page, credentials);
        for (const id of ['WIZ_36', 'WIZ_38', 'WIZ_34', 'WIZ_25']) expect(await page.evaluate(id => window.game.player.talentRanks?.[id], id)).toBe(5);
        await cast(true, 'high', 5);
        expect(failures, failures.join('\n')).toEqual([]);
        expect(allyFailures, allyFailures.join('\n')).toEqual([]);
    } finally { await peerBrowser.close(); }
});
