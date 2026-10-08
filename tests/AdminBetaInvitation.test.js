import { jest } from '@jest/globals';
import { AdminUI } from '../src/ui/AdminUI.js';
import { GameEngine } from '../src/core/GameEngine.js';
import { registrationInvitationPayload, clearRegistrationInvitation } from '../src/ui/RegistrationInvitation.js';

let ui, send;
const prepare = () => {
    const invite = ui.invitations;
    invite.form.elements.username.value = 'New Player'; invite.form.elements.email.value = 'private@example.invalid';
    invite.form.elements.expiresAt.value = '2026-10-09T17:00';
    invite.form.dispatchEvent(new Event('submit', { cancelable: true }));
    return invite;
};
const finish = (overrides = {}) => ui.handleResult('admin_beta_invitation_result', { id: ui.pending.id,
    authorized: true, success: true, final: true, code: 'A'.repeat(76), username: 'New Player', expiresAt: '2026-10-09T17:00:00Z', ...overrides });
beforeEach(() => {
    jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-08T17:00:00Z'));
    document.body.innerHTML = '<button id="launch"></button><div id="host"></div>';
    send = jest.fn();
    ui = new AdminUI({ host: document.getElementById('host'), launcher: document.getElementById('launch'), send,
        openWindow: () => {}, closeWindow: () => {} });
    ui.connectionState('connected');
    ui.handleResult('admin_status_result', { id: ui.pending.id, authorized: true, success: true }); send.mockClear();
});
afterEach(() => { ui.dispose(); jest.useRealTimers(); jest.restoreAllMocks(); });

test('explicit frozen review issues once and displays a masked proof without writing storage or copying', () => {
    const storage = jest.spyOn(Storage.prototype, 'setItem'), invite = prepare();
    expect(send).not.toHaveBeenCalled(); expect(invite.copy.textContent).toContain('private@example.invalid');
    invite.confirm.click(); invite.confirm.click(); expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('admin_beta_invitation', expect.objectContaining({ confirmed: true, username: 'New Player' }));
    finish(); expect(invite.code.value).toBe('A'.repeat(76)); expect(invite.code.type).toBe('password');
    expect(invite.proof.hidden).toBe(false); expect(invite.root.textContent).not.toContain('A'.repeat(76));
    expect(storage).not.toHaveBeenCalled();
});

test('editing, cancel, role loss, disconnect and closing clear private proofs and retire late replies', async () => {
    const invite = prepare(); invite.form.dispatchEvent(new Event('input', { bubbles: true })); invite.confirm.click();
    expect(send).not.toHaveBeenCalled(); prepare(); invite.cancel.click(); invite.confirm.click(); expect(send).not.toHaveBeenCalled();
    prepare(); invite.confirm.click(); finish(); ui.setAuthorized(false); expect(invite.code.value).toBe('');
    ui.setAuthorized(true); prepare(); invite.confirm.click(); finish(); ui.connectionState('closed'); expect(invite.code.value).toBe('');
    ui.setAuthorized(true); prepare(); invite.confirm.click(); finish();
    ui.root.style.display = 'block'; await Promise.resolve(); ui.root.style.display = 'none'; await Promise.resolve();
    expect(invite.code.value).toBe('');
});

test('timeout never resends and late/foreign or mismatched identity replies do not expose a proof', () => {
    const invite = prepare(); invite.confirm.click(); const id = ui.pending.id;
    jest.advanceTimersByTime(10000); expect(send).toHaveBeenCalledTimes(1); expect(invite.status.textContent).toContain('no automatic resend');
    ui.handleResult('admin_beta_invitation_result', { id, authorized: true, success: true, final: true, code: 'A'.repeat(76) });
    expect(invite.code.value).toBe(''); prepare(); invite.confirm.click(); finish({ username: 'Other Player' }); expect(invite.code.value).toBe('');
});

test('invalid identities and expired/oversized UTC windows cannot be reviewed', () => {
    const invite = prepare(); invite.form.elements.username.value = 'é'.repeat(65); invite.prepare(); expect(invite.review.hidden).toBe(true);
    prepare(); invite.form.elements.email.value = 'x'.repeat(321); invite.prepare(); expect(invite.review.hidden).toBe(true);
    for (const value of ['', '2026-10-08T17:00', '2026-10-16T17:00']) { prepare(); invite.form.elements.expiresAt.value = value; invite.prepare(); expect(invite.review.hidden).toBe(true); }
    expect(send).not.toHaveBeenCalled();
});

test('registration proof is optional, preserved exactly only for signup and can be cleared without storage', () => {
    expect(registrationInvitationPayload()).toEqual({});
    document.body.insertAdjacentHTML('beforeend', '<input id="auth-invitation" type="password">');
    const input = document.getElementById('auth-invitation'); input.value = ' A'.repeat(38);
    expect(registrationInvitationPayload()).toEqual({ inviteCode: input.value });
    clearRegistrationInvitation(); expect(input.value).toBe(''); expect(registrationInvitationPayload()).toEqual({});
});

test('clipboard receives a proof only after an explicit copy action', async () => {
    const writeText = jest.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const invite = prepare(); invite.confirm.click(); finish(); expect(writeText).not.toHaveBeenCalled();
    invite.copyCode.click(); await Promise.resolve(); expect(writeText).toHaveBeenCalledWith('A'.repeat(76));
});

test('private issuance acknowledgement routes to admin UI, never public chat', () => {
    const admin = { handleResult: jest.fn() }, addChatMessage = jest.fn(), payload = { id: 'synthetic-invite', code: 'A'.repeat(76) };
    GameEngine.prototype.handleServerMessage.call({ uiManager: { admin, addChatMessage }, player: { id: 'staff' } },
        { type: 'admin_beta_invitation_result', payload });
    expect(admin.handleResult).toHaveBeenCalledWith('admin_beta_invitation_result', payload);
    expect(addChatMessage).not.toHaveBeenCalled();
});
