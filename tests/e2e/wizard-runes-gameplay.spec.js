import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    loginAndEnterWorld, projectGroundOffset } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const branches = [
    { id: 'A', name: 'Pyromancer', suffix: 'wizard', choices: {
        'Flame Whip': 'flamewhip_reach', 'Flame Tornado': 'flametornado_broad',
        'Meteor Drop': 'meteor_cluster', 'Inferno Cataclysm': 'inferno_lingering'
    } },
    { id: 'B', name: 'Single-Target Caster', suffix: 'fighter', choices: {
        'Spell Focus': 'spellfocus_reservoir', 'Arcane Missiles': 'arcanemissiles_salvo',
        'Scorch Beam': 'scorchbeam_incision', 'Dragonfire Lance': 'dragonfire_broadside'
    } },
    { id: 'C', name: 'Control & Utility Mage', suffix: 'cleric', choices: {
        'Arcane Shield': 'arcaneshield_explosive', 'Teleport': 'teleport_phase',
        'Gravity Well': 'gravitywell_expanded', 'Time Warp': 'timewarp_quickening'
    } }
];

for (const branch of branches) test(`${branch.name} runes persist and twelve-skill coverage uses accepted paid casts`, async ({ page, baseURL }, testInfo) => {
    test.skip(process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires disposable allowlisted characters');
    test.setTimeout(180_000);
    const base = credentialsFromEnvironment();
    const credentials = { ...base, username: `${base.username}-${branch.suffix}`, characterClass: 'Wizard' };
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
        window.__wizardCasts = [];
        const game = window.game, receive = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            const result = receive(message);
            if (message.type === 'ability_result') window.__wizardCasts.push(message.payload);
            return result;
        };
    });
    const observations = [];
    for (const skill of Object.keys(branch.choices)) {
        const slot = await page.evaluate(skill => window.game.player.hotbar.indexOf(skill), skill);
        expect(slot).toBeGreaterThanOrEqual(0);
        const aim = await projectGroundOffset(page, 0, -4);
        expect(aim?.canvas).toBe(true);
        await page.mouse.move(aim.x, aim.y);
        const before = await page.evaluate(() => ({ count: window.__wizardCasts.length, mana: window.game.player.stats.mana }));
        await page.keyboard.press(String(slot + 1));
        await expect.poll(() => page.evaluate(() => window.__wizardCasts.length)).toBe(before.count + 1);
        const result = await page.evaluate(() => window.__wizardCasts.at(-1));
        expect(result).toMatchObject({ skillName: skill, accepted: true });
        expect(result.mana).toBeLessThan(before.mana);
        expect(result.cooldownRemaining).toBeGreaterThan(0);
        observations.push(result);
        // Normal global cooldown, no reset between casts.
        await page.waitForTimeout(1200);
    }
    await testInfo.attach('accepted-wizard-casts', { body: JSON.stringify({ branch: branch.id, runes: branch.choices, observations }, null, 2), contentType: 'application/json' });
    expect(failures, failures.join('\n')).toEqual([]);
});
