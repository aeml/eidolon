import { expect, test } from '@playwright/test';
import { buildDungeonTraversalRoutes } from '../dungeonTraversalRoutes.js';
import { dungeonPlaythroughOptions } from '../dungeonPlaythroughCatalog.js';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    enterAndExitDungeon, loginAndEnterWorld, moveByGroundClick, projectEntity, readPlayerState, returnToTown
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const fallbackRun = process.env.EIDOLON_E2E_DUNGEON_FALLBACK === '1';
const playthrough = dungeonPlaythroughOptions(process.env);
const fullRun = fallbackRun || process.env.EIDOLON_E2E_FULL_DUNGEON === '1' || playthrough.dungeonType !== 'verdant_bastion_catacombs';
const logPrefix = `[dungeon:${playthrough.dungeonType}]`;

async function prepareFighterSkills(page) {
    if (!await page.evaluate(() => window.game.player.abilityName === 'Charge')) return;
    // A freshly created character has only Charge. Select a normal level-unlocked
    // specialization through the UI so melee QA exercises attacks and damage skills.
    await page.keyboard.press('k');
    const skills = page.locator('#skill-tree-window');
    await expect(skills).toBeVisible();
    await skills.getByRole('button', { name: 'Skills', exact: true }).click();
    const branch = page.locator('.skill-branch').first();
    await expect(branch).toContainText('Shield & Mitigation');
    const select = branch.getByRole('button', { name: 'Select Spec' });
    if (await select.count()) await select.click();
    await expect.poll(() => page.evaluate(() => window.game.player.hotbar?.slice(0, 2)))
        .toEqual(['Whirlwind', 'Shield Slam']);
    await page.locator('#btn-close-skills').click();
    await expect(skills).toBeHidden();
}

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
    const deadline = Date.now() + (fullRun ? 360_000 : 120_000);
    let sawDamage = false;
    let lowestHealth = target.health;
    let lastDamageAt = Date.now();
    let nextReport = 0;
    while (Date.now() < deadline) {
        await assertWorldUpdatesContinue(page);
        const state = await page.evaluate(id => {
            const entity = window.game.remotePlayers.get(id);
            return entity ? { health: entity.health ?? entity.stats?.hp, state: entity.state } : null;
        }, target.id);
        if (state?.state === 'DEAD' || state?.health <= 0) {
            console.log(`${logPrefix} defeated ${target.type}`);
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
                    range: game.getBasicAttackRangeForEntity(enemy), playerDamage: game.player.stats?.damage };
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
            const meleeSkillKey = await page.evaluate(id => {
                const game = window.game;
                const player = game.player;
                const enemy = game.remotePlayers.get(id);
                // Large bosses stop movement at their body edge. Both skills
                // include that body radius in their server-side hit test;
                // a fixed four-unit center distance prevents valid casts.
                if (player.abilityName !== 'Charge' || !enemy ||
                    enemy.position.distanceTo(player.position) > game.getBasicAttackRangeForEntity(enemy) ||
                    player.stats.mp < 30) return null;
                const index = player.hotbar.findIndex(skill =>
                    ['Whirlwind', 'Shield Slam'].includes(skill) && !(player.cooldowns[skill] > 0));
                return index >= 0 ? String(index + 1) : null;
            }, target.id);
            if (meleeSkillKey) await page.keyboard.press(meleeSkillKey);
        } else {
            const player = await readPlayerState(page);
            const distance = Math.hypot(target.x - player.x, target.z - player.z);
            const scale = Math.min(1, 12 / distance);
            await moveByGroundClick(page, (target.x - player.x) * scale, (target.z - player.z) * scale,
                { allowJumpFallback: false });
        }
        await page.waitForTimeout(350);
        expect((await readPlayerState(page)).state, 'character must survive the encounter').not.toBe('DEAD');
    }
    throw new Error(`Real attacks did not defeat ${target.type}; observed damage=${sawDamage}`);
}

async function assertWorldUpdatesContinue(page) {
    const age = await page.evaluate(() => performance.now() - window.__verdantLastState);
    expect(age, 'authoritative world updates stalled during dungeon progression').toBeLessThan(10_000);
}

test(fullRun ? `${playthrough.name} complete ${fallbackRun ? 'fallback' : 'generated'} run remains playable` : 'Verdant ordinary encounters, first boss, and later spawns remain playable', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.setTimeout(1_500_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await prepareFighterSkills(page);
    if (fallbackRun) {
        await returnToTown(page);
        const chat = page.locator('#chat-input');
        await chat.click();
        await chat.fill('/qa-dungeon-fallback-next');
        await chat.press('Enter');
        await expect(page.locator('#chat-messages')).toContainText('Next fresh dungeon will use its complete fallback route');
    }
    await page.evaluate(() => {
        const game = window.game;
        const original = game.handleServerMessage.bind(game);
        window.__verdantLastState = performance.now();
        game.handleServerMessage = message => {
            if (message.type === 'state' || message.type === 'delta') window.__verdantLastState = performance.now();
            return original(message);
        };
    });
    let completedRun;
    await enterAndExitDungeon(page, { ...playthrough, resetRun: true, beforeExit: async () => {
        const layout = await page.evaluate(() => window.game.currentDungeonLayout);
        // Preserve replay identity without logging instance IDs/QA usernames.
        console.log(`${logPrefix} replay ${JSON.stringify({ seed: layout.generationSeed,
            generator: layout.generatorVersion, attempt: layout.generationAttempt || 0,
            fallback: Boolean(layout.generationFallback), fullRun,
            difficulty: playthrough.difficulty, level: playthrough.runLevel, class: process.env.EIDOLON_E2E_CLASS || 'Wizard',
            sourceCommit: process.env.EIDOLON_E2E_SOURCE_COMMIT || 'not-recorded',
            sourceDirty: process.env.EIDOLON_E2E_SOURCE_DIRTY === '1' })}`);
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
                        await defeatByMouse(page, nearby);
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
                    await moveByGroundClick(page, (destination.x - player.x) * scale,
                        (destination.z - player.z) * scale, { allowJumpFallback: false });
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
    } });
    if (fullRun) {
        await enterAndExitDungeon(page, { ...playthrough, beforeExit: async () => {
            expect(await page.evaluate(() => window.game.currentDungeonLayout.generationSeed)).toBe(completedRun.seed);
            expect(await page.evaluate(() => window.game.currentDungeonLayout.generatorVersion)).toBe(completedRun.generator);
            const summary = await page.evaluate(() => window.game.currentDungeonRoomState);
            for (const index of completedRun.bossRooms) expect(summary.rooms[index].cleared).toBe(true);
            expect(await page.evaluate(() => window.game.player.gold)).toBe(completedRun.gold);
            console.log(`${logPrefix} completed-run recall/re-entry preserved seed, cleared bosses and gold`);
        } });
    }
    expect(failures, failures.join('\n')).toEqual([]);
});
