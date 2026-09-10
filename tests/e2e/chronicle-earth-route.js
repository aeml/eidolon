import { expect } from '@playwright/test';
import { jumpByGroundClick, moveByGroundClick, projectEntity, projectNearestHostile, readPlayerState,
    returnToTown, setAutoLootThroughSettings, useCombatQAWaypoint, useEncounterQAWaypoint } from './helpers.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { earnEarthInvestigation } from './chronicle-investigation-route.js';
import { findExpeditionTarget } from './earned-expedition-target.js';
import { earnEarthHuntsBefore } from '../earthFunctionalPrerequisites.js';
import { maintainEarnedInventory } from './earned-inventory-management.js';
import { leaveEarnedCombatSafety } from './earned-safe-zone-combat.js';
import { approachEarnedDrop } from '../earnedDropApproach.js';
import { verifyFreshWaterHandoff } from './chronicle-water-handoff.js';

export const EARTH_DUNGEON_CHAPTER = 'chronicle_03_roots_remember';
const FIRST_CHAPTER = 'chronicle_01_bell_below';
const SEED_CHAPTER = 'chronicle_02_seeds_first_grove';

export const readChronicleChapter = (page, id) => page.evaluate(id => {
    const quest = window.game.player.quests.find(quest => quest.id === id);
    return quest ? { id: quest.id, accepted: quest.accepted, completed: quest.completed,
        count: quest.count, maxCount: quest.maxCount, grantedGold: quest.grantedGold,
        grantedXP: quest.grantedXP, grantedResonanceXP: quest.grantedResonanceXP } : null;
}, id);

export async function openIlyra(page) {
    await returnToTown(page);
    for (let step = 0; step < 12; step++) {
        const position = await readPlayerState(page);
        if (Math.hypot(position.x - 20, position.z - 215) < 4.5) break;
        const dx = 17 - position.x, dz = 215 - position.z;
        const scale = Math.min(1, 12 / Math.hypot(dx, dz));
        await moveByGroundClick(page, dx * scale, dz * scale, { allowJumpFallback: false });
    }
    // Finish the ground approach before projecting the moving camera's NPC.
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return game.player.state === 'IDLE' && !game.player.targetPosition &&
            Math.hypot(game.renderSystem.cameraTarget.x - game.player.position.x,
                game.renderSystem.cameraTarget.z - game.player.position.z) < 0.05;
    })).toBe(true);
    let point;
    await expect.poll(async () => {
        point = await projectEntity(page, 'story-wizard-1');
        if (!point?.visible) return false;
        await page.mouse.move(point.x, point.y);
        return page.evaluate(() => window.game.hoveredEntity?.id === 'story-wizard-1');
    }).toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#quest-window')).toBeVisible();
}

async function acceptOfferedChapter(page, id) {
    const quest = await readChronicleChapter(page, id);
    expect(quest?.accepted, `${id} must still be an unaccepted offer`).toBe(false);
    await page.locator('#quest-window').getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, id))?.accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
}

export async function claimChapterAndContinue(page, id) {
    const quest = await readChronicleChapter(page, id);
    expect(quest?.count).toBe(quest?.maxCount);
    expect(quest?.completed, 'Ordinary progress must not auto-complete the chapter').toBe(false);
    await openIlyra(page);
    const gold = await page.evaluate(() => window.game.player.gold);
    await page.locator('#quest-window').getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, id))?.completed).toBe(true);
    await expect.poll(() => page.evaluate(() => window.game.player.gold)).toBeGreaterThan(gold);
    expect((await readChronicleChapter(page, id)).grantedGold).toBeGreaterThan(0);
    await page.locator('#quest-window').getByRole('button', { name: 'Continue conversation', exact: true }).click();
}

