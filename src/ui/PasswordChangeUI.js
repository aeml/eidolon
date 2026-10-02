import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

let nextFieldID = 0;

// One current session owns this form. Pending state stores only an action ID,
// never passwords; no storage, logs, background lookup or automatic resend.
export class PasswordChangeUI {
    constructor({ parent, send, isCurrent }) {
        parent.__eidolonPasswordChange?.dispose();
        this.parent = parent; this.send = send; this.isCurrent = isCurrent;
        this.root = document.createElement('details');
        this.root.className = 'support-field password-change';
        const prefix = `account-password-${++nextFieldID}`;
        this.root.innerHTML = `<summary>Account security — change password</summary>
            <p class="support-field__hint">Use your current password to choose a new one. Forgotten-password recovery is not available here. The game does not store your password on this device; your password manager may offer to save it.</p>
            <form autocomplete="on">
                <label class="support-field__label" for="${prefix}-current">Current password</label>
                <input class="support-field__control" id="${prefix}-current" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" required maxlength="72">
                <label class="support-field__label" for="${prefix}-new">New password</label>
                <input class="support-field__control" id="${prefix}-new" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" required maxlength="72" aria-describedby="${prefix}-policy">
                <p class="support-field__hint" id="${prefix}-policy">At least 15 characters, at most 72 UTF-8 bytes. Use a unique passphrase or password manager. Spaces and case matter.</p>
                <label class="support-field__label" for="${prefix}-confirm">Confirm new password</label>
                <input class="support-field__control" id="${prefix}-confirm" type="password" autocomplete="new-password" autocapitalize="none" spellcheck="false" required maxlength="72">
                <div class="support-field__row"><button class="menu-btn" type="submit">Change password</button><button class="menu-btn" type="button" data-cancel>Close</button></div>
                <p class="support-field__hint" role="status" aria-live="polite"></p>
            </form>`;
        this.form = this.root.querySelector('form');
        [this.current, this.next, this.confirm] = this.root.querySelectorAll('input');
        this.button = this.root.querySelector('[type="submit"]');
        this.status = this.root.querySelector('[role="status"]');
        parent.append(this.root); parent.__eidolonPasswordChange = this;
        ownedEvent(this, this.form, 'submit', event => { event.preventDefault(); this.submit(); });
        ownedEvent(this, this.root.querySelector('[data-cancel]'), 'click', () => { this.clearFields(); this.root.open = false; });
        ownedEvent(this, this.root, 'toggle', () => { if (!this.root.open) this.clearFields(); this.refresh(); });
        this.refresh();
    }

    ownsForm() { return !this.disposed && this.parent.__eidolonPasswordChange === this; }
    clearFields() { for (const input of [this.current, this.next, this.confirm]) input.value = ''; }
    refresh() {
        if (!this.ownsForm()) return;
        const locked = Boolean(this.pending) || !this.isCurrent();
        for (const input of [this.current, this.next, this.confirm, this.button]) input.disabled = locked;
        this.button.textContent = this.pending ? 'Awaiting confirmation…' : 'Change password';
    }

    submit() {
        if (!this.ownsForm() || this.pending) return;
        if (!this.isCurrent()) {
            this.clearFields(); this.status.textContent = 'Sign in and connect before changing your password.'; this.refresh(); return;
        }
        const currentPassword = this.current.value, newPassword = this.next.value;
        if (!currentPassword || new Blob([currentPassword]).size > 72 || [...newPassword].length < 15 || new Blob([newPassword]).size > 72) {
            this.status.textContent = 'Enter your current password and a new password of at least 15 characters and at most 72 UTF-8 bytes.'; return;
        }
        if (newPassword !== this.confirm.value || currentPassword === newPassword) {
            this.status.textContent = 'The new passwords must match and be different from your current password.'; return;
        }
        const requestId = crypto.randomUUID();
        this.pending = { requestId }; this.clearFields(); this.refresh();
        this.status.textContent = 'Changing password… Wait for the server to confirm.';
        try {
            if (this.send({ requestId, currentPassword, newPassword }) !== true) throw new Error('offline');
        } catch {
            this.pending = null; this.refresh();
            this.status.textContent = 'Not connected; the request was not confirmed. No automatic retry will be sent.'; return;
        }
        // A synchronous test/transport reply may already have finished this ID.
        if (this.pending?.requestId !== requestId) return;
        this.timer = setTimeout(() => {
            if (!this.ownsForm() || this.pending?.requestId !== requestId) return;
            this.status.textContent = 'Change not confirmed. The server may have saved it. Try signing in with the new password before retrying. No automatic retry will be sent.';
        }, 15000);
    }

    handleResult(result) {
        if (!this.ownsForm() || !this.isCurrent() || !this.pending || result?.requestId !== this.pending.requestId) return false;
        clearTimeout(this.timer); this.pending = null; this.clearFields(); this.refresh();
        this.status.textContent = typeof result.message === 'string' ? result.message.slice(0, 2048)
            : result.success === true ? 'Password changed.' : 'Password change was not confirmed.';
        return true;
    }

    connectionState(state) {
        if (!this.ownsForm()) return;
        if (state !== 'connected') {
            this.clearFields();
            this.status.textContent = this.pending ? 'Disconnected before confirmation. The server may have saved the change. Sign in with the new password before retrying; no automatic retry will be sent.'
                : 'Reconnect before changing your password.';
        }
        this.refresh();
    }

    dispose() {
        if (this.disposed) return;
        this.clearFields(); this.pending = null; clearTimeout(this.timer);
        this.disposed = true; disposeOwnedEvents(this); this.root.remove();
        if (this.parent.__eidolonPasswordChange === this) delete this.parent.__eidolonPasswordChange;
    }
}
