import { expect, test } from '@playwright/test';
import { openIlyra, readChronicleChapter } from './chronicle-earth-route.js';
import { earnEarthInvestigation } from './chronicle-investigation-route.js';
import { earnFreshCollectionAndInspectHandoff } from './fresh-collection-route.js';
import { earnFreshHunt, earnFreshSkeletonHunt } from './fresh-hunt-route.js';
import { earnFreshDungeonReadiness, prepareEarnedClass } from './fresh-ready-route.js';
import { createEarnedClassCombat } from './earned-class-combat.js';
import { clearEarnedVerdant } from './fresh-dungeon-route.js';
import { collectBrowserFailures, credentialsFromEnvironment, jumpByGroundClick,
    loginAndEnterWorld, moveByGroundClick, projectEntity, projectNearestHostile,
    readPlayerState, returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 20_000 });
const chapter = 'chronicle_01_bell_below';

// Deliberately does not use findOverworldTarget: that functional QA helper may
// teleport to an encounter. Every movement here is an ordinary player input.
async function findHostileThroughTravel(page, subtype = 'Skeleton') {
    for (let step = 0; step < 24; step++) {
        const target = await projectNearestHostile(page, subtype);
        if (target) return target;
        const offset = await page.evaluate(subtype => {
            const game = window.game;
            const enemies = [...game.remotePlayers.values()].filter(entity =>
                entity.isActive && entity.state !== 'DEAD' &&
                (entity.subType || entity.constructor?.name) === subtype);
            enemies.sort((a, b) => game.player.position.distanceTo(a.position) -
                game.player.position.distanceTo(b.position));
            const nearest = enemies[0];
            if (!nearest) return { x: 0, z: -15 };
            const dx = nearest.position.x - game.player.position.x;
            const dz = nearest.position.z - game.player.position.z;
            const scale = Math.min(1, 15 / Math.max(1, Math.hypot(dx, dz)));
            return { x: dx * scale, z: dz * scale };
        }, subtype);
        await moveByGroundClick(page, offset.x, offset.z);
    }
    throw new Error(`No visible ${subtype} after bounded ordinary travel`);
}

const findSkeletonThroughTravel = page => findHostileThroughTravel(page);

async function leaveTown(page) {
    for (let step = 0; (await readPlayerState(page)).x < 115 && step < 20; step++) {
        const position = await readPlayerState(page);
        await jumpByGroundClick(page, 25, Math.max(-8, Math.min(8, 200 - position.z)));
    }
    expect((await readPlayerState(page)).x).toBeGreaterThanOrEqual(115);
}

