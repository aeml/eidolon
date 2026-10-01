import { jest } from '@jest/globals';
import { AdminUI } from '../src/ui/AdminUI.js';

let ui, send;
const report = { id: '0123456789abcdef01234567', status: 'open', reviewRevision: 3,
    username: 'reporter', reportType: 'Player Report', text: 'Private allegation' };
function reply(payload = {}) {
    ui.handleResult(`${ui.pending.type}_result`, { id: ui.pending.id, authorized: true, success: true, ...payload });
}
function review() { return ui.reportReviews[0]; }
beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<button id="launch"></button><div id="host"></div>';
    send = jest.fn();
    ui = new AdminUI({ host: document.getElementById('host'), launcher: document.getElementById('launch'), send,
        openWindow: element => { element.style.display = 'flex'; }, closeWindow: element => { element.style.display = 'none'; } });
    ui.connectionState('connected'); reply(); ui.launcher.click(); reply({ players: [] });
    ui.root.querySelector('[data-view="reports"]').click(); reply({ reports: { reports: [report] } });
});
afterEach(() => { ui.dispose(); jest.useRealTimers(); });

test('review requires reason and explicit confirmation; cancelling changes nothing', () => {
    const row = review(), calls = send.mock.calls.length;
    row.action.click(); expect(send).toHaveBeenCalledTimes(calls);
    expect(row.status.textContent).toContain('1–400');
    row.reason.value = 'Reviewed evidence'; row.action.click();
    expect(row.confirmation.hidden).toBe(false); expect(row.reason.readOnly).toBe(true);
    expect(send).toHaveBeenCalledTimes(calls);
    expect(document.activeElement).toBe(row.cancel);
    row.cancel.click(); expect(row.quote).toBeNull(); expect(row.reason.readOnly).toBe(false);
    expect(send).toHaveBeenCalledTimes(calls);
});

test.each(['A reason\u0001with a control', 'A reason\u0085with a control', '界'.repeat(401)])('invalid reason stays local', reason => {
    const row = review(), calls = send.mock.calls.length;
    row.reason.value = reason; row.action.click();
    expect(row.quote).toBeUndefined(); expect(send).toHaveBeenCalledTimes(calls);
});

test('confirmation sends the displayed case quote only once, and success rereads the queue', () => {
    const row = review(); row.reason.value = 'Reviewed evidence'; row.action.click();
    const quote = { ...row.quote }; row.confirm.click(); row.confirm.click();
    expect(send.mock.calls.filter(([type]) => type === 'admin_report_review')).toHaveLength(1);
    expect(send).toHaveBeenLastCalledWith('admin_report_review', quote);
    expect(quote).toMatchObject({ reportId: report.id, expectedRevision: 3, expectedStatus: 'open', status: 'resolved', confirmed: true });
    expect(row.reason.disabled).toBe(true);
    reply({ final: true, message: 'Review recorded at revision 4.' });
    expect(send).toHaveBeenLastCalledWith('admin_reports', { id: ui.pending.id, before: '', status: 'open' });
    expect(row.disposed).toBe(true);
    reply({ reports: { reports: [] } }); expect(ui.status.textContent).toContain('revision 4');
});

test('ambiguous outcome offers manual exact retry, never a fresh nonce or automatic action', () => {
    const row = review(); row.reason.value = 'Reviewed evidence'; row.action.click(); row.confirm.click();
    const quote = { ...row.quote };
    reply({ success: false, pending: true, message: 'Outcome unknown.' });
    jest.advanceTimersByTime(1000);
    expect(send.mock.calls.filter(([type]) => type === 'admin_report_review')).toHaveLength(1);
    expect(row.confirm.textContent).toBe('Retry same review'); expect(row.confirm.disabled).toBe(false);
    row.confirm.click(); expect(send).toHaveBeenLastCalledWith('admin_report_review', quote);
    reply({ success: false, final: true, message: 'Case changed. Refresh.' });
    expect(row.confirm.disabled).toBe(true); expect(row.action.disabled).toBe(true);
    expect(row.status.textContent).toContain('Refresh');
});

test.each(['refresh', 'disconnect', 'revocation'])('a retired row cannot send after %s', mode => {
    const row = review(); row.reason.value = 'Reviewed evidence'; row.action.click();
    if (mode === 'refresh') ui.refresh.click();
    if (mode === 'disconnect') ui.connectionState('disconnected');
    if (mode === 'revocation') ui.setAuthorized(false);
    const calls = send.mock.calls.length; row.confirm.click();
    expect(row.disposed).toBe(true); expect(send).toHaveBeenCalledTimes(calls);
});

test('legacy revision defaults to zero, invalid case IDs stay read-only, and reopen is explicit', () => {
    ui.refresh.click(); reply({ reports: { reports: [{ ...report, reviewRevision: undefined, status: 'resolved' }] } });
    let row = review(); row.reason.value = 'New evidence supplied'; row.action.click();
    expect(row.quote).toMatchObject({ expectedRevision: 0, expectedStatus: 'resolved', status: 'open' });
    row.cancel.click(); ui.refresh.click();
    reply({ reports: { reports: [{ ...report, id: '000000000000000000000000' }] } });
    row = review(); expect(row.action.disabled).toBe(true); expect(row.quote).toBeUndefined();
});
