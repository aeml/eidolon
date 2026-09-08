import { moveByGroundClick, readPlayerState } from './helpers.js';
import { GroundInputUnavailableError } from '../groundInputFailure.js';

// Only observes replicated state and chooses ordinary keys/ground clicks.
// Reinstall after fresh login, which destroys the previous browser observer.
export async function createEarnedWizardDefense(page, { retreatBelowHealthRatio } = {}) {
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        window.__freshWizardDefense = { lastAcceptedAt: 0, counts: { retreats: 0, shields: 0, rejectedShields: 0 } };
        game.handleServerMessage = message => {
            if (message.type === 'ability_result') {
                const state = window.__freshWizardDefense;
                if (message.payload?.accepted) state.lastAcceptedAt = Date.now();
                if (message.payload?.skillName === 'Arcane Shield') {
                    state.counts[message.payload.accepted ? 'shields' : 'rejectedShields']++;
                }
            }
            return original(message);
        };
    });
    const beforeCombat = async () => {
        const state = await page.evaluate(async () => {
            const game = window.game, p = game.player;
            const { getAbilityManaCost } = await import('/src/core/AbilityEconomy.js');
            return { className: p.constructor.name, dead: p.state === 'DEAD', x: p.position.x, z: p.position.z,
                radius: p.radius, walkRects: game.currentInstanceType !== 'overworld' ? game.currentDungeonLayout?.walkRects : null,
                healthRatio: p.stats.hp / p.stats.maxHp, shieldHP: p.shieldHP || 0, mana: p.stats.mana,
                shieldCost: getAbilityManaCost(p, 'Arcane Shield', 40), hotbar: p.hotbar, cooldowns: p.cooldowns,
                unlockedSkills: p.unlockedSkills,
                sinceCastMs: Date.now() - window.__freshWizardDefense.lastAcceptedAt,
                threats: (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                    p.position.distanceTo(enemy.position) < 30).map(enemy => ({ x: enemy.position.x, z: enemy.position.z,
                    // Server PerformAttack uses 3 + scaled attacker/target reach.
                    meleeReach: (enemy.subType === 'DwarfSalesman' ? 6 : 3) +
                        Math.max(0, (enemy.scale || 1) - 1) * 1.5 + Math.max(0, (p.scale || 1) - 1) * 1.5 })) };
        });
        const plan = await page.evaluate(async state => {
            const { planWizardHuntStep, isEarnedRetreatPathClear } = await import('/tests/wizardHuntControls.js');
            const game = window.game;
            return planWizardHuntStep({ ...state, canRetreat: delta =>
                isEarnedRetreatPathClear(game.collisionManager, game.player.position, state.radius || 1.25, delta) });
        }, { ...state, retreatBelowHealthRatio });
        if (!plan) return false;
        if (plan.action === 'shield') {
            await page.keyboard.press(plan.key);
            await page.waitForTimeout(550);
            return true;
        }
        try {
            await moveByGroundClick(page, plan.x, plan.z, { minimumDistance: 6, allowJumpFallback: false,
                timeout: 2500 });
        } catch (error) {
            if ((await readPlayerState(page)).state === 'DEAD') return true;
            if (error instanceof GroundInputUnavailableError) {
                await page.evaluate(() => {
                    const counts = window.__freshWizardDefense.counts;
                    counts.blockedRetreats = (counts.blockedRetreats || 0) + 1;
                });
                // No click/key was issued. Fight from here, preserving the
                // caller's unchanged combat deadline and death bounds.
                return false;
            }
            throw error;
        }
        await page.evaluate(() => window.__freshWizardDefense.counts.retreats++);
        return false;
    };
    return beforeCombat;
}
