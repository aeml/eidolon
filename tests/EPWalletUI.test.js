import { jest } from '@jest/globals';
import { EPWalletUI } from '../src/ui/EPWalletUI.js';

function fixture() {
    sessionStorage.clear();
    document.body.innerHTML = '<main></main>';
    let player = { id: 'player-hero' };
    const send = jest.fn();
    const ui = new EPWalletUI({ host: document.querySelector('main'), getPlayer: () => player, send });
    ui.handleResult({ playerID: 'player-hero', ep: 3, gold: 3000000, goldPerEP: 1000000, success: true });
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
    ui.handleResult({ playerID: 'player-hero', id: request.id, pending: true, success: false, message: 'Save pending' });
    ui.retry.click();
    expect(send.mock.calls[1][1]).toEqual(request);
    const reopened = new EPWalletUI({ host: document.body, getPlayer: () => ({ id: 'player-hero' }), send });
    reopened.handleResult({ playerID: 'player-hero', ep: 4, gold: 2000000, goldPerEP: 1000000, success: true });
    expect(reopened.pending).toEqual(request);
    expect(reopened.review.disabled).toBe(true);
    reopened.retry.click();
    expect(send.mock.calls[2][1]).toEqual(request);
    reopened.handleResult({ playerID: 'player-hero', id: request.id, success: true, pending: false, ep: 4, gold: 2000000, goldPerEP: 1000000 });
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
    ui.handleVIPStatus({ playerID: 'player-hero', success: true, active: true, until: '2026-10-14T00:00:00Z', monthlyEP: 100,
        awardedEP: 100, ep: 103, gold: 3000000, goldPerEP: 1000000 });
    expect(ui.root.querySelector('[data-vip-status]').textContent).toContain('100 EP just credited');
    ui.handleVIPStatus({ playerID: 'player-hero', success: true, active: false, ep: 103, gold: 3000000, goldPerEP: 1000000 });
    expect(ui.root.querySelector('[data-vip-status]').textContent).toContain('No active VIP');
    expect(send).not.toHaveBeenCalled();
    changePlayer('player-other'); ui.refreshPlayer();
    expect(ui.root.querySelector('[data-vip-status]').textContent).toBe('Loading VIP membership status…');
});

test.each([undefined, 'player-hero'])('late wallet and VIP results cannot load another character wallet: %s', playerID => {
    const { ui, send, changePlayer } = fixture();
    changePlayer('player-other');
    const old = { playerID, success: true, ep: 99, gold: 9000000, goldPerEP: 1000000, active: true };
    ui.handleResult(old); ui.handleVIPStatus(old);
    expect(ui.root.querySelector('[data-balance]').textContent).toBe('Loading EP wallet…');
    expect(ui.root.querySelector('[data-vip-status]').textContent).toBe('Loading VIP membership status…');
    expect(ui.ready).toBe(false); expect(ui.review.disabled).toBe(true);
    ui.review.click(); ui.root.querySelector('[data-confirm]').click(); expect(send).not.toHaveBeenCalled();
    ui.handleResult({ ...old, playerID: 'player-other' });
    expect(ui.review.disabled).toBe(false); expect(ui.root.querySelector('[data-balance]').textContent).toContain('99 EP');
    ui.dispose();
});

test.each(['missing-status', 'invalid-balance', 'wrong-owner'])('incomplete or unrelated acknowledgement cannot discard a saved exchange receipt: %s', reason => {
    const { ui, send } = fixture();
    ui.review.click(); ui.root.querySelector('[data-confirm]').click();
    const request = send.mock.calls[0][1];
    const result = { playerID: 'player-hero', id: request.id, success: true, pending: false, ep: 4, gold: 2000000, goldPerEP: 1000000 };
    if (reason === 'missing-status') { delete result.pending; delete result.success; }
    if (reason === 'invalid-balance') result.ep = -1;
    if (reason === 'wrong-owner') result.playerID = 'player-other';
    ui.handleResult(result);
    expect(ui.pending).toEqual(request); expect(JSON.parse(sessionStorage.getItem(ui.storageKey()))).toEqual(request);
    expect(ui.review.disabled).toBe(true); ui.retry.click(); expect(send.mock.calls.at(-1)[1]).toEqual(request);
    ui.dispose();
});

