import { expect } from '@playwright/test';
import { jumpByGroundClick, moveByGroundClick, projectGroundOffset, readPlayerState } from './helpers.js';
import { planWizardCrowdControl } from '../wizardHuntControls.js';
import { GroundInputUnavailableError, GroundPointerInterceptedError } from '../groundInputFailure.js';
import { planReachableWizardStep } from './earned-retreat-plan.js';

// Only observes replicated state and chooses ordinary keys/ground clicks.
// Reinstall after fresh login, which destroys the previous browser observer.
export function createEarnedWizardDefense(page, options) {
    return createEarnedRangedDefense(page, options);
}

export async function createEarnedRangedDefense(page, { allowJumpFallback = false, useCrowdControl = false,
    retreatBelowHealthRatio = Infinity } = {}) {
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        window.__freshWizardDefense = { lastAcceptedAt: 0, counts: { retreats: 0, crowdJumps: 0, shields: 0, rejectedShields: 0, wells: 0, rejectedWells: 0, fireballs: 0, rejectedFireballs: 0 } };
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
                canJump: !game.isMobile && !game.playerJumpState && !p.stunTimer && !p.rootTimer && !p.frozenTimer,
                radius: p.radius, walkRects: game.currentInstanceType !== 'overworld' ? game.currentDungeonLayout?.walkRects : null,
                healthRatio: p.stats.hp / p.stats.maxHp, shieldHP: p.shieldHP || 0, mana: p.stats.mana,
                shieldCost: getAbilityManaCost(p, 'Arcane Shield', 40), hotbar: p.hotbar, cooldowns: p.cooldowns,
                wellCost: getAbilityManaCost(p, 'Gravity Well', 60),
                unlockedSkills: p.unlockedSkills,
                sinceCastMs: Date.now() - window.__freshWizardDefense.lastAcceptedAt,
                threats: (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                    p.position.distanceTo(enemy.position) < 30).map(enemy => ({ x: enemy.position.x, z: enemy.position.z, radius: enemy.radius,
                    // Server PerformAttack uses 3 + scaled attacker/target reach.
                    meleeReach: (enemy.subType === 'DwarfSalesman' ? 6 : 3) +
                        Math.max(0, (enemy.scale || 1) - 1) * 1.5 + Math.max(0, (p.scale || 1) - 1) * 1.5 })) };
        });
        const plan = await planReachableWizardStep(page, { ...state, encounter, retreatBelowHealthRatio });
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
        if (!plan || (plan.action === 'retreat' && state.healthRatio >= retreatBelowHealthRatio)) return false;
        try {
            if (plan.useJump) {
                const before = await readPlayerState(page);
                await jumpByGroundClick(page, plan.x, plan.z);
                const after = await readPlayerState(page);
                if (after.state === 'DEAD') return true;
                expect(Math.hypot(after.x - before.x, after.z - before.z),
                    'Ordinary crowd-escape jump must actually retreat at least six units').toBeGreaterThan(6);
                await page.evaluate(() => window.__freshWizardDefense.counts.crowdJumps++);
            } else {
                await moveByGroundClick(page, plan.x, plan.z, { minimumDistance: 6, allowJumpFallback,
                    moveOnly: true, allowAlternatePaths: false, requireClearPath: true, timeout: 2500 });
            }
        } catch (error) {
            if ((await readPlayerState(page)).state === 'DEAD') return true;
            if (error instanceof GroundInputUnavailableError || error instanceof GroundPointerInterceptedError) {
                await page.evaluate(() => {
                    const counts = window.__freshWizardDefense.counts;
                    counts.blockedRetreats = (counts.blockedRetreats || 0) + 1;
                });
                // Either no input was available, or every actual click was
                // proven to select a crossing hostile instead of ground. Fight
                // from here without changing the combat deadline/death bounds.
                return false;
            }
            throw error;
        }
        await page.evaluate(() => window.__freshWizardDefense.counts.retreats++);
        return false;
    };
    return beforeCombat;
}
