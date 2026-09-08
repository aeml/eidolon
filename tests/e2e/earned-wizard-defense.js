import { moveByGroundClick, projectGroundOffset, readPlayerState } from './helpers.js';
import { planWizardCrowdControl } from '../wizardHuntControls.js';

// Only observes replicated state and chooses ordinary keys/ground clicks.
// Reinstall after fresh login, which destroys the previous browser observer.
export async function createEarnedWizardDefense(page, { allowJumpFallback = false, useCrowdControl = false } = {}) {
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        window.__freshWizardDefense = { lastAcceptedAt: 0, counts: { retreats: 0, shields: 0, rejectedShields: 0, wells: 0, rejectedWells: 0, fireballs: 0, rejectedFireballs: 0 } };
        game.handleServerMessage = message => {
            if (message.type === 'ability_result') {
                const state = window.__freshWizardDefense;
                if (message.payload?.accepted) state.lastAcceptedAt = Date.now();
                if (message.payload?.skillName === 'Arcane Shield') {
                    state.counts[message.payload.accepted ? 'shields' : 'rejectedShields']++;
                }
                if (message.payload?.skillName === 'Gravity Well') {
                    state.counts[message.payload.accepted ? 'wells' : 'rejectedWells']++;
                }
                if (message.payload?.skillName === 'Fireball') {
                    state.counts[message.payload.accepted ? 'fireballs' : 'rejectedFireballs']++;
                }
            }
            return original(message);
        };
    });
    const beforeCombat = async ({ encounter } = {}) => {
        const state = await page.evaluate(async () => {
            const game = window.game, p = game.player;
            const { getAbilityManaCost } = await import('/src/core/AbilityEconomy.js');
            return { className: p.constructor.name, dead: p.state === 'DEAD', x: p.position.x, z: p.position.z,
                radius: p.radius, walkRects: game.currentInstanceType !== 'overworld' ? game.currentDungeonLayout?.walkRects : null,
                healthRatio: p.stats.hp / p.stats.maxHp, shieldHP: p.shieldHP || 0, mana: p.stats.mana,
                shieldCost: getAbilityManaCost(p, 'Arcane Shield', 40), hotbar: p.hotbar, cooldowns: p.cooldowns,
                wellCost: getAbilityManaCost(p, 'Gravity Well', 60),
                unlockedSkills: p.unlockedSkills,
                sinceCastMs: Date.now() - window.__freshWizardDefense.lastAcceptedAt,
                threats: (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                    p.position.distanceTo(enemy.position) < 18).map(enemy => ({ x: enemy.position.x, z: enemy.position.z })) };
        });
        const plan = await page.evaluate(async ({ state, encounter }) => {
            const { planWizardHuntStep, isEarnedRetreatPathClear } = await import('/tests/wizardHuntControls.js');
            const game = window.game;
            return planWizardHuntStep({ ...state, encounter,
                canRetreat: delta => isEarnedRetreatPathClear(game.collisionManager,
                    game.player.position, state.radius || 1.25, delta) });
        }, { state, encounter });
        if (plan?.action === 'shield') {
            await page.keyboard.press(plan.key);
            await page.waitForTimeout(550);
            return true;
        }
        const control = useCrowdControl ? planWizardCrowdControl(state) : null;
        if (control) {
            const target = await projectGroundOffset(page, control.x, control.z);
            if (target?.canvas) {
                await page.mouse.move(target.x, target.y);
                await page.keyboard.press(control.key);
                await page.waitForTimeout(550);
                return true;
            }
        }
        if (!plan) return false;
        try {
            await moveByGroundClick(page, plan.x, plan.z, { minimumDistance: 6, allowJumpFallback,
                requireClearPath: true, timeout: 2500 });
        } catch (error) {
            if ((await readPlayerState(page)).state === 'DEAD') return true;
            throw error;
        }
        await page.evaluate(() => window.__freshWizardDefense.counts.retreats++);
        return false;
    };
    return beforeCombat;
}
