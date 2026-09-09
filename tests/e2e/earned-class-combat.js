import { createEarnedWizardDefense, createEarnedRangedDefense } from './earned-wizard-defense.js';
import { createEarnedClericCombat } from './earned-cleric-combat.js';
import { selectFighterDungeonSkill } from '../dungeonCombatControls.js';

// Observes accepted server casts; all actions are ordinary player hotbar keys.
// The dungeon driver already owns melee hotbar input, so do not double-cast there.
export async function createEarnedClassCombat(page, className, options) {
    className ??= await page.evaluate(() => window.game.player.constructor.name);
    if (className === 'Wizard') return createEarnedWizardDefense(page, options);
    if (className === 'Rogue') return createEarnedRangedDefense(page, options);
    if (className === 'Cleric') return createEarnedClericCombat();
    if (className !== 'Fighter') throw new Error(`No earned combat driver for ${className}`);
    await page.evaluate(() => {
        const game = window.game;
        window.__freshFighterCombat = { lastAcceptedAt: 0, counts: { accepted: {}, rejected: {} } };
        if (game.__freshFighterCombatObserverInstalled) return;
        game.__freshFighterCombatObserverInstalled = true;
        const original = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            if (message.type === 'ability_result' && message.payload?.skillName) {
                const state = window.__freshFighterCombat, { accepted, skillName } = message.payload;
                if (accepted) state.lastAcceptedAt = Date.now();
                const counts = state.counts[accepted ? 'accepted' : 'rejected'];
                counts[skillName] = (counts[skillName] || 0) + 1;
            }
            return original(message);
        };
    });
    let nextAttemptAt = 0;
    return async (_page, target) => {
        if (Date.now() < nextAttemptAt) return false;
        const state = await page.evaluate(async id => {
            const game = window.game, p = game.player;
            // Fresh login has no instance-enter event: null/empty means overworld.
            // Recall from within that world also preserves the empty marker.
            if ((game.currentInstanceType || 'overworld') !== 'overworld' || p.state === 'DEAD' ||
                Date.now() - window.__freshFighterCombat.lastAcceptedAt < 550) return null;
            const enemy = game.remotePlayers.get(id);
            if (!enemy || !game.isHostileActorTarget(enemy)) return null;
            const { getAbilityManaCost } = await import('/src/core/AbilityEconomy.js');
            return { classAbility: p.abilityName, isCharging: p.isCharging, dead: false,
                distance: p.position.distanceTo(enemy.position), attackRange: game.getBasicAttackRangeForEntity(enemy),
                mana: p.stats.mana, hotbar: p.hotbar.map(skill => p.unlockedSkills.includes(skill) ? skill : null),
                cooldowns: p.cooldowns, skillCosts: Object.fromEntries([
                    ['Iron Fortress', 40], ['Guardian Roar', 35], ['Whirlwind', 30], ['Shield Slam', 25]
                ].map(([skill, cost]) => [skill, getAbilityManaCost(p, skill, cost)])) };
        }, target?.id);
        const action = state && selectFighterDungeonSkill(state, true);
        if (!action) return false;
        await page.keyboard.press(action.key);
        nextAttemptAt = Date.now() + 1000;
        await page.waitForTimeout(550);
        return true;
    };
}
