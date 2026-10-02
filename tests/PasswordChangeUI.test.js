import { jest } from '@jest/globals';
import { PasswordChangeUI } from '../src/ui/PasswordChangeUI.js';
import { credentialTokenChange } from '../src/core/CredentialToken.js';

let parent, ui, send, current;
beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<section></section>';
    parent = document.querySelector('section'); current = true; send = jest.fn(() => true);
    jest.spyOn(crypto, 'randomUUID').mockReturnValue('password-test-id');
    ui = new PasswordChangeUI({ parent, send, isCurrent: () => current });
});
afterEach(() => { ui.dispose(); jest.restoreAllMocks(); jest.useRealTimers(); });
function fill(next = '  A unique updated phrase  ') {
    ui.current.value = 'oldpass'; ui.next.value = next; ui.confirm.value = next;
}
function reply(extra = {}) { return { requestId: 'password-test-id', success: true, message: 'Password changed.', ...extra }; }

test('accessible credential fields preserve exact input and keep only request identity pending', () => {
    fill(); ui.form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(send).toHaveBeenCalledWith({ requestId: 'password-test-id', currentPassword: 'oldpass', newPassword: '  A unique updated phrase  ' });
    expect(ui.pending).toEqual({ requestId: 'password-test-id' });
    expect([ui.current, ui.next, ui.confirm].every(field => field.value === '' && field.disabled)).toBe(true);
    expect(ui.current.autocomplete).toBe('current-password'); expect(ui.next.autocomplete).toBe('new-password');
    for (const input of parent.querySelectorAll('input')) expect(parent.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    ui.submit(); expect(send).toHaveBeenCalledTimes(1);
});

test.each(['short', '🌙'.repeat(19), 'x'.repeat(73)])('invalid new password does not send (%s)', password => {
    fill(password); ui.submit(); expect(send).not.toHaveBeenCalled(); expect(ui.pending).toBeUndefined();
});
test('valid Unicode minimum and byte ceiling are accepted', () => {
    fill('🌙'.repeat(18)); ui.submit(); expect(send).toHaveBeenCalledTimes(1);
});
test('mismatch, unchanged and empty current proof cannot send', () => {
    fill(); ui.confirm.value = 'different'; ui.submit();
    fill(); ui.current.value = ui.next.value; ui.submit();
    fill(); ui.current.value = ''; ui.submit(); expect(send).not.toHaveBeenCalled();
});
test.each(['offline', 'false-send', 'throw-send'])('%s clears credentials without resend', mode => {
    fill();
    if (mode === 'offline') current = false;
    if (mode === 'false-send') send.mockReturnValue(false);
    if (mode === 'throw-send') send.mockImplementation(() => { throw new Error('offline'); });
    ui.submit(); expect([ui.current, ui.next, ui.confirm].every(field => field.value === '')).toBe(true);
    jest.advanceTimersByTime(60000); expect(send.mock.calls.length).toBe(mode === 'offline' ? 0 : 1);
});
test('timeout stays uncertain, refuses duplicate submit and still accepts late confirmation', () => {
    fill(); ui.submit(); jest.advanceTimersByTime(16000);
    expect(ui.status.textContent).toContain('may have saved'); expect(ui.button.disabled).toBe(true);
    fill(); ui.submit(); expect(send).toHaveBeenCalledTimes(1);
    expect(ui.handleResult(reply({ requestId: 'other-session' }))).toBe(false);
    expect(ui.handleResult(reply())).toBe(true); expect(ui.status.textContent).toBe('Password changed.');
    expect(ui.pending).toBeNull(); expect(ui.button.disabled).toBe(false); expect(ui.current.value).toBe('');
});
test('close clears fields without claiming to cancel a submitted change', () => {
    fill(); ui.submit(); ui.root.querySelector('[data-cancel]').click();
    expect(ui.pending).not.toBeNull(); expect(ui.handleResult(reply())).toBe(true);
});
test('disconnect clears secrets, never replays on reconnect, and accepts only its own receipt', () => {
    fill(); ui.submit(); current = false; ui.connectionState('reconnecting');
    expect(ui.status.textContent).toContain('Disconnected before confirmation');
    expect(ui.handleResult(reply())).toBe(false);
    current = true; ui.connectionState('connected'); jest.advanceTimersByTime(16000);
    expect(send).toHaveBeenCalledTimes(1); expect(ui.handleResult(reply())).toBe(true);
});
test('replacement removes old handlers, secrets and late-result ownership', () => {
    const old = ui; fill(); old.submit();
    ui = new PasswordChangeUI({ parent, send, isCurrent: () => true });
    expect(old.disposed).toBe(true); expect(old.current.value).toBe('');
    expect(old.handleResult(reply())).toBe(false); expect(parent.querySelectorAll('form')).toHaveLength(1);
    old.form.dispatchEvent(new Event('submit', { cancelable: true })); jest.advanceTimersByTime(60000);
    expect(send).toHaveBeenCalledTimes(1);
});
test('synchronous reply cannot leave a stale timeout or disabled form', () => {
    send.mockImplementation(() => { ui.handleResult(reply()); return true; });
    fill(); ui.submit(); jest.advanceTimersByTime(60000);
    expect(ui.pending).toBeNull(); expect(ui.status.textContent).toBe('Password changed.');
});
test('server copy is rendered as text, never markup', () => {
    fill(); ui.submit(); ui.handleResult(reply({ message: '<img src=x onerror=alert(1)>' }));
    expect(ui.status.querySelector('img')).toBeNull(); expect(ui.status.textContent).toContain('<img');
});
test('token interpretation preserves ordinary failures and fails closed on an uncertain or malformed success', () => {
    expect(credentialTokenChange({ success: false })).toBeUndefined();
    expect(credentialTokenChange({ success: false, resumeInvalidated: true })).toBeNull();
    expect(credentialTokenChange({ success: true, resumeToken: 'a'.repeat(64) })).toBe('a'.repeat(64));
    expect(credentialTokenChange({ success: true, resumeToken: 'invalid' })).toBeNull();
});
