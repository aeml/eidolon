import { selectEarnedClericHeal } from '../clericEarnedControls.js';
import { projectGroundOffset } from './helpers.js';

export function createEarnedClericCombat() {
    let nextAttemptAt = 0;
    return async page => {
        if (Date.now() < nextAttemptAt) return false;
        const state = await page.evaluate(async () => {
            const p = window.game.player;
            const { getAbilityManaCost } = await import('/src/core/AbilityEconomy.js');
            return { className: p.constructor.name, dead: p.state === 'DEAD',
                healthRatio: p.stats.hp / p.stats.maxHp, mana: p.stats.mana,
                hotbar: p.hotbar, unlockedSkills: p.unlockedSkills, cooldowns: p.cooldowns,
                healCost: getAbilityManaCost(p, 'Healing Light', 25) };
        });
        const action = selectEarnedClericHeal(state);
        if (!action) return false;
        const self = await projectGroundOffset(page, 0, 0);
        if (!self?.canvas) return false;
        // Aim at the real caster through ordinary input; the server resolves
        // target validity, mana payment, cooldown and actual healing.
        await page.mouse.move(self.x, self.y);
        await page.keyboard.press(action.key);
        nextAttemptAt = Date.now() + 1000;
        await page.waitForTimeout(550);
        return true;
    };
}