test('fresh level-one character earns and manually turns in the opening Chronicle without grants', async ({ page, baseURL }, testInfo) => {
    const credentials = credentialsFromEnvironment();
    expect(testInfo.retry).toBeLessThanOrEqual(1);
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    test.skip(!credentials.username || !credentials.password, 'Requires a disposable QA character');
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    test.setTimeout(process.env.EIDOLON_E2E_FRESH_HUNT === '1' ? 3_600_000 :
        process.env.EIDOLON_E2E_FRESH_COLLECTION === '1' ? 1_200_000 : 600_000);
    const started = Date.now();
    const failures = collectBrowserFailures(page, baseURL);
    const preparedEarlier = process.env.EIDOLON_E2E_FRESH_EARLY_PREPARATION === '1';
    if (preparedEarlier) {
        expect(process.env.EIDOLON_E2E_FRESH_HUNT).toBe('1');
        expect(process.env.EIDOLON_E2E_FRESH_COLLECTION).toBe('1');
    }
    await loginAndEnterWorld(page, credentials);
    if (process.env.EIDOLON_E2E_FRESH_READY === '1') {
        expect(['Wizard', 'Fighter'], 'fresh-ready supports explicit earned Wizard and Fighter builds')
            .toContain(await page.evaluate(() => window.game.player.constructor.name));
    }
    expect((await readPlayerState(page)).level).toBe(1);
    console.log(`[fresh-opening] baseline ${JSON.stringify(await page.evaluate(() => {
        const player = window.game.player;
        return { class: player.constructor.name, level: player.level,
            hp: player.health ?? player.stats?.hp, maxHP: player.maxHealth ?? player.stats?.maxHp,
            basicDamage: player.stats?.damage ?? player.damage,
            primaryAbility: player.abilityName };
    }))}`);
    await openIlyra(page);
    await expect(page.locator('.quest-dialogue__reward')).toContainText('Reward: 100 gold · 100 XP');
    await page.locator('#quest-window').getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, chapter))?.accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    await returnToTown(page);
    await leaveTown(page);
    let deaths = 0;
    let retreats = 0;
    while ((await readChronicleChapter(page, chapter)).count < 3) {
        let target = await findSkeletonThroughTravel(page);
        let targetStartHP = target.health;
        let targetLowestHP = target.health;
        const before = (await readChronicleChapter(page, chapter)).count;
        const deadline = Date.now() + 120_000;
        while (Date.now() < deadline && (await readChronicleChapter(page, chapter)).count === before) {
            const player = await readPlayerState(page);
            const targetState = await page.evaluate(id => {
                const game = window.game;
                const enemy = game.remotePlayers.get(id);
                return enemy ? { level: enemy.level, hp: enemy.health ?? enemy.stats?.hp,
                    distance: game.player.position.distanceTo(enemy.position),
                    hovered: game.hoveredEntity?.id === id } : null;
            }, target.id);
            if (Number.isFinite(targetState?.hp)) targetLowestHP = Math.min(targetLowestHP, targetState.hp);
            if (player.state === 'DEAD') {
                deaths++;
                console.log(`[fresh-opening] death ${JSON.stringify({ deaths, count: before, level: player.level,
                    targetStartHP, targetLowestHP, target: targetState })}`);
                expect(deaths, 'Bounded opening route exceeded two normal respawns').toBeLessThanOrEqual(2);
                await returnToTown(page);
                expect((await readChronicleChapter(page, chapter)).count, 'Death must not erase earned quest credit').toBe(before);
                await leaveTown(page);
                target = await findSkeletonThroughTravel(page);
                targetStartHP = target.health;
                targetLowestHP = target.health;
                continue;
            }
            // Use the ranged class as a ranged player: retreat through ordinary
            // movement when approached. No state writes, healing or protection.
            const retreat = await page.evaluate(id => {
                const game = window.game;
                const enemy = game.remotePlayers.get(id);
                if (!enemy || game.player.constructor?.name !== 'Wizard') return null;
                const dx = game.player.position.x - enemy.position.x;
                const dz = game.player.position.z - enemy.position.z;
                const distance = Math.hypot(dx, dz);
                return distance < 5 ? { x: dx / Math.max(0.1, distance) * 8,
                    z: dz / Math.max(0.1, distance) * 8 } : null;
            }, target.id);
            if (retreat) {
                try {
                    await moveByGroundClick(page, retreat.x, retreat.z);
                } catch (error) {
                    // Combat continues during movement. A normal death belongs
                    // to the bounded respawn path above; retain other movement
                    // failures instead of hiding collision/input defects.
                    if ((await readPlayerState(page)).state === 'DEAD') continue;
                    throw error;
                }
                retreats++;
            }
            const point = await projectEntity(page, target.id);
            if (point?.visible) {
                await page.mouse.click(point.x, point.y);
                if (await page.evaluate(() => window.game.player.abilityCooldown <= 0)) {
                    await page.mouse.click(point.x, point.y, { button: 'right' });
                }
            }
            await page.waitForTimeout(250);
        }
        const diagnostic = await page.evaluate(id => {
            const game = window.game, enemy = game.remotePlayers.get(id);
            return { playerHP: game.player.health, enemyHP: enemy?.health,
                enemyState: enemy?.state, hoveredType: game.hoveredEntity?.constructor?.name,
                distance: enemy ? game.player.position.distanceTo(enemy.position) : null };
        }, target.id);
        expect((await readChronicleChapter(page, chapter)).count,
            `Opening combat deadline: ${JSON.stringify(diagnostic)}`).toBeGreaterThan(before);
        const player = await readPlayerState(page);
        console.log(`[fresh-opening] ${JSON.stringify({ kills: (await readChronicleChapter(page, chapter)).count, deaths, level: player.level, hp: player.health, elapsedSeconds: Math.round((Date.now() - started) / 1000) })}`);
    }
    expect((await readChronicleChapter(page, chapter)).completed).toBe(false);
    await openIlyra(page);
    const readRewardState = () => page.evaluate(() => {
        const p = window.game.player;
        return { level: p.level, xp: p.xp, next: p.xpToNextLevel, gold: p.gold };
    });
    const beforeReward = await readRewardState();
    await expect(page.locator('.quest-dialogue__reward')).toContainText('Reward: 100 gold · 100 XP');
    await page.locator('#quest-window').getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, chapter)).completed).toBe(true);
    const rewarded = await readChronicleChapter(page, chapter);
    expect(rewarded.grantedGold).toBe(100);
    expect(rewarded.grantedXP).toBe(100);
    expect(rewarded.grantedResonanceXP || 0).toBe(0);
    await expect(page.locator('.quest-dialogue__reward')).toContainText('Reward received · 100 gold · 100 XP');
    await expect.poll(async () => (await readRewardState()).gold).toBe(beforeReward.gold + 100);
    const afterReward = await readRewardState();
    expect([beforeReward.level, beforeReward.level + 1]).toContain(afterReward.level);
    expect(afterReward.xp - beforeReward.xp + (afterReward.level > beforeReward.level ? beforeReward.next : 0)).toBe(100);
    await page.locator('#quest-window').getByRole('button', { name: 'Continue conversation', exact: true }).click();
    expect((await readChronicleChapter(page, 'chronicle_earth_keepers_house')).accepted).toBe(false);
    const earnedLevel = (await readPlayerState(page)).level;
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect((await readPlayerState(page)).level).toBe(earnedLevel);
    expect((await readChronicleChapter(page, chapter)).completed).toBe(true);
    expect((await readChronicleChapter(page, chapter)).grantedXP).toBe(100);
    expect((await readChronicleChapter(page, chapter)).grantedGold).toBe(100);
    console.log(`[fresh-opening] completed ${JSON.stringify({ level: earnedLevel, deaths, retreats, grantedGold: rewarded.grantedGold, grantedXP: rewarded.grantedXP, elapsedSeconds: Math.round((Date.now() - started) / 1000) })}`);
    await earnEarthInvestigation(page, 'chronicle_earth_keepers_house', openIlyra,
        (site, phase) => page.screenshot({ path: testInfo.outputPath(`${phase}-${site.id}.png`) }));
    const afterDiary = await readChronicleChapter(page, 'chronicle_earth_keepers_house');
    const diaryLevel = (await readPlayerState(page)).level;
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect((await readPlayerState(page)).level).toBe(diaryLevel);
    expect((await readChronicleChapter(page, 'chronicle_earth_keepers_house')).completed).toBe(true);
    console.log(`[fresh-diary] ${JSON.stringify({ level: diaryLevel, reward: afterDiary, elapsedSeconds: Math.round((Date.now() - started) / 1000) })}`);
    if (process.env.EIDOLON_E2E_FRESH_COLLECTION === '1') {
        await earnFreshCollectionAndInspectHandoff(page, credentials, {
            findTarget: () => findSkeletonThroughTravel(page), leaveTown: () => leaveTown(page),
            captureReady: () => page.screenshot({ path: testInfo.outputPath('earned-collection-ready.png') })
        });
    }
    if (process.env.EIDOLON_E2E_FRESH_HUNT === '1') {
        const hunt = {
            findTarget: () => findSkeletonThroughTravel(page), leaveTown: () => leaveTown(page)
        };
        if (preparedEarlier) {
            await prepareEarnedClass(page, credentials, { label: 'before-Skeleton-comparison' });
            const beforeCombat = await createEarnedClassCombat(page);
            await earnFreshHunt(page, credentials, { ...hunt, beforeCombat });
        } else await earnFreshSkeletonHunt(page, credentials, hunt);
    }
    if (process.env.EIDOLON_E2E_FRESH_READY === '1') {
        await earnFreshDungeonReadiness(page, credentials, {
            findTarget: () => findHostileThroughTravel(page, 'Imp'), preparedEarlier
        });
        expect(failures, failures.join('\n')).toEqual([]);
        console.log('[fresh-ready] earned readiness and clean browser-error checkpoint passed');
    }
    if (process.env.EIDOLON_E2E_FRESH_DUNGEON === '1') {
        expect(process.env.EIDOLON_E2E_FRESH_READY).toBe('1');
        await clearEarnedVerdant(page, credentials);
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
