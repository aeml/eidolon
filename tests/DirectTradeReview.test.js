import { jest } from '@jest/globals';
import { DirectTradeUI } from '../src/ui/DirectTradeUI.js';

let player, ui, trade;
beforeEach(() => {
    document.body.innerHTML = `<div id="direct-trade-window" style="display:none">
        <div id="direct-trade-status"></div><div id="direct-trade-own-items"></div><div id="direct-trade-other-items"></div>
        <input id="direct-trade-gold"><button id="btn-direct-trade-offer"></button><button id="btn-direct-trade-confirm"></button>
        <button id="btn-direct-trade-cancel"></button><button id="btn-close-direct-trade"></button></div>`;
    player = { id: 'player-a', inventory: [{ id: 'potion', name: 'Potion' }] };
    trade = { id: 'trade-1', playerAId: 'player-a', playerBId: 'player-b',
        offerA: { items: [], gold: 5 }, offerB: { items: [], gold: 0 } };
    ui = new DirectTradeUI({ getLastPlayer: () => player, addGameMessage: jest.fn() });
    ui.onOffer = jest.fn(); ui.onConfirm = jest.fn(); ui.onCancel = jest.fn();
    ui.update({ trade, state: 'offer' });
});
afterEach(() => ui.dispose?.());
const edit = () => {
    ui.gold.value = '12'; ui.gold.dispatchEvent(new Event('input', { bubbles: true }));
    const checkbox = ui.ownItems.querySelector('input'); checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
};

test('a partner-only update preserves local draft and focused item without posting it', () => {
    edit(); ui.ownItems.querySelector('input').focus();
    ui.update({ trade: { ...trade, confirmedB: true, offerB: { items: [], gold: 8 } }, state: 'confirm' });
    expect(ui.gold.value).toBe('12'); expect(ui.ownItems.querySelector('input').checked).toBe(true);
    expect(document.activeElement).toBe(ui.ownItems.querySelector('input')); expect(ui.onOffer).not.toHaveBeenCalled();
});

test('an edited draft cannot confirm an older offer, even when its input event was missed', () => {
    ui.gold.value = '12'; ui.confirmButton.click(); expect(ui.onConfirm).not.toHaveBeenCalled();
    ui.gold.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ui.confirmButton.disabled).toBe(true); expect(ui.status.textContent).toContain('Update your offer before confirming');
});

test('only an acknowledged matching offer enables confirmation, with no optimistic escrow mutation', () => {
    edit(); ui.offerButton.click(); expect(ui.onOffer).toHaveBeenCalledWith('trade-1', ['potion'], 12);
    expect(trade.offerA).toEqual({ items: [], gold: 5 }); expect(ui.confirmButton.disabled).toBe(true);
    ui.update({ trade: { ...trade, offerA: { items: player.inventory, gold: 12 } }, state: 'offer' });
    expect(ui.confirmButton.disabled).toBe(false); ui.confirmButton.click(); expect(ui.onConfirm).toHaveBeenCalledWith('trade-1');
});

test('reverting a draft to its authoritative offer enables confirmation', () => {
    edit(); ui.gold.value = '5'; ui.ownItems.querySelector('input').checked = false;
    ui.gold.dispatchEvent(new Event('input', { bubbles: true })); expect(ui.confirmButton.disabled).toBe(false);
});

test('an acknowledgement does not erase newer edits made while the offer was in flight', () => {
    edit(); ui.offerButton.click(); ui.gold.value = '13';
    ui.gold.dispatchEvent(new Event('input', { bubbles: true }));
    ui.update({ trade: { ...trade, offerA: { items: player.inventory, gold: 12 } }, state: 'offer' });
    expect(ui.gold.value).toBe('13'); expect(ui.confirmButton.disabled).toBe(true);
    ui.gold.value = '12'; ui.gold.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ui.confirmButton.disabled).toBe(false);
});

test('reverting to the old offer cannot confirm while a changed offer is in flight', () => {
    edit(); ui.offerButton.click(); ui.gold.value = '5'; ui.ownItems.querySelector('input').checked = false;
    ui.gold.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ui.confirmButton.disabled).toBe(true); expect(ui.status.textContent).toContain('Waiting for your offer update');
    ui.update({ trade: { ...trade, offerA: { items: player.inventory, gold: 12 } }, state: 'offer' });
    expect(ui.gold.value).toBe('5'); expect(ui.ownItems.querySelector('input').checked).toBe(false);
    expect(ui.confirmButton.disabled).toBe(true); expect(ui.status.textContent).toContain('Update your offer before confirming');
});

