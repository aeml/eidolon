import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

let nextID = 0;

class EmailAccountForm {
    constructor({ parent, send, isCurrent }, key) {
        parent[key]?.dispose();
        this.parent = parent; this.key = key; this.send = send; this.isCurrent = isCurrent;
        this.prefix = `email-account-${++nextID}`;
        this.root = document.createElement('details');
        this.root.className = 'support-field email-recovery';
        parent.append(this.root); parent[key] = this;
    }

    owns() { return !this.disposed && this.parent[this.key] === this; }
    field(name, label, type, autocomplete, extra = '') {
        return `<label class="support-field__label" for="${this.prefix}-${name}">${label}</label><input class="support-field__control" id="${this.prefix}-${name}" data-field="${name}" type="${type}" autocomplete="${autocomplete}" autocapitalize="none" spellcheck="false" ${extra}>`;
    }
    bind() {
        this.form = this.root.querySelector('form');
        this.inputs = [...this.root.querySelectorAll('input')];
        this.button = this.root.querySelector('[type="submit"]');
        this.status = this.root.querySelector('[role="status"]');
        ownedEvent(this, this.form, 'submit', event => { event.preventDefault(); this.submit(); });
        ownedEvent(this, this.root.querySelector('[data-close]'), 'click', () => this.close());
        ownedEvent(this, this.root, 'toggle', () => { if (!this.root.open) this.clearFields(); this.refresh(); });
    }
    input(name) { return this.root.querySelector(`[data-field="${name}"]`); }
    clearFields() { for (const input of this.inputs || []) if (input.type === 'password' || input.type === 'email') input.value = ''; }
    refresh() {
        if (!this.owns()) return;
        const locked = Boolean(this.pending) || !this.isCurrent() || this.completed === true;
        for (const input of [...this.inputs, this.button]) input.disabled = locked;
        this.button.textContent = this.pending ? 'Awaiting confirmation…' : this.buttonLabel;
    }
    submitAction(action, payload) {
        if (!this.owns() || this.pending || this.completed) return;
        if (!this.isCurrent()) { this.clearFields(); this.status.textContent = 'Connect before submitting. Nothing will be retried automatically.'; this.refresh(); return; }
        const requestId = crypto.randomUUID();
        this.pending = { requestId, action }; this.clearFields(); this.refresh();
        this.status.textContent = 'Waiting for the server to confirm…';
        try { if (this.send(action, { ...payload, requestId }) !== true) throw new Error('offline'); }
        catch { this.pending = null; this.refresh(); this.status.textContent = 'Request was not confirmed. No automatic retry will be sent.'; return; }
        if (this.pending?.requestId !== requestId) return;
        this.timer = setTimeout(() => {
            if (!this.owns() || this.pending?.requestId !== requestId) return;
            this.status.textContent = 'Request was not confirmed; the server may have applied it. For a reset, try signing in with the new password before retrying. No automatic retry is sent.';
        }, 15000);
    }
    handleResult(result) {
        if (!this.owns() || !this.isCurrent() || !this.pending || result?.requestId !== this.pending.requestId || result?.action !== this.pending.action) return false;
        clearTimeout(this.timer); this.pending = null; this.clearFields();
        this.status.textContent = typeof result.message === 'string' ? result.message.slice(0, 2048) : 'Request completed. Follow the account instructions.';
        this.onResult?.(result); this.refresh(); return true;
    }
    connectionState(state) {
        if (!this.owns()) return;
        if (state !== 'connected') {
            this.clearFields();
            this.status.textContent = this.pending ? 'Disconnected before confirmation. The server may have applied the request. No automatic retry is sent.' : 'Connect before submitting.';
        }
        this.refresh();
    }
    close() { this.clearFields(); this.root.open = false; }
    dispose() {
        if (this.disposed) return;
        this.clearFields(); this.pending = null; clearTimeout(this.timer); this.handoff = null;
        this.disposed = true; disposeOwnedEvents(this); this.root.remove();
        if (this.parent[this.key] === this) delete this.parent[this.key];
    }
}

export class RecoveryEmailSetupUI extends EmailAccountForm {
    constructor(options) {
        super(options, '__eidolonRecoveryEmailSetup');
        this.buttonLabel = 'Send verification email';
        this.root.innerHTML = `<summary>Account recovery — verify an email</summary>
            <p class="support-field__hint">Registration email is not yet verified. Confirm an address while you can sign in so emailed links can recover your account later. No administrator receives your recovery link.</p>
            <form autocomplete="on">${this.field('email', 'Recovery email', 'email', 'email', 'required maxlength="254"')}
                ${this.field('current', 'Current password', 'password', 'current-password', 'required maxlength="72"')}
                <p class="support-field__hint">A new address replaces the previous one only after its link is confirmed. Links expire in 30 minutes.</p>
                <div class="support-field__row"><button class="menu-btn" type="submit">${this.buttonLabel}</button><button class="menu-btn" type="button" data-close>Close</button></div>
                <p class="support-field__hint" role="status" aria-live="polite"></p></form>`;
        this.bind(); this.refresh();
    }
    submit() {
        const email = this.input('email').value, currentPassword = this.input('current').value;
        if (!email || !this.input('email').checkValidity() || email.length > 254 || /[\r\n\0,]/.test(email) || !currentPassword || new Blob([currentPassword]).size > 72) {
            this.status.textContent = 'Enter one recovery email address and your current password.'; return;
        }
        this.submitAction('set_recovery_email', { email, currentPassword });
    }
}

