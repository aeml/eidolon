import { jest } from '@jest/globals';
import { AdminUI } from '../src/ui/AdminUI.js';

let ui, send;
const report = { id: '0123456789abcdef01234567', status: 'open', reviewRevision: 0,
    username: 'innocent-reporter', reportType: 'Player Report', text: 'Private allegation' };
const target = { accountId: 'abcdef012345678901234567', account: 'alice', revision: 2 };
const notice = { id: 'b'.repeat(64), reason: 'Public reason', startedAt: '2026-10-01T22:00:00Z', expiresAt: '2026-10-01T22:10:00Z' };
function reply(payload = {}) {
    ui.handleResult(`${ui.pending.type}_result`, { id: ui.pending.id, authorized: true, success: true, ...payload });
}
function row() { return ui.reportModerations[0]; }
function lookup(value = target) {
    row().targetInput.value = value.account; row().lookup.click(); reply({ target: value });
}
function prepare() {
    row().duration.value = '10'; row().publicReason.value = 'Public explanation'; row().privateReason.value = 'Private evidence'; row().mute.click();
}
beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<button id="launch"></button><div id="host"></div>';
    send = jest.fn();
    ui = new AdminUI({ host: document.getElementById('host'), launcher: document.getElementById('launch'), send,
        openWindow: element => { element.style.display = 'flex'; }, closeWindow: element => { element.style.display = 'none'; } });
    ui.connectionState('connected'); reply(); ui.launcher.click(); reply({ players: [] });
    ui.chatModerationEnabled = true; // Prepared presentation, not production activation.
    ui.root.querySelector('[data-view="reports"]').click(); reply({ reports: { reports: [report] } });
});
afterEach(() => { ui.dispose(); jest.useRealTimers(); });

test('subject is explicit, not the report author, and mute requires quoted confirmation', () => {
    expect(row().targetInput.value).toBe(''); expect(row().mute.disabled).toBe(true);
    row().lookup.click(); expect(row().status.textContent).toContain('exact account');
    lookup(); const count = send.mock.calls.length;
    row().mute.click(); expect(row().status.textContent).toContain('private reason');
    prepare(); expect(send).toHaveBeenCalledTimes(count);
    expect(row().quote).toMatchObject({ accountId: target.accountId, reportId: report.id, expectedRevision: 2,
        durationSeconds: 600, publicReason: 'Public explanation', privateReason: 'Private evidence', confirmed: true });
    expect(row().quoteText.textContent).toContain('alice'); expect(row().quoteText.textContent).not.toContain('innocent-reporter');
    expect(document.activeElement).toBe(row().cancel); expect(row().targetInput.disabled).toBe(true);
    row().cancel.click(); expect(row().quote).toBeNull(); expect(send).toHaveBeenCalledTimes(count);
    prepare(); const quoted = { ...row().quote }; row().confirm.click();
    expect(send).toHaveBeenLastCalledWith('admin_chat_moderation', quoted);
    row().confirm.click(); expect(send).toHaveBeenCalledTimes(count + 1);
});

test('reversal quotes the exact notice and has no duration or public explanation', () => {
    lookup({ ...target, notice }); row().privateReason.value = 'Appeal reviewed'; row().revoke.click();
    expect(row().quote).toMatchObject({ action: 'revoke', noticeId: notice.id, durationSeconds: 0, publicReason: '', privateReason: 'Appeal reviewed' });
    row().confirm.click(); reply({ final: true, message: 'Reversal recorded.' });
    expect(row().target).toBeNull(); expect(row().confirmation.hidden).toBe(true); expect(row().mute.disabled).toBe(true);
});

