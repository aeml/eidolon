import { expect, test } from '@playwright/test';
import { selectUnfinishedObjectiveTarget } from '../earnedObjectiveEncounter.js';
import { leaveEarnedCombatSafety } from './earned-safe-zone-combat.js';
import { openIlyra, readChronicleChapter } from './chronicle-earth-route.js';
import { earnEarthInvestigation } from './chronicle-investigation-route.js';
import { clearFreshInvestigationApproach } from './fresh-investigation-combat.js';
import { earnFreshCollectionAndInspectHandoff } from './fresh-collection-route.js';
import { createFreshCollectionCombat, observeCollectionCombatReceipts,
    readFreshCollectionCombat, selectCollectionTargetThroughInput,
    reacquireDisengagedCollectionTarget } from './fresh-collection-combat.js';
import { earnFreshHunt, earnFreshSkeletonHunt } from './fresh-hunt-route.js';
import { earnFreshDungeonReadiness, prepareEarnedClass } from './fresh-ready-route.js';
import { createEarnedClassCombat } from './earned-class-combat.js';
import { prepareEarlyEarnedCharacter } from './early-earned-preparation.js';
import { clearEarnedVerdant } from './fresh-dungeon-route.js';
import { earnFreshStoryHunt } from './fresh-story-hunt-route.js';
import { readStoryHuntFailureEvidence } from './story-hunt-combat-observer.js';
import { earnedTownRecoveryEnabled } from '../earnedRecoveryPolicy.js';
import { storyOnlyReadinessEnabled, storyOnlyDungeonEnabled } from '../storyReadinessPolicy.js';
import { createFreshStoryPhaseRunner, freshStoryTimeout, freshStoryDungeonTimeout } from '../freshCampaignPhases.js';
import { verifyStoryOnlyEarthReadiness } from './story-readiness.js';
import { recoverEarnedDeath } from './earned-death-recovery.js';
import { earnedCheckpoint, uninterruptedEarnedMode } from './earned-checkpoint.js';
import { collectBrowserFailures, credentialsFromEnvironment, jumpByGroundClick,
    loginAndEnterWorld, moveByGroundClick, projectEntity, projectNearestHostile,
    readPlayerState, returnToTown } from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 20_000 });
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;
    const evidence = await readStoryHuntFailureEvidence(page);
    if (!evidence) return;
    await testInfo.attach('story-combat-failure', { body: JSON.stringify(evidence), contentType: 'application/json' });
    console.log('[story-hunt] failure receipt', JSON.stringify({ player: evidence.player,
        outgoing: evidence.combat?.outgoing, incoming: evidence.combat?.incoming,
        requestedId: evidence.combat?.requestedId, selected: evidence.selected, nearby: evidence.nearby }));
});
const chapter = 'chronicle_01_bell_below';

