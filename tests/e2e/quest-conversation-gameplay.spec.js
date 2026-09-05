import { expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, moveByGroundClick } from './helpers.js';

const credentials = credentialsFromEnvironment();
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('fresh character talks to distinct town givers and explicitly accepts the Chronicle', async ({ page, baseURL }) => {
    test.skip(!credentials.username || !credentials.password || process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires a fresh disposable QA character');
    test.setTimeout(180000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    await page.mouse.move(640, 320);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.game?.remotePlayers?.get('story-wizard-1')?.questMarker?.visible)).toBe(true);
    expect(await page.evaluate(() => window.game.player.quests.find((quest) => quest.category === 'chronicle').accepted)).toBe(false);
    const talk = async (id) => {
        const point = await page.evaluate((id) => {
            const game = window.game;
            const npc = game.remotePlayers.get(id);
            const vector = npc.position.clone();
            vector.y += 1.2;
            vector.project(game.renderSystem.camera);
            const rect = game.renderSystem.renderer.domElement.getBoundingClientRect();
            return { x: rect.left + (vector.x + 1) * rect.width / 2, y: rect.top + (1 - vector.y) * rect.height / 2 };
        }, id);
        await page.mouse.click(point.x, point.y);
        try {
            await expect(page.locator('#quest-window')).toBeVisible({ timeout: 20000 });
        } catch (error) {
            const diagnostic = await page.evaluate(({ id, point }) => {
                const game = window.game, npc = game.remotePlayers.get(id);
                const hit = document.elementFromPoint(point.x, point.y);
                return { point, hitElement: { id: hit?.id, tag: hit?.tagName, className: hit?.className },
                    player: { position: game.player.position, target: game.player.targetPosition, state: game.player.state },
                    npc: { position: npc?.position, mesh: npc?.mesh?.position, type: npc?.type, active: npc?.isActive },
                    pending: game.pendingInteraction?.id, hovered: game.hoveredEntity?.id };
            }, { id, point });
            throw new Error(`Quest NPC click did not open dialogue: ${JSON.stringify(diagnostic)}`, { cause: error });
        }
    };
    await talk('story-wizard-1');
    await expect(page.locator('#quest-window')).toContainText('ARCHMAGE ILYRA');
    await expect(page.locator('#quest-window')).toContainText('save Eidolon');
    await page.locator('#quest-window').getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.quests.find((quest) => quest.category === 'chronicle').accepted)).toBe(true);
    await expect(page.locator('#quest-window')).toContainText('Return to Archmage Ilyra');
    await expect.poll(() => page.evaluate(() => window.game.remotePlayers.get('story-wizard-1').markerSymbol)).toBe('');
    await page.locator('#btn-close-quest').click();
    await moveByGroundClick(page, -16, -12, { allowJumpFallback: false });
    await expect.poll(() => page.evaluate(() => window.game.player.state), { timeout: 10000 }).toBe('IDLE');
    await talk('quest-npc-1');
    await expect(page.locator('#quest-window')).toContainText('DAILY CONTRACTS');
    await expect(page.locator('#quest-window')).not.toContainText('The Bell That Rang Below');
    await page.locator('.quest-contract').filter({ hasText: 'Skeleton' }).first().click();
    await page.locator('#quest-window').getByRole('button', { name: 'Accept Quest', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.game.player.quests.find((quest) => quest.id === 'daily_skeleton').accepted)).toBe(true);
    await page.locator('#btn-close-quest').click();
    await page.locator('#chat-input').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#chat-box')).toBeVisible();
    // Inspect the fully loaded town, including any legacy colliders, rather
    // than testing only isolated building factories.
    const town = await page.evaluate(() => {
        const { collisionManager, player } = window.game;
        const blocked = (x, z) => Boolean(collisionManager.checkCollision(player.position.clone().set(x, 0, z), player.radius));
        return {
            orientedShapes: collisionManager.orientedColliders.length,
            tradingCornerBlocked: blocked(-14, 193),
            stashApproachBlocked: blocked(0, 180.5),
            hallWallBlocked: blocked(0, 177.5),
            cofferBlocked: blocked(0, 185)
        };
    });
    expect(town).toEqual({ orientedShapes: 3, tradingCornerBlocked: false, stashApproachBlocked: false, hallWallBlocked: true, cofferBlocked: true });
    expect(failures, failures.join('\n')).toEqual([]);
});
