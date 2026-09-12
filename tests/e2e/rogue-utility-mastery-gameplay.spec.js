import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    findOverworldTarget, loginAndEnterWorld, moveByGroundClick, projectEntity,
    returnToTown, useCombatQAWaypoint } from './helpers.js';
import { installRogueUtilityObserver } from './rogue-utility-observer.js';
import { tryUtilityApproachStep } from './rogue-utility-approach.js';
import { selectPreparedRune } from './prepared-rune-input.js';
import { CONSTANTS } from '../../src/core/Constants.js';

test.use({ viewport: { width: 1280, height: 720 }, trace: 'off', screenshot: 'off', video: 'off' });
const technique = process.env.EIDOLON_E2E_ROGUE_TECHNIQUE === '1';
const genericId = technique ? 'ROG_33' : 'ROG_28';
const utilities = [
    { skill: 'Weak Point Mark', talent: 'ROG_05', branch: 'Assassin Burst Path',
        active: 'weakPointMarked', duration: 'weakPointDuration', timer: 'weakPointMarkTimer', visual: 'weak_point_mark', base: 10, cost: 25, cooldown: 12 },
    { skill: 'Smoke Bomb', talent: 'ROG_19', branch: 'Utility / Debuff Path',
        active: 'slowed', duration: 'slowDuration', timer: 'slowTimer', visual: 'slowed', base: 5, cost: 35, cooldown: 20 },
    { skill: 'Cloak & Vanish', talent: 'ROG_25', branch: 'Utility / Debuff Path',
        active: 'stealthActive', duration: 'stealthDuration', timer: 'stealthTimer', visual: 'stealth', base: 5, cost: 30, cooldown: 30, self: true }
].map(cfg => technique ? { ...cfg, talent: `ROG_${String(Number(cfg.talent.slice(4)) + 1).padStart(2, '0')}` } : cfg);

