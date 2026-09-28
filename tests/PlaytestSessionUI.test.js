import { jest } from '@jest/globals';
import { PlaytestSessionUI, appendPlaytestReportDraft } from '../src/ui/PlaytestSessionUI.js';

let ui, now;
beforeEach(() => { jest.useFakeTimers(); document.body.innerHTML = '<div id="host"></div>'; now = 0; });
afterEach(() => { ui?.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });
const create = options => (ui = new PlaytestSessionUI(document.querySelector('#host'), {
    now: () => now, sample: () => ({ connected: true, level: 1 }), ...options
}));

test('off by default, explicit start/stop/clear, no automatic draft or storage', () => {
    const appendDraft = jest.fn(() => true);
    create({ appendDraft });
    expect(jest.getTimerCount()).toBe(0); expect(ui.attach.disabled).toBe(true);
    ui.start.click(); expect(jest.getTimerCount()).toBe(1);
    now = 1000; jest.advanceTimersByTime(1000);
    ui.activity.value = 'lost'; ui.activity.dispatchEvent(new Event('change'));
    now = 2000; ui.stop.click();
    expect(ui.session.totals).toMatchObject({ exploring: 1000, lost: 1000 });
    expect(jest.getTimerCount()).toBe(0); expect(appendDraft).not.toHaveBeenCalled();
    ui.attach.click(); expect(appendDraft).toHaveBeenCalledTimes(1);
    ui.clear.click(); expect(ui.summary.textContent).toBe('No observations recorded.');
    expect(ui.start.disabled).toBe(false); expect(ui.attach.disabled).toBe(true);
});

test('input inactivity and connection state do not silently count as active combat', () => {
    let connected = true;
    create({ sample: () => ({ connected, level: 2 }) }); ui.start.click();
    for (let second = 1; second <= 61; second++) { now = second * 1000; jest.advanceTimersByTime(1000); }
    expect(ui.session.totals.idle).toBe(1000);
    document.dispatchEvent(new Event('pointerdown'));
    connected = false; now = 62000; ui.tick();
    now = 63000; ui.tick();
    expect(ui.session.totals.disconnected).toBe(1000);
    expect(ui.session.active()).toBe(60000);
});

test('reconstruction disposes the old timer and private session without duplicate controls', () => {
    const old = create(); old.start.click(); now = 1000; old.tick();
    create(); expect(old.session.started).toBe(false); expect(jest.getTimerCount()).toBe(0);
    expect(document.querySelectorAll('[data-start]')).toHaveLength(1);
    expect(ui.session.started).toBe(false);
});

test('sharing preserves exact existing text, rejects busy/oversized drafts and never submits', () => {
    const host = { reportText: { value: 'My issue\n' }, reportScreen: {}, report: {
        updateCount: jest.fn(), setStatus: jest.fn(), submit: jest.fn()
    }, isElementVisible: () => false, toggleReport: jest.fn() };
    expect(appendPlaytestReportDraft(host, 'Summary')).toBe(true);
    expect(host.reportText.value).toBe('My issue\n\n\nSummary');
    expect(host.toggleReport).toHaveBeenCalledTimes(1); expect(host.report.submit).not.toHaveBeenCalled();
    host.report.pending = {}; expect(appendPlaytestReportDraft(host, 'Extra')).toBe(false);
    host.report.pending = null; host.reportText.value = 'x'.repeat(3200);
    expect(appendPlaytestReportDraft(host, 'Extra')).toBe(false); expect(host.reportText.value).toHaveLength(3200);
});
