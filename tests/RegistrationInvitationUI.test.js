import { jest } from '@jest/globals';
import { RegistrationInvitationUI, primeRegistrationInvitation } from '../src/ui/RegistrationInvitationUI.js';

function fixture() {
    document.body.innerHTML = '<input id="auth-username"><div id="auth-invitation-field"><input id="auth-invitation"><span id="hint"></span></div>';
    const input = document.getElementById('auth-invitation'), root = document.getElementById('auth-invitation-field');
    return { input, root, username: document.getElementById('auth-username'), hint: document.getElementById('hint') };
}
const token = name => `v1.${Buffer.from(JSON.stringify({ username: name, cohort: 'qa', expires: 2000000000, id: 'A'.repeat(22) })).toString('base64url')}.${'A'.repeat(43)}`;

test('invitation fragment is removed before use and exact Unicode account hint is preserved without trusting its signature', () => {
    const { input, username } = fixture(), code = token('Mira 雨'), replaceState = jest.fn();
    primeRegistrationInvitation(document, { href: `https://game.test/#invite=${code}&view=help` }, { replaceState, state: { page: 1 } });
    expect(replaceState).toHaveBeenCalledWith({ page: 1 }, '', 'https://game.test/#view=help');
    expect(input.value).toBe(code); expect(username.value).toBe('Mira 雨');
    // A later bootstrap retry has no fragment, but the private DOM field survives.
    primeRegistrationInvitation(document, { href: 'https://game.test/#view=help' }, { replaceState, state: null });
    expect(input.value).toBe(code); expect(localStorage.getItem('eidolon.invitation')).toBeNull();
});
test('a link never overwrites an existing chosen account and markup stays inert', () => {
    const { input, username } = fixture(); username.value = 'Existing';
    primeRegistrationInvitation(document, { href: `https://game.test/#invite=${token('<img src=x>')}` }, { replaceState() {}, state: null });
    expect(username.value).toBe('Existing'); expect(document.querySelector('img')).toBeNull(); expect(input.value).not.toBe('');
});
test('unreadable and oversized links are scrubbed and cannot leave a partial credential', () => {
    for (const code of ['bad', 'x'.repeat(1025)]) {
        const { input } = fixture(), replaceState = jest.fn();
        input.value = token('Previous account');
        expect(primeRegistrationInvitation(document, { href: `https://game.test/#invite=${code}` }, { replaceState, state: null }).rejected).toBe(true);
        expect(input.value).toBe(''); expect(replaceState).toHaveBeenCalledWith(null, '', 'https://game.test/');
    }
});
test('public registration stays unchanged, invitation status reveals the field, and Enter applies only the explicit register action', () => {
    const f = fixture(), register = jest.fn(); const ui = new RegistrationInvitationUI({ ...f, onRegister: register });
    expect(f.root.hidden).toBe(true); expect(ui.registrationFields()).toEqual({});
    expect(ui.handleStatus({ mode: 'unknown' })).toBe(false); expect(f.root.hidden).toBe(true);
    ui.handleStatus({ mode: 'invitation' }); expect(f.root.hidden).toBe(false);
    f.input.value = token('Alice'); expect(ui.registrationFields()).toEqual({ invitation: f.input.value });
    f.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); expect(register).toHaveBeenCalledTimes(1);
    ui.clear(); expect(f.input.value).toBe(''); expect(f.root.hidden).toBe(true);
    ui.dispose(); f.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); expect(register).toHaveBeenCalledTimes(1);
    expect(ui.handleStatus({ mode: 'invitation' })).toBe(false);
});
test('early scrubbed handoff can populate the form without a secret URL and an invalid handoff clears stale input', () => {
    const f = fixture(), code = token('Mira 雨'), history = { replaceState: jest.fn() };
    expect(primeRegistrationInvitation(document, { href: 'https://game.test/' }, history, { token: code, scrubbed: true }).rejected).toBe(false);
    expect(f.input.value).toBe(code); expect(f.username.value).toBe('Mira 雨');
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(primeRegistrationInvitation(document, { href: 'https://game.test/' }, history, { invalid: true }).rejected).toBe(true);
    expect(f.input.value).toBe('');
});
test('fallback privacy handling survives blocked history and refuses invitations in queries', () => {
    const f = fixture(), code = token('Mira'), history = { replaceState() { throw new Error('blocked'); } };
    expect(primeRegistrationInvitation(document, { href: `https://game.test/#invite=${code}` }, history).rejected).toBe(false);
    expect(document.defaultView.__eidolonRecoverySensitivePage).toBe(true);
    expect(f.input.value).toBe(code);
    expect(primeRegistrationInvitation(document, { href: `https://game.test/?invite=${code}` }, history).rejected).toBe(true);
    expect(f.input.value).toBe('');
});
