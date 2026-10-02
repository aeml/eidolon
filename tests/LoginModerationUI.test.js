import { jest } from '@jest/globals';
import { LoginModerationUI } from '../src/ui/LoginModerationUI.js';

let support, socket, current, root, button;
const notice = { kind: 'suspend', id: 'a'.repeat(64), reason: 'Public suspension explanation.', startedAt: '2026-10-02T01:00:00Z', expiresAt: '2026-10-02T02:00:00Z' };
beforeEach(() => {
    jest.useFakeTimers(); jest.spyOn(crypto, 'randomUUID').mockReturnValue('login-appeal-request-001');
    document.body.innerHTML = `<button id="help" hidden>Account help</button><div id="report-screen" style="display:none">
      <select id="report-type"><option>Bug Report</option><option>Player Report</option><option>Moderation Appeal</option><option>Feature Request</option></select>
      <textarea id="report-text"></textarea><button id="btn-submit-report">Submit</button><button id="btn-cancel-report">Cancel</button><button id="btn-close-report-header">Close</button>
      <input id="report-diagnostics" type="checkbox"><pre id="report-context"></pre><p id="report-status"></p><output id="report-count"></output><p id="report-guidance"></p>
      <input id="report-reference"><button id="btn-check-report">Check status</button><p id="report-lookup-status"></p>
      <button id="btn-check-moderation">Check notices</button><button id="btn-appeal-moderation">Start appeal</button><p id="moderation-notice-status"></p></div>`;
    root = document.querySelector('#report-screen'); button = document.querySelector('#help');
    current = true; socket = { readyState: 1, send: jest.fn() };
    support = new LoginModerationUI({ root, button, socket, isCurrent: () => current });
});
afterEach(() => { support?.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });
const sent = () => socket.send.mock.calls.map(([value]) => JSON.parse(value));

test('authenticated help opens the shared form without world entry or automatic data collection', () => {
    expect(button.hidden).toBe(false); expect(socket.send).not.toHaveBeenCalled();
    button.click(); expect(root.style.display).toBe('flex'); expect(root.style.zIndex).toBe('10005');
    expect(root.classList.contains('support-window--login-report')).toBe(true);
    expect(root.querySelector('#report-type').value).toBe('Moderation Appeal');
    expect([...root.querySelector('#report-type').options].filter(option => !option.disabled).map(option => option.value)).toEqual(['Moderation Appeal']);
    root.querySelector('#btn-cancel-report').click(); expect(root.style.display).toBe('none');
    expect(socket.send).not.toHaveBeenCalled();
});

test('only an explicit notice check sends a bounded owner-only read and can draft an appeal', () => {
    button.click(); root.querySelector('#btn-check-moderation').click();
    expect(sent()).toEqual([{ type: 'moderation_notice', payload: { requestId: 'login-appeal-request-001' } }]);
    expect(support.handleMessage({ type: 'moderation_notice_result', payload: { requestId: 'login-appeal-request-001', success: true, notices: [notice], privateReason: 'Staff secret' } })).toBe(true);
    expect(root.textContent).toContain(notice.reason); expect(root.textContent).not.toContain('Staff secret');
    root.querySelector('#btn-appeal-moderation').click();
    expect(root.querySelector('#report-text').value).toContain(notice.id);
    expect(socket.send).toHaveBeenCalledTimes(1);
});

test('appeal submission preserves the draft until a matching durable acknowledgement', () => {
    const text = root.querySelector('#report-text'); text.value = 'Please review this decision.';
    root.querySelector('#btn-submit-report').click();
    expect(sent()[0].type).toBe('report'); expect(sent()[0].payload.reportType).toBe('Moderation Appeal');
    expect(text.value).toBe('Please review this decision.');
    support.handleMessage({ type: 'report_result', payload: { requestId: 'older-owner', success: true } });
    expect(text.value).toBe('Please review this decision.');
    support.handleMessage({ type: 'report_result', payload: { requestId: 'login-appeal-request-001', success: true, reportId: 'b'.repeat(24) } });
    expect(text.value).toBe(''); expect(root.textContent).toContain('Report saved');
});

test('timeout retains an uncertain appeal without automatic resubmission', () => {
    const text = root.querySelector('#report-text'); text.value = 'My explicit appeal.';
    support.report.submit(); jest.advanceTimersByTime(16000);
    expect(text.value).toBe('My explicit appeal.'); expect(root.textContent).toContain('no automatic retry');
    expect(socket.send).toHaveBeenCalledTimes(1);
});

test('Escape closes the current modal even when submission disabled the focused button', () => {
    support.open(); root.querySelector('#report-text').value = 'My appeal'; support.report.submit();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(root.style.display).toBe('none'); expect(document.activeElement).toBe(button);
    expect(support.report.pending).not.toBeNull(); expect(socket.send).toHaveBeenCalledTimes(1);
});

test('outside-world UI cannot submit another report category even if DOM selection is forced', () => {
    root.querySelector('#report-type').value = 'Bug Report'; root.querySelector('#report-text').value = 'Not an appeal.';
    support.report.submit(); expect(socket.send).not.toHaveBeenCalled();
});

test.each(['closed', 'replaced', 'retired'])('%s login session cannot read, submit or accept old replies', mode => {
    if (mode === 'closed') socket.readyState = 3;
    if (mode === 'replaced') current = false;
    if (mode === 'retired') support.dispose();
    expect(support.open()).toBe(false);
    expect(support.send('report', {})).toBe(false);
    expect(support.handleMessage({ type: 'moderation_notice_result', payload: { success: true, notices: [notice] } })).toBe(false);
    expect(socket.send).not.toHaveBeenCalled();
});

test('replacement owns the shared DOM once and disposal restores the normal report form', () => {
    root.querySelector('#report-text').value = 'Old private draft';
    const previous = support, nextSocket = { readyState: 1, send: jest.fn() };
    support = new LoginModerationUI({ root, button, socket: nextSocket, isCurrent: () => true });
    expect(previous.disposed).toBe(true); expect(root.querySelector('#report-text').value).toBe('');
    previous.dispose(); button.click(); root.querySelector('#btn-check-moderation').click();
    expect(socket.send).not.toHaveBeenCalled(); expect(nextSocket.send).toHaveBeenCalledTimes(1);
    support.dispose(); expect(button.hidden).toBe(true); expect(root.style.display).toBe('none');
    expect(root.classList.contains('support-window--login-report')).toBe(false);
    expect([...root.querySelector('#report-type').options].every(option => !option.disabled)).toBe(true);
    jest.advanceTimersByTime(60000); expect(nextSocket.send).toHaveBeenCalledTimes(1);
});
