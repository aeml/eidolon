const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value) && !/^0+$/.test(value);
const text = (value, max) => typeof value === 'string' && value.trim() && new TextEncoder().encode(value).length <= max
    && [...value].every(character => { const code = character.codePointAt(0); return code >= 32 && !(code >= 127 && code <= 159); });
const kindOf = notice => notice.kind || 'mute';
const labels = { mute: 'Chat mute', suspend: 'Account suspension', require_name_change: 'Required public name change' };
const validNotice = notice => notice && hex(notice.id, 64) && text(notice.reason, 600)
    && Number.isFinite(Date.parse(notice.startedAt)) && Object.hasOwn(labels, kindOf(notice))
    && (kindOf(notice) === 'require_name_change' ? notice.expiresAt === '0001-01-01T00:00:00Z'
        : Date.parse(notice.expiresAt) > Date.parse(notice.startedAt)
            && Date.parse(notice.expiresAt) - Date.parse(notice.startedAt) <= 30 * 86400_000);

// Dormant until the approved policy enables the parent and server protocol.
// One explicit account lookup, a quoted decision, then separate confirmation.
export class AdminChatModeration {
    constructor(row, report, admin) {
        Object.assign(this, { row, report: Object.freeze({ id: report.id, reportType: report.reportType }), admin });
        this.valid = hex(report.id, 24) && ['Player Report', 'Moderation Appeal'].includes(report.reportType);
        this.details = document.createElement('details'); this.details.className = 'administration-review';
        const summary = document.createElement('summary'); summary.textContent = 'Moderation decision or reversal';
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
        this.duration = input('Mute or suspension duration in minutes', { type: 'number', min: '1', max: '43200', step: '1' });
        this.publicReason = input('Public explanation shown to the player', { type: 'text', maxLength: 600 });
        this.privateReason = input('Private staff evidence or reversal reason', { type: 'text', maxLength: 1600 });
        this.mute = button('Review temporary mute'); this.suspend = button('Review temporary suspension');
        this.rename = button('Review required name change'); this.revoke = button('Review selected reversal');
        const reversalLabel = document.createElement('label'); reversalLabel.textContent = 'Notice to reverse';
        this.reversalNotice = document.createElement('select'); reversalLabel.append(this.reversalNotice); this.details.append(reversalLabel);
        const actions = document.createElement('div'); actions.className = 'administration-review-actions administration-moderation-actions'; actions.append(this.mute, this.suspend, this.rename, this.revoke);
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
        this.suspend.onclick = () => this.prepare('suspend'); this.rename.onclick = () => this.prepare('require_name_change');
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
        const notices = target?.notices ?? (target?.notice ? [target.notice] : []);
        return hex(target?.accountId, 24) && target.account === this.lookupTarget && text(target.account, 256)
            && Number.isSafeInteger(target.revision) && target.revision >= 0 && target.revision <= 256
            && (!target.notice || validNotice(target.notice) && kindOf(target.notice) === 'mute')
            && Array.isArray(notices) && notices.length <= 3 && notices.every(validNotice)
            && new Set(notices.map(kindOf)).size === notices.length;
    }

    capacityFor(action) {
        if (!this.target) return false;
        if (action === 'revoke') return this.target.revision < 256;
        const notices = this.target.notices;
        const remaining = notices.length + (notices.some(notice => kindOf(notice) === action) ? 0 : 1);
        return this.target.revision < 255 && this.target.revision + 1 + remaining <= 256;
    }

