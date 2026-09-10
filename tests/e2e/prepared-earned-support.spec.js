import { expect, test } from '@playwright/test';
import { createEarnedDungeonCombat } from './earned-dungeon-combat.js';
import { earnedPreparationProfile } from '../earnedPreparationPolicy.js';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld,
    moveByGroundClick, projectNearestHostile } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('prepared Rogue/Cleric dungeon driver pays for real support and respects active effects', async ({ page, baseURL }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(process.env.EIDOLON_E2E_PREPARED_SUPPORT !== '1', 'Explicit isolated prepared-support route only');
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    const className = process.env.EIDOLON_E2E_CLASS;
    expect(['Rogue', 'Cleric']).toContain(className);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentialsFromEnvironment());
    expect(await page.evaluate(() => window.game.player.constructor.name)).toBe(className);
    let lastCommandAt = 0;
    async function command(value) {
        const delay = Math.max(0, 1100 - (Date.now() - lastCommandAt));
        if (delay) await page.waitForTimeout(delay);
        lastCommandAt = Date.now();
        await page.locator('#chat-tab-chat').click();
        await page.locator('#chat-input').fill(value);
        await page.locator('#chat-input').press('Enter');
    }

    // Explicit allowlisted preparation, never an earned route: level and travel
    // are granted, waypoint protection stays on, and no survival claim is made.
    await command('/level 100');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(100);
    const profile = earnedPreparationProfile(className);
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    await skills.locator('.skill-branch').filter({ hasText: profile.branchLabel })
        .getByRole('button', { name: 'Select Spec', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.selectedBranch)).toBe(profile.branch);
    await page.locator('#btn-close-skills').click();
    const support = className === 'Rogue' ? 'Poison Coating' : 'Guardian Embrace';
    await expect.poll(() => page.evaluate(skill => window.game.player.unlockedSkills.includes(skill), support)).toBe(true);
    await command('/qa-waypoint verdant');
    await expect.poll(() => page.evaluate(() => Math.hypot(window.game.player.position.x - 800,
        window.game.player.position.z - 200))).toBeLessThan(3);
    await page.waitForTimeout(1100);
    let target = await projectNearestHostile(page, 'InfernoTitan');
    for (let step = 0; !target && step < 12; step++) {
        await moveByGroundClick(page, 0, 20);
        target = await projectNearestHostile(page, 'InfernoTitan');
    }
    expect(target, 'A naturally spawned, visible hostile is required').not.toBeNull();
    const readTarget = () => page.evaluate(id => {
        const g = window.game, p = g.player, enemy = g.remotePlayers.get(id);
        if (!enemy?.isActive || enemy.state === 'DEAD' || !g.isHostileActorTarget(enemy)) return null;
        return { x: enemy.position.x - p.position.x, z: enemy.position.z - p.position.z,
            distance: p.position.distanceTo(enemy.position), range: g.getBasicAttackRangeForEntity(enemy) };
    }, target.id);
    for (let step = 0; step < 18; step++) {
        const state = await readTarget();
        expect(state).not.toBeNull();
        if (state.distance < state.range - 1) break;
        const scale = Math.min(8, state.distance - state.range + 2) / state.distance;
        await moveByGroundClick(page, state.x * scale, state.z * scale, { moveOnly: true });
    }
    const readyTarget = await readTarget();
    expect(readyTarget).not.toBeNull();
    expect(readyTarget.distance).toBeLessThan(readyTarget.range);
    const sequence = await page.evaluate(() => window.game.animationQAReadySequence || 0);
    await command(`/qa-animation-ready${className === 'Cleric' ? ' low-health' : ''}`);
    await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(sequence);
    const driver = await createEarnedDungeonCombat(page, className);
    await page.evaluate(() => {
        const g = window.game, receive = g.handleServerMessage.bind(g);
        window.__preparedSupport = { results: [], heals: [], requests: [] };
        g.handleServerMessage = message => {
            const p = message.payload;
            if (message.type === 'ability_result') window.__preparedSupport.results.push(p);
            if (message.type === 'heal' && p?.sourceId === g.player.id && p.targetId === g.player.id) {
                window.__preparedSupport.heals.push({ kind: p.kind, amount: p.amount });
            }
            return receive(message);
        };
        const send = g.network.send.bind(g.network);
        g.network.send = (kind, payload) => {
            if (kind === 'ability') window.__preparedSupport.requests.push({ skill: payload.skillName, mana: g.player.stats.mana });
            return send(kind, payload);
        };
    });
    // No readiness reset/refill after this point. Exercise the actual composite
    // driver; observing input alone is not proof of server acceptance or healing.
    // Check stale targets before the support buff/cooldown could mask the guard.
    // Immediate self-healing remains independently valid for a wounded Cleric.
    for (let attempt = 0; attempt < 2; attempt++) {
        await driver(page, { id: 'nonexistent-prepared-support-target' });
        expect(await page.evaluate(skill => window.__preparedSupport.requests.filter(r => r.skill === skill).length, support)).toBe(0);
        await page.waitForTimeout(1100);
    }
    await expect.poll(async () => {
        await driver(page, target);
        return page.evaluate(skill => window.__earnedDungeonCasts.accepted[skill] || 0, support);
    }, { timeout: 30_000, intervals: [1100] }).toBe(1);
    const active = () => page.evaluate(name => {
        const p = window.game.player;
        return name === 'Rogue' ? p.poisonCoatingActive : p.guardianEmbraceActive;
    }, className);
    await expect.poll(active).toBe(true);
    if (className === 'Cleric') {
        await expect.poll(() => page.evaluate(() => window.__preparedSupport.heals.some(h =>
            h.kind === 'guardian_embrace' && h.amount > 0))).toBe(true);
        expect(await page.evaluate(() => window.__preparedSupport.heals.some(h => h.kind === 'holy' && h.amount > 0))).toBe(true);
    }
    const before = await page.evaluate(skill => window.__preparedSupport.requests.filter(r => r.skill === skill).length, support);
    expect(before).toBe(1);
    await page.waitForTimeout(1100);
    expect(await active()).toBe(true);
    await driver(page, target);
    expect(await page.evaluate(skill => window.__preparedSupport.requests.filter(r => r.skill === skill).length, support)).toBe(before);
    const receipt = await page.evaluate(() => ({ ...window.__preparedSupport, counts: window.__earnedDungeonCasts }));
    for (const skill of className === 'Cleric' ? ['Healing Light', support] : [support]) {
        const result = receipt.results.find(r => r.skillName === skill);
        const request = receipt.requests.find(r => r.skill === skill);
        expect(result?.accepted, `${skill} requires actual server acceptance`).toBe(true);
        expect(request).toBeDefined();
        expect(result.mana, `${skill} must spend mana`).toBeLessThan(request.mana);
    }
    expect(receipt.counts.rejected).toEqual({});
    await page.screenshot({ path: testInfo.outputPath(`prepared-${className.toLowerCase()}-support.png`) });
    console.log('[prepared-earned-support]', JSON.stringify({ className, ...receipt,
        note: 'Prepared input/paid-cast evidence only; not earned progression, poison damage or a dungeon clear.' }));
    expect(failures, failures.join('\n')).toEqual([]);
});
