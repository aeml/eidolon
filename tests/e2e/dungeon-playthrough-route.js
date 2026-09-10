import { expect } from '@playwright/test';
import { buildDungeonTraversalRoutes } from '../dungeonTraversalRoutes.js';
import { selectFighterDungeonSkill } from '../dungeonCombatControls.js';
import { tryDungeonGroundStep } from '../dungeonNavigationInput.js';
import { enterAndExitDungeon, moveByGroundClick, projectEntity, readPlayerState } from './helpers.js';
import { dungeonSpatialSnapshot } from './dungeon-spatial-snapshot.js';
import { dungeonBossEncounter } from '../dungeonCombatEncounter.js';

// Callers own login, earned or fixture preparation, and story turn-in. The safe
// default enters through the town guide, without grants. Only the legacy prepared
// caller explicitly opts into the QA entrance waypoint (which grants protection).
export async function playDungeonThroughInputs(page, {
    playthrough, fullRun = true, fallbackRun = false, beforeCombat, useTownGuide = true, afterClearedRoute,
    requiredFighterSkills = ['Iron Fortress', 'Guardian Roar', 'Whirlwind', 'Shield Slam']
}) {
    const logPrefix = `[dungeon:${playthrough.dungeonType}]`;
    async function hostiles(page) {
        return page.evaluate(() => {
            const game = window.game;
            return [...game.remotePlayers.values()]
                .filter(entity => game.isHostileActorTarget(entity) && entity.isActive &&
                    entity.state !== 'DEAD' && (entity.health ?? entity.stats?.hp) > 0)
                .map(entity => ({ id: entity.id, type: entity.subType || entity.constructor.name, x: entity.position.x,
                    z: entity.position.z, health: entity.health ?? entity.stats?.hp,
                    distance: entity.position.distanceTo(game.player.position) }))
                .sort((a, b) => a.distance - b.distance);
        });
    }

    async function defeatByMouse(page, target) {
        console.log(`${logPrefix} fighting ${target.type}`);
        if (target.encounter) console.log(`${logPrefix} boss encounter ${JSON.stringify({ type: target.type, ...target.encounter })}`);
        // Tempest seed -1329185764639002788 reached Zephyrion alive with
        // continuous damage but outlasted six minutes (93,600 starting HP).
        // Allow eight minutes for functional combat; retain the 60s damage-stall
        // watchdog and 40-minute whole-run ceiling. This is not a balance pass.
        const deadline = Date.now() + (fullRun ? 480_000 : 120_000);
        let sawDamage = false;
        let lowestHealth = target.health;
        let lastDamageAt = Date.now();
        let nextReport = 0;
        let nextSkillAttemptAt = 0;
        while (Date.now() < deadline) {
            await assertWorldUpdatesContinue(page);
            if (beforeCombat && await beforeCombat(page, target)) continue;
            const state = await page.evaluate(id => {
                const entity = window.game.remotePlayers.get(id);
                return entity ? { health: entity.health ?? entity.stats?.hp, state: entity.state } : null;
            }, target.id);
            if (state?.state === 'DEAD' || state?.health <= 0) {
                console.log(`${logPrefix} defeated ${target.type}`);
                if (fullRun && target.type === playthrough.bosses[0] && process.env.EIDOLON_E2E_CLASS === 'Fighter') {
                    const observedSkills = await page.evaluate(() => window.__dungeonObservedSkills);
                    expect(observedSkills).toEqual(expect.arrayContaining(requiredFighterSkills));
                    console.log(`${logPrefix} accepted hotbar skills ${JSON.stringify(observedSkills)}`);
                }
                return;
            }
            if (!state) throw new Error(`Combat target disappeared without a confirmed death: ${target.type}`);
            sawDamage ||= state.health < target.health;
            if (state.health < lowestHealth) {
                lowestHealth = state.health;
                lastDamageAt = Date.now();
            }
            if (Date.now() - lastDamageAt > 60_000) throw new Error(`No damage progress against ${target.type} for 60 seconds`);
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
            const point = await projectEntity(page, target.id);
            if (point?.visible) {
                await page.mouse.move(point.x, point.y);
                await page.waitForTimeout(50);
                await page.mouse.click(point.x, point.y);
                const shouldCast = await page.evaluate(id => {
                    const game = window.game;
                    const player = game.player;
                    const enemy = game.remotePlayers.get(id);
                    if (!enemy || player.abilityCooldown > 0) return false;
                    const distance = enemy.position.distanceTo(player.position);
                    // Charge closes a gap; repeatedly charging at melee contact
                    // interrupts basic attacks instead of exercising normal combat.
                    if (player.abilityName === 'Charge' && distance <= game.getBasicAttackRangeForEntity(enemy) + 2) return false;
                    return distance <= game.abilityController.getAbilityCastRange();
                }, target.id);
                if (shouldCast) await page.mouse.click(point.x, point.y, { button: 'right' });
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
                        hotbar: player.hotbar, cooldowns: player.cooldowns };
                }, target.id);
                const skillAction = skillState && selectFighterDungeonSkill(skillState, fullRun);
                if (skillAction && Date.now() >= nextSkillAttemptAt) {
                    await page.keyboard.press(skillAction.key);
                    nextSkillAttemptAt = Date.now() + 1000;
                }
            } else {
                const player = await readPlayerState(page);
                const distance = Math.hypot(target.x - player.x, target.z - player.z);
                const scale = Math.min(1, 12 / distance);
                await tryDungeonGroundStep(() => moveByGroundClick(page, (target.x - player.x) * scale, (target.z - player.z) * scale,
                    { allowJumpFallback: false }));
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
        const age = await page.evaluate(() => performance.now() - window.__verdantLastState);
        expect(age, 'authoritative world updates stalled during dungeon progression').toBeLessThan(10_000);
    }

    await page.evaluate(() => {
        const game = window.game;
        const original = game.handleServerMessage.bind(game);
        window.__verdantLastState = performance.now();
        window.__dungeonObservedSkills = [];
        window.__dungeonSurvivalEvents = [];
        game.handleServerMessage = message => {
            if (message.type === 'state' || message.type === 'delta') window.__verdantLastState = performance.now();
            if (['damage', 'heal'].includes(message.type) && message.payload?.targetId === game.player.id) {
                const data = message.payload;
                const source = game.remotePlayers.get(data.sourceId);
                window.__dungeonSurvivalEvents.push({ time: Math.round(performance.now()), event: message.type,
                    amount: data.amount, kind: data.kind, sourceType: source?.subType || source?.constructor.name ||
                        (String(data.sourceId || '').startsWith('hazard-') ? 'hazard' : 'unresolved'),
                    playerPosition: { x: game.player.position.x, z: game.player.position.z },
                    sourcePosition: source?.position ? { x: source.position.x, z: source.position.z } : null,
                    hpBeforePresentation: game.player.stats.hp });
                if (window.__dungeonSurvivalEvents.length > 80) window.__dungeonSurvivalEvents.shift();
            }
            if (message.type === 'ability' && message.payload?.sourceId === game.player.id &&
                !window.__dungeonObservedSkills.includes(message.payload.skillName)) {
                window.__dungeonObservedSkills.push(message.payload.skillName);
            }
            return original(message);
        };
    });
    let completedRun;
    await enterAndExitDungeon(page, { ...playthrough, useTownGuide, resetRun: true, beforeExit: async () => {
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
        const routes = buildDungeonTraversalRoutes(layout);
        const bossRooms = layout.rooms.map((room, index) => room.type === 'boss' ? index : -1).filter(index => index >= 0);
        expect(bossRooms).toHaveLength(playthrough.bosses.length);
        const defeated = new Set();
        const lastBoss = fullRun ? bossRooms.length - 1 : 1;
        const goldBefore = await page.evaluate(() => window.game.player.gold);
        // Walk actual joins through the chosen boss rooms. The fallback switch
        // selects geometry only: no inside waypoint, kill or health override.
        for (let routeIndex = 0; routeIndex < bossRooms[lastBoss]; routeIndex++) {
            for (const destination of routes[routeIndex]) {
                let deadline = Date.now() + 180_000;
                while (true) {
                    await assertWorldUpdatesContinue(page);
                    if (Date.now() > deadline) throw new Error(`Traversal stalled before room ${routeIndex + 1}`);
                    const nearby = (await hostiles(page)).find(entity => entity.distance < 40);
                    if (nearby) {
                        const combatStarted = Date.now();
                        await defeatByMouse(page, { ...nearby,
                            encounter: dungeonBossEncounter(layout, playthrough.bosses, nearby.type) });
                        // Combat has its own deadline; three ordinary encounters
                        // should not consume the independent walking timeout.
                        deadline += Date.now() - combatStarted;
                        defeated.add(nearby.type);
                        continue;
                    }
                    const player = await readPlayerState(page);
                    const distance = Math.hypot(destination.x - player.x, destination.z - player.z);
                    if (distance < 3) break;
                    const scale = Math.min(1, 14 / distance);
                    await tryDungeonGroundStep(() => moveByGroundClick(page, (destination.x - player.x) * scale,
                        (destination.z - player.z) * scale, { allowJumpFallback: false }));
                }
            }
        }
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
        if (afterClearedRoute) await afterClearedRoute(page);
    } });
    if (fullRun) {
        await enterAndExitDungeon(page, { ...playthrough, useTownGuide, beforeExit: async () => {
            expect(await page.evaluate(() => window.game.currentDungeonLayout.generationSeed)).toBe(completedRun.seed);
            expect(await page.evaluate(() => window.game.currentDungeonLayout.generatorVersion)).toBe(completedRun.generator);
            const summary = await page.evaluate(() => window.game.currentDungeonRoomState);
            for (const index of completedRun.bossRooms) expect(summary.rooms[index].cleared).toBe(true);
            expect(await page.evaluate(() => window.game.player.gold)).toBe(completedRun.gold);
            console.log(`${logPrefix} completed-run recall/re-entry preserved seed, cleared bosses and gold`);
        } });
    }
}
