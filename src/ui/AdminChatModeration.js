const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value) && !/^0+$/.test(value);
const text = (value, max) => typeof value === 'string' && value.trim() && new TextEncoder().encode(value).length <= max
    && [...value].every(character => { const code = character.codePointAt(0); return code >= 32 && !(code >= 127 && code <= 159); });

// Dormant until the approved policy enables the parent and server protocol.
// One explicit account lookup, a quoted decision, then separate confirmation.
export class AdminChatModeration {
    constructor(row, report, admin) {
        Object.assign(this, { row, report: Object.freeze({ id: report.id, reportType: report.reportType }), admin });
        this.valid = hex(report.id, 24) && ['Player Report', 'Moderation Appeal'].includes(report.reportType);
        this.details = document.createElement('details'); this.details.className = 'administration-review';
        const summary = document.createElement('summary'); summary.textContent = 'Temporary chat mute or reversal';
        const warning = document.createElement('p');
        warning.textContent = 'Choose the subject explicitly. The reporter is not automatically the accused player. Read the evidence before deciding.';
        const input = (label, options) => {
            const wrapper = document.createElement('label'); wrapper.textContent = label;
            const field = document.createElement('input'); Object.assign(field, options);
            wrapper.append(field); this.details.append(wrapper); return field;
        };
        const button = label => { const node = document.createElement('button'); node.type = 'button'; node.className = 'menu-btn'; node.textContent = label; return node; };
        this.details.append(summary, warning);
        this.targetInput = input('Exact account to review', { type: 'text', maxLength: 256, autocomplete: 'off' });
        this.lookup = button('Check this account');
        this.preview = document.createElement('p'); this.preview.textContent = 'No account selected or verified.';
        this.details.append(this.lookup, this.preview);
        this.duration = input('Mute duration in minutes', { type: 'number', min: '1', max: '43200', step: '1' });
        this.publicReason = input('Public explanation shown to the player', { type: 'text', maxLength: 600 });
        this.privateReason = input('Private staff evidence or reversal reason', { type: 'text', maxLength: 1600 });
        this.mute = button('Review temporary mute'); this.revoke = button('Review mute reversal');
        const actions = document.createElement('div'); actions.className = 'administration-review-actions'; actions.append(this.mute, this.revoke);
        this.confirmation = document.createElement('div'); this.confirmation.hidden = true;
        this.quoteText = document.createElement('p');
        this.confirm = button('Confirm decision'); this.cancel = button('Keep unchanged');
        const controls = document.createElement('div'); controls.className = 'administration-review-actions'; controls.append(this.cancel, this.confirm);
        this.confirmation.append(this.quoteText, controls);
        this.status = document.createElement('p'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
        this.details.append(actions, this.confirmation, this.status); row.append(this.details);
        this.lookup.onclick = () => {
            if (!this.available() || this.sent || this.quote) return;
            if (!text(this.targetInput.value, 256)) { this.status.textContent = 'Enter an exact account name.'; this.targetInput.focus(); return; }
            this.target = null; this.lookupTarget = this.targetInput.value; this.lookupId = crypto.randomUUID();
            this.admin.request('admin_chat_moderation_target', { target: this.lookupTarget }, this.lookupId);
        };
        this.targetInput.oninput = () => { if (!this.sent) { this.target = null; this.setState(false); } };
        this.mute.onclick = () => this.prepare('mute'); this.revoke.onclick = () => this.prepare('revoke');
        this.cancel.onclick = () => {
            if (!this.available() || this.sent) return;
            this.quote = null; this.confirmation.hidden = true; this.setState(false); this.mute.focus();
        };
        this.confirm.onclick = () => {
            if (!this.available() || !this.quote || this.targetInput.value !== this.lookupTarget || this.sent && !this.retryable) return;
            this.sent = true; this.retryable = false;
            this.admin.request('admin_chat_moderation', this.quote, this.quote.id);
        };
        this.setState(false);
    }

    available() { return !this.disposed && this.valid && this.row.isConnected && this.admin.chatModerationEnabled === true
        && this.admin.connected && this.admin.authorized && !this.admin.pending; }

    validTarget(target) {
        const notice = target?.notice;
        return hex(target?.accountId, 24) && target.account === this.lookupTarget && text(target.account, 256)
            && Number.isSafeInteger(target.revision) && target.revision >= 0 && target.revision <= 256
            && (!notice || hex(notice.id, 64) && text(notice.reason, 600) && Number.isFinite(Date.parse(notice.startedAt))
                && Date.parse(notice.expiresAt) > Date.parse(notice.startedAt)
                && Date.parse(notice.expiresAt) - Date.parse(notice.startedAt) <= 30 * 86400_000);
    }

    prepare(action) {
        if (!this.available() || this.sent || this.quote || !this.target || this.targetInput.value !== this.lookupTarget) return;
        if (!text(this.privateReason.value.trim(), 1600)) { this.status.textContent = 'Enter a bounded one-line private reason.'; this.privateReason.focus(); return; }
        const minutes = Number(this.duration.value);
        if (action === 'mute' && (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 43200
            || !text(this.publicReason.value.trim(), 600) || this.target.revision >= 255)) {
            this.status.textContent = 'Enter a whole duration of 1–43200 minutes and a bounded public explanation. Storage capacity must allow reversal.'; return;
        }
        if (action === 'revoke' && (!this.target.notice || this.target.revision >= 256)) return;
        this.quote = Object.freeze({ id: crypto.randomUUID(), accountId: this.target.accountId, reportId: this.report.id,
            expectedRevision: this.target.revision, action, durationSeconds: action === 'mute' ? minutes * 60 : 0,
            noticeId: action === 'revoke' ? this.target.notice.id : '', publicReason: action === 'mute' ? this.publicReason.value.trim() : '',
            privateReason: this.privateReason.value.trim(), confirmed: true });
        this.quoteText.textContent = `${action === 'mute' ? `Mute for ${minutes} minutes` : `Reverse notice ${this.quote.noticeId}`}:
            ${this.target.account} (${this.quote.accountId}), revision ${this.quote.expectedRevision}, case ${this.quote.reportId}.
            ${action === 'mute' ? `Player explanation: ${this.quote.publicReason}.` : ''} Private reason: ${this.quote.privateReason}.
            This changes chat access only; it does not resolve the case or affect gameplay.`;
        this.confirmation.hidden = false; this.setState(false); this.cancel.focus();
    }

    setState(busy) {
        const ready = !busy && this.available(), frozen = Boolean(this.quote || this.sent);
        for (const input of [this.targetInput, this.duration, this.publicReason, this.privateReason]) input.disabled = !ready || frozen;
        this.lookup.disabled = !ready || frozen;
        this.mute.disabled = !ready || frozen || !this.target || this.target.revision >= 255;
        this.revoke.disabled = !ready || frozen || !this.target?.notice || this.target.revision >= 256;
        this.cancel.disabled = !ready || Boolean(this.sent);
        this.confirm.disabled = !ready || !this.quote || this.sent && !this.retryable;
    }

    handleResult(type, result) {
        if (this.disposed || !this.row.isConnected) return;
        if (type === 'admin_chat_moderation_target_result' && result?.id === this.lookupId) {
            this.lookupId = null;
            this.target = result.success === true && this.validTarget(result.target) && this.targetInput.value === this.lookupTarget
                ? { ...result.target, ...(result.target.notice ? { notice: { ...result.target.notice } } : {}) } : null;
            this.preview.textContent = this.target
                ? `${this.target.account} · ${this.target.accountId} · revision ${this.target.revision}. ${this.target.notice
                    ? `Active notice ${this.target.notice.id}, until ${this.target.notice.expiresAt}: ${this.target.notice.reason}` : 'No active temporary chat mute.'}`
                : 'No account preview was verified. Check the exact account again.';
        } else if (type === 'admin_chat_moderation_result' && result?.id === this.quote?.id) {
            this.retryable = result.pending === true && result.success !== true;
            this.confirm.textContent = this.retryable ? 'Retry exact same decision' : 'Confirm decision';
            if (!this.retryable) {
                this.quote = null; this.sent = false; this.target = null; this.confirmation.hidden = true;
                this.preview.textContent = 'Check this account again for its current revision and notice before another decision.';
            }
        } else return;
        this.status.textContent = result.message || 'Check the current account state before deciding again.';
        this.setState(false);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.target = this.quote = this.lookupId = null;
        for (const node of [this.lookup, this.mute, this.revoke, this.confirm, this.cancel]) node.onclick = null;
        this.targetInput.oninput = null;
    }
}
