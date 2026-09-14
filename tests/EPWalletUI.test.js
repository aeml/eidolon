import { jest } from '@jest/globals';
import { EPWalletUI } from '../src/ui/EPWalletUI.js';

function fixture() {
    sessionStorage.clear();
    document.body.innerHTML = '<main></main>';
    let player = { id: 'player-hero' };
    const send = jest.fn();
    const ui = new EPWalletUI({ host: document.querySelector('main'), getPlayer: () => player, send });
    ui.handleResult({ ep: 3, gold: 3000000, goldPerEP: 1000000, success: true });
    return { ui, send, changePlayer: id => { player = { id }; } };
}

test('EP exchange requires reviewing the exact permanent cost and an explicit confirmation', () => {
    const { ui, send } = fixture();
    ui.amount.value = '2'; ui.review.click();
    expect(send).not.toHaveBeenCalled();
    expect(ui.root.querySelector('[data-cost]').textContent).toContain('2,000,000 Gold');
    ui.root.querySelector('[data-confirm]').click();
    expect(send).toHaveBeenCalledWith('exchange_gold_for_ep', expect.objectContaining({ amount: 2, confirmed: true }));
    ui.root.querySelector('[data-confirm]').click();
    expect(send).toHaveBeenCalledTimes(1);
    expect(ui.review.disabled).toBe(true);
});

test.each(['0', '-1', '1.5', '4', '9007199254740992'])('rejects unaffordable or non-whole EP amount %s', amount => {
    const { ui, send } = fixture();
    ui.amount.value = amount; ui.review.click();
    expect(ui.confirmation.hidden).toBe(true);
    expect(send).not.toHaveBeenCalled();
});

test('pending acknowledgement and reload reuse the same receipt, while balance refresh cannot clear it', () => {
    const { ui, send } = fixture();
    ui.review.click(); ui.root.querySelector('[data-confirm]').click();
    const request = send.mock.calls[0][1];
    ui.handleResult({ id: request.id, pending: true, success: false, message: 'Save pending' });
    ui.retry.click();
    expect(send.mock.calls[1][1]).toEqual(request);
    const reopened = new EPWalletUI({ host: document.body, getPlayer: () => ({ id: 'player-hero' }), send });
    reopened.handleResult({ ep: 4, gold: 2000000, goldPerEP: 1000000, success: true });
    expect(reopened.pending).toEqual(request);
    expect(reopened.review.disabled).toBe(true);
    reopened.retry.click();
    expect(send.mock.calls[2][1]).toEqual(request);
    reopened.handleResult({ id: request.id, success: true, pending: false, ep: 4, gold: 2000000, goldPerEP: 1000000 });
    expect(reopened.pending).toBeNull();
    expect(reopened.review.disabled).toBe(false);
    expect(sessionStorage.getItem(reopened.storageKey())).toBeNull();
});

test('changing character cannot confirm or replay another character’s exchange', () => {
    const { ui, send, changePlayer } = fixture();
    ui.review.click();
    changePlayer('player-other');
    ui.root.querySelector('[data-confirm]').click();
    expect(send).not.toHaveBeenCalled();
    expect(ui.confirmation.hidden).toBe(true);
    expect(ui.review.disabled).toBe(true);
});

test('editing an amount cancels its old confirmation', () => {
    const { ui, send } = fixture();
    ui.review.click();
    ui.amount.value = '2'; ui.amount.dispatchEvent(new Event('input'));
    ui.root.querySelector('[data-confirm]').click();
    expect(send).not.toHaveBeenCalled();
});

test('VIP status describes server-owned membership and allowance, not EP ownership', () => {
    const { ui, send, changePlayer } = fixture();
    ui.handleVIPStatus({ success: true, active: true, until: '2026-10-14T00:00:00Z', monthlyEP: 100,
        awardedEP: 100, ep: 103, gold: 3000000, goldPerEP: 1000000 });
    expect(ui.root.querySelector('[data-vip-status]').textContent).toContain('100 EP just credited');
    ui.handleVIPStatus({ success: true, active: false, ep: 103, gold: 3000000, goldPerEP: 1000000 });
    expect(ui.root.querySelector('[data-vip-status]').textContent).toContain('No active VIP');
    expect(send).not.toHaveBeenCalled();
    changePlayer('player-other'); ui.refreshPlayer();
    expect(ui.root.querySelector('[data-vip-status]').textContent).toBe('Loading VIP membership status…');
});
