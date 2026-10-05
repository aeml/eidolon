// Read-only case-bound observations. Never offers a delete/settle/restore action.
export class AdminRemovalReview {
    constructor(row, report, admin) {
        Object.assign(this, { row, report, admin });
        this.valid = report.reportType === 'Account Removal Request' && /^[a-f0-9]{24}$/.test(report.id)
            && !/^0+$/.test(report.id) && Number.isSafeInteger(report.reviewRevision ?? 0)
            && (report.reviewRevision ?? 0) >= 0 && (report.reviewRevision ?? 0) <= 256
            && ['open', 'resolved'].includes(report.status);
        this.details = document.createElement('details'); this.details.className = 'administration-review';
        const summary = document.createElement('summary'); summary.textContent = 'Removal dependency review · read-only';
        const warning = document.createElement('p'); warning.textContent = 'No automatic deletion. Presence is not an unresolved count; absence is not approval. Resolving this case does not erase data. Observations can change while reviewing.';
        this.action = document.createElement('button'); this.action.type = 'button'; this.action.textContent = 'Inspect removal dependencies';
        this.status = document.createElement('p'); this.status.setAttribute('role', 'status');
        this.output = document.createElement('div');
        this.action.onclick = () => {
            if (!this.available()) return;
            this.output.replaceChildren(); this.requestID = crypto.randomUUID();
            this.status.textContent = 'Checking current references; no removal will run…';
            admin.request('admin_removal_review', {reportId: report.id, expectedRevision: report.reviewRevision ?? 0,
                expectedStatus: report.status}, this.requestID);
        };
        this.details.append(summary, warning, this.action, this.status, this.output); row.append(this.details);
        if (!this.valid) this.status.textContent = 'Case quote unavailable. Refresh before inspecting.';
        this.setState(false);
    }
    available() { return this.valid && !this.disposed && this.row.isConnected && this.admin.connected && this.admin.authorized && !this.admin.pending; }
    setState(busy) {
        this.action.disabled = busy || !this.available();
        if (!this.admin.authorized || !this.admin.connected) this.output.replaceChildren();
    }
    handleResult(result) {
        if (this.disposed || !this.requestID || result?.id !== this.requestID) return;
        this.requestID = null; this.output.replaceChildren();
        const data = result.removal;
        const valid = result.success === true && data?.reportId === this.report.id && data.reviewRevision === (this.report.reviewRevision ?? 0)
            && data.caseStatus === this.report.status && data.removalSupported === false && data.removalAuthorized === false
            && typeof data.accountPresent === 'boolean' && Number.isFinite(Date.parse(data.checkedAt))
            && [data.onlineObserved, data.pendingCharacterSave].every(value => value === undefined || typeof value === 'boolean')
            && Array.isArray(data.references) && data.references.length <= 20
            && data.references.every(item => typeof item.source === 'string' && item.source.length <= 128 && typeof item.referencePresent === 'boolean')
            && Array.isArray(data.requiredReview) && data.requiredReview.length > 0 && data.requiredReview.length <= 8
            && data.requiredReview.every(text => typeof text === 'string' && text.length <= 500);
        this.status.textContent = valid ? `Observed ${new Date(data.checkedAt).toLocaleString()}. Removal remains unsupported and unauthorized.`
            : result.success === true ? 'Invalid dependency reply. Refresh the case; no removal is authorized.'
                : result.message || 'Dependency check unavailable or case changed. Refresh; do not infer that removal is safe.';
        if (valid) {
            const facts = document.createElement('p');
            const observed = value => value === undefined ? 'not checked' : value ? 'yes' : 'no';
            facts.textContent = `Account record present: ${observed(data.accountPresent)}. Online session observed: ${observed(data.onlineObserved)}. Pending character save observed: ${observed(data.pendingCharacterSave)}. Writers were not drained; this is not a frozen snapshot.`;
            const sources = document.createElement('ul');
            for (const check of data.references) {
                const item = document.createElement('li'); item.textContent = `${check.source}: ${check.referencePresent ? 'references present — review required' : 'no matching reference observed — not clearance'}`; sources.append(item);
            }
            const title = document.createElement('strong'); title.textContent = 'Required before any separately authorized removal';
            const steps = document.createElement('ul');
            for (const text of data.requiredReview) { const item = document.createElement('li'); item.textContent = text; steps.append(item); }
            this.output.append(facts, sources, title, steps);
        }
        this.setState(false);
    }
    dispose() { this.disposed = true; this.requestID = null; this.action.onclick = null; this.output.replaceChildren(); }
}
