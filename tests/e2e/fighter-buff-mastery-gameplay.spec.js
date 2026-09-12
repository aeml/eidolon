import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { installFighterBuffObserver } from './fighter-buff-observer.js';
import { backendOriginBrowserArgs, hardwareWebGLBrowserArgs } from './browserLaunchPolicy.js';

const buffs = [
    { skill: 'Berserker Edge', id: 'berserker_edge', talent: 'FTR_19', base: 1.5, seconds: 15,
        active: 'berserkerModeActive', duration: 'berserkerModeDuration', multiplier: 'berserkerModeMultiplier', timer: 'berserkerEdgeTimer' },
    { skill: 'Last Stand Rampage', id: 'last_stand', talent: 'FTR_25', base: 3, seconds: 10,
        active: 'lastStandActive', duration: 'lastStandDuration', multiplier: 'lastStandMultiplier', timer: 'lastStandTimer' }
];
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

test('Fighter buff Masteries have paid, saved strength and visible High/Low owner and party lifecycle', async ({ page, browser, baseURL }, testInfo) => {
    test.setTimeout(600_000);
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires isolated Fighter damage-buff route');
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Fighter');
    const lastCommands = new Map();
    async function command(value, actor = page) {
        await actor.waitForTimeout(Math.max(0, 1100 - (Date.now() - (lastCommands.get(actor) || 0))));
        lastCommands.set(actor, Date.now());
        await actor.locator('#chat-mobile-toggle').tap();
        await actor.locator('#chat-input').fill(value); await actor.locator('#chat-input').press('Enter');
        await actor.locator('#chat-mobile-toggle').tap();
    }
    async function skills(tab) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button', { name: tab, exact: true }).tap();
    }
    async function buyRanks(id, from, to) {
        await skills('Talents');
        const buy = page.locator(`button[data-build-action="talent:${id}"]`);
        if (id !== 'FTR_36') await expect(page.locator('.phone-build-card').filter({ has: buy })).toContainText('Damage stat');
        for (let rank = from + 1; rank <= to; rank++) {
            const points = await page.evaluate(() => window.game.player.talentPoints);
            await buy.scrollIntoViewIfNeeded(); await buy.tap();
            await expect.poll(() => page.evaluate(id => window.game.player.talentRanks?.[id], id)).toBe(rank);
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
            expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points - 1);
            await page.waitForTimeout(1100);
        }
        if (to === 5) await expect(buy).toBeDisabled();
        await page.locator('#btn-close-skills').tap();
    }
    async function outsideStableStats(actor = page) {
        // Keep Last Stand outside town's 10%-per-second healing. Let any banked
        // Well Rested expire normally so its stat bonus cannot skew comparisons.
        await command('/qa-waypoint combat', actor);
        await expect.poll(() => actor.evaluate(() => Math.hypot(window.game.player.position.x - 120,
            window.game.player.position.z - 200)), { timeout: 20_000 }).toBeLessThan(3);
        await expect.poll(() => actor.evaluate(() => window.game.player.wellRestedSeconds || 0), { timeout: 60_000 }).toBe(0);
    }
    async function quality(value, actor = page) {
        await actor.locator('#btn-mobile-menu').tap(); await actor.locator('#btn-settings').tap();
        await actor.locator('#graphics-quality').selectOption(value); await actor.locator('#btn-close-settings').tap();
        if (await actor.locator('#esc-menu').isVisible()) await actor.locator('#btn-mobile-menu').tap();
    }
    async function cast(buff, rank, tier) {
        await expect.poll(() => page.evaluate(() => window.game.player.berserkerEdgeTimer <= 0 &&
            window.game.player.lastStandTimer <= 0), { timeout: 25_000 }).toBe(true);
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await command(`/qa-animation-ready${buff.id === 'last_stand' ? ' low-health' : ''}`);
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        const before = await page.evaluate(buff => {
            const p = window.game.player;
            return { rank: p.talentRanks?.[buff.talent] || 0, damage: p.stats.damage, defense: p.stats.defense,
                mana: p.stats.mana, hp: p.stats.hp, maxHp: p.stats.maxHp, rested: p.wellRestedSeconds || 0,
                slot: p.hotbar.indexOf(buff.skill), generic: [p.talentRanks?.FTR_30 || 0, p.talentRanks?.FTR_37 || 0] };
        }, buff);
        expect(before).toMatchObject({ rank, generic: [0, 0], rested: 0 });
        expect(before.slot).toBeGreaterThanOrEqual(0);
        expect(before.damage).toBeGreaterThan(10); expect(before.defense).toBeGreaterThan(0);
        if (buff.id === 'last_stand') expect(before.hp / before.maxHp).toBeLessThan(.3);
        await page.evaluate(installFighterBuffObserver, buff);
        const multiplier = buff.base * (25 + rank) / 25;
        const damage = Math.trunc(before.damage * multiplier);
        const defense = buff.id === 'berserker_edge' ? Math.trunc(before.defense * .8) : before.defense;
        await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
        await expect.poll(() => page.evaluate(() => window.__fighterBuffNative.results.length)).toBe(1);
        const result = await page.evaluate(() => window.__fighterBuffNative.results[0]);
        expect(result.accepted).toBe(true); expect(result.mana).toBe(before.mana);
        await expect.poll(() => page.evaluate(({ multiplier, damage, defense }) => window.__fighterBuffNative.states.some(s =>
            Math.abs(s.multiplier - multiplier) < .00001 && s.damage === damage && s.defense === defense),
        { multiplier, damage, defense })).toBe(true);
        const duration = await page.evaluate(() => window.__fighterBuffNative.maxDuration);
        expect(duration).toBeGreaterThan(buff.seconds - .75); expect(duration).toBeLessThanOrEqual(buff.seconds + .1);
        await expect.poll(() => page.evaluate(({ id, tier }) => {
            const effect = window.game.player.attachedStatusEffects.get(id);
            return Boolean(effect?.isActive && effect.group?.parent && effect.group.visible &&
                effect.quality === tier && effect.getMetrics().meshes > 0);
        }, { id: buff.id, tier })).toBe(true);
        await page.locator('#btn-phone-status').tap();
        const badge = page.locator(`#phone-status-panel [data-buff-id="${buff.id}"]`);
        await expect(badge).toBeVisible();
        await expect(badge).toContainText(`+${Math.round((multiplier - 1) * 100)}% Damage stat`);
        if (buff.id === 'berserker_edge') await expect(badge).toContainText('-20% defense');
        await badge.scrollIntoViewIfNeeded();
        await expect(badge).toBeInViewport();
        await page.screenshot({ path: testInfo.outputPath(`${buff.id}-rank${rank}-${tier}.png`) });
        await expect.poll(() => page.evaluate(() => window.__fighterBuffNative.expired), { timeout: 22_000 }).toBe(true);
        await expect.poll(() => page.evaluate(({ id, timer, damage, defense }) => {
            const p = window.game.player;
            return p[timer] <= 0 && !p.attachedStatusEffects.has(id) && p.stats.damage === damage && p.stats.defense === defense;
        }, { id: buff.id, timer: buff.timer, damage: before.damage, defense: before.defense })).toBe(true);
        await expect(badge).toHaveCount(0); await page.locator('#btn-close-phone-status').tap();
        await expect(page.locator('#phone-status-panel')).toBeHidden();
        await testInfo.attach(`${buff.id}-rank${rank}-${tier}-receipts`, {
            body: JSON.stringify({ before, expected: { multiplier, damage, defense },
                receipts: await page.evaluate(() => window.__fighterBuffNative) }), contentType: 'application/json'
        });
    }

    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await skills('Skills');
    const branch = page.locator('[data-build-action="branch:C"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Last Stand Rampage'))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();
    // Ordinary Shieldwall purchases give a nonzero defense baseline; no gear
    // or stats are injected, and its ranks stay fixed throughout all buff casts.
    await buyRanks('FTR_36', 0, 5);
    await outsideStableStats(); await quality('high');
    for (const rank of [0, 1, 5]) {
        if (rank > 0) for (const buff of buffs) await buyRanks(buff.talent, rank === 1 ? 0 : 1, rank);
        for (const buff of buffs) await cast(buff, rank, 'high');
    }
    const points = await page.evaluate(() => window.game.player.talentPoints);
    await loginAndEnterWorld(page, credentials);
    await expect.poll(() => page.evaluate(() => [window.game.player.talentRanks?.FTR_19,
        window.game.player.talentRanks?.FTR_25, window.game.player.talentRanks?.FTR_36])).toEqual([5, 5, 5]);
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points);
    await page.setViewportSize({ width: 844, height: 390 });
    await outsideStableStats(); await quality('low');
    for (const buff of buffs) await cast(buff, 5, 'low');

    const second = await browser.browserType().launch({ executablePath: process.env.EIDOLON_E2E_BROWSER_PATH || '/usr/bin/google-chrome',
        headless: process.env.EIDOLON_E2E_HEADLESS !== '0',
        args: [...hardwareWebGLBrowserArgs(), ...backendOriginBrowserArgs(process.env.EIDOLON_E2E_BACKEND_ORIGIN_IP)] });
    try {
        const context = await second.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, baseURL });
        const ally = await context.newPage(), allyFailures = collectBrowserFailures(ally, baseURL);
        await loginAndEnterWorld(ally, { ...credentials, username: `${credentials.username}-ally`, characterClass: 'Cleric' });
        expect(await ally.evaluate(() => window.game.player.constructor.name)).toBe('Cleric');
        await command('/level 100', ally);
        await expect.poll(() => ally.evaluate(() => window.game.player.level)).toBe(100);
        await outsideStableStats(ally); await outsideStableStats();
        // Empty-ground phone taps cancel targeting; only desktop uses them to
        // walk. Separate the models through the actual visible phone joystick.
        await ally.waitForTimeout(1100); // Existing waypoint movement-lock window.
        const beforeMove = await ally.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
        const stick = await ally.locator('#joystick-zone').boundingBox();
        expect(stick).not.toBeNull();
        const cdp = await context.newCDPSession(ally);
        try {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
                { id: 1, x: stick.x + stick.width / 2 + 24, y: stick.y + stick.height / 2 }
            ] });
            await expect.poll(() => ally.evaluate(before => Math.hypot(window.game.player.position.x - before.x,
                window.game.player.position.z - before.z), beforeMove), { timeout: 10_000, intervals: [100] }).toBeGreaterThan(3);
        } finally {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await cdp.detach();
        }
        await expect.poll(() => ally.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBe(0);
        const ownerId = await page.evaluate(() => window.game.player.id), allyId = await ally.evaluate(() => window.game.player.id);
        await expect.poll(() => page.evaluate(id => Boolean(window.game.remotePlayers.get(id)), allyId)).toBe(true);
        await expect.poll(() => page.evaluate(({ id, before }) => {
            const position = window.game.remotePlayers.get(id)?.position;
            return position ? Math.hypot(position.x - before.x, position.z - before.z) : 0;
        }, { id: allyId, before: beforeMove })).toBeGreaterThan(2);
        await expect.poll(() => page.evaluate(id => {
            const g = window.game, position = g.remotePlayers.get(id)?.position;
            return position ? g.player.position.distanceTo(position) : Infinity;
        }, allyId)).toBeLessThan(10);
        await page.locator('#btn-phone-party').tap();
        await page.getByRole('textbox', { name: 'Player to invite' }).fill(`${credentials.username}-ally`);
        await page.locator('#phone-party-panel').getByRole('button', { name: 'Invite', exact: true }).tap();
        await expect(ally.locator('#party-request-modal')).toBeVisible(); await ally.locator('#btn-accept-party').tap();
        await expect.poll(() => page.evaluate(() => window.game.uiManager.social.partyData?.members?.length)).toBe(2);
        await expect(page.locator('#phone-party-panel')).toBeHidden();
        expect(await ally.evaluate(() => window.game.player.talentRanks?.FTR_19 || 0)).toBe(0);
        const buff = buffs[0];
        for (const tier of ['high', 'low']) {
            await quality(tier); await quality(tier, ally);
            const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
            await command('/qa-animation-ready');
            await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
            const before = await ally.evaluate(() => ({ damage: window.game.player.stats.damage,
                defense: window.game.player.stats.defense, rested: window.game.player.wellRestedSeconds || 0 }));
            expect(before.rested).toBe(0); expect(before.damage).toBeGreaterThan(10);
            await page.evaluate(installFighterBuffObserver, buff); await ally.evaluate(installFighterBuffObserver, buff);
            const slot = await page.evaluate(() => window.game.player.hotbar.indexOf('Berserker Edge'));
            expect(slot).toBeGreaterThanOrEqual(0);
            await page.locator('#hotbar-container .hotbar-slot').nth(slot).tap();
            await expect.poll(() => page.evaluate(() => window.__fighterBuffNative.results.length)).toBe(1);
            expect(await page.evaluate(() => window.__fighterBuffNative.results[0].accepted)).toBe(true);
            await expect.poll(() => ally.evaluate(before => window.__fighterBuffNative.states.some(s =>
                Math.abs(s.multiplier - 1.8) < .00001 && s.damage === Math.trunc(before.damage * 1.8) &&
                s.defense === Math.trunc(before.defense * .8)), before)).toBe(true);
            expect(await ally.evaluate(() => window.__fighterBuffNative.results)).toEqual([]);
            const sharedDuration = await ally.evaluate(() => window.__fighterBuffNative.maxDuration);
            expect(sharedDuration).toBeGreaterThan(14.25); expect(sharedDuration).toBeLessThanOrEqual(15.1);
            for (const client of [page, ally]) {
                await expect.poll(() => client.evaluate(({ ownerId, allyId, tier }) => [ownerId, allyId].every(id => {
                    const g = window.game, p = id === g.player.id ? g.player : g.remotePlayers.get(id);
                    const effect = p?.attachedStatusEffects?.get('berserker_edge');
                    return p?.berserkerEdgeActive && Math.abs(p.berserkerEdgeMultiplier - 1.8) < .00001 &&
                        effect?.isActive && effect.group?.parent && effect.quality === tier && effect.getMetrics().meshes > 0;
                }), { ownerId, allyId, tier })).toBe(true);
            }
            await ally.locator('#btn-phone-status').tap();
            const badge = ally.locator('#phone-status-panel [data-buff-id="berserker_edge"]');
            await expect(badge).toContainText('+80% Damage stat');
            await badge.scrollIntoViewIfNeeded();
            await expect(badge).toBeInViewport();
            await ally.screenshot({ path: testInfo.outputPath(`berserker-party-cleric-${tier}.png`) });
            await expect.poll(() => ally.evaluate(() => window.__fighterBuffNative.expired), { timeout: 22_000 }).toBe(true);
            await expect.poll(() => ally.evaluate(before => window.game.player.stats.damage === before.damage &&
                window.game.player.stats.defense === before.defense && !window.game.player.attachedStatusEffects.has('berserker_edge'), before)).toBe(true);
            await expect(badge).toHaveCount(0); await ally.locator('#btn-close-phone-status').tap();
            await expect(ally.locator('#phone-status-panel')).toBeHidden();
            await expect.poll(() => page.evaluate(() => window.__fighterBuffNative.expired)).toBe(true);
            for (const client of [page, ally]) {
                await expect.poll(() => client.evaluate(ids => ids.every(id => {
                    const g = window.game, p = id === g.player.id ? g.player : g.remotePlayers.get(id);
                    return p && !p.berserkerEdgeActive && p.berserkerEdgeTimer <= 0 &&
                        p.berserkerEdgeMultiplier === 1 && !p.attachedStatusEffects.has('berserker_edge');
                }), [ownerId, allyId])).toBe(true);
            }
            await testInfo.attach(`berserker-party-${tier}-receipts`, { body: JSON.stringify({ before,
                owner: await page.evaluate(() => window.__fighterBuffNative),
                recipient: await ally.evaluate(() => window.__fighterBuffNative) }), contentType: 'application/json' });
        }
        expect(allyFailures, allyFailures.join('\n')).toEqual([]);
    } finally { await second.close(); }
    expect(failures, failures.join('\n')).toEqual([]);
});
