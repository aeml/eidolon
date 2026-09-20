import { expect } from '@playwright/test';
import { installDungeonObservationInPage, readDungeonTargetStateInPage } from '../dungeonDeathObservation.js';
import { buildDungeonTraversalRoutes } from '../dungeonTraversalRoutes.js';
import { selectFighterDungeonSkill, shouldUseHuntPrimary } from '../dungeonCombatControls.js';
import { aimDungeonCombatTarget, readDungeonTargetPointerInPage, selectDungeonForegroundTarget } from '../dungeonTargetInput.js';
import { dungeonTargetApproach } from '../dungeonTargetApproach.js';
import { tryDungeonGroundStep } from '../dungeonNavigationInput.js';
import { enterAndExitDungeon, moveByGroundClick, projectEntity, readPlayerState, settlePointerRaycast } from './helpers.js';
import { dungeonSpatialSnapshot } from './dungeon-spatial-snapshot.js';
import { dungeonBossEncounter, dungeonCombatTargetType } from '../dungeonCombatEncounter.js';
import { recoverBetweenDungeonRooms } from './dungeon-town-rest.js';
import { createDungeonExpeditionTiming, dungeonCombatBudget } from '../dungeonExpeditionTiming.js';

// Callers own login, earned or fixture preparation, and story turn-in. The safe
// default enters through the town guide, without grants. Only the legacy prepared
// caller explicitly opts into the QA entrance waypoint (which grants protection).
export async function playDungeonThroughInputs(page, {
    playthrough, fullRun = true, fallbackRun = false, beforeCombat, useTownGuide = true, resetRun = true, afterClearedRoute,
    recoverBetweenRooms = false, afterTownRecovery, recoverAfterRoom, finishAtFinalBoss = false,
    afterEncounter, afterEntry, afterGroundStep, minimumChargeDistance = 0, expeditionProfile = 'solo',
    runInstance = enterAndExitDungeon, diagnosticBoss = null,
    requiredFighterSkills = ['Iron Fortress', 'Guardian Roar', 'Whirlwind', 'Shield Slam']
}) {
    const logPrefix = `[dungeon:${playthrough.dungeonType}]`;
    const timing = createDungeonExpeditionTiming({ profile: expeditionProfile,
        onReport: report => console.log(`${logPrefix} timing ${JSON.stringify(report)}`) });
    async function hostiles(page) {
        const targets = await page.evaluate(() => {
            const game = window.game;
            return [...game.remotePlayers.values()]
                .filter(entity => game.isHostileActorTarget(entity) && entity.isActive &&
                    entity.state !== 'DEAD' && (entity.health ?? entity.stats?.hp) > 0)
                .map(entity => ({ id: entity.id, type: entity.subType || entity.constructor.name, x: entity.position.x,
                    z: entity.position.z, health: entity.health ?? entity.stats?.hp,
                    distance: entity.position.distanceTo(game.player.position) }))
                .sort((a, b) => a.distance - b.distance);
        });
        // The public site intentionally does not serve test modules. Resolve
        // server boss IDs in the runner, using only the observed actor fields.
        return targets.map(target => ({ ...target,
            type: dungeonCombatTargetType({ id: target.id, subType: target.type }, playthrough.bosses) }));
    }

    async function defeatByMouse(page, target) {
        timing.enter('combat');
        console.log(`${logPrefix} fighting ${target.type}`);
        if (target.encounter) console.log(`${logPrefix} boss encounter ${JSON.stringify({ type: target.type, ...target.encounter })}`);
        // Tempest seed -1329185764639002788 reached Zephyrion alive with
        // continuous damage but outlasted six minutes (93,600 starting HP).
        // Ordinary combat retains eight minutes. The Dark King's complete
        // four-phase fight gets the approved ten-minute upper target; phases
        // never reset it. Retain the 60s stall and whole-run watchdogs.
        const deadline = Date.now() + dungeonCombatBudget(fullRun, playthrough.dungeonType, target.type);
        let sawDamage = false;
        let lowestHealth = target.health;
        let lastDamageAt = Date.now();
        let nextReport = 0;
        let nextSkillAttemptAt = 0;
        const attempted = new Set([target.id]);
        while (Date.now() < deadline) {
            await assertWorldUpdatesContinue(page);
            if (beforeCombat && await beforeCombat(page, target)) continue;
            const state = await page.evaluate(readDungeonTargetStateInPage, target.id);
            if (state?.state === 'DEAD' || state?.health <= 0) {
                if (playthrough.dungeonType === 'weekly_raid' && target.type === 'UmbraPrime') {
                    // Same browser monotonic clock as the actual phase events.
                    // Record only after confirmed death, never on timeout/exit.
                    await page.evaluate(() => {
                        const evidence = window.__partyClearEvidence;
                        if (evidence) evidence.darkKingDefeatedAtMs = performance.now();
                    });
                }
                console.log(`${logPrefix} defeated ${target.type}`);
                if (fullRun && target.type === playthrough.bosses[0] && process.env.EIDOLON_E2E_CLASS === 'Fighter') {
                    const observedSkills = await page.evaluate(() => window.__dungeonObservedSkills);
                    expect(observedSkills).toEqual(expect.arrayContaining(requiredFighterSkills));
                    console.log(`${logPrefix} accepted hotbar skills ${JSON.stringify(observedSkills)}`);
                }
                return target;
            }
            if (!state) throw new Error(`Combat target disappeared without a confirmed death: ${target.type}`);
            sawDamage ||= state.health < target.health;
            if (state.health < lowestHealth) {
                lowestHealth = state.health;
                lastDamageAt = Date.now();
            }
            if (Date.now() - lastDamageAt > 60_000) {
                // Preserve the real hit stack/cache/mesh state only on failure.
                // Position-only traces cannot distinguish crowd occlusion from
                // an actor missing its interaction proxy or active-cache entry.
                const spatial = await page.evaluate(dungeonSpatialSnapshot, { targetId: target.id });
                await page.evaluate(spatial => {
                    if (window.__partyClearEvidence) window.__partyClearEvidence.stalledSpatial = spatial;
                }, spatial);
                console.log(`${logPrefix} stalled approach ${JSON.stringify(await page.evaluate(id => {
                    const g = window.game, p = g.player, e = g.remotePlayers.get(id);
                    return { player: { x: p.position.x, z: p.position.z, state: p.state },
                        target: e ? { x: e.position.x, z: e.position.z, state: e.state } : null,
                        hovered: g.hoveredEntity?.id === id, pending: g.pendingInteraction?.id === id,
                        moveTarget: p.targetPosition ? { x: p.targetPosition.x, z: p.targetPosition.z } : null,
                        approach: window.__dungeonLatestTargetApproach || null };
                }, target.id))}`);
                throw new Error(`No damage progress against ${target.type} for 60 seconds`);
            }
            if (Date.now() >= nextReport) {
                const diagnostic = await page.evaluate(id => {
                    const game = window.game;
                    const enemy = game.remotePlayers.get(id);
                    return { health: enemy?.health ?? enemy?.stats?.hp, distance: enemy?.position.distanceTo(game.player.position),
                        range: game.getBasicAttackRangeForEntity(enemy), playerDamage: game.player.stats?.damage,
                        playerHealth: game.player.stats?.hp, playerMaxHealth: game.player.stats?.maxHp,
                        playerMana: game.player.stats?.mana,
                        playerPosition: { x: game.player.position.x, z: game.player.position.z } };
                }, target.id);
                console.log(`${logPrefix} ${target.type}: ${JSON.stringify(diagnostic)}`);
                nextReport = Date.now() + 15_000;
            }
            const partyTarget = expeditionProfile === 'party';
            const point = await aimDungeonCombatTarget({
                project: (id, hitboxPoint) => projectEntity(page, id, hitboxPoint),
                move: (x, y) => page.mouse.move(x, y),
                settle: () => settlePointerRaycast(page),
                hoveredId: () => page.evaluate(readDungeonTargetPointerInPage, target.id)
            }, target.id, partyTarget);
            if (!point && partyTarget) {
                const hoveredId = await page.evaluate(() => window.game.hoveredEntity?.id);
                const foreground = selectDungeonForegroundTarget(target, hoveredId,
                    await hostiles(page), playthrough.bosses, attempted);
                if (foreground) {
                    console.log(`${logPrefix} foreground target ${target.type} -> ${foreground.type}`);
                    target = foreground;
                    attempted.add(target.id);
                    lowestHealth = target.health;
                    sawDamage = false;
                    // No deadline extension or death credit. beforeCombat on
                    // the next iteration switches the party's input workers;
                    // aim must independently acquire this new target too.
                    continue;
                }
            }
            if (point?.visible) {
                await page.mouse.click(point.x, point.y);
                const primaryState = await page.evaluate(id => {
                    const game = window.game;
                    const player = game.player;
                    const enemy = game.remotePlayers.get(id);
                    if (!enemy) return null;
                    return { ability: player.abilityName, cooldown: player.abilityCooldown, dead: player.state === 'DEAD',
                        distance: enemy.position.distanceTo(player.position), attackRange: game.getBasicAttackRangeForEntity(enemy),
                        castRange: game.abilityController.getAbilityCastRange() };
                }, target.id);
                if (primaryState && shouldUseHuntPrimary(primaryState, { minimumChargeDistance }) &&
                    (!partyTarget || await page.evaluate(id => window.game.hoveredEntity?.id === id, target.id))) {
                    await page.mouse.click(point.x, point.y, { button: 'right' });
                }
                const skillState = await page.evaluate(id => {
                    const game = window.game;
                    const player = game.player;
                    const enemy = game.remotePlayers.get(id);
                    // Large bosses stop movement at their body edge. Both skills
                    // include that body radius in their server-side hit test;
                    // a fixed four-unit center distance prevents valid casts.
                    if (!enemy) return null;
                    return { classAbility: player.abilityName, isCharging: player.isCharging, dead: player.state === 'DEAD',
                        distance: enemy.position.distanceTo(player.position), attackRange: game.getBasicAttackRangeForEntity(enemy),
                        mana: player.stats.mana, manaCostReduction: player.stats.manaCostReduction,
                        hotbar: player.hotbar, cooldowns: player.cooldowns,
                        skillCosts: Object.fromEntries(['Iron Fortress', 'Guardian Roar', 'Shield Slam', 'Whirlwind']
                            .map(skill => [skill, game.abilityController.getConfiguredManaCost(skill)])) };
                }, target.id);
                const skillAction = skillState && selectFighterDungeonSkill(skillState, fullRun, { partyTank: partyTarget });
                if (skillAction && Date.now() >= nextSkillAttemptAt &&
                    (!partyTarget || await page.evaluate(id => window.game.hoveredEntity?.id === id, target.id))) {
                    await page.keyboard.press(skillAction.key);
                    nextSkillAttemptAt = Date.now() + 1000;
                }
                if (partyTarget) await page.evaluate(id => {
                    const g = window.game, p = g.player, enemy = g.remotePlayers.get(id);
                    const records = window.__partyClearEvidence.recentAttackInputs;
                    records.push({ hovered: g.hoveredEntity?.id === id,
                        distance: enemy ? p.position.distanceTo(enemy.position) : null,
                        basicRange: enemy ? g.getBasicAttackRangeForEntity(enemy) : null,
                        pendingTarget: g.pendingInteraction?.id === id,
                        moveTarget: p.targetPosition ? { x: p.targetPosition.x, z: p.targetPosition.z } : null });
                    if (records.length > 12) records.shift();
                }, target.id);
            } else {
                const live = await page.evaluate(id => {
                    const g = window.game, p = g.player, e = g.remotePlayers.get(id);
                    return { player: { x: p.position.x, z: p.position.z },
                        target: e?.isActive && e.state !== 'DEAD' ? { x: e.position.x, z: e.position.z } : null };
                }, target.id);
                const step = partyTarget ? await page.evaluate(async ({ id, encounter }) => {
                    const { dungeonOccludedTargetStep } = await import('/tests/dungeonTargetApproach.js');
                    const { isEarnedRetreatPathClear, retreatStaysInEncounter } = await import('/tests/wizardHuntControls.js');
                    const g = window.game, p = g.player, enemy = g.remotePlayers.get(id);
                    window.__dungeonTargetApproachPlan = null;
                    if (!enemy?.isActive || enemy.state === 'DEAD' || p.state === 'DEAD') return null;
                    if (window.__partyClearWarnings?.some(w => w.expires > performance.now() && w.instance === g.currentInstanceId)) return null;
                    const origin = { x: p.position.x, z: p.position.z, radius: p.radius || 1.25 };
                    const target = { x: enemy.position.x, z: enemy.position.z, radius: enemy.radius,
                        range: g.getBasicAttackRangeForEntity(enemy) };
                    const actors = [...g.remotePlayers.values()].filter(e => e.isActive && e.stats && e.state !== 'DEAD')
                        .map(e => ({ x: e.position.x, z: e.position.z, radius: e.radius }));
                    window.__dungeonTargetApproachPlan = { origin, target, actors,
                        at: performance.now(), instance: g.currentInstanceId };
                    return dungeonOccludedTargetStep(origin, target, delta =>
                        retreatStaysInEncounter(encounter, { x: origin.x + delta.dx, z: origin.z + delta.dz }, origin.radius) &&
                        isEarnedRetreatPathClear(g.collisionManager, p.position, origin.radius, { x: delta.dx, z: delta.dz }), actors);
                }, { id: target.id, encounter: target.encounter }) : dungeonTargetApproach(live.player, live.target);
                const moved = step ? await tryDungeonGroundStep(() => moveByGroundClick(page, step.dx, step.dz,
                    { allowJumpFallback: false, ...(partyTarget ? { moveOnly: true, allowAlternatePaths: false, requireClearPath: true, timeout: 1500 } : {}) })) : false;
                await page.evaluate(observation => {
                    window.__dungeonLatestTargetApproach = observation;
                    const records = window.__partyClearEvidence?.recentTargetApproaches;
                    if (records) {
                        const g = window.game, p = g.player;
                        records.push({ ...window.__dungeonTargetApproachPlan, step: observation.step, moved: observation.moved,
                            after: { x: p.position.x, z: p.position.z, state: p.state,
                                blockedStops: p.movementMetrics?.blockedStops || 0 }, atEnd: performance.now() });
                        if (records.length > 20) records.shift();
                    }
                }, { ...live, step, moved });
            }
            await page.waitForTimeout(350);
            const playerState = await readPlayerState(page);
            if (playerState.state === 'DEAD') {
                const spatial = await page.evaluate(dungeonSpatialSnapshot, { targetId: target.id });
                const death = await page.evaluate(() => ({
                    x: window.game.player.position.x, z: window.game.player.position.z,
                    mana: window.game.player.stats.mana, cooldowns: window.game.player.cooldowns,
                    events: window.__dungeonSurvivalEvents,
                    equipment: window.game.player.equipment,
                    defense: window.__freshWizardDefense || window.__freshFighterCombat || null,
                    earnedDungeonCasts: window.__earnedDungeonCasts || null,
                    hotbar: window.game.player.hotbar, unlockedSkills: window.game.player.unlockedSkills
                }));
                console.log(`${logPrefix} death diagnostic ${JSON.stringify({ ...death, spatial })}`);
            }
            expect(playerState.state, 'character must survive the encounter').not.toBe('DEAD');
        }
        throw new Error(`Real attacks did not defeat ${target.type}; observed damage=${sawDamage}`);
    }

    async function assertWorldUpdatesContinue(page) {
        timing.assertActive();
        const age = await page.evaluate(() => performance.now() - window.__verdantLastState);
        expect(age, 'authoritative world updates stalled during dungeon progression').toBeLessThan(10_000);
    }

    await page.evaluate(installDungeonObservationInPage);
    let completedRun;
    await runInstance(page, { ...playthrough, useTownGuide, resetRun, beforeExit: async () => {
        if (afterEntry) await afterEntry(page);
        const layout = await page.evaluate(() => window.game.currentDungeonLayout);
        // Preserve replay identity without logging instance IDs/QA usernames.
        console.log(`${logPrefix} replay ${JSON.stringify({ seed: layout.generationSeed,
            generator: layout.generatorVersion, attempt: layout.generationAttempt || 0,
            fallback: Boolean(layout.generationFallback), fullRun,
            difficulty: playthrough.difficulty, level: playthrough.runLevel, class: process.env.EIDOLON_E2E_CLASS || 'Wizard',
            sourceCommit: process.env.EIDOLON_E2E_SOURCE_COMMIT || 'not-recorded',
            sourceDirty: process.env.EIDOLON_E2E_SOURCE_DIRTY === '1' })}`);
        if (fullRun && process.env.EIDOLON_E2E_CLASS === 'Fighter') {
            console.log(`${logPrefix} defensive runes ${JSON.stringify(await page.evaluate(() => window.game.player.skillRunes))}`);
        }
        expect(layout.generationSeed).toBeTruthy();
        expect(Boolean(layout.generationFallback)).toBe(fallbackRun);
        if (diagnosticBoss) {
            if (diagnosticBoss !== 'ObsidianGuardian' || playthrough.dungeonType !== 'molten_core') throw new Error('Unsupported prepared encounter');
            const encounter = dungeonBossEncounter(layout, playthrough.bosses, diagnosticBoss);
            for (let approach = 0; approach < 8; approach++) {
                await assertWorldUpdatesContinue(page);
                const target = (await hostiles(page)).find(enemy => enemy.type === diagnosticBoss);
                if (target?.distance < 40) {
                    const killed = await defeatByMouse(page, { ...target, encounter });
                    expect(killed.type).toBe(diagnosticBoss);
                    if (afterEncounter) await afterEncounter(page, killed);
                    const roomIndex = layout.rooms.map((room, i) => room.type === 'boss' ? i : -1).filter(i => i >= 0)[3];
                    await expect.poll(() => page.evaluate(index => window.game.currentDungeonRoomState.rooms[index].cleared, roomIndex)).toBe(true);
                    return; // No full-route verification, handoff, turn-in or re-entry claim.
                }
                const state = await readPlayerState(page);
                const dx = encounter.x - state.x, dz = encounter.z - state.z, length = Math.hypot(dx, dz);
                await moveByGroundClick(page, dx * Math.min(1, 10 / length), dz * Math.min(1, 10 / length), { moveOnly: true, allowJumpFallback: false });
                if (afterGroundStep) await afterGroundStep(page);
            }
            throw new Error('Prepared boss approach did not reach the live encounter');
        }
        const routes = buildDungeonTraversalRoutes(layout);
        const bossRooms = layout.rooms.map((room, index) => room.type === 'boss' ? index : -1).filter(index => index >= 0);
        expect(bossRooms).toHaveLength(playthrough.bosses.length);
        const defeated = new Set();
        const lastBoss = fullRun ? bossRooms.length - 1 : 1;
        const goldBefore = await page.evaluate(() => window.game.player.gold);
        // Walk actual joins through the chosen boss rooms. The fallback switch
        // selects geometry only: no inside waypoint, kill or health override.
        traversal: for (let routeIndex = 0; routeIndex < bossRooms[lastBoss]; routeIndex++) {
            timing.enter('traversal');
            for (const destination of routes[routeIndex]) {
                let deadline = Date.now() + 180_000;
                const recentPositions = [];
                while (true) {
                    await assertWorldUpdatesContinue(page);
                    if (finishAtFinalBoss && fullRun && defeated.has(playthrough.bosses.at(-1))) {
                        const rooms = await page.evaluate(() => window.game.currentDungeonRoomState.rooms);
                        // A raid ritual starts when the assault clears, not when
                        // everyone walks onto Maelin at the chamber center. Hand
                        // input ownership to the existing defense route only
                        // after an observed boss death AND every cleared room.
                        if (rooms.length === layout.rooms.length && rooms.every((room, index) =>
                            layout.rooms[index].type === 'start' || room.cleared)) break traversal;
                    }
                    if (Date.now() > deadline) {
                        // The instance wrapper recalls before rethrowing, so its
                        // final screenshot is already in town. Preserve the
                        // actual stopped location and recent net progress here.
                        // Observation failure must not replace the route error.
                        const spatial = await page.evaluate(dungeonSpatialSnapshot).catch(() => null);
                        console.log(`${logPrefix} traversal failure ${JSON.stringify({
                            roomIndex: layout.corridors[routeIndex].toRoomIndex,
                            destination, recentPositions, spatial
                        })}`);
                        throw new Error(`Traversal stalled before room ${routeIndex + 1}`);
                    }
                    const nearby = (await hostiles(page)).find(entity => entity.distance < 40);
                    if (nearby) {
                        const combatStarted = Date.now();
                        const killed = await defeatByMouse(page, { ...nearby,
                            encounter: dungeonBossEncounter(layout, playthrough.bosses, nearby.type) });
                        // Combat has its own deadline; three ordinary encounters
                        // should not consume the independent walking timeout.
                        deadline += Date.now() - combatStarted;
                        defeated.add(killed.type);
                        if (afterEncounter) await afterEncounter(page, killed);
                        timing.enter('traversal');
                        continue;
                    }
                    const player = await readPlayerState(page);
                    const distance = Math.hypot(destination.x - player.x, destination.z - player.z);
                    recentPositions.push({ at: Date.now(), x: player.x, z: player.z, distance });
                    if (recentPositions.length > 12) recentPositions.shift();
                    if (distance < 3) break;
                    const scale = Math.min(1, 14 / distance);
                    await timing.measure('leaderInput', () => tryDungeonGroundStep(() => moveByGroundClick(page,
                        (destination.x - player.x) * scale, (destination.z - player.z) * scale,
                        { allowJumpFallback: false })));
                    if (afterGroundStep) await timing.measure('formation', () => afterGroundStep(page));
                    timing.count('leaderGroundSteps');
                }
            }
            // Only after traversing a completed room. A living pack or boss
            // keeps its original fight deadline; no recovery within that loop.
            const roomIndex = layout.corridors[routeIndex].toRoomIndex;
            timing.count('roomTraversals');
            const recoveryContext = { playthrough, roomIndex,
                nearbyHostiles: (await hostiles(page)).some(entity => entity.distance < 40) };
            timing.enter('recovery'); // Includes the eligibility check even when no trip is needed.
            const recovered = roomIndex < bossRooms[lastBoss] && (recoverAfterRoom
                ? await recoverAfterRoom(page, recoveryContext)
                : recoverBetweenRooms && await recoverBetweenDungeonRooms(page, recoveryContext));
            if (recovered) {
                timing.count('townReturns');
                if (afterTownRecovery) await afterTownRecovery(page, { roomIndex });
                // Rewalk all actual joins from the real entrance. Preserve the
                // original layout, defeated set, reward baseline and total
                // deadline; do not teleport ahead or start/reset another run.
                routeIndex = -1;
            }
        }
        timing.enter('verification');
        const expectedBosses = playthrough.bosses.slice(0, lastBoss + 1);
        expect([...defeated]).toEqual(expect.arrayContaining(expectedBosses));
        const summary = await page.evaluate(() => window.game.currentDungeonRoomState);
        for (const index of bossRooms.slice(0, lastBoss + 1)) expect(summary.rooms[index].cleared).toBe(true);
        if (fullRun) {
            for (const [index, room] of layout.rooms.entries()) {
                if (room.type !== 'start') expect(summary.rooms[index].cleared, `Room ${index} (${room.type}) must be cleared`).toBe(true);
            }
            completedRun = { seed: layout.generationSeed, generator: layout.generatorVersion,
                bossRooms, gold: await page.evaluate(() => window.game.player.gold) };
        }
        expect(await page.evaluate(() => window.game.player.gold)).toBeGreaterThan(goldBefore);
        // Inspection boundary after actual combat/room/reward assertions, before
        // ordinary Recall. Recovery diagnostics must observe spent pools here,
        // not infer them from already-restored town state.
        if (afterClearedRoute) await afterClearedRoute(page, {
            assertActive: () => timing.assertActive(),
            fight: async target => {
                timing.assertActive();
                const killed = await defeatByMouse(page, target);
                if (afterEncounter) await afterEncounter(page, killed);
            }
        });
        if (completedRun) completedRun.gold = await page.evaluate(() => window.game.player.gold);
    } }).finally(() => timing.report('route-exit'));
    if (fullRun && !diagnosticBoss) {
        await runInstance(page, { ...playthrough, useTownGuide, beforeExit: async () => {
            expect(await page.evaluate(() => window.game.currentDungeonLayout.generationSeed)).toBe(completedRun.seed);
            expect(await page.evaluate(() => window.game.currentDungeonLayout.generatorVersion)).toBe(completedRun.generator);
            const summary = await page.evaluate(() => window.game.currentDungeonRoomState);
            for (const index of completedRun.bossRooms) expect(summary.rooms[index].cleared).toBe(true);
            expect(await page.evaluate(() => window.game.player.gold)).toBe(completedRun.gold);
            console.log(`${logPrefix} completed-run recall/re-entry preserved seed, cleared bosses and gold`);
        } });
    }
    timing.report(diagnosticBoss ? 'prepared-encounter-complete' : 'complete');
}