test('unknown reply and timeout retain the exact decision with only manual retry', () => {
    lookup(); prepare(); const quoted = { ...row().quote }; row().confirm.click();
    reply({ success: false, pending: true, message: 'Unknown write outcome.' });
    expect(row().confirm.textContent).toContain('exact same');
    row().privateReason.value = 'Changed after send'; row().confirm.click();
    expect(send).toHaveBeenLastCalledWith('admin_chat_moderation', quoted);
    const count = send.mock.calls.length; jest.advanceTimersByTime(10_001);
    expect(send).toHaveBeenCalledTimes(count); expect(ui.authorized).toBe(true);
    expect(row().quote).toEqual(quoted); expect(row().confirm.disabled).toBe(false);
    expect(ui.actor.disabled).toBe(false); expect(ui.action.disabled).toBe(false);
    row().confirm.click(); expect(send).toHaveBeenLastCalledWith('admin_chat_moderation', quoted);
    reply({ success: false, final: true, message: 'Conflict: refresh.' });
    expect(row().quote).toBeNull(); expect(row().lookup.disabled).toBe(false); expect(row().mute.disabled).toBe(true);
});

test('lookup failures and malformed subjects never enable a decision', () => {
    for (const invalid of [{ ...target, account: 'bob' }, { ...target, accountId: 'bad' }, { ...target, revision: 300 },
        { ...target, notice: { ...notice, id: 'bad' } }, { ...target, notice: { ...notice, expiresAt: 'invalid' } }]) {
        row().targetInput.value = 'alice'; row().lookup.click(); reply({ target: invalid });
        expect(row().target).toBeNull(); expect(row().mute.disabled).toBe(true);
    }
    row().lookup.click(); reply({ success: false, message: 'Unavailable.' }); expect(row().target).toBeNull();
    row().lookup.click(); jest.advanceTimersByTime(10_001); expect(row().lookup.disabled).toBe(false); expect(row().mute.disabled).toBe(true);
});

test('duration, UTF8 bounds, control text and storage reversal capacity are preserved', () => {
    lookup(); row().privateReason.value = 'Private evidence'; row().publicReason.value = 'Public explanation';
    for (const minutes of ['', '0', '1.5', '43201']) { row().duration.value = minutes; row().mute.click(); expect(row().quote).toBeUndefined(); }
    row().duration.value = '10'; row().publicReason.value = '😀'.repeat(151); row().mute.click(); expect(row().quote).toBeUndefined();
    row().publicReason.value = 'Public\u0001explanation'; row().mute.click(); expect(row().quote).toBeUndefined();
    row().publicReason.value = 'Public explanation'; row().privateReason.value = '😀'.repeat(401); row().mute.click(); expect(row().quote).toBeUndefined();
    lookup({ ...target, revision: 255, notice }); expect(row().mute.disabled).toBe(true); expect(row().revoke.disabled).toBe(false);
    row().privateReason.value = 'Reversal remains possible'; row().revoke.click(); expect(row().quote.action).toBe('revoke');
});

test('private and account text render safely, and changing the subject retires the preview', () => {
    lookup({ ...target, account: '<img src=x onerror=alert(1)>', notice: { ...notice, reason: '<script>bad()</script>' } });
    expect(row().details.querySelector('img,script')).toBeNull(); expect(row().preview.textContent).toContain('<script>');
    row().targetInput.value = 'someone else'; row().targetInput.dispatchEvent(new Event('input')); expect(row().target).toBeNull();
});

test('revoked access, detached rows and retired callbacks cannot send a decision', () => {
    lookup(); prepare(); const old = row(), callback = old.confirm.onclick, count = send.mock.calls.length;
    ui.setAuthorized(false); callback(); old.handleResult('admin_chat_moderation_target_result', { id: old.lookupId, success: true, target });
    expect(send).toHaveBeenCalledTimes(count); expect(old.disposed).toBe(true);
    old.dispose(); expect(old.quote).toBeNull();
});

test('production defaults and unrelated report types do not expose chat sanctions', () => {
    ui.chatModerationEnabled = false; ui.renderReports({ reports: [report] }); expect(ui.reportModerations).toHaveLength(0);
    ui.chatModerationEnabled = true; ui.renderReports({ reports: [{ ...report, reportType: 'Bug Report' }] }); expect(ui.reportModerations).toHaveLength(0);
});
