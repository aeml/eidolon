import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    projectEntity, projectNearestHostile, useEncounterQAWaypoint } from './helpers.js';
import { hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, trace: 'off', screenshot: 'off', video: 'off' });

test('paid Focus training survives login and amplifies exactly one real spell on both clients', async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires isolated allowlisted actors');
    const credentials = credentialsFromEnvironment();
    const failures = collectBrowserFailures(page, baseURL);
    const lastCommands = new Map();
    async function command(actor, value) {
        await actor.waitForTimeout(Math.max(0, 1100 - (Date.now() - (lastCommands.get(actor) || 0))));
        lastCommands.set(actor, Date.now());
        const mobile = await actor.evaluate(() => window.game.isMobile);
        if (mobile) await actor.locator('#chat-mobile-toggle').tap();
        else await actor.keyboard.press('Enter');
        const input = actor.locator('#chat-input');
        await input.fill(value); await input.press('Enter');
        if (mobile) await actor.locator('#chat-mobile-toggle').tap();
        else if (await input.evaluate(node => node === document.activeElement)) await actor.keyboard.press('Escape');
    }
    async function ready(actor) {
        const sequence = await actor.evaluate(() => window.game.animationQAReadySequence || 0);
        await command(actor, '/qa-animation-ready');
        await expect.poll(() => actor.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
    }
    async function quality(actor, value) {
        const mobile = await actor.evaluate(() => window.game.isMobile);
        if (mobile) await actor.locator('#btn-mobile-menu').tap();
        else await actor.keyboard.press('Escape');
        await actor.locator('#btn-settings').click();
        await actor.locator('#graphics-quality').selectOption(value);
        await actor.locator('#btn-close-settings').click();
        if (await actor.locator('#esc-menu').isVisible()) {
            if (mobile) await actor.locator('#btn-mobile-menu').tap();
            else await actor.keyboard.press('Escape');
        }
    }
    async function observe(actor, sourceId) {
        await actor.evaluate(sourceId => {
            window.__focusNative = { sourceId, results: [], damage: [] };
            if (window.__focusNativeInstalled) return;
            window.__focusNativeInstalled = true;
            const game = window.game, receive = game.handleServerMessage.bind(game);
            game.handleServerMessage = message => {
                const result = receive(message), qa = window.__focusNative;
                if (message.type === 'ability_result') qa.results.push(message.payload);
                if (message.type === 'damage' && message.payload?.sourceId === qa.sourceId) qa.damage.push(message.payload);
                return result;
            };
        }, sourceId);
    }
    async function focusState(actor, sourceId) {
        return actor.evaluate(id => {
            const g = window.game, p = g.player.id === id ? g.player : g.remotePlayers.get(id);
            const effect = p?.attachedStatusEffects?.get('spell_focus');
            return { active: Boolean(p?.spellFocusActive), multiplier: p?.spellFocusMultiplier,
                timer: p?.spellFocusTimer || 0, attached: Boolean(effect?.isActive && effect.group?.parent),
                meshes: effect?.getMetrics().meshes || 0, quality: effect?.quality,
                detail: g.player.id === id ? g.activeBuffs?.find(b => b.id === 'spell_focus')?.detail : null };
        }, sourceId);
    }
    async function cast(actor, skill) {
        const slot = await actor.evaluate(skill => window.game.player.hotbar.indexOf(skill), skill);
        expect(slot).toBeGreaterThanOrEqual(0);
        const before = await actor.evaluate(() => window.__focusNative.results.length);
        if (await actor.evaluate(() => window.game.isMobile)) await actor.locator('#hotbar-container .hotbar-slot').nth(slot).tap();
        else await actor.keyboard.press(String(slot + 1));
        await expect.poll(() => actor.evaluate(() => window.__focusNative.results.length)).toBe(before + 1);
        const result = await actor.evaluate(() => window.__focusNative.results.at(-1));
        expect(result.skillName).toBe(skill); expect(result.accepted).toBe(true);
        return result;
    }

    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Wizard');
    // Prepared functional QA, not earned progression: no grants of ranks or hits.
    await command(page, '/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
    await page.locator('.phone-build-tabs').getByRole('button', { name: 'Skills', exact: true }).tap();
    const branch = page.locator('[data-build-action="branch:B"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Spell Focus'))).toBe(true);
    await page.locator('#btn-close-skills').tap();
    const peerBrowser = await browser.browserType().launch({ executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
        headless: true, args: hardwareWebGLBrowserArgs() });
    let desktopContext, desktopOwner;
    try {
        const peer = await (await peerBrowser.newContext({ ...devices['Desktop Chrome'], baseURL })).newPage();
        const peerFailures = collectBrowserFailures(peer, baseURL);
        await loginAndEnterWorld(peer, { ...credentials, username: `${credentials.username}-observer`, characterClass: 'Fighter' });
        let sourceId = await page.evaluate(() => window.game.player.id);
        await expect.poll(() => peer.evaluate(id => window.game.remotePlayers.has(id), sourceId)).toBe(true);
        for (const actor of [page, peer]) await observe(actor, sourceId);
        for (const [rank, multiplier, mode] of [[0, 2.5, 'high'], [5, 3, 'low']]) {
            if (rank) {
                await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
                await page.locator('.phone-build-tabs').getByRole('button', { name: 'Talents', exact: true }).tap();
                for (let next = 1; next <= 5; next++) {
                    const buy = page.locator('[data-build-action="talent:WIZ_15"]');
                    for (let attempt = 0; attempt < 3; attempt++) {
                        const points = await page.evaluate(() => window.game.player.talentPoints);
                        await buy.scrollIntoViewIfNeeded(); await buy.tap();
                        await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
                        const actual = await page.evaluate(() => window.game.player.talentRanks?.WIZ_15 || 0);
                        if (actual === next) {
                            expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points - 1); break;
                        }
                        expect(actual).toBe(next - 1);
                        expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points);
                        await expect(page.locator('.phone-build-feedback')).toContainText('rate limit');
                        await expect(buy).toBeEnabled(); await page.waitForTimeout(1100);
                    }
                    expect(await page.evaluate(() => window.game.player.talentRanks.WIZ_15)).toBe(next);
                }
                await page.locator('#btn-close-skills').tap();
            }
            for (const actor of [page, peer]) await quality(actor, mode);
            await ready(page); await cast(page, 'Spell Focus');
            for (const actor of [page, peer]) {
                await expect.poll(async () => (await focusState(actor, sourceId)).attached).toBe(true);
                const state = await focusState(actor, sourceId);
                expect(state).toMatchObject({ active: true, multiplier, quality: mode });
                expect(state.timer).toBeGreaterThan(10); expect(state.timer).toBeLessThanOrEqual(15);
                expect(state.meshes).toBeGreaterThan(0);
                await actor.screenshot({ path: testInfo.outputPath(`focus-${rank}-${mode}-${actor === page ? 'owner' : 'observer'}.png`) });
            }
            await expect.poll(async () => (await focusState(page, sourceId)).detail).toBe(`+${(multiplier - 1) * 100}% next spell damage`);
            for (const actor of [page, peer]) {
                await expect.poll(async () => (await focusState(actor, sourceId)).active, { timeout: 17_000 }).toBe(false);
                expect(await focusState(actor, sourceId)).toMatchObject({ attached: false, multiplier: 1 });
            }
            console.log(`[focus-native] ${rank} ranks, ${mode}: stored strength, both actual glyphs, detail and expiry verified`);
        }

        // Close the original connection; prove the saved build in a new desktop context.
        await page.goto('about:blank');
        desktopContext = await browser.newContext({ ...devices['Desktop Chrome'], baseURL });
        const owner = await desktopContext.newPage();
        desktopOwner = owner;
        const desktopFailures = collectBrowserFailures(owner, baseURL);
        await loginAndEnterWorld(owner, credentials);
        expect(await owner.evaluate(() => window.game.player.talentRanks.WIZ_15)).toBe(5);
        expect(await owner.evaluate(() => window.game.isMobile)).toBe(false);
        await quality(owner, 'high'); await quality(peer, 'high');
        sourceId = await owner.evaluate(() => window.game.player.id);
        for (const actor of [owner, peer]) await observe(actor, sourceId);
        for (const multiplier of [3, 1]) {
            // Bounded waypoint selects an existing live enemy; it creates no targets
            // and grants no outgoing damage. All targeting/casts remain real input.
            await useEncounterQAWaypoint(owner); await useEncounterQAWaypoint(peer);
            await expect.poll(() => peer.evaluate(id => window.game.remotePlayers.has(id), sourceId)).toBe(true);
            await ready(owner);
            if (multiplier === 3) {
                await cast(owner, 'Spell Focus');
                for (const actor of [owner, peer]) await expect.poll(async () => (await focusState(actor, sourceId)).multiplier).toBe(3);
                // The server admits another ability after its ordinary 500ms
                // global cooldown. Wait after the accepted Focus receipt and
                // acquire the moving target afterward, without resetting it.
                await owner.waitForTimeout(600);
            }
            let target;
            await expect.poll(async () => {
                target = await projectNearestHostile(owner);
                if (!target || target.distance >= 16) return false;
                for (const point of [null, { x: .2, y: .7, z: .5 }, { x: .8, y: .7, z: .5 }]) {
                    const aim = await projectEntity(owner, target.id, point);
                    if (!aim?.visible) continue;
                    await owner.mouse.move(aim.x, aim.y);
                    if (await owner.evaluate(id => window.game.hoveredEntity?.id === id, target.id)) return true;
                }
                return false;
            }).toBe(true);
            // Only Focus is trained: ordinary criticals can double this exact damage.
            const before = await owner.evaluate(() => ({ intelligence: window.game.player.stats.intelligence,
                fireBonus: window.game.player.stats.fireDamageBonus,
                ranks: window.game.player.talentRanks, runes: window.game.player.skillRunes,
                rest: window.game.player.wellRestedSeconds }));
            expect(before.ranks).toEqual({ WIZ_15: 5 });
            expect(before.runes || {}).toEqual({}); expect(before.fireBonus || 0).toBe(0);
            expect(before.rest === 0 || before.rest > 4).toBe(true);
            for (const actor of [owner, peer]) await observe(actor, sourceId);
            await cast(owner, 'Scorch Beam');
            const expected = Math.floor((25 + 2 * before.intelligence) * multiplier);
            const amounts = [];
            for (const actor of [owner, peer]) {
                await expect.poll(() => actor.evaluate(id => window.__focusNative.damage.some(hit => hit.targetId === id), target.id)).toBe(true);
                const amount = await actor.evaluate(id => window.__focusNative.damage.find(hit => hit.targetId === id).amount, target.id);
                expect([expected, expected * 2]).toContain(amount); amounts.push(amount);
                await expect.poll(async () => (await focusState(actor, sourceId)).active).toBe(false);
                expect(await focusState(actor, sourceId)).toMatchObject({ multiplier: 1, attached: false });
            }
            expect(amounts[1]).toBe(amounts[0]);
            console.log(`[focus-native] multiplier ${multiplier}: normal Scorch Beam input dealt ${amounts[0]} on both clients, charge absent afterward`);
        }
        expect(failures).toEqual([]); expect(peerFailures).toEqual([]); expect(desktopFailures).toEqual([]);
    } catch (error) {
        if (!page.isClosed() && page.url() !== 'about:blank') await page.screenshot({ path: testInfo.outputPath('focus-failure.png') });
        if (desktopOwner && !desktopOwner.isClosed()) {
            await desktopOwner.screenshot({ path: testInfo.outputPath('focus-desktop-failure.png') });
            console.log('[focus-native-failure]', JSON.stringify(await desktopOwner.evaluate(() => ({
                results: window.__focusNative?.results, damage: window.__focusNative?.damage,
                active: window.game?.player?.spellFocusActive,
                multiplier: window.game?.player?.spellFocusMultiplier
            }))));
        }
        throw error;
    } finally {
        await desktopContext?.close(); await peerBrowser.close();
    }
});
