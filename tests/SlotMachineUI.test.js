import { jest } from '@jest/globals';
import { SlotMachineUI } from '../src/ui/SlotMachineUI.js';
import { getSlotSymbolIcon } from '../src/art/ProceduralSlotIcons.js';

const machine = { theme: 'earth', lore: 'Orun remembers.', mechanic: 'Sticky middle-reel wilds.', freeSpins: 5,
    symbols: ['Seed', 'Fern', 'Amber', 'Roadward', 'Rootheart', 'Orun', 'Living root', 'Vault key'],
    bonusTitle: 'The archive', bonusChoices: ['Open the chest', 'Read the tablet', '<b>Follow the root</b>'],
    weights: [24, 20, 16, 12, 10, 8, 5, 5], pays: Array.from({ length: 6 }, () => [6, 16, 28]) };
const view = { available: true, gold: 300, processing: false, machine, lines: Array.from({ length: 10 }, () => [1, 1, 1, 1, 1]),
    session: { revision: 1, bet: 20, freeSpins: 0, bonus: false } };
const grid = Array.from({ length: 5 }, () => [0, 1, 2]);

test('paid spins require explicit current-revision Gold confirmation and prevent duplicate clicks', () => {
    const send = jest.fn(), ui = new SlotMachineUI(send); ui.update(view);
    ui.spin.click(); expect(send).not.toHaveBeenCalled(); expect(ui.quoteText.textContent).toContain('20 Gold');
    ui.confirm.click(); ui.confirm.click(); ui.spin.click();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ action: 'slot_spin', bet: 20, roundRevision: 1 });
    ui.update(view); ui.spin.click(); ui.update({ ...view, session: { ...view.session, revision: 2 } });
    ui.confirm.click(); expect(send).toHaveBeenCalledTimes(1); expect(ui.confirmation.hidden).toBe(true);
    ui.dispose();
});

test('saved free spins retain stake; sealed bonus chooses only one index and exposes no offers', () => {
    const send = jest.fn(), ui = new SlotMachineUI(send);
    ui.update({ ...view, session: { ...view.session, bet: 40, freeSpins: 5 } });
    expect(ui.stake.disabled).toBe(true); ui.spin.click();
    expect(send).toHaveBeenLastCalledWith({ action: 'slot_spin', bet: 40, roundRevision: 1 });
    ui.update({ ...view, session: { ...view.session, revision: 2, freeSpins: 5, bonus: true } });
    expect(ui.spin.disabled).toBe(true); expect(ui.bonus.querySelector('b')).toBeNull();
    ui.bonus.querySelectorAll('button')[2].click();
    expect(send).toHaveBeenLastCalledWith({ action: 'slot_bonus', choice: 2, roundRevision: 2 });
    ui.update({ ...view, available: false }); ui.bonus.querySelectorAll('button')[0].click(); expect(send).toHaveBeenCalledTimes(2);
    ui.dispose();
});

test('server outcomes animate once, show winning cells, and stop cleanly when leaving', () => {
    jest.useFakeTimers(); const sound = jest.fn(), ui = new SlotMachineUI(jest.fn(), sound);
    try {
        ui.update(view);
        const next = { ...view, session: { ...view.session, revision: 2, last: { landed: grid, payout: 28, freeAwarded: 0,
            bonusPicked: -1, stages: [{ grid, wins: [{ line: 0, count: 5 }], payout: 28 }] } } };
        ui.update(next); expect(ui.spin.disabled).toBe(true); ui.update(next);
        expect(sound).toHaveBeenCalledTimes(1); jest.runOnlyPendingTimers();
        expect(ui.grid.querySelectorAll('.win')).toHaveLength(5); expect(ui.result.textContent).toContain('28 Gold returned');
        expect(ui.spin.disabled).toBe(false);
        ui.update({ ...next, session: { ...next.session, revision: 3 } }); ui.update(null);
        jest.runOnlyPendingTimers(); expect(ui.root.hidden).toBe(true); expect(ui.animating).toBe(false);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('all elemental symbols have deterministic code-native icons', () => {
    const icons = new Set();
    for (const theme of ['earth', 'fire', 'water', 'air']) for (let symbol = 0; symbol < 8; symbol++) {
        const icon = getSlotSymbolIcon(theme, symbol); expect(icon).toContain('data:image/svg+xml');
        expect(getSlotSymbolIcon(theme, symbol)).toBe(icon); icons.add(icon);
    }
    expect(icons.size).toBe(32);
});
