import { devices, expect, test } from '@playwright/test';
import { collectBrowserFailures, credentialsFromEnvironment, loginAndEnterWorld } from './helpers.js';
import { approachEncounter, selectLiveTarget } from './mobile-helpers.js';
import { walkToIlyra } from './mobile-ilyra.js';
import { openPhoneNavigation } from './mobile-helpers.js';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
    userAgent: devices['Pixel 7'].userAgent, actionTimeout: 12_000,
    trace: 'off', screenshot: 'off', video: 'off' });

async function walkToPointByTouch(page, context, x, z) {
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('#joystick-zone').boundingBox();
    let started = false;
    try {
        await expect.poll(async () => {
            const delta = await page.evaluate(({ x, z }) => ({ x: x - window.game.player.position.x, z: z - window.game.player.position.z }), { x, z });
            const distance = Math.hypot(delta.x, delta.z);
            if (distance < 2) return true;
            const jx = delta.x - delta.z, jy = delta.x + delta.z, length = Math.hypot(jx, jy);
            const radius = 32 * Math.min(1, distance / 4);
            await cdp.send('Input.dispatchTouchEvent', { type: started ? 'touchMove' : 'touchStart', touchPoints: [
                { id: 85, x: box.x + box.width / 2 + radius * jx / length, y: box.y + box.height / 2 + radius * jy / length }
            ] });
            started = true;
            return false;
        }, { timeout: 35_000, intervals: [100] }).toBe(true);
    } catch (error) {
        console.log('[phone-diary-travel]', JSON.stringify(await page.evaluate(({ x, z }) => {
            const game = window.game;
            return { destination: [x, z], position: game.player.position.toArray(), state: game.player.state,
                joystick: game.inputManager.joystickVector.toArray(), health: game.player.health,
                nearby: game.activeEntitiesCache.filter(e => e !== game.player && e.position.distanceTo(game.player.position) < 8)
                    .map(e => ({ id: e.id, type: e.type, position: e.position.toArray(), state: e.state })),
                menu: game.uiManager.isEscMenuOpen, journal: game.uiManager.quest.isJournalOpen };
        }, { x, z })));
        throw error;
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    }
    await expect.poll(() => page.evaluate(() => window.game.inputManager.joystickVector.lengthSq())).toBe(0);
}

async function swipeJournal(page, context, direction) {
    const box = await page.locator('#journal-list').boundingBox();
    expect(box.height, 'Journal leaves room for a real reading gesture').toBeGreaterThan(60);
    const cdp = await context.newCDPSession(page);
    const start = direction === 'up' ? box.y + box.height - 16 : box.y + 16;
    const distance = (box.height - 32) * (direction === 'up' ? -1 : 1);
    try {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 86, x: box.x + box.width / 2, y: start }] });
        for (let step = 1; step <= 8; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
                { id: 86, x: box.x + box.width / 2, y: start + distance * step / 8 }
            ] });
            await page.waitForTimeout(30);
        }
    } finally {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    }
    await page.waitForTimeout(150);
}

async function diaryEndingIsReadable(record) {
    return record.evaluate(el => {
        const paragraph = el.lastElementChild, text = paragraph?.lastChild;
        if (text?.nodeType !== Node.TEXT_NODE) return false;
        // Check the actual final line inside the scrollport, not just text in
        // the DOM or the browser viewport beyond the clipped journal body.
        const range = document.createRange();
        range.setStart(text, Math.max(0, text.length - 12));
        range.setEnd(text, text.length);
        const line = range.getBoundingClientRect();
        const body = el.closest('#journal-list').getBoundingClientRect();
        return line.height > 0 && line.top >= body.top && line.bottom <= body.bottom &&
            paragraph.contains(document.elementFromPoint(line.x + line.width / 2, line.y + line.height / 2));
    });
}

