import { expect } from '@playwright/test';
import { chronicleHunts } from '../../src/data/chronicleHunts.generated.js';
import { leaveEarnedCombatSafety } from './earned-safe-zone-combat.js';
import { openIlyra, readChronicleChapter } from './chronicle-earth-route.js';
import { createEarnedClassCombat } from './earned-class-combat.js';
import { recoverEarnedDeath } from './earned-death-recovery.js';
import { earnedCheckpoint } from './earned-checkpoint.js';
import { recoverBetweenHuntEncounters } from './earned-hunt-rest.js';
import { earnedTownRecoveryEnabled } from '../earnedRecoveryPolicy.js';
import { canEngageExpeditionTarget, chooseExpeditionCombatTarget } from '../expeditionCombatTargets.js';
import { findExpeditionTarget } from './earned-expedition-target.js';
import { equipEarnedEmptySlots } from './earned-equipment.js';
import { selectEarnedAttackTarget } from './earned-target-input.js';
import { prepareStoryHuntBuild } from './story-hunt-preparation.js';
import { maintainEarnedInventory } from './earned-inventory-management.js';
import { storyHuntTrainingDue } from '../storyHuntPreparationPolicy.js';
import { installStoryHuntCombatObserver, readStoryHuntCombatEvidence } from './story-hunt-combat-observer.js';
import { projectEntity, readPlayerState,
    setAutoLootThroughSettings } from './helpers.js';

const snapshot = page => page.evaluate(() => {
    const p = window.game.player;
    return { level: p.level, xp: p.xp, nextXP: p.xpToNextLevel, gold: p.gold,
        statPoints: p.statPoints, baseStats: { ...p.baseStats }, talentPoints: p.talentPoints,
        occupiedSlots: p.inventory.filter(item => item?.id).length,
        unsoldEquipmentValue: p.inventory.filter(item => item?.id &&
            ['WEAPON', 'ARMOR', 'ACCESSORY', 'NECK', 'GLOVES'].includes(item.type))
            .reduce((sum, item) => sum + (item.value || 0), 0) };
});

// Volatile combat evidence is deliberately separate from the exact saved
// progression snapshot: natural regeneration and login recovery are not grants.
const combatSnapshot = page => page.evaluate(() => {
    const game = window.game, p = game.player;
    return { hp: p.stats.hp, maxHP: p.stats.maxHp, mana: p.stats.mana,
        maxMana: p.stats.maxMana, hpRegen: p.stats.hpRegen, manaRegen: p.stats.manaRegen,
        x: p.position.x, z: p.position.z,
        nearbyEnemies: [...game.remotePlayers.values()].filter(enemy => game.isHostileActorTarget(enemy) && enemy.isActive &&
            enemy.state !== 'DEAD' && (enemy.health ?? enemy.stats?.hp) > 0 &&
            game.player.position.distanceTo(enemy.position) < 18).map(enemy => ({
            type: enemy.subType || enemy.constructor.name, level: enemy.level,
            hp: enemy.health ?? enemy.stats?.hp,
            distance: Math.round(game.player.position.distanceTo(enemy.position) * 10) / 10
        })) };
});