// Deliberately does not use findOverworldTarget: that functional QA helper may
// teleport to an encounter. Every movement here is an ordinary player input.
async function findHostileThroughTravel(page, subtype = 'Skeleton', deadline = Infinity) {
    for (let step = 0; step < 24 && Date.now() < deadline; step++) {
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
    const diagnostic = await page.evaluate(subtype => {
        const game = window.game, p = game.player;
        const enemies = [...game.remotePlayers.values()].filter(entity =>
            (entity.subType || entity.constructor?.name) === subtype)
            .sort((a, b) => p.position.distanceTo(a.position) - p.position.distanceTo(b.position));
        return { player: { x: p.position.x, y: p.position.y, z: p.position.z, state: p.state },
            nearest: enemies.slice(0, 8).map(entity => ({
                id: entity.id, x: entity.position.x, z: entity.position.z,
                hp: entity.health ?? entity.stats?.hp, state: entity.state,
                active: entity.isActive, hostile: game.isHostileActorTarget(entity),
                cached: (game.activeEntitiesCache || []).includes(entity),
                mesh: Boolean(entity.mesh), attached: Boolean(entity.mesh?.parent)
            })) };
    }, subtype);
    throw new Error(`No visible ${subtype} after bounded ordinary travel: ${JSON.stringify(diagnostic)}`);
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
    earnedTownRecoveryEnabled(); // Reject malformed diagnostics before creating a character.
    const credentials = credentialsFromEnvironment();
    expect(testInfo.retry).toBeLessThanOrEqual(1);
    if (testInfo.retry) credentials.username += `-retry${testInfo.retry}`;
    test.skip(!credentials.username || !credentials.password, 'Requires a disposable QA character');
    expect(process.env.EIDOLON_E2E_REGISTER).toBe('1');
    uninterruptedEarnedMode(); // Fail unsupported combinations before creating a character.
    earnedTownRecoveryEnabled();
    const storyOnlyReadiness = storyOnlyReadinessEnabled();
    const storyOnlyDungeon = storyOnlyDungeonEnabled();
    const storyTimeout = storyOnlyDungeon ? freshStoryDungeonTimeout : freshStoryTimeout;
    const runPhase = storyOnlyReadiness ? createFreshStoryPhaseRunner({
        includeDungeon: storyOnlyDungeon,
        step: (name, body, options) => test.step(name, body, options),
        record: receipt => console.log('[fresh-story-phase]', JSON.stringify(receipt))
    }) : (_id, body) => body();
    test.setTimeout(storyOnlyReadiness ? storyTimeout :
        process.env.EIDOLON_E2E_FRESH_STORY_HUNT === '1' ? 1_800_000 :
        process.env.EIDOLON_E2E_FRESH_HUNT === '1' ? 3_600_000 :
        // The expanded Earth route now includes150 required expedition kills,
        // not just the former diary/collection/scar sequence.
        process.env.EIDOLON_E2E_FRESH_COLLECTION === '1' ? 3_600_000 : 600_000);
    const started = Date.now();
    const prepareCollection = process.env.EIDOLON_E2E_PREPARED_COLLECTION === '1';
    if (prepareCollection) expect(process.env.EIDOLON_E2E_FRESH_COLLECTION).toBe('1');
    const failures = collectBrowserFailures(page, baseURL);
    const preparedEarlier = process.env.EIDOLON_E2E_FRESH_EARLY_PREPARATION === '1';
    if (preparedEarlier) {
        expect(process.env.EIDOLON_E2E_FRESH_HUNT).toBe('1');
        expect(process.env.EIDOLON_E2E_FRESH_COLLECTION).toBe('1');
    }
    await runPhase('opening', async () => {
        await loginAndEnterWorld(page, credentials);
        if (process.env.EIDOLON_E2E_FRESH_READY === '1') {
            expect(['Wizard', 'Fighter'], 'fresh-ready supports explicit earned Wizard and Fighter builds')
                .toContain(await page.evaluate(() => window.game.player.constructor.name));
        }
        expect((await readPlayerState(page)).level).toBe(1);
        await expect.poll(() => page.evaluate(() => {
            const player = window.game.player;
            const expected = player.wellRestedSeconds > 0 ? .11 : .1;
            return [player.stats.hpRegen, player.stats.manaRegen]
                .every(rate => Math.abs(rate - expected) < 1e-6); // protobuf float precision
        }), { message: 'Fresh character retains .01 per-stat regeneration, with exactly10% while rested' })
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
        await expect(page.locator('.quest-dialogue__reward')).toContainText('Reward: 100 gold · 100 XP');
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
            const encounter = await selectUnfinishedObjectiveTarget(
                async () => (await readChronicleChapter(page, chapter)).count,
                () => findSkeletonThroughTravel(page), 3);
            if (!encounter) break;
            let { target } = encounter;
            let targetStartHP = target.health;
            let targetLowestHP = target.health;
            const before = encounter.before;
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
                        targetStartHP, targetLowestHP, target: targetState,
                        resources: await page.evaluate(() => ({ hp: window.game.player.stats.hp,
                            mana: window.game.player.stats.mana, maxMana: window.game.player.stats.maxMana })) })}`);
                    expect(deaths, 'Bounded opening route exceeded two normal respawns').toBeLessThanOrEqual(2);
                    await recoverEarnedDeath(page);
                    expect((await readChronicleChapter(page, chapter)).count, 'Death must not erase earned quest credit').toBe(before);
                    await leaveTown(page);
                    target = await findSkeletonThroughTravel(page);
                    targetStartHP = target.health;
                    targetLowestHP = target.health;
                    continue;
                }
                // Share the collection route's ordinary defensive inputs instead
                // of interrupting every healthy attack with another retreat.
                if (await leaveEarnedCombatSafety(page, () => leaveTown(page))) continue;
                if (await beforeOpeningCombat(page, target)) continue;
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
        await page.locator('#btn-close-quest').click();
        await expect(page.locator('#quest-window')).toBeHidden();
        const earnedLevel = (await readPlayerState(page)).level;
        await earnedCheckpoint(page, credentials, { label: 'opening' });
        expect((await readPlayerState(page)).level).toBe(earnedLevel);
        expect((await readChronicleChapter(page, chapter)).completed).toBe(true);
        expect((await readChronicleChapter(page, chapter)).grantedXP).toBe(100);
        expect((await readChronicleChapter(page, chapter)).grantedGold).toBe(100);
        console.log(`[fresh-opening] completed ${JSON.stringify({ level: earnedLevel, deaths, retreats, grantedGold: rewarded.grantedGold, grantedXP: rewarded.grantedXP, elapsedSeconds: Math.round((Date.now() - started) / 1000) })}`);
        await earnEarthInvestigation(page, 'chronicle_earth_keepers_house', openIlyra,
            (site, phase) => page.screenshot({ path: testInfo.outputPath(`${phase}-${site.id}.png`) }),
            { beforeInspect: site => clearFreshInvestigationApproach(page, site) });
        const afterDiary = await readChronicleChapter(page, 'chronicle_earth_keepers_house');
        const diaryLevel = (await readPlayerState(page)).level;
        await earnedCheckpoint(page, credentials, { label: 'diary' });
        expect((await readPlayerState(page)).level).toBe(diaryLevel);
        expect((await readChronicleChapter(page, 'chronicle_earth_keepers_house')).completed).toBe(true);
        console.log(`[fresh-diary] ${JSON.stringify({ level: diaryLevel, reward: afterDiary, elapsedSeconds: Math.round((Date.now() - started) / 1000) })}`);
    });
    if (process.env.EIDOLON_E2E_FRESH_STORY_HUNT === '1' || process.env.EIDOLON_E2E_FRESH_COLLECTION === '1') {
        try {
            await runPhase('watch', () => earnFreshStoryHunt(page, credentials, 'chronicle_earth_kept_watch', {
                leaveTown: () => leaveTown(page),
                captureReady: () => page.screenshot({ path: testInfo.outputPath('earned-watch-ready.png') })
            }));
        } catch (error) {
            await page.screenshot({ path: testInfo.outputPath('failed-watch.png') });
            throw error;
        }
    }
    if (process.env.EIDOLON_E2E_FRESH_COLLECTION === '1') {
        try {
            await earnFreshCollectionAndInspectHandoff(page, credentials, {
                runPhase,
                findTarget: () => findSkeletonThroughTravel(page), leaveTown: () => leaveTown(page),
                prepare: prepareCollection ? () => prepareEarlyEarnedCharacter(page) : undefined,
                captureReady: () => page.screenshot({ path: testInfo.outputPath('earned-collection-ready.png') })
            });
        } catch (error) {
            await page.screenshot({ path: testInfo.outputPath('failed-collection.png') });
            throw error;
        }
    }
    if (storyOnlyReadiness) {
        await runPhase('readiness', () => verifyStoryOnlyEarthReadiness(page));
        if (storyOnlyDungeon) {
            await clearEarnedVerdant(page, credentials, { runPhase,
                captureEntry: receipt => testInfo.attach('earned-dungeon-entry', {
                    body: JSON.stringify(receipt), contentType: 'application/json'
                }) });
            const usedDailies = await page.evaluate(() => window.game.player.quests.filter(quest =>
                quest.id?.startsWith('daily_') && (quest.accepted || quest.completed)).map(quest => quest.id));
            expect(usedDailies, 'Dungeon completion must not introduce daily-quest leveling').toEqual([]);
            await page.screenshot({ path: testInfo.outputPath('earned-earth-dungeon-complete.png') });
        }
        runPhase.assertComplete();
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
