import { createEarnedClassCombat } from './earned-class-combat.js';
import { projectGroundOffset } from './helpers.js';
import { selectEarnedDungeonSupport } from '../earnedDungeonSupport.js';

export async function createEarnedDungeonCombat(page, className) {
    const defend = await createEarnedClassCombat(page, className);
    // Keep the already exercised Wizard/Fighter input ownership unchanged.
    if (!['Rogue', 'Cleric'].includes(className)) return defend;
    await page.evaluate(() => {
        const game = window.game;
        window.__earnedDungeonCasts = { lastAcceptedAt: 0, accepted: {}, rejected: {} };
        if (game.__earnedDungeonCastObserverInstalled) return;
        game.__earnedDungeonCastObserverInstalled = true;
        const original = game.handleServerMessage.bind(game);
        game.handleServerMessage = message => {
            if (message.type === 'ability_result' && message.payload?.skillName) {
                const { skillName, accepted } = message.payload, evidence = window.__earnedDungeonCasts;
                if (accepted) evidence.lastAcceptedAt = Date.now();
                const counts = evidence[accepted ? 'accepted' : 'rejected'];
                counts[skillName] = (counts[skillName] || 0) + 1;
            }
            return original(message);
        };
    });
    let nextAttemptAt = 0;
    return async (_page, target) => {
        // Ranged escape and immediate Healing Light take priority over buffs.
        if (await defend(page, target)) return true;
        if (Date.now() < nextAttemptAt) return false;
        const state = await page.evaluate(async id => {
            const game = window.game, p = game.player, enemy = game.remotePlayers.get(id);
            const { getAbilityManaCost } = await import('/src/core/AbilityEconomy.js');
            const { CONSTANTS } = await import('/src/core/Constants.js');
            const className = p.constructor.name;
            const skill = className === 'Rogue' ? 'Poison Coating' : 'Guardian Embrace';
            const config = CONSTANTS.ABILITY_CONFIG[className]?.skills?.[skill];
            return { className, dead: p.state === 'DEAD', healthRatio: p.stats.hp / p.stats.maxHp,
                targetValid: Boolean(enemy?.isActive && enemy.state !== 'DEAD' &&
                    (enemy.health ?? enemy.stats?.hp) > 0 && game.isHostileActorTarget(enemy)),
                distance: enemy ? p.position.distanceTo(enemy.position) : null,
                attackRange: enemy ? game.getBasicAttackRangeForEntity(enemy) : null,
                mana: p.stats.mana, hotbar: p.hotbar, unlockedSkills: p.unlockedSkills, cooldowns: p.cooldowns,
                skillCosts: { [skill]: config ? getAbilityManaCost(p, skill, config.mana) : null },
                poisonCoatingActive: p.poisonCoatingActive, poisonCoatingTimer: p.poisonCoatingTimer,
                guardianEmbraceActive: p.guardianEmbraceActive, guardianEmbraceTimer: p.guardianEmbraceTimer,
                sinceCastMs: Date.now() - window.__earnedDungeonCasts.lastAcceptedAt };
        }, target?.id);
        const action = selectEarnedDungeonSupport(state);
        if (!action) return false;
        const self = await projectGroundOffset(page, 0, 0);
        if (!self?.canvas) return false;
        await page.mouse.move(self.x, self.y);
        await page.keyboard.press(action.key);
        nextAttemptAt = Date.now() + 1000;
        await page.waitForTimeout(550);
        return true;
    };
}
