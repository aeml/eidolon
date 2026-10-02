import { expect, test } from '@playwright/test';
import { collectBrowserFailures } from './helpers.js';

// Native UI and request-shape fixture; simulated time, not a live wager or phone certification.
for (const width of [390, 1440]) test(`${width}px: voluntary casino limit preserves funded decisions and explicit restart`, async ({ page, baseURL }, testInfo) => {
    const failures = collectBrowserFailures(page, baseURL);
    await page.setViewportSize({ width, height: 844 });
    await page.routeWebSocket(/\/ws(?:\?|$)/, () => {});
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
        const THREE = await import('three');
        const { CasinoController } = await import('/src/core/CasinoController.js');
        document.getElementById('start-screen').style.display = 'none';
        document.querySelectorAll('canvas').forEach(canvas => { canvas.hidden = true; });
        const sent = [], camera = new THREE.OrthographicCamera();
        const engine = { currentInstanceId: 'lanternhold-casino', cameraLocked: true,
            player: { id: 'hero', position: new THREE.Vector3(), state: 'IDLE' },
            network: { socket: { readyState: WebSocket.OPEN }, send(type, payload) { sent.push({ type, payload }); } },
            inputManager: { clearInputState() {} }, renderSystem: { camera, cameraTarget: new THREE.Vector3(), scene: new THREE.Scene(), setCameraTarget() {} } };
        const controller = new CasinoController(engine), table = { id: 'public-blackjack', name: 'Lanternhold Blackjack', floor: 'public', game: 'blackjack',
            x: 0, z: 170, seats: [{ x: 0, z: 172, rotation: 0, exitX: 0, exitZ: 173 }] };
        controller.updateState({ tables: [table], yourSeat: { tableId: table.id, seat: 0, sessionId: 'local-fixture-seat', exitX: 0, exitZ: 173 },
            occupants: [{ playerId: 'hero', name: 'Hero', connected: true, tableId: table.id, seat: 0 }],
            blackjack: { available: true, processing: false, phase: 'betting', roundId: 'fixture-round', currency: 'gold',
                balance: 1000, gold: 1000, minBet: 100, maxBet: 100000, betStep: 100, players: [] } });
        let clock = 0; controller.playControls.now = () => clock;
        window.__casinoPlay = { controller, sent, setClock(seconds) { clock = seconds * 1000; controller.playControls.tick(); } };
    });
    const controls = page.getByRole('region', { name: 'Voluntary casino play controls' });
    await expect(controls.getByRole('button', { name: 'Take a break' })).toBeVisible();
    await controls.getByText('Play-time limit & safety', { exact: true }).click();
    await controls.getByLabel('Stop new play after').selectOption('15');
    await controls.getByRole('button', { name: 'Apply time limit' }).click();
    await expect(controls).toContainText('15:00');
    await expect(controls).toContainText('not an account lock');
    await controls.getByText('Play-time limit & safety', { exact: true }).click();
    await page.evaluate(() => window.__casinoPlay.setClock(1)); await expect(controls).toContainText('14:59');
    await page.evaluate(() => window.__casinoPlay.setClock(2)); await expect(controls).toContainText('14:58');
    await page.evaluate(() => window.__casinoPlay.setClock(900)); await expect(controls).toContainText('limit is reached');
    await page.getByRole('button', { name: 'Bet · 100 Gold', exact: true }).click();
    await expect(page.locator('.blackjack-game')).toContainText('New play is paused');
    expect(await page.evaluate(() => window.__casinoPlay.sent.length)).toBe(0);
    await page.evaluate(() => {
        const ui = window.__casinoPlay.controller.blackjack;
        ui.update({ available: true, processing: false, phase: 'playing', roundId: 'funded-round', currency: 'gold', balance: 900,
            players: [{ playerId: 'hero', name: 'Hero', seat: 0, bet: 100 }],
            round: { revision: 1, dealer: [9], dealerHidden: true, turnPlayerId: 'hero', turnHand: 0,
                deadline: new Date(Date.now() + 30000).toISOString(), actions: ['hit', 'stand'],
                players: [{ playerId: 'hero', seat: 0, hands: [{ cards: [7, 20], bet: 100 }] }] } }, 'hero', ui.presence);
    });
    await expect(page.getByRole('button', { name: 'Stand', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Dealer hidden card', { exact: true })).toBeVisible();
    expect(await page.locator('.card-table-seat.own .casino-hand-value').evaluate(element => {
        const value = element.getBoundingClientRect(), hands = element.closest('.card-table-seat-hands').getBoundingClientRect();
        return value.bottom <= hands.bottom + 1 && value.top >= hands.top - 1;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`casino-limit-funded-${width}.png`) });
    expect(await controls.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Stand', exact: true }).click();
    expect(await page.evaluate(() => window.__casinoPlay.sent.map(message => message.payload.action))).toEqual(['play']);
    await controls.getByRole('button', { name: 'Start new session' }).click();
    await expect(controls).toContainText('15:00');
    expect(await page.evaluate(() => window.__casinoPlay.sent.length)).toBe(1);
    await page.evaluate(() => {
        const controller = window.__casinoPlay.controller;
        const ui = controller.blackjack;
        ui.update({ available: true, processing: false, phase: 'betting', roundId: 'next-fixture-round', currency: 'gold',
            balance: 1000, minBet: 100, maxBet: 100000, betStep: 100, players: [] }, 'hero', ui.presence);
        controller.engine.network.socket.readyState = WebSocket.CLOSED;
    });
    await page.getByRole('button', { name: 'Bet · 100 Gold', exact: true }).click();
    await expect(page.locator('.blackjack-game')).toContainText('No request was sent');
    await expect(page.getByRole('button', { name: 'Bet · 100 Gold', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => window.__casinoPlay.sent.length)).toBe(1);
    await page.evaluate(() => { window.__casinoPlay.controller.engine.network.socket.readyState = WebSocket.OPEN; });
    expect(await page.evaluate(() => window.__casinoPlay.sent.length)).toBe(1);
    await page.getByRole('button', { name: 'Bet · 100 Gold', exact: true }).click();
    expect(await page.evaluate(() => window.__casinoPlay.sent.map(message => message.payload.action))).toEqual(['play', 'bet']);
    await page.getByRole('button', { name: 'Leave table', exact: true }).click();
    expect(await page.evaluate(() => window.__casinoPlay.sent.map(message => message.payload.action))).toEqual(['play', 'bet', 'leave']);
    await page.evaluate(() => window.__casinoPlay.controller.dispose());
    expect(failures, failures.join('\n')).toEqual([]);
});