export class PublicEmailRecoveryUI extends EmailAccountForm {
    constructor({ parent, send, isCurrent, connect, handoff, onPasswordReset }) {
        super({ parent, send, isCurrent }, '__eidolonPublicEmailRecovery');
        this.connect = connect; this.handoff = handoff?.kind ? handoff : null;
        this.mode = this.handoff?.kind || 'request';
        this.root.classList.add('auth-session-help');
        this.root.innerHTML = `<summary>Forgot your password? / Recovery link</summary>
            <p class="support-field__hint" data-guidance></p>
            <form autocomplete="on">${this.field('username', 'Account username', 'text', 'username', 'required maxlength="128"')}
                <div data-password-fields>${this.field('new', 'New password', 'password', 'new-password', 'maxlength="72"')}
                ${this.field('confirm', 'Confirm new password', 'password', 'new-password', 'maxlength="72"')}
                <p class="support-field__hint">At least 15 characters and at most 72 UTF-8 bytes. Spaces and case matter.</p></div>
                <div class="support-field__row"><button class="auth-btn" type="submit"></button><button class="auth-btn" type="button" data-connect>Reconnect</button><button class="auth-btn" type="button" data-close>Back to login</button></div>
                <p class="support-field__hint" role="status" aria-live="polite"></p></form>`;
        this.bind();
        this.connectButton = this.root.querySelector('[data-connect]');
        ownedEvent(this, this.connectButton, 'click', () => { this.connect(); this.refresh(); });
        ownedEvent(this, this.root, 'toggle', () => { if (this.root.open) { this.connect(); this.refresh(); } });
        this.onResult = result => {
            if (result.success === true && result.action !== 'request_password_recovery') {
                if (result.action === 'complete_password_recovery') onPasswordReset?.();
                this.handoff = null; this.completed = true;
            }
        };
        this.updateMode();
        if (handoff) {
            this.root.open = true;
            if (handoff.invalid) this.status.textContent = 'This recovery link is invalid. Request a new one.';
            if (handoff.scrubbed === false) this.status.textContent = 'Your browser could not clear this private URL. Do not share it; analytics is disabled on this page.';
        }
    }
    updateMode() {
        const hasLink = Boolean(this.handoff);
        this.input('username').readOnly = hasLink;
        if (hasLink) this.input('username').value = this.handoff.username;
        this.root.querySelector('[data-password-fields]').hidden = this.mode !== 'reset';
        for (const input of [this.input('new'), this.input('confirm')]) input.required = this.mode === 'reset';
        this.buttonLabel = this.mode === 'verify' ? 'Confirm email' : this.mode === 'reset' ? 'Reset password' : 'Send recovery link';
        this.root.querySelector('[data-guidance]').textContent = this.mode === 'verify'
            ? 'Confirm this email explicitly. Opening the link alone does not change your account or sign you in.'
            : this.mode === 'reset' ? 'Choose a new password. This single-use link expires in 15 minutes. Successful reset signs out existing sessions; you must then log in normally.'
                : 'Use your account username. Only an address previously verified by its signed-in owner can receive a reset link. Requesting a link does not change your password or sign you out.';
        this.refresh();
    }
    refresh() {
        super.refresh();
        if (this.connectButton) this.connectButton.hidden = this.isCurrent();
    }
    submit() {
        const username = this.handoff?.username || this.input('username').value;
        if (!username || username.length > 128) { this.status.textContent = 'Enter your account username.'; return; }
        if (this.mode === 'request') { this.submitAction('request_password_recovery', { username }); return; }
        if (!this.handoff) return;
        if (this.mode === 'verify') { this.submitAction('confirm_recovery_email', { username, token: this.handoff.token }); return; }
        const newPassword = this.input('new').value;
        if ([...newPassword].length < 15 || new Blob([newPassword]).size > 72 || newPassword !== this.input('confirm').value) {
            this.status.textContent = 'Matching passwords must contain at least 15 characters and at most 72 UTF-8 bytes.'; return;
        }
        this.submitAction('complete_password_recovery', { username, token: this.handoff.token, newPassword });
    }
    close() {
        super.close(); this.handoff = null; this.mode = 'request'; this.completed = false;
        this.input('username').value = ''; this.updateMode();
    }
}
