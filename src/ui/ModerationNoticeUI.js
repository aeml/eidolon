import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

const dateLabel = value => new Date(value).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
const validNotice = notice => notice && typeof notice.id === 'string' && /^[a-f0-9]{64}$/.test(notice.id)
    && typeof notice.reason === 'string' && notice.reason.trim() && notice.reason.length <= 600
    && typeof notice.startedAt === 'string' && typeof notice.expiresAt === 'string'
    && Number.isFinite(Date.parse(notice.startedAt)) && Number.isFinite(Date.parse(notice.expiresAt))
    && Date.parse(notice.expiresAt) > Date.parse(notice.startedAt)
    && Date.parse(notice.expiresAt) - Date.parse(notice.startedAt) <= 30 * 86400000;

// Explicit owner-only read. No polling, local notice catalog or automatic appeal.
export class ModerationNoticeUI {
    constructor(ui, report) {
        this.ui = ui; this.report = report;
        this.button = ui.reportScreen?.querySelector('#btn-check-moderation');
        this.appeal = ui.reportScreen?.querySelector('#btn-appeal-moderation');
        this.status = ui.reportScreen?.querySelector('#moderation-notice-status');
        if (!this.button || !this.appeal || !this.status) return;
        this.status.textContent = ''; this.setPending(false);
        ownedEvent(this, this.button, 'click', () => this.check());
        ownedEvent(this, this.appeal, 'click', () => {
            if (!this.disposed && !this.pending && this.notice) this.report.startModerationAppeal(this.notice.id);
        });
    }

    setPending(value) {
        this.button.disabled = value; this.button.textContent = value ? 'Checking…' : 'Check my chat-mute notice';
        this.appeal.disabled = value || !this.notice;
    }

    check() {
        if (this.disposed || this.pending || !this.button?.isConnected) return;
        const pending = { requestId: crypto.randomUUID() };
        this.pending = pending; this.notice = null; this.setPending(true);
        this.status.textContent = 'Checking this account’s chat-mute notice…';
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
        if (result.success !== true || (result.notice != null && !validNotice(result.notice))) {
            this.status.textContent = 'Your chat-mute notice is unavailable. Reconnect and try again.';
        } else if (result.notice == null) {
            this.status.textContent = 'No active temporary chat-mute notice for this account. This is not a report or appeal status check.';
        } else {
            // Keep only the public projection in this form's ephemeral session.
            const { id, reason, startedAt, expiresAt } = result.notice;
            this.notice = { id, reason, startedAt, expiresAt };
            this.status.textContent = `Chat-mute notice: ${id}. ${reason} Issued ${dateLabel(startedAt)}; expires ${dateLabel(expiresAt)}. This is the notice at your last check. An appeal requests review; it does not automatically reverse the decision.`;
        }
        this.setPending(false);
        if (this.status.closest('details')?.open && this.ui.reportScreen.style.display !== 'none') {
            this.status.scrollIntoView?.({ block: 'nearest' });
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; disposeOwnedEvents(this); clearTimeout(this.timer);
        this.pending = null; this.notice = null;
        if (this.button && this.appeal && this.status) { this.setPending(false); this.status.textContent = ''; }
    }
}
