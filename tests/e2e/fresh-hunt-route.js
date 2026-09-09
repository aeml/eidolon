import { expect } from '@playwright/test';
import { shouldUseHuntPrimary } from '../dungeonCombatControls.js';
import { readChronicleChapter } from './chronicle-earth-route.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { findHuntTargetWithRecovery } from '../huntTargetRecovery.js';
import { loginAndEnterWorld, projectEntity, readPlayerState,
    returnToTown, setAutoLootThroughSettings, zoomOutForPortal } from './helpers.js';

const snapshot = page => page.evaluate(() => {
    const p = window.game.player;
    return { level: p.level, xp: p.xp, maxXP: p.xpToNextLevel, gold: p.gold };
});

async function selectContract(page, target) {
    const heading = page.locator('#quest-window .quest-dialogue h3');
    if (await heading.isVisible() && await heading.textContent() === `Daily Hunt: ${target}`) return;
    const back = page.getByRole('button', { name: 'Back to contracts', exact: true });
    if (await back.isVisible()) await back.click();
    await page.locator('.quest-contract').filter({ hasText: `Daily Hunt: ${target}` }).first().click();
    await expect(heading).toHaveText(`Daily Hunt: ${target}`);
}

export async function discussHunt(page, target = 'Skeleton') {
    await returnToTown(page);
    if (await page.locator('#quest-window').isVisible()) {
        await expect(page.locator('#quest-window')).toContainText('DAILY CONTRACTS');
        await selectContract(page, target);
        return;
    }
    // Frame the giver, then click the NPC itself and let normal interaction
    // approach it. A ground-motion assertion is not appropriate for an NPC
    // click that successfully opens a dialogue without further displacement.
    await zoomOutForPortal(page);
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return game.player.state === 'IDLE' && !game.player.targetPosition &&
            Math.hypot(game.renderSystem.cameraTarget.x - game.player.position.x,
                game.renderSystem.cameraTarget.z - game.player.position.z) < 0.05;
    })).toBe(true);
    let point;
    let diagnostic;
    await expect.poll(async () => {
        const meshPoint = await projectEntity(page, 'quest-npc-1');
        const bodyPoints = await page.evaluate(() => {
            const game = window.game, npc = game.remotePlayers.get('quest-npc-1');
            const canvas = game.renderSystem.renderer.domElement;
            const rect = canvas.getBoundingClientRect();
            return [1.2, 0.8, 1.6].map(height => {
                const vector = npc.position.clone(); vector.y += height;
                vector.project(game.renderSystem.camera);
                const x = rect.left + (vector.x + 1) * rect.width / 2;
                const y = rect.top + (1 - vector.y) * rect.height / 2;
                return { x, y, visible: vector.z >= -1 && vector.z <= 1 && document.elementFromPoint(x, y) === canvas };
            });
        });
        for (const candidate of [meshPoint, ...bodyPoints]) {
            if (!candidate?.visible) continue;
            point = candidate;
            await page.mouse.move(point.x, point.y);
            if (await page.evaluate(() => window.game.hoveredEntity?.id === 'quest-npc-1')) return true;
        }
        diagnostic = await page.evaluate(() => {
            const game = window.game;
            return { player: game.player.position, npc: game.remotePlayers.get('quest-npc-1')?.position,
                hovered: game.hoveredEntity?.constructor?.name, state: game.player.state,
                questWindow: document.getElementById('quest-window')?.style.display,
                blockers: [1.2, 0.8, 1.6].map(height => {
                    const vector = game.remotePlayers.get('quest-npc-1').position.clone(); vector.y += height;
                    vector.project(game.renderSystem.camera);
                    const node = document.elementFromPoint((vector.x + 1) * innerWidth / 2, (1 - vector.y) * innerHeight / 2);
                    return { tag: node?.tagName, id: node?.id, className: node?.className };
                }) };
        });
        return false;
    }).toBe(true).catch(error => {
        console.log(`[fresh-hunt] daily pointer ${JSON.stringify({ point, diagnostic })}`);
        throw error;
    });
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#quest-window')).toBeVisible();
    await selectContract(page, target);
}

// This baseline deliberately does not equip drops, spend talent points or grant
// QA travel/protection/progress. It measures one existing contract, not the best
// leveling route or a human player's ability to discover it.
export async function earnFreshSkeletonHunt(page, credentials, { findTarget, leaveTown }) {
    return earnFreshHunt(page, credentials, { findTarget, leaveTown });
}

