import { jest } from '@jest/globals';
import { SlotMachineUI } from '../src/ui/SlotMachineUI.js';
import { getSlotSymbolIcon } from '../src/art/ProceduralSlotIcons.js';

const machine = { theme: 'earth', lore: 'Orun remembers.', mechanic: 'Sticky middle-reel wilds.', freeSpins: 5,
    symbols: ['Seed', 'Fern', 'Amber', 'Roadward', 'Rootheart', 'Orun', 'Living root', 'Vault key'],
    bonusTitle: 'The archive', bonusChoices: ['Open the chest', 'Read the tablet', '<b>Follow the root</b>'],
    weights: [24, 20, 16, 12, 10, 8, 5, 5], pays: Array.from({ length: 6 }, () => [6, 16, 28]) };
const view = { available: true, gold: 300, processing: false, minBet: 20, maxBet: 500, betStep: 20, machine, lines: Array.from({ length: 10 }, () => [1, 1, 1, 1, 1]),
    session: { revision: 1, bet: 20, freeSpins: 0, bonus: false } };
const grid = Array.from({ length: 5 }, () => [0, 1, 2]);

test('one click spins at the selected stake; unchanged polls cannot unlock duplicate spending', () => {
    const send = jest.fn(), ui = new SlotMachineUI(send); ui.update(view);
    ui.spin.click(); ui.update(view); ui.spin.click();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ action: 'slot_spin', bet: 20, roundRevision: 1 });
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
        expect(sound).not.toHaveBeenCalled(); jest.advanceTimersByTime(2000);
        expect(sound.mock.calls.filter(([cue]) => cue === 'win')).toHaveLength(1);
        expect(ui.grid.querySelectorAll('.win')).toHaveLength(5); expect(ui.result.textContent).toContain('28 Gold returned');
        expect(ui.spin.disabled).toBe(true); expect(ui.celebration.root.hidden).toBe(false);
        jest.advanceTimersByTime(2500); expect(ui.spin.disabled).toBe(false);
        ui.update({ ...next, session: { ...next.session, revision: 3 } }); ui.update(null);
        jest.runOnlyPendingTimers(); expect(ui.root.hidden).toBe(true); expect(ui.animating).toBe(false);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

const resultView = (revision, extras = {}) => ({ ...view, ...extras, session: { ...view.session, revision,
    last: { landed: grid, payout: 0, bonusPicked: -1, stages: [{ grid, wins: [], payout: 0 }] }, ...extras.session } });

test.each([['gold', 8, 'Net loss: 12 Gold'], ['gold', 20, 'No net profit or loss Gold'],
    ['ep', 8, 'Net loss: 12 EP'], ['ep', 20, 'No net profit or loss EP']])(
    '%s return %i is not celebrated as a profitable paid spin', (currency, payout, message) => {
        jest.useFakeTimers(); const sound = jest.fn(), ui = new SlotMachineUI(jest.fn(), sound);
        try {
            ui.update({ ...view, currency }); const next = resultView(2, { currency }); next.session.last.payout = payout;
            ui.update(next); jest.advanceTimersByTime(2000);
            expect(ui.result.textContent).toContain(message);
            expect(ui.celebration.active).toBe(false);
            expect(sound.mock.calls.some(([cue]) => ['win', 'jackpot'].includes(cue))).toBe(false);
        } finally { ui.dispose(); jest.useRealTimers(); }
    }
);

test('a saved free spin has no new stake and a bonus award is not mislabeled as paid-spin profit', () => {
    const ui = new SlotMachineUI(jest.fn()); ui.update(view);
    const last = { ...resultView(2).session.last, payout: 8, free: true };
    ui.showResult(last); ui.celebrateResult(last);
    expect(ui.result.textContent).toContain('Free spin: no stake charged');
    expect(ui.celebration.title.textContent).toBe('WIN'); ui.celebration.clear();
    const paid = { ...last, free: false, freeAwarded: 3 };
    ui.showResult(paid); ui.celebrateResult(paid);
    expect(ui.celebration.title.textContent).toBe('FREE SPINS');
    expect(ui.celebration.detail.textContent).toContain('net loss 12 Gold'); ui.dispose();
});