test('disposing the wallet retains an unresolved receipt but cannot submit or accept late results', () => {
    const { ui, send } = fixture(); ui.review.click(); ui.root.querySelector('[data-confirm]').click();
    const request = send.mock.calls[0][1], stored = sessionStorage.getItem(ui.storageKey());
    ui.dispose(); ui.submitPending();
    ui.handleResult({ playerID: 'player-hero', id: request.id, success: true, pending: false, ep: 4, gold: 2000000, goldPerEP: 1000000 });
    expect(send).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(ui.storageKey())).toBe(stored);
    expect(ui.pending).toEqual(request);
});

test('VIP expiry uses the server snapshot time, marks status for refresh and never grants or polls', () => {
    const clock = jest.spyOn(performance, 'now').mockReturnValue(1000);
    try {
        const { ui, send } = fixture();
        ui.handleVIPStatus({ playerID: 'player-hero', success: true, active: true,
            asOf: '2026-10-01T23:59:58Z', until: '2026-10-02T00:00:00Z', monthlyEP: 100,
            awardedEP: 0, ep: 3, gold: 3000000, goldPerEP: 1000000 });
        expect(ui.root.querySelector('[data-vip-status]').textContent).toContain('VIP active');
        clock.mockReturnValue(2999); ui.refreshPlayer();
        expect(ui.root.querySelector('[data-vip-status]').textContent).toContain('VIP active');
        clock.mockReturnValue(3000); ui.refreshPlayer();
        expect(ui.root.querySelector('[data-vip-status]').textContent).toContain('Refresh VIP status');
        expect(ui.root.querySelector('[data-vip-status]').textContent).not.toContain('VIP active');
        expect(send).not.toHaveBeenCalled();
        expect(ui.root.querySelector('[data-balance]').textContent).toContain('3 EP');
        ui.dispose();
    } finally { clock.mockRestore(); }
});

test('explicit membership refresh clears a prior badge but cannot consume a pending exchange receipt', () => {
    const { ui, send } = fixture();
    ui.review.click(); ui.root.querySelector('[data-confirm]').click();
    const request = send.mock.calls[0][1], stored = sessionStorage.getItem(ui.storageKey());
    const refresh = ui.root.querySelector('[data-vip-refresh]');
    expect(refresh).not.toBeNull();
    refresh.click();
    expect(send.mock.calls.at(-1)).toEqual(['get_vip_status', {}]);
    expect(ui.root.querySelector('[data-vip-status]').textContent).toContain('Loading VIP');
    ui.handleVIPStatus({ playerID: 'player-hero', success: true, active: false, awardedEP: 0,
        ep: 3, gold: 3000000, goldPerEP: 1000000 });
    expect(ui.pending).toEqual(request);
    expect(sessionStorage.getItem(ui.storageKey())).toBe(stored);
    expect(send.mock.calls.filter(([type]) => type === 'exchange_gold_for_ep')).toHaveLength(1);
    ui.dispose(); refresh.click();
    expect(send.mock.calls.at(-1)).toEqual(['get_vip_status', {}]);
});

test.each(['bad-date', 'bad-allowance', 'non-boolean-active'])('invalid membership metadata cannot overwrite valid balances or claim active VIP: %s', kind => {
    const { ui } = fixture();
    const reply = { playerID: 'player-hero', success: true, active: true, monthlyEP: 100,
        awardedEP: 100, ep: 999, gold: 9999999, goldPerEP: 1000000, until: '2026-12-01T00:00:00Z' };
    if (kind === 'bad-date') reply.until = 'not-a-date';
    if (kind === 'bad-allowance') reply.monthlyEP = 999;
    if (kind === 'non-boolean-active') reply.active = 'true';
    const balance = ui.root.querySelector('[data-balance]').textContent;
    expect(ui.handleVIPStatus(reply)).toBe(false);
    expect(ui.root.querySelector('[data-balance]').textContent).toBe(balance);
    expect(ui.root.querySelector('[data-vip-status]').textContent).not.toContain('VIP active');
    ui.dispose();
});
