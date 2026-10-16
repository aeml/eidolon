import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

const MAX_INVITATION_BYTES = 1024;

// The hint is untrusted convenience only. The server verifies the signature,
// roster, exact account name, expiry and revocation before creating an account.
function invitationUsername(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3 || parts[0] !== 'v1' || !/^[A-Za-z0-9_-]+$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return '';
        const binary = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
        const name = data.username;
        return typeof name === 'string' && new TextEncoder().encode(name).length <= 128 && name.trim() && !/\p{Cc}/u.test(name) ? name : '';
    } catch { return ''; }
}

export function primeRegistrationInvitation(document, location, history, handoff = null) {
    let token = handoff?.token || '';
    if (!handoff) {
        const url = new URL(location.href);
        const fragment = new URLSearchParams(url.hash.slice(1));
        const query = new URLSearchParams(url.search);
        if (!fragment.has('invite') && !query.has('invite')) return { rejected: false };
        token = fragment.get('invite') || '';
        const valid = fragment.getAll('invite').length === 1 && !query.has('invite') && !fragment.has('eidolon-recovery');
        fragment.delete('invite'); query.delete('invite'); url.hash = fragment.toString(); url.search = query.toString();
        if (document.defaultView) document.defaultView.__eidolonRecoverySensitivePage = true;
        try { history.replaceState(history.state, '', url.toString()); } catch { /* Analytics stays off. */ }
        if (!valid) handoff = { invalid: true };
    }
    const input = document.getElementById('auth-invitation');
    if (input) input.value = '';
    const name = token && new TextEncoder().encode(token).length <= MAX_INVITATION_BYTES ? invitationUsername(token) : '';
    if (handoff?.invalid || !input || !name) return { rejected: true };
    input.value = token;
    const username = document.getElementById('auth-username');
    if (username && !username.value) username.value = name;
    return { rejected: false };
}

export class RegistrationInvitationUI {
    constructor({ root, input, hint, onRegister, rejected = false }) {
        this.root = root; this.input = input; this.hint = hint;
        this.revealed = Boolean(input?.value || rejected);
        this.rejected = rejected;
        ownedEvent(this, input, 'input', () => { this.rejected = false; this.revealed = true; this.render(); });
        ownedEvent(this, input, 'keydown', event => {
            if (event.key === 'Enter') { event.preventDefault(); onRegister?.(); }
        });
        this.render();
    }
    render() {
        if (this.disposed || !this.root) return;
        this.root.hidden = !this.revealed;
        if (this.hint) this.hint.textContent = this.rejected
            ? 'That invitation link could not be read. Ask the operator for a new link.'
            : 'Only new accounts need an invitation. Existing accounts can sign in normally.';
    }
    handleStatus(payload) {
        if (this.disposed || !['open', 'invitation'].includes(payload?.mode)) return false;
        this.revealed = payload.mode === 'invitation' || Boolean(this.input?.value);
        this.render(); return true;
    }
    registrationFields() {
        const invitation = this.input?.value || '';
        return invitation ? { invitation } : {};
    }
    clear() {
        if (this.input) this.input.value = '';
        this.rejected = false; this.revealed = false; this.render();
    }
    dispose() { if (this.disposed) return; this.clear(); disposeOwnedEvents(this); this.disposed = true; }
}