test('big win celebration pauses the next automatic wager and cannot be bypassed manually', () => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        ui.update(view); ui.count.value = '2'; ui.auto.click();
        const next = resultView(2); next.session.last.payout = 200; ui.update(next);
        jest.advanceTimersByTime(1700); expect(ui.celebration.title.textContent).toBe('BIG WIN'); expect(ui.spin.disabled).toBe(true);
        ui.spinOnce(); ui.act({ action: 'slot_spin', bet: 20, roundRevision: 2 }); ui.update(next);
        jest.advanceTimersByTime(2499); expect(send).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(501); expect(send).toHaveBeenCalledTimes(2);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('bonus overlay waits for reels and wins, then exposes themed choices once', () => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        ui.update(view); const next = resultView(2, { session: { bonus: true, freeSpins: 5 } });
        next.session.last.payout = 200; ui.update(next); expect(ui.bonus.hidden).toBe(true);
        jest.advanceTimersByTime(1700); expect(ui.celebration.active).toBe(true); expect(ui.bonus.hidden).toBe(true);
        jest.advanceTimersByTime(2500); expect(ui.bonus.hidden).toBe(false); expect(ui.bonus.textContent).toContain('BONUS ROUND'); expect(ui.bonus.textContent).toContain('5 FREE SPINS');
        ui.bonus.querySelector('button').click(); ui.bonus.querySelector('button').click(); expect(send).toHaveBeenCalledTimes(1);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test.each(['gold', 'ep'])('auto queue pauses for bonus choice and saved reveal, then resumes without counting the choice as a spin: %s', currency => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        ui.update({ ...view, currency }); ui.count.value = '3'; ui.auto.click();
        const triggered = resultView(2, { currency, session: { bonus: true, freeSpins: 5 } });
        triggered.session.last.freeAwarded = 5;
        ui.update(triggered); jest.advanceTimersByTime(4200);
        expect(ui.autoRemaining).toBe(2); expect(ui.autoStatus.textContent).toContain('paused');
        expect(ui.bonus.hidden).toBe(false); expect(ui.stop.disabled).toBe(false);
        ui.bonus.querySelector('button').click();
        expect(send).toHaveBeenLastCalledWith({ action: 'slot_bonus', choice: 0, roundRevision: 2 });
        expect(ui.autoRemaining).toBe(2);
        const picked = { ...triggered, session: { ...triggered.session, revision: 3, bonus: false,
            last: { ...triggered.session.last, bonusPicked: 0, bonusPayout: 40 } } };
        ui.update({ ...picked, processing: true }); jest.advanceTimersByTime(5000);
        expect(send).toHaveBeenCalledTimes(2); expect(ui.celebration.active).toBe(false);
        ui.update(picked); expect(ui.celebration.title.textContent).toBe('BONUS REVEALED');
        jest.advanceTimersByTime(2999); expect(send).toHaveBeenCalledTimes(2);
        jest.advanceTimersByTime(1);
        expect(send).toHaveBeenLastCalledWith({ action: 'slot_spin', bet: 20, roundRevision: 3 });
        expect(ui.autoRemaining).toBe(1);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('old revisions and bonus/spin actions for the wrong state cannot be sent', () => {
    const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        ui.update(view);
        ui.act({ action: 'slot_spin', bet: 20, roundRevision: 0 });
        ui.act({ action: 'slot_bonus', choice: 0, roundRevision: 1 });
        expect(send).not.toHaveBeenCalled(); expect(ui.pending).toBeFalsy();
        ui.update({ ...view, session: { ...view.session, revision: 2, bonus: true, freeSpins: 5 } });
        ui.act({ action: 'slot_spin', bet: 20, roundRevision: 2 });
        ui.act({ action: 'slot_bonus', choice: 0, roundRevision: 1 });
        expect(send).not.toHaveBeenCalled(); expect(ui.pending).toBeFalsy();
        ui.bonus.querySelector('button').click(); expect(send).toHaveBeenCalledTimes(1);
    } finally { ui.dispose(); }
});

test('synchronizing cancels an in-flight reel presentation and does not replay it on recovery', () => {
    jest.useFakeTimers(); const sound = jest.fn(), ui = new SlotMachineUI(jest.fn(), sound);
    try {
        ui.update(view); const next = resultView(2); next.session.last.payout = 200;
        ui.update(next); jest.advanceTimersByTime(90); expect(ui.animating).toBe(true);
        ui.update({ ...next, available: false }); jest.advanceTimersByTime(6000);
        expect(ui.animating).toBe(false); expect(ui.celebration.active).toBe(false); expect(sound).not.toHaveBeenCalled();
        ui.update(next); jest.advanceTimersByTime(6000);
        expect(ui.result.textContent).toContain('200 Gold returned');
        expect(ui.animating).toBe(false); expect(ui.celebration.active).toBe(false); expect(sound).not.toHaveBeenCalled();
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('new win and bonus reveals bring the stage into view without scrolling on unchanged polls', () => {
    jest.useFakeTimers(); const ui = new SlotMachineUI(jest.fn()); ui.stage.scrollIntoView = jest.fn();
    try {
        ui.update(view);
        const triggered = resultView(2, { session: { bonus: true, freeSpins: 5 } });
        triggered.session.last.freeAwarded = 5;
        ui.update(triggered); jest.advanceTimersByTime(1700);
        expect(ui.stage.scrollIntoView).toHaveBeenCalledTimes(1);
        ui.update(triggered); expect(ui.stage.scrollIntoView).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(2500); expect(ui.stage.scrollIntoView).toHaveBeenCalledTimes(2);
        ui.update(triggered); expect(ui.stage.scrollIntoView).toHaveBeenCalledTimes(2);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('Stop during a bonus pause cancels future spins but leaves the saved choice usable', () => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        ui.update(view); ui.count.value = '3'; ui.auto.click();
        const triggered = resultView(2, { session: { bonus: true, freeSpins: 5 } });
        triggered.session.last.freeAwarded = 5;
        ui.update(triggered); jest.advanceTimersByTime(4200);
        expect(ui.autoRemaining).toBe(2); ui.stop.click(); expect(ui.autoRemaining).toBe(0);
        ui.bonus.querySelector('button').click(); expect(send).toHaveBeenCalledTimes(2);
        ui.update({ ...triggered, session: { ...triggered.session, revision: 3, bonus: false } });
        jest.advanceTimersByTime(6000); expect(send).toHaveBeenCalledTimes(2);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('a pending payout waits for saved settlement before celebrating', () => {
    jest.useFakeTimers(); const ui = new SlotMachineUI(jest.fn());
    try {
        ui.update(view); const next = resultView(2, { processing: true }); next.session.last.payout = 200;
        ui.update(next); jest.advanceTimersByTime(2000); expect(ui.celebration.active).toBe(false); expect(ui.spin.disabled).toBe(true);
        ui.update({ ...next, processing: false }); expect(ui.celebration.active).toBe(true); expect(ui.spin.disabled).toBe(true);
        jest.advanceTimersByTime(2500); ui.update({ ...next, processing: false }); expect(ui.celebration.active).toBe(false);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('queued spins wait for settlement and animation, use fresh revisions and end at the selected count', () => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        ui.update(view); ui.count.value = '2'; ui.auto.click();
        expect(send).toHaveBeenCalledTimes(1);
        const before = ui.cells[0][0].label.textContent; jest.advanceTimersByTime(90);
        expect(ui.cells[0][0].label.textContent).not.toBe(before);
        ui.update(view); jest.advanceTimersByTime(1000); expect(send).toHaveBeenCalledTimes(1);
        ui.update(resultView(2, { processing: true })); jest.advanceTimersByTime(2300);
        expect(send).toHaveBeenCalledTimes(1);
        ui.update(resultView(2)); jest.advanceTimersByTime(500);
        expect(send).toHaveBeenLastCalledWith({ action: 'slot_spin', bet: 20, roundRevision: 2 });
        ui.update(resultView(3)); jest.advanceTimersByTime(5000);
        expect(send).toHaveBeenCalledTimes(2); expect(ui.autoRemaining).toBe(0);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test.each(['stop', 'leave', 'unavailable', 'funds', 'hidden', 'timeout'])('auto spins stop safely on %s', reason => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        ui.update(view); ui.count.value = '50'; ui.auto.click();
        if (reason === 'stop') ui.stop.click();
        if (reason === 'leave') ui.update(null);
        if (reason === 'unavailable') ui.update({ ...view, available: false });
        if (reason === 'hidden') {
            jest.spyOn(document, 'hidden', 'get').mockReturnValue(true);
            document.dispatchEvent(new Event('visibilitychange'));
        }
        if (reason === 'timeout') jest.advanceTimersByTime(10000);
        if (reason !== 'leave') ui.update(resultView(2, { gold: reason === 'funds' ? 0 : 300 }));
        jest.advanceTimersByTime(6000);
        expect(send).toHaveBeenCalledTimes(1); expect(ui.autoRemaining).toBe(0);
    } finally { ui.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); }
});

test.each(['theme', 'currency'])('retired bonus choices cannot act on a replacement machine with the same revision: %s', change => {
    const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        const bonus = { ...view, session: { ...view.session, bonus: true, freeSpins: 5 } };
        ui.update(bonus); const oldChoice = ui.bonus.querySelector('button');
        const replacement = change === 'theme' ? { ...bonus, machine: { ...machine, theme: 'fire' } } : { ...bonus, currency: 'ep' };
        ui.update(replacement); oldChoice.click();
        expect(send).not.toHaveBeenCalled();
        ui.bonus.querySelector('button').click();
        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenLastCalledWith({ action: 'slot_bonus', choice: 0, roundRevision: 1 });
    } finally { ui.dispose(); }
});

test('synchronizing retires bonus controls; same-revision recovery renders current choices without autoplay or replay', () => {
    jest.useFakeTimers(); const send = jest.fn(), sound = jest.fn(), ui = new SlotMachineUI(send, sound);
    try {
        ui.update(view); ui.count.value = '3'; ui.auto.click();
        const triggered = resultView(2, { session: { bonus: true, freeSpins: 5 } });
        triggered.session.last.freeAwarded = 5;
        ui.update(triggered); jest.advanceTimersByTime(4200);
        const oldChoice = ui.bonus.querySelector('button');
        const replacement = { ...triggered, machine: { ...machine, theme: 'water', bonusChoices: ['Read the tide', 'Open the shell'] } };
        ui.update({ ...replacement, available: false });
        expect(ui.autoRemaining).toBe(0); expect(ui.celebration.active).toBe(false);
        ui.update(replacement); oldChoice.click();
        expect(send).toHaveBeenCalledTimes(1);
        expect(ui.bonus.querySelector('button').textContent).toBe('Read the tide');
        expect(ui.animating).toBe(false); expect(ui.celebration.active).toBe(false);
        jest.advanceTimersByTime(6000); expect(send).toHaveBeenCalledTimes(1);
        ui.bonus.querySelector('button').click(); expect(send).toHaveBeenCalledTimes(2);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('leaving retires bonus choices and disposal cannot be revived by late snapshots', () => {
    jest.useFakeTimers(); const send = jest.fn(), ui = new SlotMachineUI(send);
    try {
        const bonus = { ...view, session: { ...view.session, bonus: true, freeSpins: 5 } };
        ui.update(bonus); const oldChoice = ui.bonus.querySelector('button');
        ui.update(null); ui.update(bonus); oldChoice.click(); expect(send).not.toHaveBeenCalled();
        ui.bonus.querySelector('button').click(); expect(send).toHaveBeenCalledTimes(1);
        ui.dispose(); ui.update(view); ui.count.value = '50'; ui.startAuto(); ui.spinOnce();
        jest.advanceTimersByTime(20000);
        expect(ui.root.hidden).toBe(true); expect(ui.view).toBeNull();
        expect(send).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
    } finally { ui.dispose(); jest.useRealTimers(); }
});

test('queue rejects invalid counts and consumes saved free spins without changing their stake', () => {
    const send = jest.fn(), ui = new SlotMachineUI(send);
    ui.update({ ...view, gold: 0, session: { ...view.session, bet: 40, freeSpins: 5 } });
    for (const count of ['0', '1001', '1.5', '']) { ui.count.value = count; ui.auto.click(); }
    expect(send).not.toHaveBeenCalled(); ui.count.value = '100'; ui.auto.click();
    expect(send).toHaveBeenCalledWith({ action: 'slot_spin', bet: 40, roundRevision: 1 });
    expect(ui.autoRemaining).toBe(99); ui.dispose();
});

test('only matching rejections release pending controls and never restart queued spins', () => {
    const send = jest.fn(), ui = new SlotMachineUI(send); ui.update(view); ui.auto.click();
    ui.rejectAction({ action: 'slot_spin', roundRevision: 0, error: 'old error' }); expect(ui.pending).toBeTruthy();
    ui.rejectAction({ action: 'slot_spin', roundRevision: 1, error: 'Not enough Gold' });
    expect(ui.pending).toBeNull(); expect(ui.autoRemaining).toBe(0); expect(ui.spin.disabled).toBe(false);
    expect(send).toHaveBeenCalledTimes(1); ui.dispose();
});

test('reduced motion settles without rolling symbols and disposal cancels timers', () => {
    jest.useFakeTimers(); const original = window.matchMedia;
    window.matchMedia = () => ({ matches: true }); const ui = new SlotMachineUI(jest.fn());
    try {
        ui.update(view); ui.spin.click(); expect(ui.grid.querySelectorAll('.rolling')).toHaveLength(0);
        ui.update(resultView(2)); jest.advanceTimersByTime(150);
        expect(ui.animating).toBe(false); expect(ui.result.textContent).toContain('0 Gold returned');
    } finally { ui.dispose(); window.matchMedia = original; jest.useRealTimers(); }
});

test('all elemental symbols have deterministic code-native icons', () => {
    const icons = new Set();
    for (const theme of ['earth', 'fire', 'water', 'air']) for (let symbol = 0; symbol < 8; symbol++) {
        const icon = getSlotSymbolIcon(theme, symbol); expect(icon).toContain('data:image/svg+xml');
        expect(getSlotSymbolIcon(theme, symbol)).toBe(icon); icons.add(icon);
    }
    expect(icons.size).toBe(32);
});

test('amount field and half/double controls change the next paid stake but not a pending spin', () => {
    const send = jest.fn(), ui = new SlotMachineUI(send); ui.update(view);
    ui.stake.value = '100'; ui.stake.oninput(); expect(ui.spin.textContent).toContain('100 Gold');
    ui.adjustments.lastChild.click(); expect(ui.stake.value).toBe('200');
    ui.adjustments.firstChild.click(); expect(ui.stake.value).toBe('100'); ui.spin.click();
    expect(send).toHaveBeenLastCalledWith({ action: 'slot_spin', bet: 100, roundRevision: 1 });
    ui.adjustments.lastChild.click(); expect(ui.stake.value).toBe('100');
    ui.update({ ...view, session: { ...view.session, bet: 100, revision: 2 } });
    ui.stake.value = '60'; ui.spin.click(); expect(send).toHaveBeenLastCalledWith({ action: 'slot_spin', bet: 60, roundRevision: 2 });
    ui.dispose();
});

test('Manual/Auto changes visibility and switching to Manual cancels future queued spins', () => {
    const ui = new SlotMachineUI(jest.fn()); ui.update(view);
    expect(ui.autoControls.hidden).toBe(true); ui.autoMode.click();
    expect(ui.spin.hidden).toBe(true); expect(ui.autoControls.hidden).toBe(false);
    ui.auto.click(); expect(ui.autoRemaining).toBe(49); ui.manualMode.click();
    expect(ui.autoRemaining).toBe(0); expect(ui.spin.hidden).toBe(false); expect(ui.pending).toBeTruthy(); ui.dispose();
});
