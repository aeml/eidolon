import { jest } from '@jest/globals';
import { ReportLookupUI } from '../src/ui/ReportLookupUI.js';

let ui, lookup;
const reference = '0123456789abcdef01234567';
const report = { id: reference, reportType: 'Moderation Appeal', status: 'open', createdAt: '2026-10-01T12:00:00Z' };
beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('lookup-request-000001');
    document.body.innerHTML = '<div id="report-screen"><input id="report-reference"><button id="btn-check-report"></button><p id="report-lookup-status"></p></div>';
    ui = { reportScreen: document.querySelector('#report-screen'), onReportLookup: jest.fn(() => true) };
    lookup = new ReportLookupUI(ui);
});
afterEach(() => { lookup.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });

test('checking requires a valid reference and never submits or caches a report', () => {
    for (const value of ['', 'other-account', '0'.repeat(24)]) {
        lookup.reference.value = value; lookup.button.click();
    }
    expect(ui.onReportLookup).not.toHaveBeenCalled();
    lookup.reference.value = reference.toUpperCase(); lookup.button.click(); lookup.button.click();
    expect(ui.onReportLookup).toHaveBeenCalledTimes(1);
    expect(ui.onReportLookup).toHaveBeenCalledWith(reference, 'lookup-request-000001');
    expect(lookup.reference.readOnly).toBe(true); expect(lookup.button.disabled).toBe(true);
});

test('only the matching response is rendered; staff notes and allegation text stay hidden', () => {
    lookup.remember(reference); lookup.button.click();
    lookup.handleResult({requestId: 'older', success: true, report});
    expect(lookup.pending).not.toBeNull();
    lookup.handleResult({requestId: 'lookup-request-000001', success: true,
        report: {...report, text: '<img src=x> secret allegation', lastReview: {reason: 'private staff note'}}});
    expect(lookup.status.textContent).toContain('Awaiting operator review');
    expect(lookup.status.textContent).toContain('2026-10-01 12:00 UTC');
    expect(lookup.status.textContent).not.toMatch(/secret|private staff|img/);
    expect(document.querySelector('img')).toBeNull();
    expect(lookup.reference.value).toBe(reference); expect(lookup.button.disabled).toBe(false);
});

test('resolved and reopened reports do not promise a fix or sanction reversal', () => {
    lookup.remember(reference); lookup.button.click();
    lookup.handleResult({requestId: 'lookup-request-000001', success: true,
        report: {...report, status: 'resolved', resolvedAt: '2026-10-01T13:00:00Z'}});
    expect(lookup.status.textContent).toContain('Review finished');
    expect(lookup.status.textContent).toContain('not a promised fix or sanction reversal');
    lookup.button.click();
    lookup.handleResult({requestId: 'lookup-request-000001', success: true, report});
    expect(lookup.status.textContent).toContain('Awaiting operator review');
    expect(lookup.status.textContent).not.toContain('Reviewed 2026');
});

test.each(['offline', 'failure', 'timeout', 'wrong-case'])('%s preserves the reference with no automatic retry', mode => {
    lookup.remember(reference);
    if (mode === 'offline') ui.onReportLookup.mockReturnValue(false);
    lookup.button.click();
    if (mode === 'failure') lookup.handleResult({requestId: 'lookup-request-000001', success: false, message: 'sensitive diagnostic'});
    if (mode === 'wrong-case') lookup.handleResult({requestId: 'lookup-request-000001', success: true, report: {...report, id: 'abcdef0123456789abcdef01'}});
    jest.advanceTimersByTime(11000);
    expect(ui.onReportLookup).toHaveBeenCalledTimes(1);
    expect(lookup.reference.value).toBe(reference); expect(lookup.button.disabled).toBe(false);
    expect(lookup.status.textContent).not.toContain('sensitive');
});

test('retiring a session clears references/results and prevents delayed replies or clicks', () => {
    lookup.remember(reference); lookup.button.click(); lookup.dispose();
    lookup.handleResult({requestId: 'lookup-request-000001', success: true, report});
    lookup.button.click(); jest.advanceTimersByTime(11000);
    expect(lookup.reference.value).toBe(''); expect(lookup.status.textContent).toBe('');
    expect(ui.onReportLookup).toHaveBeenCalledTimes(1);
});

test('a synchronous test response cannot leave a timeout that overwrites confirmed status', () => {
    ui.onReportLookup.mockImplementation(() => {
        lookup.handleResult({requestId: 'lookup-request-000001', success: true, report}); return true;
    });
    lookup.remember(reference); lookup.button.click(); jest.advanceTimersByTime(11000);
    expect(lookup.status.textContent).toContain('Awaiting operator review');
});

test('retired lookup cannot erase or remember references in its replacement', () => {
    const old = lookup;
    old.dispose(); lookup = new ReportLookupUI(ui);
    lookup.remember(reference); lookup.button.click();
    old.remember('abcdef0123456789abcdef01'); old.dispose();
    expect(lookup.reference.value).toBe(reference);
    expect(lookup.reference.readOnly).toBe(true);
    expect(lookup.button.disabled).toBe(true);
    expect(lookup.status.textContent).toBe('Checking your report…');
    expect(jest.getTimerCount()).toBe(1);
});

test('failed send after retirement cannot overwrite the replacement status', () => {
    const old = lookup;
    ui.onReportLookup.mockImplementation(() => {
        old.dispose(); lookup = new ReportLookupUI(ui);
        lookup.status.textContent = 'Current session status'; return false;
    });
    old.remember(reference); old.lookup();
    expect(lookup.status.textContent).toBe('Current session status');
    expect(jest.getTimerCount()).toBe(0);
});