export async function earnFreshStoryHunt(page, credentials, id, { captureReady, leaveTown } = {}) {
    const hunt = chronicleHunts.find(hunt => hunt.id === id);
    expect(hunt?.huntingRealm, 'This earned driver currently covers Earth expeditions only').toBe('earth');
    const started = Date.now();
    const before = await snapshot(page);
    const prepare = async label => {
        const current = await snapshot(page);
        // Online attributes grow automatically; there are no spendable stat
        // points. Equip earned empty slots and train earned branch/mastery.
        await prepareStoryHuntBuild(page, credentials, current, label);
        console.log('[story-hunt] preparation receipt', JSON.stringify({ label, before: current, after: await snapshot(page) }));
        return current.level;
    };
    let preparedLevel = await prepare(`before-${id}`);
    await openIlyra(page);
    await expect(page.locator('.quest-dialogue h3')).toHaveText(hunt.title);
    expect((await readChronicleChapter(page, id))?.accepted).toBe(false);
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, id))?.accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    const previousAutoLoot = await page.evaluate(() => window.game.autoLootEnabled);
    await setAutoLootThroughSettings(page, true);
    // As in the verified collection route, allow a healthy ranged character to
    // finish ordinary basic attacks; permanent retreat resets starter leashes.
    let beforeCombat = await createEarnedClassCombat(page, undefined, { retreatBelowHealthRatio: .8 });
    await installStoryHuntCombatObserver(page);
    console.log(`[story-hunt] start ${JSON.stringify({ id, ...before, combat: await combatSnapshot(page) })}`);
    let deaths = 0, lastReported = 0, restStops = 0, trainingStops = 0;
    const recover = async () => {
        const credit = (await readChronicleChapter(page, id)).count;
        deaths++;
        console.log(`[story-hunt] death ${JSON.stringify({ id, deaths, credit, ...await snapshot(page), combat: await combatSnapshot(page) })}`);
        expect(deaths, 'Expedition exceeded two ordinary respawns').toBeLessThanOrEqual(2);
        await recoverEarnedDeath(page);
        const equipped = await equipEarnedEmptySlots(page);
        console.log('[story-hunt] recovery equipment', JSON.stringify({ equipped,
            combat: await combatSnapshot(page) }));
        expect((await readChronicleChapter(page, id)).count).toBeGreaterThanOrEqual(credit);
    };
    while ((await readChronicleChapter(page, id)).count < hunt.count) {
        if (earnedTownRecoveryEnabled()) await maintainEarnedInventory(page, { leaveTown });
        const credit = (await readChronicleChapter(page, id)).count;
        let enemy;
        if (storyHuntTrainingDue(preparedLevel, (await snapshot(page)).level)) {
            expect(typeof leaveTown, 'Milestone training must resume through ordinary town departure').toBe('function');
            console.log('[story-hunt] pre-training combat evidence', JSON.stringify(await readStoryHuntCombatEvidence(page)));
            preparedLevel = await prepare(`earned-milestone-${id}`);
            trainingStops++;
            await leaveTown();
            beforeCombat = await createEarnedClassCombat(page, undefined, { retreatBelowHealthRatio: .8 });
            await installStoryHuntCombatObserver(page);
            expect((await readChronicleChapter(page, id)).count).toBe(credit);
        }
        if (await recoverBetweenHuntEncounters(page, {
            enabled: earnedTownRecoveryEnabled(), creditedKills: credit, leaveTown
        })) restStops++;
        try { enemy = await findExpeditionTarget(page, hunt); } catch (error) {
            if ((await readPlayerState(page)).state !== 'DEAD') throw error;
            await recover();
            continue;
        }
        const deadline = Date.now() + 120_000;
        let respawned = false;
        while (Date.now() < deadline && (await readChronicleChapter(page, id)).count === credit) {
            if ((await readPlayerState(page)).state === 'DEAD') {
                await recover(); respawned = true; break;
            }
            if (await leaveEarnedCombatSafety(page, leaveTown)) continue;
            const observed = await page.evaluate(id => {
                const game = window.game;
                const describe = target => target ? { id: target.id,
                    alive: game.isHostileActorTarget(target) && target.state !== 'DEAD' &&
                        (target.health ?? target.stats?.hp) > 0,
                    distance: game.player.position.distanceTo(target.position) } : null;
                return { goal: describe(game.remotePlayers.get(id)),
                    selected: describe(game.pendingInteraction),
                    nearby: [...game.remotePlayers.values()].filter(target => game.isHostileActorTarget(target))
                        .map(describe) };
            }, enemy.id);
            const combatTarget = chooseExpeditionCombatTarget(
                observed.selected?.alive ? observed.selected : observed.goal, observed.nearby);
            await page.evaluate(id => { window.__storyHuntCombatEvidence.requestedId = id; }, combatTarget?.id || null);
            const acquisitionPoint = combatTarget && await projectEntity(page, combatTarget.id);
            if (!canEngageExpeditionTarget(combatTarget, acquisitionPoint?.visible)) {
                // Retreat/leash can stream out the original target. Seek a
                // visible appropriate enemy through ordinary travel, without
                // resetting the deadline or manufacturing quest credit. A
                // visible living enemy can be clicked to start normal pursuit.
                enemy = await findExpeditionTarget(page, hunt, deadline);
                continue;
            }
            if (await beforeCombat(page, combatTarget)) continue;
            const point = await projectEntity(page, combatTarget.id);
            if (point?.visible) {
                await selectEarnedAttackTarget(page, combatTarget, point);
                if (await page.evaluate(() => window.game.player.abilityCooldown <= 0)) {
                    await page.mouse.click(point.x, point.y, { button: 'right' });
                }
            }
            await page.waitForTimeout(250);
        }
        if (respawned) continue;
        const count = (await readChronicleChapter(page, id)).count;
        if (count <= credit) console.log(`[story-hunt] stalled ${JSON.stringify(await page.evaluate(id => {
            const game = window.game, target = game.remotePlayers.get(id);
            return { player: { level: game.player.level, hp: game.player.stats.hp,
                maxHP: game.player.stats.maxHp, mana: game.player.stats.mana, maxMana: game.player.stats.maxMana,
                statPoints: game.player.statPoints, baseStats: game.player.baseStats,
                talentPoints: game.player.talentPoints, talents: game.player.talentRanks,
                restBank: game.player.wellRestedSeconds, safeZone: game.player.safeZoneId,
                x: game.player.position.x, z: game.player.position.z },
            target: target ? { id, level: target.level, hp: target.health ?? target.stats?.hp,
                state: target.state, distance: game.player.position.distanceTo(target.position) } : null,
            hovered: game.hoveredEntity?.id, defense: window.__freshWizardDefense?.counts || window.__freshFighterCombat?.counts,
            damageEvidence: window.__storyHuntCombatEvidence };
        }, enemy.id))}`);
        expect(count, `Ordinary ${hunt.enemy} combat must earn server hunt credit`).toBeGreaterThan(credit);
        if (count >= lastReported + 5 || count === hunt.count) {
            lastReported = count;
            console.log(`[story-hunt] ${JSON.stringify({ id, creditedKills: count, required: hunt.count,
                deaths, restStops, trainingStops, ...await snapshot(page), combat: await combatSnapshot(page), seconds: Math.round((Date.now() - started) / 1000) })}`);
        }
    }
    const ready = await readChronicleChapter(page, id);
    console.log('[story-hunt] final combat evidence', JSON.stringify(await readStoryHuntCombatEvidence(page)));
    expect(ready.completed).toBe(false);
    expect(ready.grantedXP || 0).toBe(0);
    expect(ready.grantedGold || 0).toBe(0);
    await setAutoLootThroughSettings(page, false);
    await expect.poll(() => page.evaluate(() => window.game.pendingLootPickups.size)).toBe(0);
    await openIlyra(page);
    const beforeClaim = await snapshot(page);
    if (captureReady) await captureReady();
    await page.getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, id)).completed).toBe(true);
    const receipt = await readChronicleChapter(page, id);
    expect(receipt.grantedXP).toBe(Math.floor((100 + 25 * (hunt.contentLevel - 1) ** 2) * .75));
    expect(receipt.grantedGold).toBe(hunt.contentLevel * 10);
    await expect(page.locator('.quest-dialogue__speech')).toHaveText(hunt.completion.split(/\n\s*\n/));
    expect((await snapshot(page)).gold).toBe(beforeClaim.gold + receipt.grantedGold);
    await page.getByRole('button', { name: 'Continue conversation', exact: true }).click();
    await page.locator('#btn-close-quest').click();
    await setAutoLootThroughSettings(page, previousAutoLoot);
    const earned = await snapshot(page);
    await earnedCheckpoint(page, credentials, { label: id, final: true });
    expect(await snapshot(page)).toEqual(earned);
    expect(await readChronicleChapter(page, id)).toEqual(receipt);
    expect((await readChronicleChapter(page, hunt.beforeQuestId))?.accepted).toBe(false);
    console.log(`[story-hunt] complete ${JSON.stringify({ id, before, beforeClaim, earned, receipt, deaths, restStops, trainingStops,
        seconds: Math.round((Date.now() - started) / 1000), note: 'Unsold vendor values are not income; quest count is server credit, not a separate count of selected-target deaths.' })}`);
}
