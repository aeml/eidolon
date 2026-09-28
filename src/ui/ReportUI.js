const MAX_TEXT = 3200;
const REPORT_TYPES = new Set(['Bug Report', 'Player Report', 'Feature Request']);
const SAFE_TAG = /^[a-zA-Z0-9 ._-]{1,80}$/;
const tag = value => typeof value === 'string' && SAFE_TAG.test(value) ? value : 'unknown';

// Explicit allowlist: never copy navigator, logs, account/session data, chat,
// inventories or arbitrary engine properties into a report.
export function collectReportContext(engine, diagnostics = false) {
    const position = engine.player?.position;
    let area = engine.currentInstanceType || 'overworld';
    if (area === 'overworld') {
        const x = position?.x, z = position?.z;
        area = !Number.isFinite(x) || !Number.isFinite(z) ? 'overworld'
            : x >= -100 && x <= 100 && z >= 100 && z <= 300 ? 'Lanternhold'
                : z < -600 ? 'Water realm' : x < -1000 ? 'Fire realm' : x > 1000 ? 'Air realm' : 'Earth realm';
    }
    const context = {
        build: tag(document.querySelector('.start-version-row__label')?.textContent?.trim()),
        commit: tag(new URL(import.meta.url).searchParams.get('release') || 'local'),
        area: tag(area)
    };
    if (diagnostics) {
        context.quality = tag(engine.renderSystem?.graphicsQuality);
        context.viewport = `${Math.min(10000, Math.max(0, Math.round(innerWidth)))}x${Math.min(10000, Math.max(0, Math.round(innerHeight)))}`;
        context.controls = engine.isMobile ? 'touch' : 'desktop';
        if (Number.isFinite(position?.x) && Number.isFinite(position?.z)
            && Math.abs(position.x) <= 1000000 && Math.abs(position.z) <= 1000000) {
            context.position = `${Math.round(position.x)}, ${Math.round(position.z)}`;
        }
    }
    return context;
}

export function formatReportContext(context = {}) {
    const fields = ['build', 'commit', 'area', 'quality', 'viewport', 'controls', 'position'];
    return fields.filter(key => typeof context[key] === 'string')
        .map(key => `${key}: ${[...context[key]].map(char => char.codePointAt(0) < 32 ? ' ' : char).join('').slice(0, 80)}`).join('\n');
}

export class ReportUI {
    constructor(ui) {
        this.ui = ui;
        this.root = ui.reportScreen;
        this.root?.__eidolonReportUI?.dispose();
        if (!this.root) return;
        this.root.__eidolonReportUI = this;
        this.text = ui.reportText;
        this.type = ui.reportType;
        this.button = ui.btnSubmitReport;
        this.optIn = this.root.querySelector('#report-diagnostics');
        this.preview = this.root.querySelector('#report-context');
        this.status = this.root.querySelector('#report-status');
        this.count = this.root.querySelector('#report-count');
        // A new character/session must not inherit another player's draft.
        this.text.value = '';
        this.optIn.checked = false;
        this.submitListener = () => this.submit();
        this.contextListener = () => this.refreshContext();
        this.inputListener = () => this.updateCount();
        this.keyListener = event => {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); this.ui.toggleReport?.(); }
            if (event.key !== 'Tab') return;
            const controls = [...this.root.querySelectorAll('button, input, select, textarea, summary')]
                .filter(element => !element.disabled && element.getClientRects().length);
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        this.button.addEventListener('click', this.submitListener);
        this.optIn.addEventListener('change', this.contextListener);
        this.text.addEventListener('input', this.inputListener);
        this.root.addEventListener('keydown', this.keyListener);
        this.updateCount();
        this.setStatus('Reports go to the game operator. Do not include passwords or payment details.');
    }

    setStatus(message) { this.status.textContent = message; }
    updateCount() { this.count.textContent = `${[...this.text.value].length} / ${MAX_TEXT} characters`; }

    focusOnOpen() { this.opener = document.activeElement; this.text.focus(); }
    restoreFocus() { if (this.opener?.isConnected) this.opener.focus(); }

    refreshContext() {
        if (this.pending) return;
        this.context = formatReportContext(this.ui.getReportContext?.(this.optIn.checked));
        this.preview.textContent = this.context || 'Build and area unavailable.';
    }

    setPending(pending) {
        this.button.disabled = pending;
        this.text.readOnly = pending;
        this.type.disabled = pending;
        this.optIn.disabled = pending;
        this.button.textContent = pending ? 'Saving…' : 'Submit';
    }

    submit() {
        if (this.pending) return;
        const text = this.text.value.trim();
        if (!text || [...text].length > MAX_TEXT || !REPORT_TYPES.has(this.type.value)) {
            this.setStatus(`Choose a report type and enter 1–${MAX_TEXT} characters.`);
            this.text.focus();
            return;
        }
        if (this.context === undefined) this.refreshContext();
        const requestId = crypto.randomUUID();
        const body = this.context ? `${text}\n\nClient-reported context:\n${this.context}` : text;
        const pending = { requestId, draft: this.text.value, type: this.type.value };
        this.pending = pending;
        this.setPending(true);
        this.setStatus('Saving report… Your draft stays here until the server confirms.');
        try {
            if (this.ui.onReportSubmit?.(pending.type, body, requestId) !== true) {
                throw new Error('offline');
            }
        } catch {
            this.pending = null;
            this.setPending(false);
            this.setStatus('Not connected. Your draft is still here; reconnect before submitting.');
            return;
        }
        this.timer = setTimeout(() => {
            if (this.pending !== pending) return;
            this.pending = null;
            this.setPending(false);
            this.setStatus('Save not confirmed. The server may have received it. Your draft is retained; no automatic retry was sent.');
        }, 15000);
    }

    handleResult(result) {
        if (!this.pending || result?.requestId !== this.pending.requestId) return;
        const submitted = this.pending;
        clearTimeout(this.timer);
        this.pending = null;
        this.setPending(false);
        if (result.success === true) {
            if (this.text.value === submitted.draft && this.type.value === submitted.type) this.text.value = '';
            const id = typeof result.reportId === 'string' && /^[a-f0-9]{24}$/.test(result.reportId) ? result.reportId : '';
            this.setStatus(`Report saved for operator review.${id ? ` Reference: ${id}.` : ''}`);
        } else {
            this.setStatus('The report could not be saved. Your draft is retained. Please try again later.');
        }
        this.updateCount();
    }

    dispose() {
        clearTimeout(this.timer);
        this.pending = null;
        this.button?.removeEventListener('click', this.submitListener);
        this.optIn?.removeEventListener('change', this.contextListener);
        this.text?.removeEventListener('input', this.inputListener);
        this.root?.removeEventListener('keydown', this.keyListener);
        if (this.button) this.setPending(false);
        if (this.root?.__eidolonReportUI === this) delete this.root.__eidolonReportUI;
    }
}
