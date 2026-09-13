import { jest } from '@jest/globals';
import { CasinoCelebration, blackjackCount, slotWinTier } from '../src/ui/CasinoCelebration.js';

test.each([[[10,3], '14'], [[0,5], '17 · Soft'], [[0,13,8], '21 · Soft'], [[0,9,4], '16'], [[9,12,3], '24 · Bust']])('blackjack count %j → %s', (cards, label) => {
    expect(blackjackCount(cards)).toBe(label);
});
test.each([[1,'WIN'], [10,'BIG WIN'], [50,'HUGE WIN'], [100,'GIGANTIC WIN']])('slot tiers depend on stake multiple %i', (multiple, tier) => {
    expect(slotWinTier(multiple * 100000, 100000)).toBe(tier);
});
test('celebration completes once and leaving cancels the queued continuation', () => {
    jest.useFakeTimers(); const popup = new CasinoCelebration(document.createElement('div')), done = jest.fn();
    try {
        popup.show('WIN', '200 Gold returned', '100 staked', done); jest.advanceTimersByTime(2999);
        expect(popup.active).toBe(true); expect(done).not.toHaveBeenCalled();
        jest.advanceTimersByTime(1); expect(done).toHaveBeenCalledTimes(1); expect(popup.active).toBe(false);
        popup.show('WIN', '200', '', done); popup.clear(); jest.runOnlyPendingTimers(); expect(done).toHaveBeenCalledTimes(1);
    } finally { popup.clear(); jest.useRealTimers(); }
});
