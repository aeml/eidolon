import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

const dateLabel = value => new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const labels = { mute: 'Chat-mute notice', suspend: 'Temporary account suspension', require_name_change: 'Required public name change' };
const kindOf = notice => notice.kind || 'mute';
const validNotice = notice => notice && typeof notice.id === 'string' && /^[a-f0-9]{64}$/.test(notice.id)
    && typeof notice.reason === 'string' && notice.reason.trim() && new TextEncoder().encode(notice.reason).length <= 600
    && [...notice.reason].every(character => { const code = character.codePointAt(0); return code >= 32 && !(code >= 127 && code <= 159); })
    && typeof notice.startedAt === 'string' && typeof notice.expiresAt === 'string'
    && Number.isFinite(Date.parse(notice.startedAt)) && Object.hasOwn(labels, kindOf(notice))
    && (kindOf(notice) === 'require_name_change' ? notice.expiresAt === '0001-01-01T00:00:00Z'
        : Number.isFinite(Date.parse(notice.expiresAt)) && Date.parse(notice.expiresAt) > Date.parse(notice.startedAt)
            && Date.parse(notice.expiresAt) - Date.parse(notice.startedAt) <= 30 * 86400000);

// Explicit owner-only read. No polling, local notice catalog or automatic appeal.
export class ModerationNoticeUI {
    constructor(ui, report) {
        this.ui = ui; this.report = report;
        this.button = ui.reportScreen?.querySelector('#btn-check-moderation');
        this.appeal = ui.reportScreen?.querySelector('#btn-appeal-moderation');
        this.status = ui.reportScreen?.querySelector('#moderation-notice-status');
        if (!this.button || !this.appeal || !this.status) return;
        this.selection = document.createElement('select'); this.selection.className = 'support-field__control moderation-notice-selector'; this.selection.setAttribute('aria-label', 'Notice to appeal');
        this.selection.hidden = true; this.status.before(this.selection);
        ownedEvent(this, this.selection, 'change', () => {
            this.notice = this.notices?.find(notice => notice.id === this.selection.value) || null;
            this.setPending(Boolean(this.pending));
        });
        this.status.textContent = ''; this.setPending(false);
        ownedEvent(this, this.button, 'click', () => this.check());
        ownedEvent(this, this.appeal, 'click', () => {
            if (!this.disposed && !this.pending && this.notice) this.report.startModerationAppeal(this.notice.id);
        });
    }

    setPending(value) {
        this.button.disabled = value; this.button.textContent = value ? 'Checking…' : 'Check my moderation notices';
        this.selection.disabled = value;
        this.appeal.disabled = value || !this.notice;
    }

    check() {
        if (this.disposed || this.pending || !this.button?.isConnected) return;
        const pending = { requestId: crypto.randomUUID() };
        this.pending = pending; this.notice = null; this.notices = []; this.selection.hidden = true; this.selection.replaceChildren(); this.setPending(true);
        this.status.textContent = 'Checking this account’s moderation notices…';
        try {
            if (this.ui.onModerationNoticeLookup?.(pending.requestId) !== true) throw new Error('offline');
        } catch {
            if (this.disposed || this.pending !== pending) return;
            this.pending = null; this.setPending(false);
            this.status.textContent = 'Not connected. Reconnect before checking your notice.'; return;
        }
        if (this.disposed || this.pending !== pending) return;
        this.timer = setTimeout(() => {
            if (this.disposed || this.pending !== pending) return;
            this.pending = null; this.setPending(false);
            this.status.textContent = 'Notice not confirmed. Check again when connected; no automatic retry was sent.';
        }, 10000);
    }

    handleResult(result) {
        if (this.disposed || !this.pending || result?.requestId !== this.pending.requestId) return;
        clearTimeout(this.timer); this.pending = null; this.notice = null;
        this.notices = []; this.selection.replaceChildren(); this.selection.hidden = true;
        const notices = result.notices ?? (result.notice ? [result.notice] : []);
        if (result.success !== true || !Array.isArray(notices) || notices.length > 3 || !notices.every(validNotice)
            || new Set(notices.map(kindOf)).size !== notices.length) {
            this.status.textContent = 'Your moderation notices are unavailable. Reconnect and try again.';
        } else if (!notices.length) {
            this.status.textContent = 'No active temporary chat-mute or other moderation notice for this account. This is not a report or appeal status check.';
        } else {
            // Keep only the public projection in this form's ephemeral session.
            this.notices = notices.map(({ id, reason, startedAt, expiresAt, kind }) => ({ id, reason, startedAt, expiresAt, ...(kind ? { kind } : {}) }));
            this.notice = this.notices[0];
            for (const notice of this.notices) {
                const option = document.createElement('option'); option.value = notice.id;
                option.textContent = `${labels[kindOf(notice)]} · ${notice.id.slice(0, 12)}…`; this.selection.append(option);
            }
            this.selection.hidden = this.notices.length < 2;
            this.status.textContent = this.notices.map(({ id, reason, startedAt, expiresAt, kind }) => `${labels[kind || 'mute']}: ${id}. ${reason} Issued ${dateLabel(startedAt)}; ${kind === 'require_name_change'
                ? 'a corrected public name or staff reversal is required; your login and saved progress stay unchanged' : `expires ${dateLabel(expiresAt)}`}.`).join(' ')
                + ' These are the notices at your last check. An appeal requests review; it does not automatically reverse a decision.';
        }
        this.setPending(false);
        if (this.status.closest('details')?.open && this.ui.reportScreen.style.display !== 'none') {
            this.status.scrollIntoView?.({ block: 'nearest' });
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; disposeOwnedEvents(this); clearTimeout(this.timer);
        this.pending = null; this.notice = null; this.notices = []; this.selection?.remove();
        if (this.button && this.appeal && this.status) { this.setPending(false); this.status.textContent = ''; }
    }
}
