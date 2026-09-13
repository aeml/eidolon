import { jest } from '@jest/globals';
import { BlackjackTableUI } from '../src/ui/BlackjackTableUI.js';

const betting = () => ({ available: true, roundId: 'round-one', phase: 'betting', processing: false, gold: 300, players: [] });
const playing = () => ({ ...betting(), phase: 'playing', players: [{ playerId: 'alice', name: 'Alice', seat: 0, bet: 100 }], round: {
    revision: 1, dealer: [9], dealerHidden: true, turnPlayerId: 'alice', turnHand: 0, deadline: new Date(Date.now() + 30000).toISOString(),
    actions: ['hit', 'stand', 'double', 'split'], players: [{ playerId: 'alice', seat: 0, hands: [{ cards: [7, 20], bet: 100 }] }]
} });

test('one-click wagers respect balance and stay locked across unchanged polls', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send);
    ui.update(betting(), 'alice'); ui.bet.click(); ui.update(betting(), 'alice'); ui.bet.click();
    expect(send).toHaveBeenCalledWith({ action: 'bet', roundId: 'round-one', bet: 100 });
    expect(send).toHaveBeenCalledTimes(1);
    ui.update({ ...betting(), roundId: 'round-two' }, 'alice');
    ui.stake.value = '500'; ui.bet.click(); expect(ui.summary.textContent).toContain('available balance');
});

test('double/split show the extra Gold and directly submit only once per turn', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send); ui.update(playing(), 'alice');
    expect(ui.actions.textContent).toContain('Double · +100 Gold'); ui.choose('double');
    expect(send).toHaveBeenCalledWith({ action: 'play', roundId: 'round-one', roundRevision: 1, gameAction: 'double' });
    ui.update(playing(), 'alice'); ui.choose('split'); expect(send).toHaveBeenCalledTimes(1);
    const next = playing(); next.round.revision = 2; next.gold = 10; ui.update(next, 'alice');
    ui.choose('split'); expect(ui.summary.textContent).toContain('Not enough Gold');
});

test('only public cards render; processing disables actions and leaving clears pending state', () => {
    const ui = new BlackjackTableUI(jest.fn()); ui.update(playing(), 'alice');
    expect(ui.root.querySelectorAll('.blackjack-card')).toHaveLength(4);
    expect(ui.root.querySelector('[aria-label="Dealer hidden card"]')).not.toBeNull();
    ui.update({ ...playing(), processing: true }, 'alice');
    expect([...ui.actions.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    ui.update(playing(), 'alice'); ui.choose('double'); ui.update(null, 'alice');
    expect(ui.root.hidden).toBe(true); expect(ui.pendingKey).toBeNull();
});

test('matching rejection releases controls without rebetting; stale errors do not', () => {
    const send = jest.fn(), ui = new BlackjackTableUI(send); ui.update(betting(), 'alice'); ui.bet.click();
    ui.rejectAction({ action: 'bet', roundId: 'old-round', roundRevision: 0, error: 'old' }); expect(ui.bet.disabled).toBe(true);
    ui.rejectAction({ action: 'bet', roundId: 'round-one', roundRevision: 0, error: 'Not enough Gold' });
    expect(ui.bet.disabled).toBe(false); expect(send).toHaveBeenCalledTimes(1);
});
