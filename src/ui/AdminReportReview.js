// A case quote belongs to its displayed row. Refresh/disposal retires it;
// ambiguous replies may retry only the exact confirmed payload and nonce.
import { PRIVACY_REPORT_TYPES } from './reportTypes.js';

export class AdminReportReview {
    constructor(row, report, admin, kind = 'review') {
        Object.assign(this, { row, admin });
        const approval = kind === 'export';
        const approved = report.exportApproval?.enabled === true;
        this.details = document.createElement('details');
        this.details.className = 'administration-review';
        const summary = document.createElement('summary'); summary.textContent = approval ? 'Owner export approval · separate from case review' : 'Review and resolve report';
        const label = document.createElement('label'); label.textContent = 'Private review reason';
        this.reason = document.createElement('input');
        this.reason.type = 'text'; this.reason.maxLength = 400;
        this.reason.placeholder = 'Brief reason; no passwords or private chat dumps';
        label.append(this.reason);
        this.status = document.createElement('p'); this.status.setAttribute('role', 'status');
        const privacy = PRIVACY_REPORT_TYPES.has(report.reportType);
        const consequence = approval
            ? 'Verify the requesting account and scope before approving. This permits owner-only export delivery; it sends no data now and never deletes data. Revoke blocks future admissions but cannot recall an already delivered export. Current retention is unchanged.'
            : privacy
            ? 'Review only: no data is exported or deleted; current retention is unchanged. Verify ownership, custody, redaction and delivery separately.'
            : 'Resolving a report records review only; it does not punish a player.';
        this.status.textContent = consequence;
        this.action = document.createElement('button'); this.action.type = 'button'; this.action.className = 'menu-btn';
        this.action.textContent = approval ? (approved ? 'Revoke owner export approval' : 'Approve owner export') : report.status === 'open' ? 'Mark resolved' : 'Reopen report';
        this.confirmation = document.createElement('div'); this.confirmation.hidden = true;
        const warning = document.createElement('p');
        this.confirm = document.createElement('button'); this.confirm.type = 'button'; this.confirm.className = 'menu-btn';
        this.confirm.textContent = approval ? (approved ? 'Confirm revoke' : 'Confirm export approval') : report.status === 'open' ? 'Confirm resolution' : 'Confirm reopen';
        this.cancel = document.createElement('button'); this.cancel.type = 'button'; this.cancel.className = 'menu-btn';
        this.cancel.textContent = 'Keep unchanged';
        const controls = document.createElement('div'); controls.className = 'administration-review-actions';
        controls.append(this.cancel, this.confirm); this.confirmation.append(warning, controls);
        const reviewRevision = report.reviewRevision ?? 0;
        const revision = approval ? report.exportApproval?.revision ?? 0 : reviewRevision;
        this.valid = typeof report.id === 'string' && /^[a-f0-9]{24}$/.test(report.id) && !/^0+$/.test(report.id)
            && ['open', 'resolved'].includes(report.status) && Number.isSafeInteger(revision) && revision >= 0 && revision < 256;
        if (approval) this.valid &&= report.reportType === 'Account Data Export'
            && Number.isSafeInteger(reviewRevision) && reviewRevision >= 0 && reviewRevision <= 256
            && (report.exportApproval == null || typeof report.exportApproval.enabled === 'boolean')
            && approved === (revision % 2 === 1);
        this.action.onclick = () => {
            if (!this.available()) return;
            const reason = this.reason.value.trim();
            if (!reason || [...reason].length > 400 || [...reason].some(character => {
                const code = character.codePointAt(0);
                return code < 32 || code >= 127 && code <= 159;
            })) {
                this.status.textContent = 'Enter a one-line review reason of 1–400 characters.'; this.reason.focus(); return;
            }
            this.quote = { id: crypto.randomUUID(), reportId: report.id, expectedRevision: revision,
                expectedStatus: report.status, ...(approval ? {expectedReviewRevision: reviewRevision, enabled: !approved}
                    : {status: report.status === 'open' ? 'resolved' : 'open'}), reason, confirmed: true };
            warning.textContent = `${this.action.textContent} ${report.id} at revision ${revision}? ${approval ? consequence : `The report and its review receipt change together; no player sanction is applied. ${privacy ? consequence : ''}`}`;
            this.reason.readOnly = true; this.action.hidden = true; this.confirmation.hidden = false; this.cancel.focus();
        };
        this.cancel.onclick = () => {
            if (!this.available() || this.sent) return;
            this.quote = null; this.reason.readOnly = false; this.action.hidden = false; this.confirmation.hidden = true; this.action.focus();
        };
        this.confirm.onclick = () => {
            if (!this.available() || !this.quote || this.sent && !this.retryable) return;
            this.sent = true; this.retryable = false;
            this.admin.request(approval ? 'admin_privacy_export_approval' : 'admin_report_review', this.quote, this.quote.id);
        };
        this.details.append(summary, label, this.status, this.action, this.confirmation); row.append(this.details);
        if (!this.valid) this.status.textContent = 'Review unavailable for this record. Refresh or use the operator report tool.';
        this.setState(false);
    }

    available() { return !this.disposed && this.valid && !this.finished && this.row.isConnected && this.admin.connected && this.admin.authorized && !this.admin.pending; }
    setState(busy) {
        const enabled = !busy && this.available();
        this.action.disabled = !enabled || Boolean(this.sent);
        this.reason.disabled = !enabled || Boolean(this.sent);
        this.cancel.disabled = !enabled || Boolean(this.sent);
        this.confirm.disabled = !enabled || this.sent && !this.retryable;
    }
    handleResult(result) {
        if (!this.quote || result?.id !== this.quote.id || this.disposed) return;
        this.status.textContent = result.message || 'Refresh the case to verify its current state.';
        this.retryable = result.pending === true && result.success !== true;
        this.finished = !this.retryable;
        if (this.retryable) this.confirm.textContent = 'Retry same review';
        this.setState(false);
    }
    dispose() { this.disposed = true; this.quote = null; this.action.onclick = this.confirm.onclick = this.cancel.onclick = null; }
}