export async function earnFreshHunt(page, credentials, {
    findTarget, leaveTown, target = 'Skeleton', daily = 'daily_skeleton', rewardXP = 50_000, beforeCombat
}) {
    await page.locator('#btn-close-dungeon-menu').click();
    await discussHunt(page, target);
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, daily)).accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    const previousAutoLoot = await page.evaluate(() => window.game.autoLootEnabled);
    await setAutoLootThroughSettings(page, false);
    const baseline = await snapshot(page);
    const started = Date.now();
    console.log(`[fresh-hunt:${target}] baseline ${JSON.stringify(baseline)}`);
    await page.evaluate(() => {
        const game = window.game, original = game.handleServerMessage.bind(game);
        window.__huntSurvivalEvents = [];
        game.handleServerMessage = message => {
            if (['damage', 'heal'].includes(message.type) && message.payload?.targetId === game.player.id) {
                const data = message.payload, source = game.remotePlayers.get(data.sourceId);
                window.__huntSurvivalEvents.push({ at: Math.round(performance.now()), event: message.type,
                    amount: data.amount, kind: data.kind, sourceId: data.sourceId,
                    sourceType: source?.subType || source?.constructor.name || 'unresolved',
                    sourceLevel: source?.level, x: game.player.position.x, z: game.player.position.z,
                    hpBeforePresentation: game.player.stats.hp });
                if (window.__huntSurvivalEvents.length > 60) window.__huntSurvivalEvents.shift();
            }
            return original(message);
        };
    });
    await returnToTown(page);
    await leaveTown();
    let deaths = 0, reported = 0;
    const recoverDeath = async before => {
        deaths++;
        console.log(`[fresh-hunt:${target}] death ${JSON.stringify({ deaths, count: before,
            ...await snapshot(page), defense: await page.evaluate(() => window.__freshFighterCombat?.counts || window.__freshWizardDefense?.counts || null),
            survival: await page.evaluate(() => {
                const game = window.game, p = game.player;
                return { x: p.position.x, z: p.position.z, maxHP: p.stats.maxHp, damage: p.stats.damage,
                    recent: window.__huntSurvivalEvents,
                    nearby: (game.activeEntitiesCache || []).filter(enemy => game.isHostileActorTarget(enemy) &&
                        p.position.distanceTo(enemy.position) < 30).map(enemy => ({ type: enemy.subType || enemy.constructor.name,
                        level: enemy.level, x: enemy.position.x, z: enemy.position.z, health: enemy.stats?.hp ?? enemy.health })) };
            }) })}`);
        expect(deaths, 'Fresh hunt exceeded two ordinary respawns').toBeLessThanOrEqual(2);
        await returnToTown(page);
        expect((await readChronicleChapter(page, daily)).count, 'Death must not erase earned hunt credit').toBeGreaterThanOrEqual(before);
        await leaveTown();
    };
    while ((await readChronicleChapter(page, daily)).count < 100) {
        const before = (await readChronicleChapter(page, daily)).count;
        const enemy = await findHuntTargetWithRecovery({ findTarget,
            isDead: async () => (await readPlayerState(page)).state === 'DEAD', recover: () => recoverDeath(before) });
        if (!enemy) continue;
        const deadline = Date.now() + 120_000;
        let respawned = false;
        while (Date.now() < deadline && (await readChronicleChapter(page, daily)).count === before) {
            if ((await readPlayerState(page)).state === 'DEAD') {
                await recoverDeath(before);
                respawned = true;
                break;
            }
            if (beforeCombat && await beforeCombat(page, enemy)) continue;
            const point = await projectEntity(page, enemy.id);
            if (point?.visible) {
                await page.mouse.click(point.x, point.y);
                const primary = await page.evaluate(id => {
                    const game = window.game, p = game.player, target = game.remotePlayers.get(id);
                    if (!target) return null;
                    return { ability: p.abilityName, cooldown: p.abilityCooldown, dead: p.state === 'DEAD',
                        distance: p.position.distanceTo(target.position), attackRange: game.getBasicAttackRangeForEntity(target),
                        castRange: game.abilityController.getAbilityCastRange() };
                }, enemy.id);
                if (primary && shouldUseHuntPrimary(primary)) {
                    await page.mouse.click(point.x, point.y, { button: 'right' });
                }
            }
            await page.waitForTimeout(250);
        }
        if (respawned) continue;
        const count = (await readChronicleChapter(page, daily)).count;
        expect(count, 'Ordinary hunt combat must produce server quest credit').toBeGreaterThan(before);
        if (count >= reported + 10 || count === 100) {
            reported = count;
            console.log(`[fresh-hunt:${target}] ${JSON.stringify({ count, deaths, ...await snapshot(page),
                defense: await page.evaluate(() => window.__freshFighterCombat?.counts || window.__freshWizardDefense?.counts || null),
                seconds: Math.round((Date.now() - started) / 1000) })}`);
        }
    }
    const defense = await page.evaluate(() => window.__freshFighterCombat?.counts || window.__freshWizardDefense?.counts || null);
    expect((await readChronicleChapter(page, daily)).completed).toBe(false);
    await discussHunt(page, target);
    const beforeReward = await snapshot(page);
    await page.getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, daily)).completed).toBe(true);
    const reward = await readChronicleChapter(page, daily);
    expect(reward.grantedXP).toBe(rewardXP);
    expect(reward.grantedGold).toBeGreaterThan(0);
    await page.locator('#btn-close-quest').click();
    await setAutoLootThroughSettings(page, previousAutoLoot);
    const earned = await snapshot(page);
    expect(earned.gold).toBe(beforeReward.gold + reward.grantedGold);
    await loginAndEnterWorld(page, credentials);
    expect(await snapshot(page)).toEqual(earned);
    expect((await readChronicleChapter(page, daily)).completed).toBe(true);
    await openDungeonGuide(page);
    const entryEnabled = await page.locator('#btn-enter-dungeon').isEnabled();
    expect(entryEnabled).toBe(earned.level >= 30);
    console.log(`[fresh-hunt:${target}] complete ${JSON.stringify({ baseline, beforeReward, earned, deaths,
        rewardXP: reward.grantedXP, rewardGold: reward.grantedGold, entryEnabled, defense,
        seconds: Math.round((Date.now() - started) / 1000) })}`);
}
