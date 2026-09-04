import { jest } from '@jest/globals';
import { DirectTradeUI } from '../src/ui/DirectTradeUI.js';

function buildDOM() {
    document.body.innerHTML = `
        <div id="direct-trade-window" style="display:none">
            <button id="btn-close-direct-trade"></button>
            <div id="direct-trade-status"></div>
            <h3 id="direct-trade-partner-title"></h3>
            <div id="direct-trade-own-items"></div>
            <div id="direct-trade-other-items"></div>
            <div id="direct-trade-other-gold"></div>
            <input id="direct-trade-gold" type="number" value="0">
            <button id="btn-direct-trade-offer"></button>
            <button id="btn-direct-trade-confirm"></button>
            <button id="btn-direct-trade-cancel"></button>
        </div>`;
}

describe('DirectTradeUI', () => {
    beforeEach(buildDOM);

    test('renders escrow, partner offer, and emits bounded final actions', () => {
        const player = { id: 'player-alice', inventory: [{ id: 'potion', name: 'Potion', stack: 2 }] };
        const ui = new DirectTradeUI({ getLastPlayer: () => player, addGameMessage: jest.fn() });
        ui.onOffer = jest.fn();
        ui.onConfirm = jest.fn();
        ui.onCancel = jest.fn();
        ui.update({
            state: 'offer',
            trade: {
                id: 'trade-1', playerAId: 'player-alice', playerBId: 'player-bob',
                offerA: { items: [{ id: 'sword', name: 'Sword', stack: 1 }], gold: 5 },
                offerB: { items: [{ id: 'gem', name: 'Ruby', stack: 1 }], gold: 8 },
                confirmedA: false, confirmedB: true
            }
        });

        expect(document.getElementById('direct-trade-window').style.display).toBe('block');
        expect(document.getElementById('direct-trade-partner-title').textContent).toContain('bob');
        expect(document.getElementById('direct-trade-other-items').textContent).toContain('Ruby');
        const checkboxes = document.querySelectorAll('#direct-trade-own-items input');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0].checked).toBe(true);
        checkboxes[1].checked = true;
        document.getElementById('direct-trade-gold').value = '999999';
        document.getElementById('btn-direct-trade-offer').click();
        expect(ui.onOffer).toHaveBeenCalledWith('trade-1', ['sword', 'potion'], 100000);

        document.getElementById('btn-direct-trade-confirm').click();
        document.getElementById('btn-direct-trade-cancel').click();
        expect(ui.onConfirm).toHaveBeenCalledWith('trade-1');
        expect(ui.onCancel).toHaveBeenCalledWith('trade-1');
    });

    test('terminal state closes the window and reports escrow outcome', () => {
        const addGameMessage = jest.fn();
        const ui = new DirectTradeUI({ getLastPlayer: () => ({ id: 'player-a', inventory: [] }), addGameMessage });
        ui.update({ trade: { id: 'trade-1' }, state: 'open' });
        ui.update({ trade: { id: 'trade-1' }, state: 'cancelled' });
        expect(document.getElementById('direct-trade-window').style.display).toBe('none');
        expect(addGameMessage).toHaveBeenCalledWith('Trade', 'Trade cancelled; escrow returned.');
    });
});
