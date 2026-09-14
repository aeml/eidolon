import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { credentialsFromEnvironment, loginAndEnterWorld, openGame, moveByGroundClick, readPlayerState, collectBrowserFailures, exerciseReconnect } from './helpers.js';

const credentials = credentialsFromEnvironment();
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

async function prepareCasinoAccount(page, login) {
    const container = process.env.EIDOLON_E2E_CASINO_MONGO_CONTAINER;
    const port = process.env.EIDOLON_E2E_CASINO_MONGO_PORT;
    if (!/^eidolon-isolated-qa-mongo-[a-z0-9_.-]+$/.test(container || '') || !/^\d+$/.test(port || '') ||
        process.env.EIDOLON_E2E_REGISTER !== '1' || !/^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(process.env.EIDOLON_E2E_WS_URL || '')) {
        throw new Error('Casino wagering QA requires an explicitly owned disposable loopback database');
    }
    await openGame(page);
    await page.locator('#auth-username').fill(login.username);
    await page.locator('#auth-password').fill(login.password);
    await page.locator('#auth-email').fill(`${login.username}@example.invalid`);
    await page.locator('#btn-register').click();
    await expect(page.locator('#auth-status')).toContainText('Registration successful');
    // Prepared bankroll, not earned progression. Initialize only a newly
    // registered account BEFORE it has a live character; never top up a hand.
    const character = { name: login.username, class: 'Fighter', level: 1, progression_version: 2,
        xp: 0, gold: 1000, x: -1.25, y: 0, z: 200,
        stats: { strength: 10, dexterity: 10, intelligence: 10, wisdom: 10, vitality: 10 } };
    const script = `
        if (!db.getSiblingDB('admin').auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD)) throw Error('Fixture auth failed');
        const r = db.getSiblingDB('eidolon').users.updateOne(
            { username: ${JSON.stringify(login.username)}, 'characters.0': { $exists: false } },
            { $set: { characters: [${JSON.stringify(character)}] } });
        if (r.matchedCount !== 1 || r.modifiedCount !== 1) throw Error('Requires one newly registered empty account');
    `;
    try {
        execFileSync('docker', ['exec', '-i', container, 'mongosh', '--quiet', '--port', port, '--file', '/dev/stdin'],
            { input: script, stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000 });
    } catch { throw new Error('Could not initialize disposable casino bankroll'); }
    await loginAndEnterWorld(page, login);
    await expect.poll(() => page.evaluate(() => window.game.player.gold)).toBe(1000);
}

