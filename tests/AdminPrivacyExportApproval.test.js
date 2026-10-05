import { jest } from '@jest/globals';
import { AdminUI } from '../src/ui/AdminUI.js';
import { GameEngine } from '../src/core/GameEngine.js';

let ui, send;
const report = { id: '0123456789abcdef01234567', status: 'open', reviewRevision: 2,
    reportType: 'Account Data Export', username: 'owner', text: 'My private request' };
const reply = extra => ui.handleResult(`${ui.pending.type}_result`, {id: ui.pending.id, authorized: true, success: true, ...extra});
const control = () => ui.reportReviews[1];
beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<button id="launch"></button><div id="host"></div>';
    send = jest.fn();
    ui = new AdminUI({host: document.querySelector('#host'), launcher: document.querySelector('#launch'), send,
        openWindow: element => { element.style.display = 'flex'; }, closeWindow: element => { element.style.display = 'none'; }});
    ui.connectionState('connected'); reply(); ui.launcher.click(); reply({players: []});
    ui.root.querySelector('[data-view="reports"]').click(); reply({reports: {reports: [report]}});
});
afterEach(() => {ui.dispose();jest.useRealTimers();});

test('review and approval are separate; confirmation uses exact case and permission revisions', () => {
    expect(ui.reportReviews).toHaveLength(2);
    const row = control(), before = send.mock.calls.length;
    expect(row.action.textContent).toBe('Approve owner export');
    expect(row.status.textContent).toContain('sends no data now and never deletes');
    row.action.click(); expect(send).toHaveBeenCalledTimes(before);
    row.reason.value = 'Ownership and scope reviewed'; row.action.click();
    expect(row.confirmation.textContent).toContain('cannot recall');
    row.cancel.click(); expect(send).toHaveBeenCalledTimes(before);
    row.action.click(); row.confirm.click(); row.confirm.click();
    expect(send.mock.calls.filter(([type]) => type === 'admin_privacy_export_approval')).toHaveLength(1);
    expect(send).toHaveBeenLastCalledWith('admin_privacy_export_approval', expect.objectContaining({
        reportId: report.id, expectedRevision: 0, expectedReviewRevision: 2, expectedStatus: 'open', enabled: true, confirmed: true
    }));
    reply({final: true, message: 'Decision recorded; refresh for current permission.'});
    expect(row.disposed).toBe(true); expect(ui.pending.type).toBe('admin_reports');
});

test('revoke is a separate explicit decision and no download or removal is triggered', () => {
    ui.refresh.click(); reply({reports: {reports: [{...report, exportApproval: {enabled: true, revision: 1}}]}});
    const row = control();
    expect(row.action.textContent).toContain('Revoke'); row.reason.value = 'Request withdrawn'; row.action.click();
    expect(row.confirm.textContent).toBe('Confirm revoke');
    row.confirm.click();
    expect(send).toHaveBeenLastCalledWith('admin_privacy_export_approval', expect.objectContaining({expectedRevision: 1, enabled: false}));
    expect(send.mock.calls.some(([type]) => /download|delete|remove/.test(type))).toBe(false);
});

test('an ambiguous approval permits only manual exact retry and result must correlate', () => {
    const row = control(); row.reason.value = 'Reviewed owner'; row.action.click(); row.confirm.click();
    const quote = {...row.quote};
    GameEngine.prototype.handleServerMessage.call({uiManager: {admin: ui}, player: {id: 'staff'}},
        {type: 'admin_privacy_export_approval_result', payload: {id: 'different-case', authorized: true, success: true}});
    expect(ui.pending.id).toBe(quote.id);
    GameEngine.prototype.handleServerMessage.call({uiManager: {admin: ui}, player: {id: 'staff'}},
        {type: 'admin_privacy_export_approval_result', payload: {id: quote.id, authorized: true, success: false, pending: true, message: 'Outcome unknown'}});
    jest.advanceTimersByTime(1000);
    expect(send.mock.calls.filter(([type]) => type === 'admin_privacy_export_approval')).toHaveLength(1);
    expect(row.confirm.disabled).toBe(false); row.confirm.click();
    expect(send).toHaveBeenLastCalledWith('admin_privacy_export_approval', quote);
});

test.each(['refresh', 'disconnect', 'revocation'])('retired permission quote cannot send after %s', mode => {
    const row = control(); row.reason.value = 'Reviewed owner'; row.action.click();
    if (mode === 'refresh') ui.refresh.click();
    if (mode === 'disconnect') ui.connectionState('disconnected');
    if (mode === 'revocation') ui.setAuthorized(false);
    const before = send.mock.calls.length; row.confirm.click();
    expect(row.disposed).toBe(true); expect(send).toHaveBeenCalledTimes(before);
});

test.each([{enabled: true, revision: 0}, {enabled: 'true', revision: 1}, {enabled: false, revision: 256}])('corrupt or exhausted permission is read-only: %j', exportApproval => {
    ui.refresh.click(); reply({reports: {reports: [{...report, exportApproval}]}});
    expect(control().action.disabled).toBe(true);
});

test('a removal request has case review only and never an export approval control', () => {
    ui.refresh.click(); reply({reports: {reports: [{...report, reportType: 'Account Removal Request'}]}});
    expect(ui.reportReviews).toHaveLength(1);
    expect(ui.list.textContent).not.toContain('Approve owner export');
});
