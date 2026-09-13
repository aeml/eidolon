import { jest } from '@jest/globals';
import { PokerTableUI } from '../src/ui/PokerTableUI.js';

const lobby = () => ({ available: true, processing: false, phase: 'betting', roundId: 'hand-1', gold: 300, players: [] });
const playing = () => ({ ...lobby(), phase: 'playing', players: [{ playerId: 'A', name: '<img src=x>', seat: 0, buyIn: 100 }, { playerId: 'B', name: 'Beryl', seat: 1, buyIn: 200 }], round: {
    revision: 1, phase: 'playing', street: 'flop', board: [0, 9, 10], buttonSeat: 0, turnPlayerId: 'A', deadline: new Date(Date.now() + 30000).toISOString(),
    actions: ['fold', 'call', 'raise', 'all_in'], callAmount: 10, minimumRaiseTo: 30, maximumRaiseTo: 100,
    pots: [{ amount: 30 }], players: [{ playerId: 'A', seat: 0, stack: 90, streetBet: 10, committed: 10, cards: [13, 14] },
        { playerId: 'B', seat: 1, stack: 180, streetBet: 20, committed: 20, cards: [-1, -1] }]
} });

test('poker requires confirmed affordable buy-in and suppresses double clicks', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update(lobby(), 'A'); ui.buy.click();
    expect(send).not.toHaveBeenCalled(); expect(ui.quoteText.textContent).toContain('Reserve 100 Gold'); ui.confirm.click(); ui.confirm.click(); ui.buy.click();
    expect(send).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledWith({ action: 'poker_buy_in', roundId: 'hand-1', bet: 100 });
    ui.update(lobby(), 'A'); ui.stake.value = '500'; ui.buy.click(); expect(ui.summary.textContent).toContain('available balance');
    ui.stake.value = '100'; ui.buy.click(); ui.update({ ...lobby(), roundId: 'hand-2' }, 'A'); ui.confirm.click(); expect(send).toHaveBeenCalledTimes(1);
});

test('poker raise/all-in quotes use reserved stack and expire when the turn changes', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update(playing(), 'A'); ui.raise.value = '50'; ui.choose('raise');
    expect(ui.quoteText.textContent).toContain('total street bet to 50 Gold'); expect(send).not.toHaveBeenCalled(); ui.confirm.click();
    expect(send).toHaveBeenCalledWith({ action: 'poker_play', roundId: 'hand-1', roundRevision: 1, gameAction: 'raise', bet: 50 });
    ui.update(playing(), 'A'); ui.choose('all_in'); expect(ui.quoteText.textContent).toContain('No additional Gold');
    const next = playing(); next.round.revision = 2; next.round.actions = []; ui.update(next, 'A'); ui.confirm.click(); expect(send).toHaveBeenCalledTimes(1);
    ui.choose('call'); expect(send).toHaveBeenCalledTimes(1);
});

test('poker renders only provided cards, escapes names and preserves focus on unchanged polls', () => {
    const ui = new PokerTableUI(jest.fn()); document.body.append(ui.root); const view = playing(); ui.update(view, 'A');
    expect(ui.root.querySelector('img')).toBeNull(); expect(ui.root.textContent).toContain('<img src=x>');
    expect(ui.root.querySelectorAll('[aria-label="Hidden card"]')).toHaveLength(4);
    const input = ui.raise; input.focus(); input.value = '65'; ui.update(view, 'A'); expect(ui.raise).toBe(input); expect(document.activeElement).toBe(input); expect(input.value).toBe('65');
    ui.update({ ...view, processing: true }, 'A'); expect([...ui.root.querySelectorAll('button')].every(b => b.disabled)).toBe(true);
    ui.update(view, 'A'); ui.choose('all_in'); ui.update(null, 'A'); expect(ui.root.hidden).toBe(true); expect(ui.quote).toBeNull(); ui.dispose();
});

test('poker waiting state never offers house opponents or a second buy-in', () => {
    const send = jest.fn(), ui = new PokerTableUI(send); ui.update({ ...lobby(), players: [{ playerId: 'A', buyIn: 100 }] }, 'A');
    expect(ui.summary.textContent).toContain('Waiting for another real player'); expect(ui.lobby.hidden).toBe(true); ui.reviewBuyIn(); expect(ui.quote).toBeFalsy();
    ui.update({ ...lobby(), available: false }, 'A'); ui.reviewBuyIn(); expect(send).not.toHaveBeenCalled();
});
