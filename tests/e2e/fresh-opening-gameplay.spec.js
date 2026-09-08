import { expect, test } from '@playwright/test';
import { openIlyra, readChronicleChapter } from './chronicle-earth-route.js';
import { earnFreshCollectionAndInspectHandoff } from './fresh-collection-route.js';
import { createFreshCollectionCombat, observeCollectionCombatReceipts,
    readFreshCollectionCombat, selectCollectionTargetThroughInput,
    reacquireDisengagedCollectionTarget } from './fresh-collection-combat.js';
import { earnFreshHunt, earnFreshSkeletonHunt } from './fresh-hunt-route.js';
import { earnFreshDungeonReadiness, prepareEarnedClass } from './fresh-ready-route.js';
import { createEarnedClassCombat } from './earned-class-combat.js';
import { prepareEarlyEarnedCharacter } from './early-earned-preparation.js';
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
    const prepareCollection = process.env.EIDOLON_E2E_PREPARED_COLLECTION === '1';
    if (prepareCollection) expect(process.env.EIDOLON_E2E_FRESH_COLLECTION).toBe('1');
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
    await expect.poll(() => page.evaluate(() => {
        const player = window.game.player;
        return [player.stats.hpRegen, player.stats.manaRegen]
            .every(rate => Math.abs(rate - 0.1) < 1e-6); // protobuf float precision
    }), { message: 'Fresh authoritative character must use the new 0.01 per-stat regeneration' })
        .toBe(true);
    console.log(`[fresh-opening] baseline ${JSON.stringify(await page.evaluate(() => {
        const player = window.game.player;
        return { class: player.constructor.name, level: player.level,
            hp: player.health ?? player.stats?.hp, maxHP: player.maxHealth ?? player.stats?.maxHp,
            basicDamage: player.stats?.damage ?? player.damage,
            hpRegen: player.stats.hpRegen, manaRegen: player.stats.manaRegen,
            primaryAbility: player.abilityName };
    }))}`);
    await openIlyra(page);
    await page.locator('#quest-window').getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, chapter))?.accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    await returnToTown(page);
    await leaveTown(page);
    const beforeOpeningCombat = await createFreshCollectionCombat(page);
    await observeCollectionCombatReceipts(page);
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
            // Share the collection route's ordinary defensive inputs instead
            // of interrupting every healthy attack with another retreat.
            if (await beforeOpeningCombat()) continue;
            retreats = await page.evaluate(() => window.__freshWizardDefense?.counts.retreats || 0);
            if ((await readPlayerState(page)).state === 'DEAD') continue;
            if ((await readChronicleChapter(page, chapter)).count > before) break;
            target = await reacquireDisengagedCollectionTarget(page, target,
                () => projectNearestHostile(page, 'Skeleton'));
            const point = await projectEntity(page, target.id);
            if (point?.visible) {
                target = await selectCollectionTargetThroughInput(page, target, point);
                if (await page.evaluate(() => window.game.player.abilityCooldown <= 0)) {
                    await page.mouse.click(point.x, point.y, { button: 'right' });
                }
            }
            await page.waitForTimeout(250);
        }
        const diagnostic = await readFreshCollectionCombat(page, target.id);
        expect((await readChronicleChapter(page, chapter)).count,
            `Opening combat deadline: ${JSON.stringify(diagnostic)}`).toBeGreaterThan(before);
        const player = await readPlayerState(page);
        console.log(`[fresh-opening] ${JSON.stringify({ kills: (await readChronicleChapter(page, chapter)).count, deaths, level: player.level, hp: player.health, elapsedSeconds: Math.round((Date.now() - started) / 1000) })}`);
    }
    expect((await readChronicleChapter(page, chapter)).completed).toBe(false);
    await openIlyra(page);
    await page.locator('#quest-window').getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, chapter)).completed).toBe(true);
    const rewarded = await readChronicleChapter(page, chapter);
    expect(rewarded.grantedGold).toBeGreaterThan(0);
    expect(rewarded.grantedXP).toBeGreaterThan(0);
    await page.locator('#quest-window').getByRole('button', { name: 'Continue conversation', exact: true }).click();
    expect((await readChronicleChapter(page, 'chronicle_02_seeds_first_grove')).accepted).toBe(false);
    const earnedLevel = (await readPlayerState(page)).level;
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect((await readPlayerState(page)).level).toBe(earnedLevel);
    expect((await readChronicleChapter(page, chapter)).completed).toBe(true);
    console.log(`[fresh-opening] completed ${JSON.stringify({ level: earnedLevel, deaths, retreats, grantedGold: rewarded.grantedGold, grantedXP: rewarded.grantedXP, elapsedSeconds: Math.round((Date.now() - started) / 1000) })}`);
    if (process.env.EIDOLON_E2E_FRESH_COLLECTION === '1') {
        try {
            await earnFreshCollectionAndInspectHandoff(page, credentials, {
                findTarget: () => findSkeletonThroughTravel(page), leaveTown: () => leaveTown(page),
                prepare: prepareCollection ? () => prepareEarlyEarnedCharacter(page) : undefined,
                captureReady: () => page.screenshot({ path: testInfo.outputPath('earned-collection-ready.png') })
            });
        } catch (error) {
            await page.screenshot({ path: testInfo.outputPath('failed-collection.png') });
            throw error;
        }
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
