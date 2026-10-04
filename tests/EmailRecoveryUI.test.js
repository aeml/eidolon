import { jest } from '@jest/globals';
import { RecoveryEmailSetupUI, PublicEmailRecoveryUI } from '../src/ui/EmailRecoveryUI.js';

let parent, send, current, ui;
beforeEach(() => {
    jest.useFakeTimers(); document.body.innerHTML = '<section></section>';
    parent = document.querySelector('section'); current = true; send = jest.fn(() => true);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('email-test-id');
});
afterEach(() => { ui?.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });
function setup() { ui = new RecoveryEmailSetupUI({ parent, send, isCurrent: () => current }); return ui; }
function publicForm(kind) {
    ui = new PublicEmailRecoveryUI({ parent, send, isCurrent: () => current, connect: jest.fn(),
        handoff: kind ? { kind, username: 'exact-owner', token: 'a'.repeat(64), scrubbed: true } : undefined });
    return ui;
}
function result(action, extra = {}) { return { requestId: 'email-test-id', action, success: true, message: 'Confirmed.', ...extra }; }

test('setup clears credentials and retains only the correlated request ID/action', () => {
    setup(); ui.input('email').value = 'owner@example.invalid'; ui.input('current').value = ' Exact current phrase ';
    ui.submit();
    expect(send).toHaveBeenCalledWith('set_recovery_email', { requestId: 'email-test-id', email: 'owner@example.invalid', currentPassword: ' Exact current phrase ' });
    expect(ui.pending).toEqual({ requestId: 'email-test-id', action: 'set_recovery_email' });
    expect(ui.inputs.every(input => input.value === '' && input.disabled)).toBe(true);
    for (const input of ui.inputs) expect(ui.root.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
});
test.each(['', 'owner@example.invalid,other@example.invalid', 'owner@example.invalid\nother@example.invalid'])('invalid setup address cannot send (%s)', email => {
    setup(); ui.input('email').value = email; ui.input('current').value = 'current'; ui.submit();
    expect(send).not.toHaveBeenCalled();
});
test.each(['offline', 'throw', 'false'])('setup %s does not retry or retain typed secrets', mode => {
    setup(); ui.input('email').value = 'owner@example.invalid'; ui.input('current').value = 'current';
    if (mode === 'offline') current = false;
    if (mode === 'throw') send.mockImplementation(() => { throw new Error('offline'); });
    if (mode === 'false') send.mockReturnValue(false);
    ui.submit(); jest.advanceTimersByTime(60000);
    expect(ui.inputs.every(input => input.value === '')).toBe(true);
    expect(send).toHaveBeenCalledTimes(mode === 'offline' ? 0 : 1);
});
test('request uses the username, never asks for the unverified registration email', () => {
    publicForm(); ui.input('username').value = 'exact-owner'; ui.submit();
    expect(send).toHaveBeenCalledWith('request_password_recovery', { username: 'exact-owner', requestId: 'email-test-id' });
    expect(ui.root.querySelector('input[type="email"]')).toBeNull();
    expect(ui.root.querySelector('[data-password-fields]').hidden).toBe(true);
});
test.each(['verify', 'reset'])('opening a %s link does not submit, render or persist its token', kind => {
    publicForm(kind); expect(send).not.toHaveBeenCalled();
    expect(ui.root.innerHTML.includes('a'.repeat(64))).toBe(false);
    expect(ui.input('username').readOnly).toBe(true);
    expect(ui.input('username').value).toBe('exact-owner');
    expect(ui.root.querySelector('[data-password-fields]').hidden).toBe(kind !== 'reset');
});
test('verification requires explicit submit and matches both action and request ID', () => {
    publicForm('verify'); ui.submit();
    expect(send).toHaveBeenCalledWith('confirm_recovery_email', { username: 'exact-owner', token: 'a'.repeat(64), requestId: 'email-test-id' });
    expect(ui.handleResult(result('complete_password_recovery'))).toBe(false);
    expect(ui.handleResult(result('confirm_recovery_email', { requestId: 'other' }))).toBe(false);
    expect(ui.handleResult(result('confirm_recovery_email', { message: '<img onerror=alert(1)>' }))).toBe(true);
    expect(ui.status.textContent).toBe('<img onerror=alert(1)>'); expect(ui.status.querySelector('img')).toBeNull();
    expect(ui.handoff).toBeNull(); expect(ui.button.disabled).toBe(true);
});
test.each(['short', 'x'.repeat(73), '🌙'.repeat(19)])('weak/oversize reset password cannot send', password => {
    publicForm('reset'); ui.input('new').value = password; ui.input('confirm').value = password; ui.submit(); expect(send).not.toHaveBeenCalled();
});
test('valid reset clears passwords, cannot resend while uncertain, and accepts a late receipt', () => {
    publicForm('reset'); ui.input('new').value = ' Exact recovery passphrase '; ui.input('confirm').value = ' Exact recovery passphrase '; ui.submit();
    expect(send).toHaveBeenCalledWith('complete_password_recovery', { username: 'exact-owner', token: 'a'.repeat(64), newPassword: ' Exact recovery passphrase ', requestId: 'email-test-id' });
    expect([ui.input('new'), ui.input('confirm')].every(input => input.value === '' && input.disabled)).toBe(true);
    jest.advanceTimersByTime(16000); expect(ui.status.textContent).toContain('may have applied');
    ui.submit(); expect(send).toHaveBeenCalledTimes(1);
    expect(ui.handleResult(result('complete_password_recovery'))).toBe(true);
    expect(ui.handoff).toBeNull(); expect(ui.completed).toBe(true);
});
test('disconnect/closure clear fields and disposal rejects late replies', () => {
    publicForm('reset'); ui.input('new').value = 'unsent secret'; current = false; ui.connectionState('closed');
    expect(ui.input('new').value).toBe(''); ui.close(); expect(ui.handoff).toBeNull(); expect(ui.mode).toBe('request');
    ui.dispose(); expect(ui.handleResult(result('complete_password_recovery'))).toBe(false);
    expect(parent.children.length).toBe(0);
});
