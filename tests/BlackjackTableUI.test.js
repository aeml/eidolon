import { jest } from '@jest/globals';
import { BlackjackTableUI } from '../src/ui/BlackjackTableUI.js';

const betting = () => ({ available: true, roundId: 'round-one', phase: 'betting', processing: false, gold: 300, players: [] });
const playing = () => ({ ...betting(), phase: 'playing', players: [{ playerId: 'alice', name: 'Alice', seat: 0, bet: 100 }], round: {
    revision: 1, dealer: [9], dealerHidden: true, turnPlayerId: 'alice', turnHand: 0, deadline: new Date(Date.now() + 30000).toISOString(),
    actions: ['hit', 'stand', 'double', 'split'], players: [{ playerId: 'alice', seat: 0, hands: [{ cards: [7, 20], bet: 100 }] }]
} });

test('wagers require explicit confirmation, respect balance and expire with the round', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send);
    ui.update(betting(), 'alice'); ui.bet.click(); expect(send).not.toHaveBeenCalled();
    expect(ui.quoteText.textContent).toContain('100 Gold'); ui.confirm.click();
    expect(send).toHaveBeenCalledWith({ action: 'bet', roundId: 'round-one', bet: 100 });
    ui.stake.value = '500'; ui.bet.click(); expect(ui.summary.textContent).toContain('available balance');
    ui.stake.value = '100'; ui.bet.click(); ui.update({ ...betting(), roundId: 'round-two' }, 'alice'); ui.confirm.click();
    expect(send).toHaveBeenCalledTimes(1);
});

test('double/split quote the extra Gold and cannot confirm a stale turn', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send); ui.update(playing(), 'alice');
    ui.choose('double'); expect(send).not.toHaveBeenCalled(); expect(ui.quoteText.textContent).toContain('100 Gold');
    ui.confirm.click(); expect(send).toHaveBeenCalledWith({ action: 'play', roundId: 'round-one', roundRevision: 1, gameAction: 'double' });
    ui.choose('split'); const next = playing(); next.round.revision = 2; ui.update(next, 'alice'); ui.confirm.click(); expect(send).toHaveBeenCalledTimes(1);
    ui.update({ ...playing(), gold: 10 }, 'alice'); ui.choose('split'); expect(ui.summary.textContent).toContain('Not enough Gold');
});

test('only public cards render; processing disables actions and leaving clears quotes', () => {
    const ui = new BlackjackTableUI(jest.fn()); ui.update(playing(), 'alice');
    expect(ui.root.querySelectorAll('.blackjack-card')).toHaveLength(4);
    expect(ui.root.querySelector('[aria-label="Dealer hidden card"]')).not.toBeNull();
    ui.update({ ...playing(), processing: true }, 'alice');
    expect([...ui.actions.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    ui.update(playing(), 'alice'); ui.choose('double'); ui.update(null, 'alice');
    expect(ui.root.hidden).toBe(true); expect(ui.quote).toBeNull();
});
