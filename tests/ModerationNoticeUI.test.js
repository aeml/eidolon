import { jest } from '@jest/globals';
import { ReportUI } from '../src/ui/ReportUI.js';

let ui, notice;
const publicNotice = { id: 'a'.repeat(64), reason: 'Reviewed public explanation.',
    startedAt: '2026-10-01T22:00:00Z', expiresAt: '2026-10-01T22:10:00Z' };
beforeEach(() => {
    jest.useFakeTimers(); jest.spyOn(crypto, 'randomUUID').mockReturnValue('notice-request-000001');
    document.body.innerHTML = `<div id="report-screen"><select><option>Bug Report</option><option>Moderation Appeal</option></select>
        <textarea></textarea><button id="submit">Submit</button><input id="report-diagnostics" type="checkbox">
        <pre id="report-context"></pre><p id="report-status"></p><output id="report-count"></output><p id="report-guidance"></p>
        <button id="btn-check-moderation"></button><button id="btn-appeal-moderation"></button><p id="moderation-notice-status"></p></div>`;
    ui = { reportScreen: document.querySelector('#report-screen'), reportText: document.querySelector('textarea'),
        reportType: document.querySelector('select'), btnSubmitReport: document.querySelector('#submit'),
        onReportSubmit: jest.fn(() => true), onModerationNoticeLookup: jest.fn(() => true) };
    ui.report = new ReportUI(ui); notice = ui.report.notice;
});
afterEach(() => { ui.report.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });

test('notice read sends only correlation and never submits an appeal or starts polling', () => {
    expect(ui.onModerationNoticeLookup).not.toHaveBeenCalled();
    notice.button.click(); notice.button.click();
    expect(ui.onModerationNoticeLookup).toHaveBeenCalledTimes(1);
    expect(ui.onModerationNoticeLookup).toHaveBeenCalledWith('notice-request-000001');
    expect(ui.onReportSubmit).not.toHaveBeenCalled();
    expect(notice.appeal.disabled).toBe(true);
});

test('only public fields render as text and only an explicit appeal click adds an editable draft', () => {
    ui.reportText.value = 'My existing draft.';
    notice.button.click();
    notice.handleResult({ requestId: 'older', success: true, notice: publicNotice });
    expect(notice.pending).not.toBeNull();
    notice.handleResult({ requestId: 'notice-request-000001', success: true,
        notice: { ...publicNotice, reason: '<img src=x> is literal text.', privateReason: 'Staff secret', actor: 'Private reviewer', reportId: 'Private case' } });
    expect(notice.status.textContent).toContain(publicNotice.id);
    expect(notice.status.textContent).toContain('<img src=x>');
    expect(document.querySelector('img')).toBeNull();
    expect(notice.status.textContent).not.toMatch(/Staff secret|Private reviewer|Private case/);
    expect(Object.keys(notice.notice)).toEqual(['id', 'reason', 'startedAt', 'expiresAt']);
    expect(ui.reportText.value).toBe('My existing draft.');
    notice.appeal.click();
    expect(ui.reportText.value).toContain('My existing draft.');
    expect(ui.reportText.value).toContain(`Moderation notice: ${publicNotice.id}`);
    expect(ui.reportType.value).toBe('Moderation Appeal');
    expect(ui.report.status.textContent).toContain('Nothing has been sent');
    expect(ui.onReportSubmit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(11000);
    expect(notice.status.textContent).toContain(publicNotice.id);
});

test('notice-free success does not claim a report was resolved and disables appeal', () => {
    notice.button.click(); notice.handleResult({ requestId: 'notice-request-000001', success: true });
    expect(notice.status.textContent).toContain('No active temporary chat-mute');
    expect(notice.status.textContent).toContain('not a report or appeal status check');
    expect(notice.appeal.disabled).toBe(true);
});

test.each(['offline', 'failure', 'timeout', 'invalid-notice'])('%s has no automatic retry, disclosure or appeal', mode => {
    if (mode === 'offline') ui.onModerationNoticeLookup.mockReturnValue(false);
    notice.button.click();
    if (mode === 'failure') notice.handleResult({ requestId: 'notice-request-000001', success: false, message: 'Private diagnostic' });
    if (mode === 'invalid-notice') notice.handleResult({ requestId: 'notice-request-000001', success: true, notice: { ...publicNotice, expiresAt: 'invalid date' } });
    jest.advanceTimersByTime(11000);
    expect(ui.onModerationNoticeLookup).toHaveBeenCalledTimes(1);
    expect(notice.status.textContent).not.toContain('Private');
    expect(notice.notice).toBeNull(); expect(notice.appeal.disabled).toBe(true);
});

test('appeal drafting protects pending submissions, oversized drafts and retired sessions', () => {
    ui.reportText.value = 'Submitted draft'; ui.report.submit();
    expect(ui.report.startModerationAppeal(publicNotice.id)).toBe(false);
    expect(ui.reportText.value).toBe('Submitted draft');
    ui.report.handleResult({ requestId: 'notice-request-000001', success: false });
    ui.reportText.value = 'x'.repeat(3190);
    expect(ui.report.startModerationAppeal(publicNotice.id)).toBe(false);
    expect(ui.reportText.value).toBe('x'.repeat(3190));
    expect(ui.report.startModerationAppeal('wrong reference')).toBe(false);
    ui.report.dispose(); expect(ui.report.startModerationAppeal(publicNotice.id)).toBe(false);
});

test('a replacement report session retires notice replies, controls and timeout', () => {
    notice.button.click(); const old = notice;
    ui.report = new ReportUI(ui); notice = ui.report.notice;
    old.handleResult({ requestId: 'notice-request-000001', success: true, notice: publicNotice });
    old.dispose(); jest.advanceTimersByTime(11000);
    expect(notice.status.textContent).toBe(''); expect(notice.appeal.disabled).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
});

test('retirement during send does not overwrite replacement controls or install an old timeout', () => {
    const old = notice;
    ui.onModerationNoticeLookup.mockImplementation(() => {
        ui.report = new ReportUI(ui); notice = ui.report.notice; return false;
    });
    old.check();
    expect(notice.status.textContent).toBe(''); expect(notice.button.disabled).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
});