test('shared casino entry, physical blackjack seats, paid hand, clean exit and VIP guard', async ({ page, context, baseURL }, testInfo) => {
    test.skip(!credentials.username, 'Requires disposable character QA');
    test.setTimeout(300000);
    const failures = collectBrowserFailures(page, baseURL);
    const readGold = target => target.evaluate(() => window.game.player.gold);
    const walkTo = async (target, z, x = 0) => {
        for (let step = 0; step < 18; step++) {
            const current = await readPlayerState(target);
            const dx = x - current.x, dz = z - current.z, distance = Math.hypot(dx, dz);
            if (distance < 2) return;
            const scale = Math.min(1, 6 / distance);
            await moveByGroundClick(target, dx * scale, dz * scale, { allowAlternatePaths: false });
            await expect.poll(() => target.evaluate(() => window.game.player.targetPosition === null)).toBe(true);
        }
        throw new Error('Casino aisle route did not reach its destination');
    };
    const enter = async target => {
        await walkTo(target, 184);
        await target.waitForTimeout(350); // Let the follow camera finish the movement before projecting the door.
        const door = await target.evaluate(() => {
            const game = window.game;
            const mesh = game.renderSystem.scene.getObjectByName('casino-town-door');
            const point = mesh.position.clone(); mesh.parent.localToWorld(point);
            point.project(game.renderSystem.camera);
            const rect = game.renderSystem.renderer.domElement.getBoundingClientRect();
            return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 };
        });
        await target.mouse.click(door.x, door.y);
        // Veyra's wardrobe shares the presentation class but is a different,
        // closed dialog. Select the entrance controller, not both components.
        const dialogue = target.locator('.casino-entry-dialogue:not(.cosmetic-vendor)');
        await expect(dialogue).toBeVisible().catch(async error => {
            await target.screenshot({ path: '/tmp/eidolon-casino-door-diagnostic.png' });
            const detail = await target.evaluate(point => ({ position: window.game.player.position.toArray(),
                pending: window.game.casino.pendingDoor, surface: document.elementFromPoint(point.x, point.y)?.outerHTML.slice(0, 250) }), door);
            throw new Error(`Casino door: ${JSON.stringify(detail)}`, { cause: error });
        });
        await dialogue.getByRole('button', { name: 'Enter Casino', exact: true }).click();
        await expect.poll(() => target.evaluate(() => window.game?.currentInstanceId)).toBe('lanternhold-casino');
        await expect.poll(() => target.evaluate(() => Boolean(window.game?.renderSystem.scene.getObjectByName('casino-vip-guard')))).toBe(true);
        await expect.poll(() => target.evaluate(() => window.game.renderSystem.staticEnvironmentGroup.visible)).toBe(false);
    };
    await prepareCasinoAccount(page, credentials);
    await enter(page);
    await expect.poll(() => page.evaluate(() => window.game.casino.data.tables.filter(table => table.floor === 'public').length)).toBe(10);
    const initialGold = await readGold(page);
    const other = await context.newPage();
    const otherFailures = collectBrowserFailures(other, baseURL);
    await prepareCasinoAccount(other, { ...credentials, username: `${credentials.username}-casino-guest` });
    await enter(other);
    await expect.poll(() => page.evaluate(() => window.game.remotePlayers.size)).toBeGreaterThan(0);
    expect(await other.evaluate(() => window.game.currentInstanceId)).toBe(await page.evaluate(() => window.game.currentInstanceId));
    await exerciseReconnect(other);
    await expect.poll(() => other.evaluate(() => window.game.currentInstanceId)).toBe('lanternhold-casino');

    // Extend this connected route, not the mocked seating fixture: actual chair
    // clicks, server wagers/deal/settlement, and ordinary Gold with no top-ups.
    const players = [page, other];
    const balances = await Promise.all(players.map(readGold));
    for (const balance of balances) {
        expect(Number.isSafeInteger(balance)).toBe(true);
        expect(balance).toBeGreaterThanOrEqual(100);
    }
    const savedViews = await Promise.all(players.map(target => target.evaluate(() => ({
        locked: window.game.cameraLocked, zoom: window.game.renderSystem.camera.zoom
    }))));
    const readHand = target => target.evaluate(() => window.game.casino.blackjack.view);
    for (const [seat, target] of players.entries()) {
        await target.bringToFront();
        await walkTo(target, 183);
        const approach = await target.evaluate(index => window.game.casino.data.tables
            .find(table => table.id === 'public-blackjack').seats[index], seat);
        await walkTo(target, 183, approach.exitX);
        await target.waitForTimeout(350);
        const point = await target.evaluate(index => {
            const game = window.game;
            const chair = game.casino.furniture.getObjectByName(`public-blackjack-seat-${index}`);
            const position = chair.position.clone(); chair.parent.localToWorld(position);
            position.y += 1.4; position.project(game.renderSystem.camera);
            const rect = game.renderSystem.renderer.domElement.getBoundingClientRect();
            return { x: rect.left + (position.x + 1) * rect.width / 2, y: rect.top + (1 - position.y) * rect.height / 2 };
        }, seat);
        await target.mouse.click(point.x, point.y);
        await expect.poll(() => target.evaluate(() => window.game.casino.data.yourSeat?.seat), { timeout: 20000 }).toBe(seat);
        await expect(target.locator('.casino-session.has-blackjack')).toBeVisible();
        await expect.poll(() => target.evaluate(() => window.game.player.casinoSeated)).toBe(true);
    }
    const ids = await Promise.all(players.map(target => target.evaluate(() => window.game.player.id)));
    for (const target of players) {
        await expect(target.locator('.blackjack-scene .card-table-seat:not(.empty)')).toHaveCount(2);
        await expect(target.locator('.blackjack-scene .card-table-dealer')).toBeVisible();
    }
    await expect.poll(async () => {
        const hands = await Promise.all(players.map(readHand));
        return hands.every(hand => hand?.phase === 'betting' && hand.roundId === hands[0].roundId
            && Date.parse(hand.dealAt) - Date.parse(hand.serverNow) > 12000);
    }, { timeout: 40000 }).toBe(true);
    await page.bringToFront();
    const countdown = await page.evaluate(async () => {
        const samples = [], end = performance.now() + 2300;
        do {
            const value = Number.parseInt(document.querySelector('.blackjack-scene [role="timer"] strong').textContent, 10);
            if (samples.at(-1) !== value) samples.push(value);
            await new Promise(resolve => setTimeout(resolve, 100));
        } while (performance.now() < end);
        return samples;
    });
    expect(countdown.length).toBeGreaterThanOrEqual(3);
    for (let index = 1; index < countdown.length; index++) expect(countdown[index - 1] - countdown[index]).toBe(1);
    const roundId = (await readHand(page)).roundId;
    const tableNode = await page.locator('.blackjack-scene').elementHandle();
    for (const target of players) await target.getByRole('button', { name: 'Bet · 100 Gold', exact: true }).click();
    for (const [index, target] of players.entries()) {
        await expect.poll(async () => (await readHand(target)).players.length).toBe(2);
        await expect.poll(() => readGold(target)).toBe(balances[index] - 100);
    }
    await expect.poll(async () => (await readHand(page)).phase, { timeout: 40000 }).toMatch(/^(playing|complete)$/);
    for (let turn = 0; turn < 4; turn++) {
        const hand = await readHand(page);
        if (hand.phase === 'complete') break;
        expect(hand.roundId).toBe(roundId);
        const index = ids.indexOf(hand.round.turnPlayerId);
        expect(index).toBeGreaterThanOrEqual(0);
        const target = players[index];
        await target.bringToFront();
        await expect.poll(async () => (await readHand(target)).round?.revision).toBe(hand.round.revision);
        expect((await readHand(target)).round.players.map(player => player.hands.map(held => held.cards)))
            .toEqual(hand.round.players.map(player => player.hands.map(held => held.cards)));
        await expect(target.getByRole('button', { name: 'Stand', exact: true })).toBeEnabled();
        await expect(target.locator('.blackjack-scene .casino-hand-value')).toHaveCount(3);
        await target.getByRole('button', { name: 'Stand', exact: true }).click();
        await expect.poll(async () => {
            const next = await readHand(page);
            return next.phase === 'complete' || next.phase === 'playing' && next.round.revision > hand.round.revision;
        }).toBe(true);
    }
    await expect.poll(async () => (await readHand(page)).phase).toBe('complete');
    const settled = await readHand(page);
    expect(settled.roundId).toBe(roundId);
    expect(settled.round.dealerHidden).toBe(false);
    const expectedBalances = ids.map((id, index) => balances[index] - 100
        + settled.round.players.find(player => player.playerId === id).hands.reduce((sum, hand) => sum + hand.payout, 0));
    for (const [index, target] of players.entries()) {
        await expect.poll(() => readGold(target)).toBe(expectedBalances[index]);
        await expect(target.locator('.blackjack-scene .card-table-seat:not(.empty)')).toHaveCount(2);
    }
    expect(await tableNode.evaluate(node => node === document.querySelector('.blackjack-scene'))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('connected-blackjack-result.png') });
    await expect.poll(async () => (await readHand(page)).phase, { timeout: 40000 }).toBe('betting');
    await page.getByLabel('Wager (Gold)').fill('200');
    await expect(page.getByRole('button', { name: 'Bet · 200 Gold', exact: true })).toBeEnabled();
    // Changing the next wager must not spend it. Leave normally and check the
    // camera/control state plus an actual reconnect, without fabricating cards.
    for (const [index, target] of players.entries()) {
        await target.getByRole('button', { name: 'Leave table', exact: true }).click();
        await expect(target.locator('.casino-session')).toBeHidden();
        expect(await target.evaluate(() => ({ locked: window.game.cameraLocked,
            zoom: window.game.renderSystem.camera.zoom }))).toEqual(savedViews[index]);
        expect(await readGold(target)).toBe(expectedBalances[index]);
    }
    await exerciseReconnect(other);
    expect(await readGold(other)).toBe(expectedBalances[1]);
    console.log('[casino-connected] shared blackjack settled', JSON.stringify({ roundId, initial: balances, final: expectedBalances }));
    await page.bringToFront();
    await walkTo(page, 183, -18);
    await walkTo(page, 183);
    await page.bringToFront(); // Exercise the player's active tab, not background-throttled rendering.
    // Actual movement inputs down the central aisle, not a scene-position teleport.
    await walkTo(page, 154);
    await expect(page.getByRole('button', { name: 'Talk to VIP Guard', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Talk to VIP Guard', exact: true }).click();
    const guardDialogue = page.locator('.casino-entry-dialogue:not(.cosmetic-vendor)');
    await expect(guardDialogue).toContainText('You must be a VIP to enter');
    await page.screenshot({ path: '/tmp/eidolon-casino-guard-20260913.png' });
    await guardDialogue.getByRole('button', { name: 'Close', exact: true }).click();
    await page.screenshot({ path: '/tmp/eidolon-casino-interior-20260913.png' });
    expect(await readGold(page)).toBe(expectedBalances[0]);
    expect(initialGold).toBe(balances[0]);
    await page.keyboard.press('b');
    await expect.poll(() => page.evaluate(() => window.game.currentInstanceType)).toBe('overworld');
    await expect.poll(() => page.evaluate(() => window.game.renderSystem.staticEnvironmentGroup.visible)).toBe(true);
    expect(await other.evaluate(() => window.game.currentInstanceId)).toBe('lanternhold-casino');
    await other.close();
    expect(failures).toEqual([]);
    expect(otherFailures).toEqual([]);
});
