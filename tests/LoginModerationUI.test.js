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
const nameNotice = { ...notice, kind: 'require_name_change', expiresAt: '0001-01-01T00:00:00Z' };
const readNameNotice = () => {
    root.querySelector('#btn-check-moderation').click();
    support.handleMessage({ type: 'moderation_notice_result', payload: { requestId: 'login-appeal-request-001', success: true, notices: [nameNotice] } });
};

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

test('name notice enables an explicit review and separate confirmation without changing the appeal draft', () => {
    const draft = root.querySelector('#report-text'); draft.value = 'My retained appeal draft.';
    readNameNotice(); const name = support.nameCorrection;
    expect(name.root.hidden).toBe(false); name.input.value = 'Arcanis Dawn'; name.review.click();
    expect(socket.send).toHaveBeenCalledTimes(1); expect(name.quote.textContent).toContain('Arcanis Dawn');
    expect(name.quote.textContent).toContain(nameNotice.id); expect(name.input.disabled).toBe(true);
    name.cancel.click(); expect(socket.send).toHaveBeenCalledTimes(1); expect(name.input.disabled).toBe(false);
    name.review.click(); name.confirm.click(); name.confirm.click();
    expect(sent()[1]).toEqual({ type: 'public_name_correction', payload: { id: 'login-appeal-request-001', noticeId: nameNotice.id, publicName: 'Arcanis Dawn', confirmed: true } });
    expect(socket.send).toHaveBeenCalledTimes(2); expect(draft.value).toBe('My retained appeal draft.');
    support.handleMessage({ type: 'public_name_correction_result', payload: { id: 'wrong-owner', success: true, final: true } });
    expect(name.input.value).toBe('Arcanis Dawn');
    support.handleMessage({ type: 'public_name_correction_result', payload: { id: 'login-appeal-request-001', success: true, final: true, message: 'Correction recorded; other restrictions remain.' } });
    expect(name.input.value).toBe(''); expect(name.notice).toBeNull(); expect(name.status.textContent).toContain('other restrictions remain');
    expect(draft.value).toBe('My retained appeal draft.');
});

test('name-correction timeout retains the exact captured request and never retries automatically', () => {
    readNameNotice(); const name = support.nameCorrection; name.input.value = 'Arcanis Dawn'; name.review.click(); name.confirm.click();
    const first = sent()[1]; jest.advanceTimersByTime(11000);
    expect(socket.send).toHaveBeenCalledTimes(2); expect(name.confirm.textContent).toContain('Retry exact');
    expect(name.cancel.disabled).toBe(true); name.input.value = 'Changed after submission'; name.confirm.click();
    expect(sent()[2]).toEqual(first);
    support.handleMessage({ type: 'public_name_correction_result', payload: { id: first.payload.id, success: false, pending: true, message: 'Unknown outcome' } });
    name.confirm.click(); expect(sent()[3]).toEqual(first);
});

test('unsolicited notice replies cannot retire an unsubmitted name review', () => {
    readNameNotice(); const name = support.nameCorrection; name.input.value = 'Arcanis Dawn'; name.review.click();
    const confirmed = name.confirmed;
    support.handleMessage({ type: 'moderation_notice_result', payload: { success: true, notices: [] } });
    expect(name.confirmed).toBe(confirmed); expect(name.notice.id).toBe(nameNotice.id);
});

test('name correction cannot be enabled from a mute or invalid notice and rejects unsafe labels', () => {
    root.querySelector('#btn-check-moderation').click();
    support.handleMessage({ type: 'moderation_notice_result', payload: { requestId: 'login-appeal-request-001', success: true, notices: [notice] } });
    expect(support.nameCorrection.root.hidden).toBe(true);
    readNameNotice(); const name = support.nameCorrection;
    for (const value of ['aa', ' Arcanis', '<script>alert(1)', '2Name', 'Arcanis\u202e']) {
        name.input.value = value; name.review.click(); expect(name.confirmed).toBeFalsy();
    }
    expect(sent().every(message => message.type === 'moderation_notice')).toBe(true);
});

test('retired name controls cannot send or receive and disposal leaves no duplicate controls', () => {
    readNameNotice(); const name = support.nameCorrection; name.input.value = 'Arcanis Dawn'; name.review.click();
    support.dispose(); const before = socket.send.mock.calls.length;
    name.confirm.click(); name.handleResult({ id: 'login-appeal-request-001', success: true, final: true });
    expect(socket.send).toHaveBeenCalledTimes(before); expect(root.querySelector('.public-name-correction')).toBeNull();
    expect(name.confirmed).toBeNull();
});