async function defeatOrdinaryEarthEnemy(page, hunt = null) {
    let target;
    if (hunt) {
        // A nearest-enemy QA waypoint does not select the required subtype or
        // level. Share ordinary authored-hunt acquisition, including its bounds.
        target = await findExpeditionTarget(page, hunt);
    } else {
        await useEncounterQAWaypoint(page);
        await expect.poll(async () => { target = await projectNearestHostile(page); return Boolean(target); }).toBe(true);
    }
    const deadline = Date.now() + 90_000;
    let lastPosition;
    while (Date.now() < deadline) {
        const state = await page.evaluate(id => {
            const game = window.game;
            const enemy = game.activeEntitiesCache.find(entity => entity.id === id) || game.remotePlayers.get(id);
            return enemy ? { state: enemy.state, hp: enemy.health ?? enemy.stats?.hp,
                x: enemy.position.x, z: enemy.position.z } : null;
        }, target.id);
        if (!state) throw new Error('Earth encounter disappeared without an observed death');
        lastPosition = state;
        if (state.state === 'DEAD' || state.hp <= 0) {
            // Approach the normal drop location so auto-loot can collect a
            // naturally rolled personal relic; no guaranteed-drop command.
            await approachEarnedDrop({ destination: state, readPosition: () => readPlayerState(page),
                move: async (x, z) => {
                    await moveByGroundClick(page, x, z, { moveOnly: true, allowJumpFallback: false });
                    await expect.poll(() => page.evaluate(() => !window.game.player.targetPosition)).toBe(true);
                } });
            // Death, world-drop publication and pickup acknowledgement are not
            // one synchronous event. Do not leave a rolled fragment behind.
            await page.waitForTimeout(900);
            await expect.poll(() => page.evaluate(() => {
                const game = window.game;
                return [...game.remotePlayers.values()].filter(entity => entity.isActive &&
                    entity.item?.id?.startsWith('chronicle-item-') && game.canAttemptLootPickup(entity)).length;
            })).toBe(0);
            await expect.poll(() => page.evaluate(() => window.game.pendingLootPickups.size)).toBe(0);
            return;
        }
        if (await leaveEarnedCombatSafety(page, () => leaveTownForFunctionalHunt(page))) continue;
        const point = await projectEntity(page, target.id);
        if (point?.visible) {
            await page.mouse.move(point.x, point.y);
            await page.mouse.click(point.x, point.y);
            if (await page.evaluate(() => window.game.player.abilityName === 'Fireball' && window.game.player.abilityCooldown <= 0)) {
                await page.mouse.click(point.x, point.y, { button: 'right' });
            }
        }
        await page.waitForTimeout(200);
        expect((await readPlayerState(page)).state, 'Normal quest combat must remain survivable').not.toBe('DEAD');
    }
    throw new Error(`Ordinary Earth combat timed out: ${JSON.stringify(lastPosition)}`);
}

async function leaveTownForFunctionalHunt(page) {
    for (let step = 0; (await readPlayerState(page)).x < 115 && step < 20; step++) {
        const position = await readPlayerState(page);
        await jumpByGroundClick(page, 25, Math.max(-8, Math.min(8, 200 - position.z)));
    }
    expect((await readPlayerState(page)).x).toBeGreaterThanOrEqual(115);
}

async function earnObjective(page, id, hunt = null) {
    if (!hunt) await useCombatQAWaypoint(page);
    const maxEncounters = Math.max(30, (await readChronicleChapter(page, id)).maxCount * 5);
    for (let kills = 0; kills < maxEncounters; kills++) {
        const quest = await readChronicleChapter(page, id);
        if (quest.count >= quest.maxCount) return;
        await maintainEarnedInventory(page, { leaveTown: () => leaveTownForFunctionalHunt(page) });
        await defeatOrdinaryEarthEnemy(page, hunt);
    }
    const final = await readChronicleChapter(page, id);
    if (final.count >= final.maxCount) return;
    throw new Error(`No complete objective after ${maxEncounters} normal Earth encounters: ${JSON.stringify(final)}`);
}

async function earnRequiredHunts(page, nextChapter) {
    await earnEarthHuntsBefore(nextChapter, async hunt => {
        expect((await readChronicleChapter(page, hunt.previousQuestId))?.completed,
            `${hunt.title} requires its actual preceding chapter`).toBe(true);
        await openIlyra(page);
        await acceptOfferedChapter(page, hunt.id);
        await setAutoLootThroughSettings(page, true);
        await leaveTownForFunctionalHunt(page);
        await earnObjective(page, hunt.id, hunt);
        await claimChapterAndContinue(page, hunt.id);
        await page.locator('#btn-close-quest').click();
    });
}

