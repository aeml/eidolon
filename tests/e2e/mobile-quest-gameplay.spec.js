import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld, projectEntity } from './helpers.js';
import { approachEncounter, selectLiveTarget } from './mobile-helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

async function walkToIlyra(page, context) {
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('#joystick-zone').boundingBox();
    let started = false;
    try {
        await expect.poll(async () => {
            const delta = await page.evaluate(() => {
                const player = window.game.player.position;
                return { x: 17 - player.x, z: 215 - player.z };
            });
            if (Math.hypot(delta.x, delta.z) < 1.5) return true;
            const jx = delta.x - delta.z, jy = delta.x + delta.z;
            const length = Math.hypot(jx, jy);
            await cdp.send('Input.dispatchTouchEvent', { type: started ? 'touchMove' : 'touchStart', touchPoints: [
                { id: 81, x: box.x + box.width / 2 + 32 * jx / length, y: box.y + box.height / 2 + 32 * jy / length }
            ] });
            started = true;
            return false;
        }, { timeout: 20_000, intervals: [100] }).toBe(true);
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    }
    await expect.poll(() => page.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBe(0);
    const point = await projectEntity(page, 'story-wizard-1');
    expect(point?.visible, 'Ilyra is visible at the default phone camera framing').toBe(true);
    await page.touchscreen.tap(point.x, point.y);
    await expect(page.locator('#quest-window')).toBeVisible();
}

test('phone player earns the first Chronicle objective and explicitly claims Ilyra’s reward', async ({ page, context, baseURL }) => {
    const credentials = credentialsFromEnvironment();
    test.skip(!credentials.username || !credentials.password || process.env.EIDOLON_E2E_REGISTER !== '1', 'Requires a fresh disposable character');
    test.setTimeout(360_000);
    const failures = collectBrowserFailures(page, baseURL);
    await loginAndEnterWorld(page, credentials);
    expect(await page.evaluate(() => window.game.isMobile)).toBe(true);
    await walkToIlyra(page, context);
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).tap();
    const questState = () => page.evaluate(() => {
        const quest = window.game.player.quests.find(q => q.id === 'chronicle_01_bell_below');
        return { accepted: quest?.accepted, count: quest?.count, completed: quest?.completed };
    });
    await expect.poll(async () => (await questState()).accepted).toBe(true);
    await page.locator('#btn-close-quest').tap();
    // Explicit combat setup only: level 30 and a normal encounter waypoint.
    // No granted kill, quest progress or reward. This is not first-hour balance evidence.
    await page.locator('#chat-mobile-toggle').tap();
    await page.locator('#chat-input').fill('/level 30');
    await page.locator('#chat-input').press('Enter');
    await expect.poll(() => page.evaluate(() => window.game.player.level)).toBe(30);
    await page.locator('#chat-mobile-toggle').tap();
    for (let attempt = 0; (await questState()).count < 3 && attempt < 10; attempt++) {
        await approachEncounter(page);
        const target = await selectLiveTarget(page);
        await page.locator('#btn-mobile-attack').tap();
        await expect.poll(() => page.evaluate(id => {
            const enemy = window.game.chunkManager.getActiveEntities().find(e => e.id === id);
            return !enemy || enemy.state === 'DEAD';
        }, target.id), { timeout: 35_000 }).toBe(true);
    }
    await expect.poll(async () => (await questState()).count).toBe(3);
    expect((await questState()).completed).toBe(false);
    console.log('[phone-quests] three ordinary combat kills credited; quest remains unclaimed');
    await page.locator('#btn-mobile-menu').tap();
    await page.locator('#btn-recall').tap();
    await expect.poll(() => page.evaluate(() => {
        const game = window.game;
        return !game.currentInstanceId && Math.hypot(game.player.position.x + 1.25, game.player.position.z - 200) < 3;
    }), { timeout: 30_000 }).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await walkToIlyra(page, context);
    await expect.poll(() => page.evaluate(() => window.game.remotePlayers.get('story-wizard-1').markerSymbol)).toBe('?');
    const before = await page.evaluate(() => ({ gold: window.game.player.gold, xp: window.game.player.xp }));
    const complete = page.getByRole('button', { name: 'Complete Quest', exact: true });
    await expect(complete).toBeInViewport();
    expect(await page.evaluate(() => window.game.ensureMovementNetworkState().recoveryContext)).toBeTruthy();
    expect((await questState()).completed).toBe(false);
    await page.evaluate(() => {
        const ui = window.game.uiManager.quest;
        const complete = ui.onCompleteQuest;
        window.__phoneCompletionRequests = [];
        ui.onCompleteQuest = id => { window.__phoneCompletionRequests.push(id); complete(id); };
    });
    await complete.tap();
    try {
        await expect.poll(async () => (await questState()).completed).toBe(true);
    } catch (error) {
        console.log('[phone-quests] turn-in diagnostic', JSON.stringify(await page.evaluate(() => {
            const game = window.game, ui = game.uiManager.quest;
            return { position: game.player.position.toArray(), state: game.player.state,
                movement: { multiplayer: game.isMultiplayer, next: game.movementNetworkState?.nextSequence,
                    ack: game.movementNetworkState?.lastAcknowledgedSequence, last: game.movementNetworkState?.lastPacket,
                    serverPosition: game.movementNetworkState?.lastAcknowledgedServerPosition,
                    sent: game.movementTelemetry?.packetsSent },
                quest: game.player.quests.find(q => q.id === 'chronicle_01_bell_below'),
                pending: ui.pendingQuestAction, error: ui.questActionError,
                buttons: [...document.querySelectorAll('.phone-quest-actions button')].map(b => ({ text: b.textContent, disabled: b.disabled })),
                requests: window.__phoneCompletionRequests, windowOpen: ui.isQuestWindowOpen, speaker: ui.questKind };
        })));
        throw error;
    }
    await expect(page.locator('#quest-list')).toContainText('QUEST COMPLETE');
    await expect(page.locator('#quest-list')).toContainText('I once called him a fellow keeper');
    await expect.poll(() => page.evaluate(() => window.game.player.gold)).toBeGreaterThan(before.gold);
    await expect.poll(() => page.evaluate(() => window.game.player.xp)).toBeGreaterThan(before.xp);
    await page.getByRole('button', { name: 'Continue conversation', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Accept Quest', exact: true })).toBeVisible();
    console.log('[phone-quests] landscape manual turn-in acknowledged with gold, XP, Ilyra’s reply and next chapter');
    await page.locator('#btn-close-quest').tap();
    await page.reload({ waitUntil: 'networkidle' });
    await loginAndEnterWorld(page, credentials);
    expect((await questState()).completed).toBe(true);
    // Recovery context must also survive a resumed transport (or reset cleanly
    // with a newly joined entity); client-only movement is insufficient proof.
    const cdp = await context.newCDPSession(page);
    const stick = await page.locator('#joystick-zone').boundingBox();
    const beforeMove = await page.evaluate(() => window.game.player.position.toArray());
    try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
            { id: 82, x: stick.x + stick.width / 2 - 24, y: stick.y + stick.height / 2 }
        ] });
        await expect.poll(() => page.evaluate(before => Math.hypot(window.game.player.position.x - before[0],
            window.game.player.position.z - before[2]), beforeMove)).toBeGreaterThan(1);
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    }
    await expect.poll(() => page.evaluate(() => {
        const game = window.game, server = game.movementNetworkState?.lastAcknowledgedServerPosition;
        return server ? Math.hypot(game.player.position.x - server.x, game.player.position.z - server.z) : Infinity;
    })).toBeLessThan(0.5);
    expect(failures, failures.join('\n')).toEqual([]);
});