test('phone player earns the first Chronicle objective and explicitly claims Ilyra’s reward', async ({ page, context, baseURL }, testInfo) => {
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

    // Continue the genuinely recorded first objective into the new diary. The
    // earlier level-30 fixture remains explicit: this is touch interaction QA,
    // not a claim about fresh-character balance or an unassisted first hour.
    await walkToIlyra(page, context);
    await page.getByRole('button', { name: 'Accept Quest', exact: true }).tap();
    const diary = () => page.evaluate(() => window.game.player.quests.find(q => q.id === 'chronicle_earth_keepers_house'));
    await expect.poll(async () => (await diary())?.accepted).toBe(true);
    await page.locator('#btn-close-quest').tap();
    await page.setViewportSize({ width: 390, height: 844 });
    await openPhoneNavigation(page, 'btn-recall');
    await expect.poll(() => page.evaluate(() => Math.hypot(window.game.player.position.x + 1.25, window.game.player.position.z - 200))).toBeLessThan(3);
    try {
        // The direct recall → east-gate line runs through the merchant's stall.
        // Follow the open south side of the square instead of pushing its wall.
        for (const [x, z] of [[0, 230], [55, 230], [80, 200], [105, 200], [140, 240], [150, 218]]) await walkToPointByTouch(page, context, x, z);
    } catch (error) {
        await page.screenshot({ path: testInfo.outputPath('phone-diary-travel-failure.png') });
        throw error;
    }
    await expect.poll(() => page.evaluate(() => {
        const game = window.game, site = game.remotePlayers.get('chronicle-site-mara_diary');
        return site ? game.player.position.distanceTo(site.position) : Infinity;
    })).toBeLessThan(5);
    await page.locator('#btn-mobile-interact').tap();
    const record = page.locator('#journal-list details[data-discovery-id="mara_diary"]');
    await expect(record).toHaveAttribute('open', '');
    await expect(record).toContainText('No living thing should have to kneel');
    expect((await diary()).completed).toBe(false);
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        await expect(page.locator('#btn-close-journal')).toBeInViewport();
        expect(await record.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        if (viewport.width > viewport.height) {
            // Start above the ending so the landscape check must actually
            // exercise touch scrolling, even if portrait left it in view.
            for (let swipe = 0; await diaryEndingIsReadable(record) && swipe < 8; swipe++) await swipeJournal(page, context, 'down');
            expect(await diaryEndingIsReadable(record), 'Landscape ending starts outside the reading area').toBe(false);
        }
        for (let swipe = 0; !await diaryEndingIsReadable(record) && swipe < 16; swipe++) await swipeJournal(page, context, 'up');
        await expect.poll(() => diaryEndingIsReadable(record), { message: 'Final diary line can be read using actual touch scrolling' }).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`earned-phone-diary-${viewport.width}.png`) });
    }
    await page.locator('#btn-close-journal').tap();
    await openPhoneNavigation(page, 'btn-recall');
    await expect.poll(() => page.evaluate(() => Math.hypot(window.game.player.position.x + 1.25, window.game.player.position.z - 200))).toBeLessThan(3);
    await walkToIlyra(page, context);
    await page.getByRole('button', { name: 'Complete Quest', exact: true }).tap();
    await expect.poll(async () => (await diary()).completed).toBe(true);
    await page.locator('#btn-close-quest').tap();
    await loginAndEnterWorld(page, credentials);
    expect((await diary()).investigationMask).toBe(1);
    expect((await diary()).completed).toBe(true);
    await openPhoneNavigation(page, 'btn-mobile-quest');
    await record.locator('summary').scrollIntoViewIfNeeded();
    if (await record.getAttribute('open') === null) await record.locator('summary').tap();
    await expect(record).toHaveAttribute('open', '');
    await expect(record).toContainText('No living thing should have to kneel');
    console.log('[phone-diary] joystick travel, USE inspection, journal in both orientations, manual completion and saved rereading passed');
    expect(failures, failures.join('\n')).toEqual([]);
});