test('an older acknowledgement cannot clear a newer in-flight offer', () => {
    edit(); ui.offerButton.click(); ui.gold.value = '13'; ui.offerButton.click();
    ui.update({ trade: { ...trade, offerA: { items: player.inventory, gold: 12 } }, state: 'offer' });
    expect(ui.confirmButton.disabled).toBe(true); expect(ui.status.textContent).toContain('Waiting for your offer update');
    ui.update({ trade: { ...trade, offerA: { items: player.inventory, gold: 13 } }, state: 'offer' });
    expect(ui.confirmButton.disabled).toBe(false);
});

test('a disconnected offer reports failure and can be deliberately retried', () => {
    edit(); ui.onOffer.mockReturnValue(false); ui.offerButton.click();
    expect(ui.status.textContent).toContain('Offer was not sent'); expect(ui.confirmButton.disabled).toBe(true);
    ui.onOffer.mockReturnValue(true); ui.offerButton.click(); expect(ui.status.textContent).toContain('Waiting for your offer update');
});

test('out-of-range displayed Gold cannot masquerade as the acknowledged capped offer', () => {
    ui.update({ trade: { ...trade, offerA: { items: [], gold: 100000 } }, state: 'offer' });
    ui.gold.value = '999999'; ui.gold.dispatchEvent(new Event('input', { bubbles: true }));
    expect(ui.confirmButton.disabled).toBe(true); ui.offerButton.click();
    expect(ui.gold.value).toBe('100000'); expect(ui.onOffer).toHaveBeenCalledWith('trade-1', [], 100000);
});

test('offer submission displays the same whole Gold amount sent to the server', () => {
    ui.gold.value = '12.75'; ui.offerButton.click();
    expect(ui.gold.value).toBe('12'); expect(ui.onOffer).toHaveBeenCalledWith('trade-1', [], 12);
    expect(ui.confirmButton.disabled).toBe(true);
});

test('pending save permits offer retry but never confirmation; recovery freezes draft inputs', () => {
    ui.update({ trade, state: 'saving' }); expect(ui.offerButton.disabled).toBe(false); expect(ui.confirmButton.disabled).toBe(true);
    ui.update({ trade, state: 'recovering' }); expect(ui.gold.disabled).toBe(true);
    expect(ui.ownItems.querySelector('input').disabled).toBe(true);
    ui.update({ trade, state: 'offer' }); expect(ui.gold.disabled).toBe(false); expect(ui.confirmButton.disabled).toBe(false);
});

test.each(['offer', 'confirm', 'cancel', 'close'])('a replacement character cannot submit the previous trade through %s', action => {
    player = { ...player, id: 'player-other' };
    ({ offer: ui.offerButton, confirm: ui.confirmButton, cancel: ui.cancelButton, close: ui.closeButton })[action].click();
    expect(ui.onOffer).not.toHaveBeenCalled(); expect(ui.onConfirm).not.toHaveBeenCalled(); expect(ui.onCancel).not.toHaveBeenCalled();
});

test('an old terminal message cannot dismiss a newer active trade', () => {
    const next = { ...trade, id: 'trade-2' }; ui.update({ trade: next, state: 'open' });
    ui.update({ trade, state: 'complete' }); expect(ui.trade.id).toBe('trade-2'); expect(ui.window.style.display).toBe('block');
});

test('an unrelated participant update cannot replace this trade', () => {
    ui.update({ trade: { ...trade, id: 'unrelated', playerAId: 'player-x', playerBId: 'player-y' }, state: 'open' });
    expect(ui.trade.id).toBe('trade-1');
});

test('the second participant also retains a draft across first-participant updates', () => {
    ui.close(); player.id = 'player-b'; ui.update({ trade, state: 'open' }); edit();
    ui.update({ trade: { ...trade, offerA: { items: [], gold: 30 } }, state: 'offer' });
    expect(ui.gold.value).toBe('12'); expect(ui.ownItems.querySelector('input').checked).toBe(true);
    expect(ui.confirmButton.disabled).toBe(true);
});

test('disposed owners cannot reopen or retain actionable trade state', () => {
    ui.dispose(); ui.update({ trade, state: 'open' }); ui.offerButton.click(); ui.confirmButton.click();
    expect(ui.trade).toBeNull(); expect(ui.window.style.display).toBe('none'); expect(ui.onOffer).not.toHaveBeenCalled();
    expect(ui.onConfirm).not.toHaveBeenCalled();
});
