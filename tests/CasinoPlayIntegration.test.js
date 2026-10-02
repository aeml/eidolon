import { jest } from '@jest/globals';
import * as THREE from 'three';
import { CasinoController } from '../src/core/CasinoController.js';

function setup() {
    const engine = { currentInstanceId: 'lanternhold-casino', player: { id: 'hero', state: 'IDLE', position: new THREE.Vector3() },
        network: { send: jest.fn(), socket: { readyState: WebSocket.OPEN } },
        renderSystem: { camera: new THREE.OrthographicCamera(), cameraTarget: new THREE.Vector3(), scene: new THREE.Scene(), setCameraTarget: jest.fn() },
        inputManager: { clearInputState: jest.fn() } };
    const controller = new CasinoController(engine);
    controller.playControls.setContext('hero', true);
    controller.data.yourSeat = { tableId: 'public-blackjack', sessionId: 'private-seat' };
    return { engine, controller };
}

test('the controller rejects new-round requests locally but keeps funded actions and recovery available', () => {
    const { engine, controller } = setup(); controller.playControls.pause.click();
    for (const action of ['bet', 'poker_buy_in', 'house_bet', 'slot_spin']) {
        expect(controller.send({ action, roundId: 'round' })).toBe(false);
    }
    expect(engine.network.send).not.toHaveBeenCalled();
    for (const action of ['play', 'poker_play', 'slot_bonus', 'leave', 'get']) controller.send({ action });
    expect(engine.network.send).toHaveBeenCalledTimes(5);
    expect(engine.network.send).toHaveBeenCalledWith('casino', { action: 'play', sessionId: 'private-seat' });
    controller.dispose();
});

test('an opening blackjack bet rejected by a voluntary break clears its pending buttons immediately', () => {
    const { engine, controller } = setup();
    controller.blackjack.update({ available: true, processing: false, phase: 'betting', roundId: 'round', currency: 'gold',
        gold: 1000, balance: 1000, minBet: 100, maxBet: 100000, betStep: 100, players: [] }, 'hero');
    controller.playControls.pause.click(); controller.blackjack.submit({ action: 'bet', roundId: 'round', bet: 100 });
    expect(engine.network.send).not.toHaveBeenCalled();
    expect(controller.blackjack.pendingKey).toBeNull();
    expect(controller.blackjack.summary.textContent).toContain('New play is paused');
    expect(controller.blackjack.summary.textContent).not.toContain('Connection'); controller.dispose();
});

test('a voluntary rejection clears house and slot pending states without claiming a lost connection', () => {
    const { engine, controller } = setup(); controller.playControls.pause.click();
    controller.house.view = { roundId: 'house-round' }; controller.house.pending = true;
    controller.send({ action: 'house_bet', roundId: 'house-round', wagers: [{ spot: 'red', amount: 100 }] });
    expect(controller.house.pending).toBe(false); expect(controller.house.summary.textContent).toContain('New play is paused');
    controller.slots.view = { available: true, session: { freeSpins: 0 } };
    controller.slots.pending = { action: 'slot_spin', revision: 1 }; controller.slots.autoRemaining = 50;
    controller.send({ action: 'slot_spin', roundRevision: 1, bet: 20 });
    expect(controller.slots.pending).toBeNull(); expect(controller.slots.autoRemaining).toBe(0);
    expect(controller.slots.result.textContent).toContain('New play is paused');
    expect(engine.network.send).not.toHaveBeenCalled(); controller.dispose();
});

test('a funded free spin is sent while paused; missing saved state does not authorize a new paid spin', () => {
    const { engine, controller } = setup(); controller.playControls.pause.click();
    controller.slots.view = { available: true, session: { freeSpins: 1 } };
    controller.send({ action: 'slot_spin', roundRevision: 2, bet: 20 });
    expect(engine.network.send).toHaveBeenCalledTimes(1);
    controller.slots.view = null; expect(controller.send({ action: 'slot_spin' })).toBe(false);
    expect(engine.network.send).toHaveBeenCalledTimes(1); controller.dispose();
});

test('deadline checks stop an unstarted queue before sending even between rendered frames', () => {
    const { engine, controller } = setup(); let clock = 0;
    controller.playControls.now = () => clock; controller.playControls.minutes.value = '15'; controller.playControls.apply.click();
    controller.slots.autoRemaining = 100; clock = 900000;
    expect(controller.send({ action: 'bet', roundId: 'round', bet: 100 })).toBe(false);
    expect(controller.slots.autoRemaining).toBe(0); expect(engine.network.send).not.toHaveBeenCalled();
    controller.playControls.resume.click(); expect(controller.slots.autoRemaining).toBe(0);
    expect(engine.network.send).not.toHaveBeenCalled(); controller.dispose();
});

test('changing chair or floor cannot reset the pause; leaving the venue clears this browser visit', () => {
    const { engine, controller } = setup(); controller.playControls.pause.click();
    controller.floor = 'vip'; controller.data.yourSeat = { sessionId: 'other-chair' };
    expect(controller.send({ action: 'bet' })).toBe(false);
    engine.currentInstanceId = ''; controller.beforeUpdate(0);
    expect(controller.playControls.paused).toBe(false); expect(controller.playControls.limitMinutes).toBe(0);
    controller.dispose();
});
