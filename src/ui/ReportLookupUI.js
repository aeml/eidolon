import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

const validReference = value => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value) && !/^0+$/.test(value);
const TYPES = new Set(['Bug Report', 'Player Report', 'Moderation Appeal', 'Feature Request']);
const dateLabel = value => {
    const date = new Date(value);
    return value && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'date unavailable';
};

// Explicit user-owned lookup, no stored reference catalog or background polling.
export class ReportLookupUI {
    constructor(ui) {
        this.ui = ui;
        this.reference = ui.reportScreen?.querySelector('#report-reference');
        this.button = ui.reportScreen?.querySelector('#btn-check-report');
        this.status = ui.reportScreen?.querySelector('#report-lookup-status');
        if (!this.reference || !this.button || !this.status) return;
        this.reference.value = ''; this.status.textContent = '';
        ownedEvent(this, this.button, 'click', () => this.lookup());
    }

    remember(reference) { if (this.reference && validReference(reference) && !this.pending) this.reference.value = reference; }
    setPending(value) { this.button.disabled = value; this.reference.readOnly = value; this.button.textContent = value ? 'Checking…' : 'Check status'; }
    lookup() {
        if (this.disposed || this.pending || !this.reference || !this.reference.isConnected) return;
        const reportId = this.reference.value.trim().toLowerCase();
        if (!validReference(reportId)) { this.status.textContent = 'Enter the 24-character reference from your saved report.'; this.reference.focus(); return; }
        this.pending = { requestId: crypto.randomUUID(), reportId };
        const pending = this.pending;
        this.setPending(true); this.status.textContent = 'Checking your report…';
        try {
            if (this.ui.onReportLookup?.(this.pending.reportId, this.pending.requestId) !== true) throw new Error('offline');
        } catch {
            this.pending = null; this.setPending(false); this.status.textContent = 'Not connected. Reconnect before checking your report.'; return;
        }
        if (this.disposed || this.pending !== pending) return;
        this.timer = setTimeout(() => {
            if (this.pending !== pending) return;
            this.pending = null; this.setPending(false); this.status.textContent = 'Status not confirmed. Check again when connected; no automatic retry was sent.';
        }, 10000);
    }

    handleResult(result) {
        if (this.disposed || !this.pending || result?.requestId !== this.pending.requestId) return;
        const reference = this.pending.reportId;
        clearTimeout(this.timer); this.pending = null; this.setPending(false);
        const report = result.report;
        if (result.success !== true || report?.id !== reference || !TYPES.has(report.reportType) || !['open', 'resolved'].includes(report.status)) {
            this.status.textContent = 'Report status unavailable. Verify the reference and use the account that submitted it.'; return;
        }
        this.status.textContent = `${report.reportType} · ${reference} · ${report.status === 'open' ? 'Awaiting operator review' : 'Review finished'} · Submitted ${dateLabel(report.createdAt)}.${report.resolvedAt ? ` Reviewed ${dateLabel(report.resolvedAt)}.` : ''} Resolution is not a promised fix or sanction reversal.`;
        if (this.status.closest('details')?.open && this.ui.reportScreen.style.display !== 'none') {
            this.status.scrollIntoView?.({block: 'nearest'});
        }
    }

    dispose() {
        this.disposed = true; disposeOwnedEvents(this); clearTimeout(this.timer); this.pending = null;
        if (this.button && this.reference && this.status) { this.setPending(false); this.reference.value = ''; this.status.textContent = ''; }
    }
}
