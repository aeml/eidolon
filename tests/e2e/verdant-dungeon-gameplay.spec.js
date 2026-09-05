import { expect, test } from '@playwright/test';
import { buildDungeonTraversalRoutes } from '../dungeonTraversalRoutes.js';
import {
    collectBrowserFailures, credentialsFromEnvironment, ensureDungeonReadyLevel,
    enterAndExitDungeon, loginAndEnterWorld, moveByGroundClick, projectEntity, readPlayerState
} from './helpers.js';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

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
    console.log(`[verdant] fighting ${target.type}`);
    const deadline = Date.now() + 120_000;
    let sawDamage = false;
    let nextReport = 0;
    while (Date.now() < deadline) {
        await assertWorldUpdatesContinue(page);
        const state = await page.evaluate(id => {
            const entity = window.game.remotePlayers.get(id);
            return entity ? { health: entity.health ?? entity.stats?.hp, state: entity.state } : null;
        }, target.id);
        if (state?.state === 'DEAD' || state?.health <= 0) {
            console.log(`[verdant] defeated ${target.type}`);
            return;
        }
        if (!state) throw new Error(`Combat target disappeared without a confirmed death: ${target.type}`);
        sawDamage ||= state.health < target.health;
        if (Date.now() >= nextReport) {
            const diagnostic = await page.evaluate(id => {
                const game = window.game;
                const enemy = game.remotePlayers.get(id);
                return { health: enemy?.health ?? enemy?.stats?.hp, distance: enemy?.position.distanceTo(game.player.position),
                    range: game.getBasicAttackRangeForEntity(enemy), playerDamage: game.player.stats?.damage };
            }, target.id);
            console.log(`[verdant] ${target.type}: ${JSON.stringify(diagnostic)}`);
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
                const player = window.game.player;
                const enemy = window.game.remotePlayers.get(id);
                if (player.abilityName !== 'Charge' || !enemy ||
                    enemy.position.distanceTo(player.position) > 4 || player.stats.mp < 30) return null;
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

test('Verdant ordinary encounters, first boss, and later spawns remain playable', async ({ page, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password, 'Requires a dedicated QA character');
    test.setTimeout(900_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await ensureDungeonReadyLevel(page);
    await prepareFighterSkills(page);
    await page.evaluate(() => {
        const game = window.game;
        const original = game.handleServerMessage.bind(game);
        window.__verdantLastState = performance.now();
        game.handleServerMessage = message => {
            if (message.type === 'state' || message.type === 'delta') window.__verdantLastState = performance.now();
            return original(message);
        };
    });
    await enterAndExitDungeon(page, { resetRun: true, beforeExit: async () => {
        const layout = await page.evaluate(() => window.game.currentDungeonLayout);
        const routes = buildDungeonTraversalRoutes(layout);
        const bossRooms = layout.rooms.map((room, index) => room.type === 'boss' ? index : -1).filter(index => index >= 0);
        const defeated = new Set();
        // Walk the actual joins through two boss rooms. No waypoint inside the
        // instance, forced kill, health edit, or progression override is used.
        for (let routeIndex = 0; routeIndex < bossRooms[1]; routeIndex++) {
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
        expect([...defeated]).toEqual(expect.arrayContaining(['RootboundWarden', 'BriarMatron']));
        const summary = await page.evaluate(() => window.game.currentDungeonRoomState);
        expect(summary.rooms[bossRooms[0]].cleared).toBe(true);
        expect(summary.rooms[bossRooms[1]].cleared).toBe(true);
    } });
    expect(failures, failures.join('\n')).toEqual([]);
});
