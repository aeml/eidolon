import { expect } from '@playwright/test';
import { moveByGroundClick, projectEntity, projectNearestHostile, readPlayerState,
    returnToTown, setAutoLootThroughSettings, useCombatQAWaypoint, useEncounterQAWaypoint } from './helpers.js';
import { openDungeonGuide } from './dungeon-guide.js';

export const EARTH_DUNGEON_CHAPTER = 'chronicle_03_roots_remember';
const FIRST_CHAPTER = 'chronicle_01_bell_below';
const SEED_CHAPTER = 'chronicle_02_seeds_first_grove';

export const readChronicleChapter = (page, id) => page.evaluate(id => {
    const quest = window.game.player.quests.find(quest => quest.id === id);
    return quest ? { id: quest.id, accepted: quest.accepted, completed: quest.completed,
        count: quest.count, maxCount: quest.maxCount, grantedGold: quest.grantedGold,
        grantedXP: quest.grantedXP, grantedResonanceXP: quest.grantedResonanceXP } : null;
}, id);

async function openIlyra(page) {
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

async function claimChapterAndContinue(page, id) {
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

async function defeatOrdinaryEarthEnemy(page) {
    await useEncounterQAWaypoint(page);
    let target;
    await expect.poll(async () => { target = await projectNearestHostile(page); return Boolean(target); }).toBe(true);
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
            const player = await readPlayerState(page);
            const distance = Math.hypot(state.x - player.x, state.z - player.z);
            if (distance > 3) {
                const scale = Math.min(1, 10 / distance);
                await moveByGroundClick(page, (state.x - player.x) * scale, (state.z - player.z) * scale,
                    { allowJumpFallback: false });
            }
            return;
        }
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

async function earnObjective(page, id) {
    await useCombatQAWaypoint(page);
    for (let kills = 0; kills < 30; kills++) {
        const quest = await readChronicleChapter(page, id);
        if (quest.count >= quest.maxCount) return;
        await defeatOrdinaryEarthEnemy(page);
    }
    throw new Error(`No complete objective after 30 normal Earth encounters: ${JSON.stringify(await readChronicleChapter(page, id))}`);
}

export async function prepareEarthChronicleThroughPlay(page) {
    // The enclosing functional dungeon route prepares levels. These steps do
    // not grant quests, items, kills or access; encounter waypoints are explicit
    // QA travel/protection, so this is not fresh-character balance evidence.
    const previousAutoLoot = await page.evaluate(() => window.game.uiManager.getAutoLootEnabled());
    await openIlyra(page); await acceptOfferedChapter(page, FIRST_CHAPTER);
    await setAutoLootThroughSettings(page, true);
    await earnObjective(page, FIRST_CHAPTER);
    await claimChapterAndContinue(page, FIRST_CHAPTER); await acceptOfferedChapter(page, SEED_CHAPTER);
    await earnObjective(page, SEED_CHAPTER);
    const seedsInBag = () => page.evaluate(() => window.game.player.inventory.reduce((sum, item) =>
        sum + (item?.name === 'Verdant Memory Seed' ? item.stack || 1 : 0), 0));
    // An area attack can roll several personal drops before pickups update the
    // objective. Verify the required consumption, not an artificial loot cap.
    await setAutoLootThroughSettings(page, false);
    const seedsBeforeTurnIn = await seedsInBag();
    expect(seedsBeforeTurnIn).toBeGreaterThanOrEqual(4);
    await claimChapterAndContinue(page, SEED_CHAPTER);
    expect(await seedsInBag()).toBe(seedsBeforeTurnIn - 4);
    await acceptOfferedChapter(page, EARTH_DUNGEON_CHAPTER);
    await setAutoLootThroughSettings(page, previousAutoLoot);
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]')).toHaveAttribute('data-access', 'sealed');
    await page.locator('#btn-close-dungeon-menu').click();
    console.log('[chronicle-earth] ordinary kills, naturally dropped relics, manual rewards and sealed pre-clear raid verified');
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
    await expect.poll(() => readChronicleChapter(page, 'chronicle_04_pearls_without_tides')).not.toBeNull();
    expect((await readChronicleChapter(page, 'chronicle_04_pearls_without_tides')).accepted).toBe(false);
    await page.locator('#btn-close-quest').click();
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]')).toHaveAttribute('data-access', 'open');
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]').getByRole('button', { name: 'Enter Rootheart Sanctum', exact: true })).toBeEnabled();
    await page.locator('#btn-close-dungeon-menu').click();
    const { loginAndEnterWorld } = await import('./helpers.js');
    await page.reload({ waitUntil: 'networkidle' }); await loginAndEnterWorld(page, credentials);
    expect((await readChronicleChapter(page, EARTH_DUNGEON_CHAPTER)).completed).toBe(true);
    await openDungeonGuide(page);
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    await expect(page.locator('[data-raid-type="earth_crystal_raid"]')).toHaveAttribute('data-access', 'open');
    await page.locator('#btn-close-dungeon-menu').click();
    console.log('[chronicle-earth] full dungeon kill credit, manual chapter reward, Rootheart access and reconnect persistence verified');
}