export async function earnEarthCollectionThroughPlay(page) {
    // The enclosing functional route prepares levels once. These steps do not
    // grant quests, items, kills or access; encounter waypoints are explicit QA
    // travel/protection, so this is not fresh-character balance evidence.
    const previousAutoLoot = await page.evaluate(() => window.game.uiManager.getAutoLootEnabled());
    await openIlyra(page); await acceptOfferedChapter(page, FIRST_CHAPTER);
    await setAutoLootThroughSettings(page, true);
    await earnObjective(page, FIRST_CHAPTER);
    await claimChapterAndContinue(page, FIRST_CHAPTER);
    await page.locator('#btn-close-quest').click();
    await earnEarthInvestigation(page, 'chronicle_earth_keepers_house', openIlyra);
    await earnRequiredHunts(page, SEED_CHAPTER);
    await openIlyra(page); await acceptOfferedChapter(page, SEED_CHAPTER);
    await earnObjective(page, SEED_CHAPTER);
    const required = (await readChronicleChapter(page, SEED_CHAPTER)).maxCount;
    expect(required).toBe(8);
    const seedsInBag = () => page.evaluate(() => window.game.player.inventory.reduce((sum, item) =>
        sum + (item?.name === 'Verdant Memory Seed' ? item.stack || 1 : 0), 0));
    // An area attack can roll several personal drops before pickups update the
    // objective. Verify the required consumption, not an artificial loot cap.
    await setAutoLootThroughSettings(page, false);
    const seedsBeforeTurnIn = await seedsInBag();
    expect(seedsBeforeTurnIn).toBeGreaterThanOrEqual(required);
    await claimChapterAndContinue(page, SEED_CHAPTER);
    expect(await seedsInBag()).toBe(seedsBeforeTurnIn - required);
    await page.locator('#btn-close-quest').click();
    await setAutoLootThroughSettings(page, previousAutoLoot);
    console.log('[chronicle-earth] opening, diary, 40 Skeletons and 8 natural Seeds manually turned in');
}

export async function earnEarthImpAndScarThroughPlay(page) {
    expect((await readChronicleChapter(page, SEED_CHAPTER))?.completed,
        'The same character must have earned and turned in the Seed chapter').toBe(true);
    const previousAutoLoot = await page.evaluate(() => window.game.uiManager.getAutoLootEnabled());
    await earnRequiredHunts(page, 'chronicle_earth_returning_scar');
    await earnEarthInvestigation(page, 'chronicle_earth_returning_scar', openIlyra);
    await setAutoLootThroughSettings(page, previousAutoLoot);
    console.log('[chronicle-earth] 60 qualifying Imps and all scar investigations manually turned in');
}

export async function prepareEarthDungeonOfferThroughPlay(page) {
    expect((await readChronicleChapter(page, 'chronicle_earth_returning_scar'))?.completed,
        'The same character must have earned and turned in the scar chapter').toBe(true);
    const previousAutoLoot = await page.evaluate(() => window.game.uiManager.getAutoLootEnabled());
    await earnRequiredHunts(page, EARTH_DUNGEON_CHAPTER);
    await openIlyra(page);
    await acceptOfferedChapter(page, EARTH_DUNGEON_CHAPTER);
    await setAutoLootThroughSettings(page, previousAutoLoot);
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]')).toHaveAttribute('data-access', 'sealed');
    await page.locator('#btn-close-dungeon-menu').click();
    console.log('[chronicle-earth] ordinary kills, naturally dropped relics, manual rewards and sealed pre-clear raid verified');
}

export async function prepareEarthChronicleThroughPlay(page) {
    // Preserve the full prerequisite graph for the actual dungeon playthrough.
    await earnEarthCollectionThroughPlay(page);
    await earnEarthImpAndScarThroughPlay(page);
    await prepareEarthDungeonOfferThroughPlay(page);
}

export async function verifyEarthDungeonChronicleTurnIn(page, credentials) {
    const earned = await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER);
    expect(earned?.count).toBe(1);
    expect(earned?.completed).toBe(false);
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]')).toHaveAttribute('data-access', 'sealed');
    await page.locator('#btn-close-dungeon-menu').click();
    await claimChapterAndContinue(page, EARTH_DUNGEON_CHAPTER);
    await verifyFreshWaterHandoff(page);
    await page.locator('#btn-close-quest').click();
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]')).toHaveAttribute('data-access', 'open');
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]').getByRole('button', { name: 'Enter Rootheart Sanctum', exact: true })).toBeEnabled();
    await page.locator('#btn-close-dungeon-menu').click();
    const { loginAndEnterWorld } = await import('./helpers.js');
    await loginAndEnterWorld(page, credentials);
    expect((await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER)).completed).toBe(true);
    await verifyFreshWaterHandoff(page);
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]')).toHaveAttribute('data-access', 'open');
    await page.locator('#btn-close-dungeon-menu').click();
    console.log('[chronicle-earth] full dungeon kill credit, manual chapter reward, Rootheart access and reconnect persistence verified');
}
