import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    loginAndEnterWorld, projectGroundOffset, projectNearestHostile, useEncounterQAWaypoint } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const branches = [
    { id: 'A', name: 'Pure Healer Path', suffix: 'fighter', choices: {
        'Healing Light': 'healinglight_beacon', 'Guardian Embrace': 'embrace_wide',
        'Purifying Wave': 'purifyingwave_binding', 'Divine Intervention': 'divineintervention_miracle'
    } },
    { id: 'B', name: 'Battle Cleric', suffix: 'wizard', choices: {
        'Radiant Strike': 'radiantstrike_smite', 'Consecrated Ground': 'consecratedground_sanctuary',
        'Spirit Guardians Boost': 'spiritboost_wide', 'Avenging Seraph': 'seraph_guardian'
    } },
    { id: 'C', name: 'Buff/Debuff Support', suffix: 'cleric', choices: {
        'Blessing of Resolve': 'resolve_rally', 'Blessing of Zeal': 'zeal_quick',
        'Mark of Weakness': 'weakness_distant', "Heaven's Trumpet": 'trumpet_binding'
    } }
];

for (const branch of branches) test(`${branch.name} runes persist and each branch uses accepted paid casts`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable allowlisted characters');
    test.skip(Boolean(process.env.EIDOLON_E2E_CLERIC_RUNE_BRANCH && process.env.EIDOLON_E2E_CLERIC_RUNE_BRANCH !== branch.id), 'Scoped branch verification');
    test.setTimeout(180_000);
    const base = credentialsFromEnvironment();
    const credentials = { ...base, username: `${base.username}-${branch.suffix}`, characterClass: 'Cleric' };
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    // Prepared functional checks, not earned progression or sustained load.
    await ensureDungeonReadyLevel(page);
    if (await page.locator('#chat-input').evaluate(node => node === document.activeElement)) await page.keyboard.press('Escape');
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    await skills.locator('.skill-branch').filter({ hasText: branch.name }).getByRole('button', { name: 'Select Spec' }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.selectedBranch)).toBe(branch.id);
    await skills.getByRole('button', { name: 'Runes', exact: true }).click();
    for (const [skill, rune] of Object.entries(branch.choices)) {
        const button = skills.locator(`button[data-rune-id="${rune}"]`);
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await expect.poll(() => page.evaluate(skill => window.game.player.skillRunes[skill], skill)).toBe(rune);
    }
    await page.locator('#btn-close-skills').click();
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.player.selectedBranch)).toBe(branch.id);
    expect(await page.evaluate(() => window.game.player.skillRunes)).toMatchObject(branch.choices);
    const ready = await page.evaluate(() => window.game.animationQAReadySequence || 0);
    await page.keyboard.press('Enter');
    await page.locator('#chat-input').fill('/qa-animation-ready');
    await page.locator('#chat-input').press('Enter');
    await expect.poll(() => page.evaluate(() => window.game.animationQAReadySequence || 0)).toBeGreaterThan(ready);
    if (await page.locator('#chat-input').evaluate(node => node === document.activeElement)) await page.keyboard.press('Escape');
    await page.evaluate(() => {
        window.__clericCasts = [];
        window.__clericDamage = [];
        const game = window.game, receive = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            const result = receive(message);
            if (message.type === 'ability_result') window.__clericCasts.push(message.payload);
            if (message.type === 'damage' && message.payload?.sourceId === game.player.id) window.__clericDamage.push(message.payload);
            return result;
        };
    });
    const observations = [];
    for (const skill of Object.keys(branch.choices)) {
        const slot = await page.evaluate(skill => window.game.player.hotbar.indexOf(skill), skill);
        expect(slot).toBeGreaterThanOrEqual(0);
        let aim;
        if (skill === 'Mark of Weakness') {
            await useEncounterQAWaypoint(page);
            await expect.poll(async () => {
                aim = await projectNearestHostile(page);
                if (!aim || aim.distance > 15) return false;
                await page.mouse.move(aim.x, aim.y);
                return page.evaluate(id => window.game.hoveredEntity?.id === id, aim.id);
            }).toBe(true);
        } else {
            aim = await projectGroundOffset(page, 0, -4);
            expect(aim?.canvas).toBe(true);
        }
        await page.mouse.move(aim.x, aim.y);
        const before = await page.evaluate(() => ({ count: window.__clericCasts.length, mana: window.game.player.stats.mana }));
        await page.keyboard.press(String(slot + 1));
        await expect.poll(() => page.evaluate(() => window.__clericCasts.length)).toBe(before.count + 1);
        const result = await page.evaluate(() => window.__clericCasts.at(-1));
        expect(result).toMatchObject({ skillName: skill, accepted: true });
        expect(result.mana).toBeLessThan(before.mana);
        expect(result.cooldownRemaining).toBeGreaterThan(0);
        if (skill === 'Mark of Weakness') await expect.poll(() => page.evaluate(id => window.game.activeEntitiesCache.find(e => e.id === id)?.markWeaknessTimer > 0, aim.id)).toBe(true);
        observations.push(result);
        // Normal global cooldown, no reset between casts.
        await page.waitForTimeout(1200);
    }
    await testInfo.attach('accepted-cleric-casts', { body: JSON.stringify({ branch: branch.id, runes: branch.choices, observations }, null, 2), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