test(`Rogue utility ${technique ? 'Techniques reduce paid mana and cooldowns' : 'Masteries extend real paid effects'} through normal purchases and saved rune training`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_ROGUE_UTILITY !== '1' || process.env.EIDOLON_E2E_REGISTER !== '1',
        'Explicit disposable Rogue utility route only');
    test.setTimeout(900_000);
    const credentials = credentialsFromEnvironment(), failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe('Rogue');
    await ensureDungeonReadyLevel(page, 100);
    await page.evaluate(installRogueUtilityObserver);
    const skills = page.locator('#skill-tree-window');
    const receipts = [];

    async function menu(tab) {
        await page.keyboard.press('k'); await expect(skills).toBeVisible();
        await skills.getByRole('button', { name: tab, exact: true }).click();
    }
    async function branch(cfg) {
        await menu('Skills');
        const selection = page.locator('.skill-branch').filter({ hasText: cfg.branch })
            .getByRole('button', { name: 'Select Spec' });
        if (await selection.count()) await selection.click();
        await expect.poll(() => page.evaluate(skill => window.game.player.hotbar.includes(skill), cfg.skill)).toBe(true);
        await page.locator('#btn-close-skills').click();
    }
    async function purchase(id, from, to) {
        const name = CONSTANTS.PASSIVE_TALENTS.Rogue.find(talent => talent.id === id)?.name;
        expect(name, 'purchase the existing catalog talent, without inventing its label').toBeTruthy();
        await returnToTown(page); await menu('Talents');
        for (let rank = from + 1; rank <= to; rank++) {
            await page.waitForTimeout(1100);
            const points = await page.evaluate(() => window.game.player.talentPoints);
            await page.evaluate(installRogueUtilityObserver);
            const node = skills.locator('.skill-node').filter({ has: page.getByText(name, { exact: true }) });
            await expect(node).toHaveCount(1); await node.scrollIntoViewIfNeeded(); await node.click();
            // Desktop ranks have an optimistic preview. Require the actual
            // server rank AND the exact consumed point, not that preview.
            await expect.poll(() => page.evaluate(id => window.__rogueUtility.ranks?.[id], id)).toBe(rank);
            await expect.poll(() => page.evaluate(() => window.__rogueUtility.points)).toBe(points - 1);
        }
        await page.locator('#btn-close-skills').click();
    }
    async function quality(value) {
        await page.keyboard.press('Escape'); await page.locator('#btn-settings').click();
        await page.locator('#graphics-quality').selectOption(value); await page.locator('#btn-close-settings').click();
        if (await page.locator('#esc-menu').isVisible()) await page.keyboard.press('Escape');
    }
    async function targetFor(cfg) {
        if (cfg.self) return await page.evaluate(() => ({ id: window.game.player.id }));
        const target = await findOverworldTarget(page);
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
            const delta = await page.evaluate(id => {
                const g = window.game, e = g.remotePlayers.get(id);
                return e?.isActive && e.state !== 'DEAD' ? { x: e.position.x - g.player.position.x,
                    z: e.position.z - g.player.position.z } : null;
            }, target.id);
            expect(delta, 'ordinary target must stay alive').not.toBeNull();
            const distance = Math.hypot(delta.x, delta.z);
            if (distance < 4) {
                await expect.poll(async () => {
                    for (const point of [null, { x: .2, y: .7, z: .5 }, { x: .8, y: .7, z: .5 }]) {
                        const aim = await projectEntity(page, target.id, point);
                        if (!aim?.visible) continue;
                        await page.mouse.move(aim.x, aim.y); await page.waitForTimeout(70);
                        if (await page.evaluate(id => window.game.hoveredEntity?.id === id, target.id)) return true;
                    }
                    return false;
                }).toBe(true);
                // Projection/hover takes time while the enemy keeps walking.
                // Reacquire by real movement before any paid cast if it left
                // the interior of Smoke's five-unit authoritative footprint.
                const ready = await page.evaluate(id => {
                    const g = window.game, e = g.remotePlayers.get(id);
                    return Boolean(e?.isActive && e.state !== 'DEAD' && g.hoveredEntity?.id === id &&
                        Math.hypot(e.position.x - g.player.position.x, e.position.z - g.player.position.z) < 4);
                }, target.id);
                if (ready) return target;
                continue;
            }
            const scale = Math.min(8, distance - 3) / distance;
            const issued = await tryUtilityApproachStep(() => moveByGroundClick(page, delta.x * scale, delta.z * scale,
                { moveOnly: true, allowJumpFallback: false, requireClearPath: true }));
            if (!issued) await page.waitForTimeout(100);
        }
        throw new Error('Could not walk into the real utility footprint');
    }
    async function cast(cfg, rank, generic, tier, rune = '') {
        await returnToTown(page); await branch(cfg); await quality(tier); await useCombatQAWaypoint(page);
        // Incoming combat, cooldowns and mana are fixture preparation only;
        // the target, ranks, timers and cast itself are never assigned.
        await page.waitForTimeout(1100);
        const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
        await page.locator('#chat-input').fill('/qa-animation-ready'); await page.locator('#chat-input').press('Enter');
        await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
        // Prepare before approaching a live enemy. A chat round-trip after
        // acquisition let the enemy move outside the required footprint.
        const target = await targetFor(cfg);
        const before = await page.evaluate(({ cfg, id, genericId }) => {
            const g = window.game, p = g.player, actor = cfg.self ? p : g.remotePlayers.get(id);
            return { mana: p.stats.mana, maxMana: p.stats.maxMana, rest: p.wellRestedSeconds, safeZone: p.safeZoneId,
                rank: p.talentRanks?.[cfg.talent] || 0, generic: p.talentRanks?.[genericId] || 0,
                globalCDR: p.stats.cooldownReduction || 0, equipmentManaReduction: p.stats.manaCostReduction || 0,
                rune: p.skillRunes?.[cfg.skill] || '', slot: p.hotbar.indexOf(cfg.skill), hp: actor?.stats?.hp,
                distance: actor ? Math.hypot(actor.position.x - p.position.x, actor.position.z - p.position.z) : Infinity };
        }, { cfg, id: target.id, genericId });
        expect(before).toMatchObject({ rank, generic, rune }); expect(before.slot).toBeGreaterThanOrEqual(0);
        if (!cfg.self) expect(before.distance).toBeLessThan(5);
        await page.evaluate(installRogueUtilityObserver, { ...cfg, targetId: target.id });
        const base = rune === 'cloak_longer' ? 10 : cfg.base;
        const expected = base * (1 + (technique ? 0 : .04 * (rank + generic)));
        // Prepared characters carry no equipment cost reduction. Compare the
        // independent paid server result, not a locally predicted mana value.
        expect(before.equipmentManaReduction).toBe(0);
        const expectedCost = Math.floor(cfg.cost * (1 - (technique ? .02 * rank : 0)) + 1e-9);
        const expectedCooldown = cfg.cooldown * (1 - before.globalCDR) *
            (1 - (technique ? .03 * rank + .02 * generic : 0));
        await page.keyboard.press(String(before.slot + 1));
        try {
            await expect.poll(() => page.evaluate(() => window.__rogueUtility.results.length)).toBe(1);
            const result = await page.evaluate(() => window.__rogueUtility.results[0]);
            expect(result.accepted).toBe(true); expect(before.mana - result.mana).toBe(expectedCost);
            expect(result.cooldownRemaining).toBeCloseTo(expectedCooldown, 5);
        } catch (error) {
            const observed = await page.evaluate(() => ({
                ...window.__rogueUtility, focus: document.activeElement?.id,
                playerState: window.game.player.state, pendingSkill: window.game.abilityController.pendingAbilitySkill,
                pendingTarget: window.game.abilityController.pendingAbilityTarget?.id,
                hoveredId: window.game.hoveredEntity?.id, cooldowns: window.game.player.cooldowns
            }));
            console.log('[rogue-utility-failed]', JSON.stringify({ before, expected, expectedCost, expectedCooldown, observed }));
            await testInfo.attach('rogue-utility-failed-cast', { body: JSON.stringify({ before, expected, expectedCost, expectedCooldown, observed }), contentType: 'application/json' });
            await page.screenshot({ path: testInfo.outputPath('rogue-utility-failed-cast.png') });
            throw error;
        }
        await expect.poll(() => page.evaluate(() => window.__rogueUtility.casts.length)).toBe(1);
        if (!cfg.self && cfg.skill === 'Weak Point Mark') {
            expect(await page.evaluate(() => window.__rogueUtility.casts[0].targetId)).toBe(target.id);
        }
        // One rank adds only0.2s to Smoke/Cloak. A0.75s tolerance could pass an
        // entirely missing rank-one benefit; keep these wire bounds disjoint.
        await expect.poll(() => page.evaluate(() => window.__rogueUtility.maxDuration)).toBeGreaterThan(expected - .15);
        expect(await page.evaluate(() => window.__rogueUtility.maxDuration)).toBeLessThanOrEqual(expected + .1);
        try {
            await expect.poll(() => page.evaluate(({ cfg, id }) => {
                const g = window.game, actor = cfg.self ? g.player : g.remotePlayers.get(id);
                return actor?.[cfg.timer] || 0;
            }, { cfg, id: target.id })).toBeGreaterThan(expected - 1.5);
        } catch (error) {
            const observation = await page.evaluate(() => window.__rogueUtility);
            const diagnostic = { before, expected, expectedCost, expectedCooldown, observation };
            console.log('[rogue-utility-local-timer-failed]', JSON.stringify(diagnostic));
            await testInfo.attach('rogue-utility-local-timer-failed', { body: JSON.stringify(diagnostic), contentType: 'application/json' });
            await page.screenshot({ path: testInfo.outputPath('rogue-utility-local-timer-failed.png') });
            throw error;
        }
        await expect.poll(() => page.evaluate(({ cfg, id, tier }) => {
            const g = window.game, actor = cfg.self ? g.player : g.remotePlayers.get(id);
            const effect = actor?.attachedStatusEffects?.get(cfg.visual);
            return Boolean(effect?.isActive && effect.group?.parent && effect.group.visible &&
                effect.quality === tier && effect.getMetrics().meshes > 0);
        }, { cfg, id: target.id, tier })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`${cfg.talent}-${rank}-${generic}-${rune || 'base'}-${tier}.png`) });
        await expect.poll(() => page.evaluate(() => window.__rogueUtility.expired), { timeout: 20_000 }).toBe(true);
        await expect.poll(() => page.evaluate(({ cfg, id }) => {
            const g = window.game, actor = cfg.self ? g.player : g.remotePlayers.get(id);
            return actor?.[cfg.timer];
        }, { cfg, id: target.id })).toBeLessThanOrEqual(0);
        await expect.poll(() => page.evaluate(({ cfg, id }) => {
            const g = window.game, actor = cfg.self ? g.player : g.remotePlayers.get(id);
            return Boolean(actor?.attachedStatusEffects?.has(cfg.visual));
        }, { cfg, id: target.id })).toBe(false);
        if (!cfg.self) expect(await page.evaluate(id => window.game.remotePlayers.get(id)?.stats?.hp, target.id)).toBe(before.hp);
        expect(await page.evaluate(() => window.game.player.state)).not.toBe('DEAD');
        const observation = await page.evaluate(() => window.__rogueUtility);
        receipts.push({ skill: cfg.skill, technique, before, expected, expectedCost, expectedCooldown, observation });
        console.log(`[rogue-utility] ${cfg.skill}: rank${rank}/generic${generic}/${rune || 'base'}/${tier}, cost${expectedCost}, cooldown${expectedCooldown}, paid duration${expected}, natural expiry`);
    }

    for (const cfg of utilities) {
        for (const rank of [0, 1, 5]) {
            if (rank) await purchase(cfg.talent, rank === 1 ? 0 : 1, rank);
            await cast(cfg, rank, 0, rank === 5 ? 'low' : 'high');
        }
    }
    await purchase(genericId, 0, 5);
    await returnToTown(page); await menu('Runes');
    await selectPreparedRune(page, skills, { skill: 'Cloak & Vanish', id: 'cloak_longer', name: 'Lasting Shadow' });
    await expect.poll(() => page.evaluate(() => window.game.player.skillRunes?.['Cloak & Vanish'])).toBe('cloak_longer');
    await page.locator('#btn-close-skills').click();
    const points = await page.evaluate(() => window.game.player.talentPoints); expect(points).toBe(0);
    await loginAndEnterWorld(page, credentials);
    const savedIds = [...utilities.map(cfg => cfg.talent), genericId];
    await expect.poll(() => page.evaluate(ids => ids.map(id => window.game.player.talentRanks?.[id]), savedIds)).toEqual([5, 5, 5, 5]);
    expect(await page.evaluate(() => window.game.player.talentPoints)).toBe(points);
    for (const cfg of utilities) await cast(cfg, 5, 5, 'high', cfg.self ? 'cloak_longer' : '');
    await testInfo.attach('rogue-utility-paid-saved-receipts', { body: JSON.stringify(receipts), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