    prepare(action) {
        if (!this.available() || this.sent || this.quote || !this.target || this.targetInput.value !== this.lookupTarget) return;
        if (!text(this.privateReason.value.trim(), 1600)) { this.status.textContent = 'Enter a bounded one-line private reason.'; this.privateReason.focus(); return; }
        const minutes = Number(this.duration.value);
        const timed = action === 'mute' || action === 'suspend';
        if (timed && (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 43200)) {
            this.status.textContent = 'Enter a whole duration of 1–43200 minutes and a bounded public explanation. Storage capacity must allow reversal.'; return;
        }
        if (!this.capacityFor(action) || action !== 'revoke' && !text(this.publicReason.value.trim(), 600)) {
            this.status.textContent = 'Enter a bounded public explanation. Storage capacity must allow every restriction to be reversed.'; return;
        }
        const selected = this.target.notices.find(notice => notice.id === this.reversalNotice.value);
        if (action === 'revoke' && !selected) return;
        this.quote = Object.freeze({ id: crypto.randomUUID(), accountId: this.target.accountId, reportId: this.report.id,
            expectedRevision: this.target.revision, action, durationSeconds: timed ? minutes * 60 : 0,
            noticeId: action === 'revoke' ? selected.id : '', publicReason: action !== 'revoke' ? this.publicReason.value.trim() : '',
            privateReason: this.privateReason.value.trim(), confirmed: true });
        const effect = action === 'mute' ? 'This changes chat access only; it does not affect gameplay.'
            : action === 'suspend' ? 'This blocks world participation until expiry or reversal; private notice and appeal access remain available.'
                : action === 'require_name_change' ? 'This requires a new public name before playing; the login identity and saved progress remain unchanged.'
                    : `This withdraws only the selected ${labels[kindOf(selected)]}; other restrictions remain unchanged.`;
        this.quoteText.textContent = `${action === 'revoke' ? `Reverse notice ${this.quote.noticeId}` : `${labels[action]}${timed ? ` for ${minutes} minutes` : ''}`}:
            ${this.target.account} (${this.quote.accountId}), revision ${this.quote.expectedRevision}, case ${this.quote.reportId}.
            ${action !== 'revoke' ? `Player explanation: ${this.quote.publicReason}.` : ''} Private reason: ${this.quote.privateReason}.
            ${effect} This does not automatically resolve the case.`;
        this.confirmation.hidden = false; this.setState(false); this.cancel.focus();
    }

    setState(busy) {
        const ready = !busy && this.available(), frozen = Boolean(this.quote || this.sent);
        for (const input of [this.targetInput, this.duration, this.publicReason, this.privateReason, this.reversalNotice]) input.disabled = !ready || frozen;
        this.lookup.disabled = !ready || frozen;
        this.mute.disabled = !ready || frozen || !this.capacityFor('mute');
        this.suspend.disabled = !ready || frozen || !this.capacityFor('suspend');
        this.rename.disabled = !ready || frozen || !this.capacityFor('require_name_change');
        this.revoke.disabled = !ready || frozen || !this.target?.notices.length || !this.capacityFor('revoke');
        this.cancel.disabled = !ready || Boolean(this.sent);
        this.confirm.disabled = !ready || !this.quote || this.sent && !this.retryable;
    }

    handleResult(type, result) {
        if (this.disposed || !this.row.isConnected) return;
        if (type === 'admin_chat_moderation_target_result' && result?.id === this.lookupId) {
            this.lookupId = null;
            this.target = result.success === true && this.validTarget(result.target) && this.targetInput.value === this.lookupTarget
                ? { ...result.target, ...(result.target.notice ? { notice: { ...result.target.notice } } : {}),
                    notices: (result.target.notices ?? (result.target.notice ? [result.target.notice] : [])).map(notice => ({ ...notice })) } : null;
            this.reversalNotice.replaceChildren();
            for (const notice of this.target?.notices || []) {
                const option = document.createElement('option'); option.value = notice.id;
                option.textContent = `${labels[kindOf(notice)]} · ${notice.id.slice(0, 12)}…`; this.reversalNotice.append(option);
            }
            this.preview.textContent = this.target
                ? `${this.target.account} · ${this.target.accountId} · revision ${this.target.revision}. ${this.target.notices.length
                    ? this.target.notices.map(notice => `${labels[kindOf(notice)]} ${notice.id}, ${kindOf(notice) === 'require_name_change'
                        ? 'until corrected or reversed' : `expires ${notice.expiresAt}`}: ${notice.reason}`).join(' · ') : 'No recorded restrictions.'}`
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
        for (const node of [this.lookup, this.mute, this.suspend, this.rename, this.revoke, this.confirm, this.cancel]) node.onclick = null;
        this.targetInput.oninput = null;
    }
}
