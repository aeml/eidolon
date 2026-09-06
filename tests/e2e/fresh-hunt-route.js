import { expect } from '@playwright/test';
import { readChronicleChapter } from './chronicle-earth-route.js';
import { openDungeonGuide } from './dungeon-guide.js';
import { loginAndEnterWorld, projectEntity, readPlayerState,
    returnToTown, setAutoLootThroughSettings, zoomOutForPortal } from './helpers.js';

const daily = 'daily_skeleton';
const snapshot = page => page.evaluate(() => {
    const p = window.game.player;
    return { level: p.level, xp: p.xp, maxXP: p.xpToNextLevel, gold: p.gold };
});

async function selectSkeletonContract(page) {
    const heading = page.locator('#quest-window .quest-dialogue h3');
    if (await heading.filter({ hasText: 'Daily Hunt: Skeleton' }).isVisible()) return;
    const back = page.getByRole('button', { name: 'Back to contracts', exact: true });
    if (await back.isVisible()) await back.click();
    await page.locator('.quest-contract').filter({ hasText: 'Skeleton' }).first().click();
    await expect(heading).toHaveText('Daily Hunt: Skeleton');
}

export async function discussHunt(page) {
    await returnToTown(page);
    if (await page.locator('#quest-window').isVisible()) {
        await expect(page.locator('#quest-window')).toContainText('DAILY CONTRACTS');
        await selectSkeletonContract(page);
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
    await selectSkeletonContract(page);
}

// This baseline deliberately does not equip drops, spend talent points or grant
// QA travel/protection/progress. It measures one existing contract, not the best
// leveling route or a human player's ability to discover it.
export async function earnFreshSkeletonHunt(page, credentials, { findTarget, leaveTown }) {
    await page.locator('#btn-close-dungeon-menu').click();
    await discussHunt(page);
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, daily)).accepted).toBe(true);
    await page.locator('#btn-close-quest').click();
    const previousAutoLoot = await page.evaluate(() => window.game.autoLootEnabled);
    await setAutoLootThroughSettings(page, false);
    const baseline = await snapshot(page);
    const started = Date.now();
    console.log(`[fresh-hunt] baseline ${JSON.stringify(baseline)}`);
    await returnToTown(page);
    await leaveTown();
    let deaths = 0, reported = 0;
    while ((await readChronicleChapter(page, daily)).count < 100) {
        const target = await findTarget();
        const before = (await readChronicleChapter(page, daily)).count;
        const deadline = Date.now() + 120_000;
        let respawned = false;
        while (Date.now() < deadline && (await readChronicleChapter(page, daily)).count === before) {
            if ((await readPlayerState(page)).state === 'DEAD') {
                deaths++;
                expect(deaths, 'Fresh hunt exceeded two ordinary respawns').toBeLessThanOrEqual(2);
                await returnToTown(page);
                await leaveTown();
                respawned = true;
                break;
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
        if (respawned) continue;
        const count = (await readChronicleChapter(page, daily)).count;
        expect(count, 'Ordinary hunt combat must produce server quest credit').toBeGreaterThan(before);
        if (count >= reported + 10 || count === 100) {
            reported = count;
            console.log(`[fresh-hunt] ${JSON.stringify({ count, deaths, ...await snapshot(page),
                seconds: Math.round((Date.now() - started) / 1000) })}`);
        }
    }
    expect((await readChronicleChapter(page, daily)).completed).toBe(false);
    await discussHunt(page);
    const beforeReward = await snapshot(page);
    await page.getByRole('button', { name: 'Complete Quest', exact: true }).click();
    await expect.poll(async () => (await readChronicleChapter(page, daily)).completed).toBe(true);
    const reward = await readChronicleChapter(page, daily);
    expect(reward.grantedXP).toBe(50_000);
    expect(reward.grantedGold).toBeGreaterThan(0);
    await page.locator('#btn-close-quest').click();
    await setAutoLootThroughSettings(page, previousAutoLoot);
    const earned = await snapshot(page);
    expect(earned.gold).toBe(beforeReward.gold + reward.grantedGold);
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect(await snapshot(page)).toEqual(earned);
    expect((await readChronicleChapter(page, daily)).completed).toBe(true);
    await openDungeonGuide(page);
    const entryEnabled = await page.locator('#btn-enter-dungeon').isEnabled();
    expect(entryEnabled).toBe(earned.level >= 30);
    console.log(`[fresh-hunt] complete ${JSON.stringify({ baseline, beforeReward, earned, deaths,
        rewardXP: reward.grantedXP, rewardGold: reward.grantedGold, entryEnabled,
        seconds: Math.round((Date.now() - started) / 1000) })}`);
}
