import { expect } from '@playwright/test';
import { openIlyra, readChronicleChapter } from './chronicle-earth-route.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { loginAndEnterWorld, moveByGroundClick, projectEntity, readPlayerState,
    returnToTown, setAutoLootThroughSettings } from './helpers.js';

const collection = 'chronicle_02_seeds_first_grove';
const dungeonChapter = 'chronicle_03_roots_remember';
const seedsInBag = page => page.evaluate(() => window.game.player.inventory.reduce((sum, item) =>
    sum + (item?.name === 'Verdant Memory Seed' ? item.stack || 1 : 0), 0));

// Extends the genuinely earned opening. Callbacks use only ordinary canvas
// movement; no level, item, quest, protection or encounter-waypoint commands.
export async function earnFreshCollectionAndInspectHandoff(page, credentials, { findTarget, leaveTown }) {
    const started = Date.now();
    await openIlyra(page);
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, collection))?.accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    const previousAutoLoot = await page.evaluate(() => window.game.autoLootEnabled);
    await setAutoLootThroughSettings(page, true);
    await returnToTown(page);
    await leaveTown();
    let observedTargetDeaths = 0, deaths = 0;
    for (let encounter = 0; encounter < 40 && (await readChronicleChapter(page, collection)).count < 4; encounter++) {
        const target = await findTarget();
        const deadline = Date.now() + 120_000;
        let defeated = null, respawned = false;
        while (Date.now() < deadline) {
            const player = await readPlayerState(page);
            if (player.state === 'DEAD') {
                deaths++;
                expect(deaths, 'Fresh collection exceeded two ordinary respawns').toBeLessThanOrEqual(2);
                await returnToTown(page);
                await leaveTown();
                respawned = true;
                break;
            }
            const enemy = await page.evaluate(id => {
                const game = window.game;
                const enemy = game.remotePlayers.get(id);
                return enemy ? { hp: enemy.health ?? enemy.stats?.hp, state: enemy.state,
                    x: enemy.position.x, z: enemy.position.z } : null;
            }, target.id);
            expect(enemy, 'Collection target disappeared without an observed death').not.toBeNull();
            if (enemy.state === 'DEAD' || enemy.hp <= 0) { defeated = enemy; break; }
            const point = await projectEntity(page, target.id);
            if (point?.visible) {
                await page.mouse.click(point.x, point.y);
                if (await page.evaluate(() => window.game.player.abilityCooldown <= 0)) {
                    await page.mouse.click(point.x, point.y, { button: 'right' });
                }
            }
            await page.waitForTimeout(250);
        }
        if (respawned) continue;
        expect(defeated, 'Ordinary collection combat must finish within its bounded encounter').not.toBeNull();
        observedTargetDeaths++;
        // Walk to the actual drop location; ranged kills do not imply pickups.
        for (let step = 0; step < 10; step++) {
            const player = await readPlayerState(page);
            const dx = defeated.x - player.x, dz = defeated.z - player.z;
            const distance = Math.hypot(dx, dz);
            if (distance < 3) break;
            const scale = Math.min(1, 8 / distance);
            await moveByGroundClick(page, dx * scale, dz * scale);
        }
        await page.waitForTimeout(900);
        console.log(`[fresh-collection] ${JSON.stringify({ observedTargetDeaths, deaths,
            seeds: (await readChronicleChapter(page, collection)).count,
            level: (await readPlayerState(page)).level })}`);
    }
    expect((await readChronicleChapter(page, collection)).count).toBe(4);
    expect((await readChronicleChapter(page, collection)).completed).toBe(false);
    await setAutoLootThroughSettings(page, false);
    await expect.poll(() => page.evaluate(() => window.game.pendingLootPickups.size)).toBe(0);
    const seedsBefore = await seedsInBag(page);
    expect(seedsBefore).toBeGreaterThanOrEqual(4);
    await openIlyra(page);
    await page.getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, collection)).completed).toBe(true);
    await expect.poll(() => seedsInBag(page)).toBe(seedsBefore - 4);
    const reward = await readChronicleChapter(page, collection);
    expect(reward.grantedGold).toBeGreaterThan(0);
    expect(reward.grantedXP).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Continue conversation', exact: true }).click();
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, dungeonChapter)).accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    await setAutoLootThroughSettings(page, previousAutoLoot);
    const earnedLevel = (await readPlayerState(page)).level;
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect((await readPlayerState(page)).level).toBe(earnedLevel);
    expect((await readChronicleChapter(page, collection)).completed).toBe(true);
    expect((await readChronicleChapter(page, dungeonChapter)).accepted).toBe(true);
    expect(await seedsInBag(page)).toBe(seedsBefore - 4);
    await openDungeonGuide(page);
    await page.locator('#dungeon-type-select').selectOption('verdant_bastion_catacombs');
    const enabled = await page.locator('#btn-enter-dungeon').isEnabled();
    console.log(`[fresh-handoff] ${JSON.stringify({ level: earnedLevel, observedTargetDeaths, deaths,
        grantedGold: reward.grantedGold, grantedXP: reward.grantedXP, entryEnabled: enabled,
        entryNote: await page.locator('#dungeon-unlock-note').textContent({ timeout: 5_000 }),
        collectionSeconds: Math.round((Date.now() - started) / 1000) })}`);
    if (earnedLevel < 30) {
        await expect(page.locator('#btn-enter-dungeon'), 'The first dungeon must explain its unmet level gate instead of offering an unusable Start action').toBeDisabled();
        await expect(page.locator('#dungeon-unlock-note')).toContainText('unlocks at level 30');
    }
    await page.getByRole('tab', { name: 'Raids', exact: true }).click();
    const earthRaid = page.locator('[data-raid-type="earth_crystal_raid"]');
    // Below the raid's minimum level the existing menu does not show its card.
    if (earnedLevel < 30) await expect(earthRaid).toHaveCount(0);
    else await expect(earthRaid).toHaveAttribute('data-access', 'sealed');
}
