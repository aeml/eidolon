import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, returnToTown } from './helpers.js';
import { installTripwireObserver } from './tripwire-observer.js';
import { moveByPhoneJoystick } from './phone-joystick-movement.js';

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000, trace: 'off', screenshot: 'off', video: 'off' });

test('paid Tripwire training and saved ranks damage and root an ordinarily lured enemy', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(480_000);
    test.skip(process.env.EIDOLON_E2E_TRIPWIRE !== '1' || process.env.EIDOLON_E2E_REGISTER !== '1', 'Explicit disposable Tripwire route only');
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Rogue');
    let lastCommandAt = 0;
    async function command(value) {
        await page.waitForTimeout(Math.max(0, 1100 - (Date.now() - lastCommandAt))); lastCommandAt = Date.now();
        await page.locator('#chat-mobile-toggle').tap();
        await page.locator('#chat-input').fill(value); await page.locator('#chat-input').press('Enter');
        await page.locator('#chat-mobile-toggle').tap();
    }
    async function menu(tab) {
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-phone-skills').tap();
        await page.locator('.phone-build-tabs').getByRole('button', { name: tab, exact: true }).tap();
    }
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    await menu('Skills');
    const branch = page.locator('[data-build-action="branch:C"]');
    await branch.scrollIntoViewIfNeeded(); await branch.tap();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar.includes('Tripwire'))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
    await page.locator('#btn-close-skills').tap();

    async function cast(rank, quality, saved = false) {
        await returnToTown(page, { allowRespawn: false });
        await page.locator('#btn-mobile-menu').tap(); await page.locator('#btn-settings').tap();
        await page.locator('#graphics-quality').selectOption(quality); await page.locator('#btn-close-settings').tap();
        if (await page.locator('#esc-menu').isVisible()) await page.locator('#btn-mobile-menu').tap();
        await expect.poll(() => page.evaluate(() => {
            const p = window.game.player;
            return Boolean(p.safeZoneId) && p.stats.mana === p.stats.maxMana && (p.cooldowns.Tripwire || 0) <= 0;
        }), { timeout: 25_000 }).toBe(true);
        const origin = await page.evaluate(() => ({ x: window.game.player.position.x, z: window.game.player.position.z }));
        // Level-100 Tripwire can kill even a full-health level-10 Skeleton
        // (150 HP). Use the existing durable-enemy waypoint so actual root
        // expiry is observable without altering health or suppressing damage.
        await command('/qa-waypoint verdant');
        await expect.poll(() => page.evaluate(p => Math.hypot(window.game.player.position.x - p.x,
            window.game.player.position.z - p.z), origin), { timeout: 30_000 }).toBeGreaterThan(20);
        await page.waitForTimeout(1100);
        const find = () => page.evaluate(async () => {
            const { nearestObservedHostile } = await import('/tests/observedHostileApproach.js');
            const { isEarnedRetreatPathClear } = await import('/tests/wizardHuntControls.js');
            const g = window.game;
            const minimumHealth = 2 * Math.floor((20 + g.player.stats.dexterity) * (1 + .04 * (g.player.talentRanks?.ROG_23 || 0)));
            return nearestObservedHostile(g.player.position, [...g.remotePlayers.values()].map(e => ({ id: e.id,
                subtype: e.subType || e.constructor.name, active: e.isActive && g.isHostileActorTarget(e),
                alive: e.state !== 'DEAD' && !e.ccImmune && (e.health ?? e.stats?.hp) > minimumHealth,
                x: e.position.x, z: e.position.z })), 'InfernoTitan', enemy => {
                if (enemy.distance < 6) return true;
                const scale = (enemy.distance - 4) / enemy.distance;
                return isEarnedRetreatPathClear(g.collisionManager, g.player.position, g.player.radius || 1.25,
                    { x: (enemy.x - g.player.position.x) * scale, z: (enemy.z - g.player.position.z) * scale });
            });
        });
        await expect.poll(find, { timeout: 30_000 }).not.toBeNull();
        const target = await find();
        const approach = [];
        const offset = () => page.evaluate(id => {
            const g = window.game, e = g.remotePlayers.get(id);
            return e?.isActive && e.state !== 'DEAD' ? { x: e.position.x - g.player.position.x, z: e.position.z - g.player.position.z } : null;
        }, target.id);
        try {
            for (let step = 0; step < 15; step++) {
                approach.push(await page.evaluate(id => {
                    const g = window.game, p = g.player, e = g.remotePlayers.get(id);
                    return { player: { x: p.position.x, z: p.position.z, hp: p.stats.hp, state: p.state,
                        instance: g.currentInstanceId, pending: g.pendingInteraction?.id || null },
                    target: e ? { id: e.id, x: e.position.x, z: e.position.z, hp: e.health ?? e.stats?.hp,
                        active: e.isActive, state: e.state, hostile: g.isHostileActorTarget(e) } : null };
                }, target.id));
                const d = await offset(); expect(d).not.toBeNull();
                const distance = Math.hypot(d.x, d.z);
                if (distance < 6) break;
                const scale = Math.min(3, distance - 4) / distance;
                const movement = await moveByPhoneJoystick(page, d.x * scale, d.z * scale);
                approach.push({ movement });
            }
        } catch (error) {
            await page.screenshot({ path: testInfo.outputPath(`tripwire-${rank}-${quality}-${saved}-approach-failed.png`) });
            throw error;
        } finally {
            await testInfo.attach(`tripwire-approach-${rank}-${quality}-${saved}`,
                { body: JSON.stringify({ target, approach }), contentType: 'application/json' });
        }
        const d = await offset(); expect(d).not.toBeNull();
        expect(Math.hypot(d.x, d.z)).toBeLessThan(6);
        await page.evaluate(installTripwireObserver, target.id);
        const before = await page.evaluate(id => {
            const p = window.game.player, e = window.game.remotePlayers.get(id);
            return { x: p.position.x, z: p.position.z, mana: p.stats.mana, dex: p.stats.dexterity,
                mastery: p.talentRanks?.ROG_23 || 0, technique: p.talentRanks?.ROG_24 || 0,
                hp: e.health ?? e.stats.hp, slot: p.hotbar.indexOf('Tripwire') };
        }, target.id);
        expect(before.mastery).toBe(rank); expect(before.technique).toBe(rank); expect(before.slot).toBeGreaterThanOrEqual(0);
        const base = Math.floor((20 + before.dex) * (1 + .04 * rank));
        expect(before.hp).toBeGreaterThan(base * 2);
        try {
            await page.locator('#hotbar-container .hotbar-slot').nth(before.slot).tap();
            await expect.poll(() => page.evaluate(() => window.__tripwire.results.length)).toBe(1);
            await expect.poll(() => page.evaluate(() => window.__tripwire.traps.length)).toBe(1);
            const cast = await page.evaluate(() => ({ result: window.__tripwire.results[0], trap: window.__tripwire.traps[0] }));
            expect(cast.result.accepted).toBe(true); expect(before.mana - cast.result.mana).toBe(25);
            expect(cast.trap.damage).toBe(base);
            expect(Math.hypot(cast.trap.x - before.x, cast.trap.z - before.z)).toBeLessThan(.25);
            await expect.poll(() => page.evaluate(id => {
                const mesh = window.game.remotePlayers.get(id)?.mesh;
                return Boolean(mesh?.parent && mesh.visible);
            }, cast.trap.id)).toBe(true);
            await page.screenshot({ path: testInfo.outputPath(`tripwire-${rank}-${quality}-${saved}-placed.png`) });
            // A melee enemy stops short of a trap under a stationary player's
            // feet. Walk away so its normal chase crosses the placed trap.
            const length = Math.hypot(d.x, d.z);
            await moveByPhoneJoystick(page, -d.x / length * 8, -d.z / length * 8);
            await command('/qa-protection off'); // Existing fixture primes ordinary AI threat, never damage.
            await expect.poll(() => page.evaluate(() => window.__tripwire.damage.length), { timeout: 20_000 }).toBe(1);
            const hit = await page.evaluate(() => window.__tripwire.damage[0]);
            expect([base, base * 2]).toContain(hit.amount); // Crit roll stays random; deterministic boundaries are server-tested.
            await expect.poll(() => page.evaluate(() => window.__tripwire.maxRoot)).toBeGreaterThan(2.8);
            expect(await page.evaluate(() => window.__tripwire.maxRoot)).toBeLessThanOrEqual(3.05);
            await expect.poll(() => page.evaluate(id => !window.game.remotePlayers.has(id), cast.trap.id)).toBe(true);
            await expect.poll(() => page.evaluate(() => window.__tripwire.expired), { timeout: 10_000 }).toBe(true);
            expect(await page.evaluate(() => window.__tripwire.damage.length)).toBe(1);
            console.log(`[tripwire-native] rank${rank}/${quality}/saved${saved}: paid25, placed${base}, actual${hit.amount}, root and expiry`);
        } finally {
            const observed = await page.evaluate(() => window.__tripwire).catch(() => null);
            await testInfo.attach(`tripwire-${rank}-${quality}-${saved}`, { body: JSON.stringify({ before, observed }), contentType: 'application/json' });
        }
        await returnToTown(page, { allowRespawn: false });
    }
    await cast(0, 'high');
    for (let rank = 1; rank <= 5; rank++) {
        await menu('Talents');
        for (const id of ['ROG_23', 'ROG_24']) {
            await page.waitForTimeout(1100);
            const points = await page.evaluate(() => window.game.player.talentPoints);
            await page.evaluate(installTripwireObserver);
            const buy = page.locator(`button[data-build-action="talent:${id}"]`);
            await buy.scrollIntoViewIfNeeded(); await buy.tap();
            await expect.poll(() => page.evaluate(id => window.__tripwire.ranks?.[id], id)).toBe(rank);
            await expect.poll(() => page.evaluate(() => window.__tripwire.points)).toBe(points - 1);
            await expect.poll(() => page.evaluate(() => window.game.uiManager.skillTree.mobile.pending === null)).toBe(true);
        }
        await page.locator('#btn-close-skills').tap();
        if (rank === 1 || rank === 5) await cast(rank, rank === 1 ? 'high' : 'low');
    }
    const points = await page.evaluate(() => window.game.player.talentPoints);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points);
    await cast(5, 'high', true);
    expect(failures, failures.join('\n')).toEqual([]);
});
