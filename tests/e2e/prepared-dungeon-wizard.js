import { expect } from '@playwright/test';
import { earnedPreparationBudget, earnedPreparationProfile } from '../earnedPreparationPolicy.js';
import { CONSTANTS } from '../../src/core/Constants.js';

// Prepared functional QA, not fresh-character balance evidence. Like Fighter's
// rune selection, this uses the ordinary build UI after the explicit level
// fixture. No equipment, resources, ranks or damage are injected here, and no
// reconnect is allowed to hide the cost of earlier encounters.
export async function prepareDungeonWizard(page) {
    const before = await page.evaluate(() => {
        const p = window.game.player;
        return { className: p.constructor.name, level: p.level, statPoints: p.statPoints,
            talentPoints: p.talentPoints, talentRanks: { ...p.talentRanks }, mana: p.stats.mana };
    });
    if (before.className !== 'Wizard') return;
    const profile = earnedPreparationProfile('Wizard');
    const budget = earnedPreparationBudget('Wizard', before, 0);
    const rune = CONSTANTS.SKILL_RUNES.Wizard.find(r => r.id === 'fireball_empowered');
    expect(rune, 'prepared Wizard rune must exist in the actual catalog').toBeTruthy();

    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Talents', exact: true }).click();
    for (let i = 0; i < budget.masteryPurchases; i++) {
        await skills.locator('.skill-node').filter({ hasText: profile.masteryLabel }).click();
        await expect.poll(() => page.evaluate(() => window.game.player.talentPoints))
            .toBe(before.talentPoints - i - 1);
        await expect.poll(() => page.evaluate(id => window.game.player.talentRanks[id], profile.mastery))
            .toBe(budget.currentMastery + i + 1);
    }
    if (before.level >= rune.unlockLevel) {
        await skills.getByRole('button', { name: 'Runes', exact: true }).click();
        await skills.getByText(rune.skill, { exact: true }).locator('..')
            .getByText(rune.name, { exact: true }).click();
        await expect.poll(() => page.evaluate(skill => window.game.player.skillRunes?.[skill], rune.skill))
            .toBe(rune.id);
    }
    await page.locator('#btn-close-skills').click();
    await expect(skills).toBeHidden();
    const after = await page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, statPoints: p.statPoints, talentPoints: p.talentPoints,
            mastery: p.talentRanks.WIZ_01 || 0, rune: p.skillRunes?.Fireball,
            mana: p.stats.mana, maxMana: p.stats.maxMana, damage: p.stats.damage };
    });
    expect(after.level).toBe(before.level);
    expect(after.statPoints).toBe(before.statPoints);
    console.log(`[prepared-dungeon-wizard] ${JSON.stringify({ purchases: budget.masteryPurchases, beforeMana: before.mana, ...after })}`);
}
