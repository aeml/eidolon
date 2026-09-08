import { expect } from '@playwright/test';
import { chronicleHunts } from '../../src/data/chronicleHunts.generated.js';
import { openIlyra, readChronicleChapter } from './chronicle-earth-route.js';
import { createEarnedClassCombat } from './earned-class-combat.js';
import { recoverEarnedDeath } from './earned-death-recovery.js';
import { earnedCheckpoint } from './earned-checkpoint.js';
import { chooseExpeditionCombatTarget, levelAppropriateExpeditionTargets } from '../expeditionCombatTargets.js';
import { equipEarnedEmptySlots } from './earned-equipment.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { prepareEarnedClass } from './fresh-ready-route.js';
import { moveByGroundClick, projectEntity, readPlayerState,
    setAutoLootThroughSettings } from './helpers.js';

const snapshot = page => page.evaluate(() => {
    const p = window.game.player;
    return { level: p.level, xp: p.xp, nextXP: p.xpToNextLevel, gold: p.gold,
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

// Read replicated enemies and approach through ordinary movement. No encounter
// waypoints, teleport commands, entity moves or progression grants are used.
async function findExpeditionTarget(page, hunt) {
    // The original Skeleton fallback lay in level-ten territory. Walk back
    // toward the authored starter band if streaming shows no appropriate foe.
    const fallback = hunt.enemy === 'Skeleton'
        ? (hunt.minEnemyLevel < 10 ? { x: 175, z: 200 } : { x: 125, z: -150 }) :
        hunt.enemy === 'Imp' ? { x: -300, z: 200 } : { x: 300, z: 200 };
    for (let step = 0; step < 100; step++) {
        expect((await readPlayerState(page)).state, 'Ordinary expedition travel must be survivable').not.toBe('DEAD');
        const observed = await page.evaluate(hunt => {
            const game = window.game;
            return [...game.remotePlayers.values()].filter(enemy => enemy.isActive && enemy.state !== 'DEAD' &&
                (enemy.subType || enemy.constructor.name) === hunt.enemy && enemy.level >= hunt.minEnemyLevel &&
                (enemy.health ?? enemy.stats?.hp) > 0).map(enemy => ({ id: enemy.id, level: enemy.level,
                x: enemy.position.x, z: enemy.position.z, rendered: game.activeEntitiesCache.includes(enemy),
                distance: game.player.position.distanceTo(enemy.position) })).sort((a, b) => a.distance - b.distance);
        }, hunt);
        const candidates = levelAppropriateExpeditionTargets(observed, hunt.minEnemyLevel,
            (await readPlayerState(page)).level);
        for (const enemy of candidates.slice(0, 6)) {
            if (!enemy.rendered) continue;
            const point = await projectEntity(page, enemy.id);
            if (point?.visible) return enemy;
        }
        const target = candidates[0] || fallback;
        const player = await readPlayerState(page);
        const dx = target.x - player.x, dz = target.z - player.z;
        const scale = Math.min(1, 12 / Math.max(1, Math.hypot(dx, dz)));
        await moveByGroundClick(page, dx * scale, dz * scale);
    }
    throw new Error(`No reachable ${hunt.enemy} level ${hunt.minEnemyLevel}+ after bounded ordinary travel`);
}

export async function earnFreshStoryHunt(page, credentials, id, { captureReady } = {}) {
    const hunt = chronicleHunts.find(hunt => hunt.id === id);
    expect(hunt?.huntingRealm, 'This earned driver currently covers Earth expeditions only').toBe('earth');
    const started = Date.now();
    const before = await snapshot(page);
    if (before.level >= 10) {
        // Higher expeditions use equipment and training already earned through
        // the story. No new items, levels or points are granted by preparation.
        await openDungeonGuide(page);
        await prepareEarnedClass(page, credentials, { label: `before-${id}` });
        await page.locator('#btn-close-dungeon-menu').click();
    }
    await openIlyra(page);
    await expect(page.locator('.quest-dialogue h3')).toHaveText(hunt.title);
    expect((await readChronicleChapter(page, id))?.accepted).toBe(false);
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, id))?.accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    if (before.level < 10) {
        const equipped = await equipEarnedEmptySlots(page);
        console.log('[story-hunt] earned equipment', JSON.stringify({ equipped,
            combat: await combatSnapshot(page) }));
    }
    const previousAutoLoot = await page.evaluate(() => window.game.autoLootEnabled);
    await setAutoLootThroughSettings(page, true);
    const beforeCombat = await createEarnedClassCombat(page);
    console.log(`[story-hunt] start ${JSON.stringify({ id, ...before, combat: await combatSnapshot(page) })}`);
    let deaths = 0, lastReported = 0;
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
        const credit = (await readChronicleChapter(page, id)).count;
        let enemy;
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
            const observed = await page.evaluate(id => {
                const game = window.game;
                const describe = target => target ? { id: target.id,
                    alive: game.isHostileActorTarget(target) && target.state !== 'DEAD' &&
                        (target.health ?? target.stats?.hp) > 0,
                    distance: game.player.position.distanceTo(target.position) } : null;
                return { goal: describe(game.remotePlayers.get(id)),
                    nearby: [...game.remotePlayers.values()].filter(target => game.isHostileActorTarget(target))
                        .map(describe) };
            }, enemy.id);
            const combatTarget = chooseExpeditionCombatTarget(observed.goal, observed.nearby);
            if (!combatTarget) {
                // Any credit still comes from normal server deaths. Do not
                // spend the watchdog repeatedly clicking an already-dead actor.
                await page.waitForTimeout(250);
                continue;
            }
            if (await beforeCombat(page, combatTarget)) continue;
            const point = await projectEntity(page, combatTarget.id);
            if (point?.visible) {
                await page.mouse.click(point.x, point.y);
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
                x: game.player.position.x, z: game.player.position.z },
            target: target ? { id, level: target.level, hp: target.health ?? target.stats?.hp,
                state: target.state, distance: game.player.position.distanceTo(target.position) } : null,
            hovered: game.hoveredEntity?.id, defense: window.__freshWizardDefense?.counts || window.__freshFighterCombat?.counts };
        }, enemy.id))}`);
        expect(count, `Ordinary ${hunt.enemy} combat must earn server hunt credit`).toBeGreaterThan(credit);
        if (count >= lastReported + 5 || count === hunt.count) {
            lastReported = count;
            console.log(`[story-hunt] ${JSON.stringify({ id, creditedKills: count, required: hunt.count,
                deaths, ...await snapshot(page), combat: await combatSnapshot(page), seconds: Math.round((Date.now() - started) / 1000) })}`);
        }
    }
    const ready = await readChronicleChapter(page, id);
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
    console.log(`[story-hunt] complete ${JSON.stringify({ id, before, beforeClaim, earned, receipt, deaths,
        seconds: Math.round((Date.now() - started) / 1000), note: 'Unsold vendor values are not income; quest count is server credit, not a separate count of selected-target deaths.' })}`);
}
