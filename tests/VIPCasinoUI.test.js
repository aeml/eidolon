import { jest } from '@jest/globals';
import * as THREE from 'three';
import { BlackjackTableUI } from '../src/ui/BlackjackTableUI.js';
import { PokerTableUI } from '../src/ui/PokerTableUI.js';
import { SlotMachineUI } from '../src/ui/SlotMachineUI.js';
import { CollisionManager } from '../src/core/CollisionManager.js';
import { createCasinoFurniture, disposeCasinoObject } from '../src/art/ProceduralCasino.js';

test.each(['blackjack', 'poker', 'slots'])('%s uses EP balance and limits, never the available Gold', kind => {
    const send = jest.fn();
    const UI = { blackjack: BlackjackTableUI, poker: PokerTableUI, slots: SlotMachineUI }[kind];
    const ui = new UI(send);
    const view = { available: true, currency: 'ep', balance: 0, gold: 100000, roundId: 'vip-hand', phase: 'betting', players: [],
        minBet: kind === 'blackjack' ? 2 : 10, maxBet: 100, betStep: kind === 'blackjack' ? 2 : 10,
        minBuyIn: 10, maxBuyIn: 100, buyInStep: 10, smallBlind: 1, bigBlind: 2,
        machine: { theme: 'earth', lore: 'The Sovereign Vault', mechanic: 'Rooted wilds.', symbols: ['Seed','Fern','Amber','Roadward','Rootheart','Orun','Root','Key'], weights: [24,20,16,12,10,8,5,5], pays: Array.from({length:6},()=>[5,14,26]), freeSpins: 5 },
        lines: Array.from({length:10},()=>[1,1,1,1,1]), session: { revision: 1, bet: 10, freeSpins: 0, bonus: false } };
    try {
        ui.update(view, 'hero');
        expect(ui.root.textContent).not.toContain('Gold');
        expect(ui.root.textContent).toContain('EP');
        const button = ui.bet || ui.buy || ui.spin;
        button.click(); expect(send).not.toHaveBeenCalled();
        ui.update({ ...view, balance: 100 }, 'hero');
        ui.stake.value = '110'; button.click(); expect(send).not.toHaveBeenCalled();
        ui.stake.value = '100'; button.click(); expect(send).toHaveBeenCalledTimes(1);
        expect(send.mock.calls[0][0].bet).toBe(100);
    } finally { ui.dispose(); }
});

test('upper furniture, click proxies and containment agree at eight units', () => {
    const furniture = createCasinoFurniture([{ id:'vip-blackjack', floor:'vip', game:'blackjack', x:-14,y:8,z:137,
        seats:[{x:-14,y:8,z:139.2,rotation:Math.PI,exitX:-14,exitZ:140.4}] }]);
    try {
        furniture.updateWorldMatrix(true,true);
        expect(furniture.userData.seats[0].getWorldPosition(new THREE.Vector3()).y).toBe(8);
        expect(furniture.userData.seats[0].userData.casinoSeat.floor).toBe('vip');
        const collision = new CollisionManager(); collision.casinoInterior = true; collision.casinoVIPFloor = true;
        const rear = collision.checkCollision(new THREE.Vector3(0,100,160),.5,new THREE.Vector3(0,8,140));
        expect(rear.toArray()).toEqual([0,8,141]);
        const gallery = collision.checkCollision(new THREE.Vector3(10,0,180),.5,new THREE.Vector3(29,8,180));
        expect(gallery.toArray()).toEqual([26,8,180]);
        collision.casinoVIPFloor = false;
        expect(collision.checkCollision(new THREE.Vector3(0,8,140),.5).toArray()).toEqual([0,0,148]);
    } finally { disposeCasinoObject(furniture); }
});
