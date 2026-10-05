import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';
import { ReportLookupUI } from './ReportLookupUI.js';
import { ModerationNoticeUI } from './ModerationNoticeUI.js';
import { getOverworldRegion, WORLD_REGIONS } from '../data/worldGeography.js';
import { REPORT_TYPES, PRIVACY_REPORT_TYPES } from './reportTypes.js';
import { OwnerExportDownload } from './OwnerExportDownload.js';
import { mountDataPrivacyNotices } from './DataPrivacyNotice.js';

const MAX_TEXT = 3200;
const SAFE_TAG = /^[a-zA-Z0-9 ._-]{1,80}$/;
const tag = value => typeof value === 'string' && SAFE_TAG.test(value) ? value : 'unknown';

// Explicit allowlist: never copy navigator, logs, account/session data, chat,
// inventories or arbitrary engine properties into a report.
export function collectReportContext(engine, diagnostics = false) {
    const position = engine.player?.position;
    let area = engine.currentInstanceType || 'overworld';
    if (area === 'overworld') {
        const region = getOverworldRegion(position?.x, position?.z);
        area = WORLD_REGIONS[region]?.name || 'overworld';
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
        mountDataPrivacyNotices(this.root);
        this.text = ui.reportText;
        this.type = ui.reportType;
        this.button = ui.btnSubmitReport;
        this.optIn = this.root.querySelector('#report-diagnostics');
        this.preview = this.root.querySelector('#report-context');
        this.status = this.root.querySelector('#report-status');
        this.count = this.root.querySelector('#report-count');
        this.guidance = this.root.querySelector('#report-guidance');
        this.exportDownload = new OwnerExportDownload({parent: this.root.querySelector('.support-window__body') || this.root,
            send: payload => ui.onOwnerExportSection?.(payload), isCurrent: () => !this.disposed && this.root.style.display !== 'none' && ui.isOwnerExportSessionCurrent?.() === true});
        this.lookup = new ReportLookupUI(ui, report => this.exportDownload.setApproval(report));
        this.notice = new ModerationNoticeUI(ui, this);
        // A new character/session must not inherit another player's draft.
        this.text.value = '';
        this.optIn.checked = false;
        this.submitListener = () => this.submit();
        this.contextListener = () => this.refreshContext();
        this.inputListener = () => this.updateCount();
        this.typeListener = () => { this.updateGuidance(); this.refreshContext(); };
        this.keyListener = event => {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); this.ui.toggleReport?.(); }
            if (event.key !== 'Tab') return;
            const controls = [...this.root.querySelectorAll('button, input, select, textarea, summary, a[href]')]
                .filter(element => {
                    if (element.disabled || element.tabIndex < 0 || !element.getClientRects().length) return false;
                    for (let ancestor = element.parentElement; ancestor && ancestor !== this.root; ancestor = ancestor.parentElement) {
                        if (ancestor.hidden) return false;
                        // Chromium can retain layout rectangles for children of
                        // a collapsed disclosure. Those are not keyboard targets.
                        if (ancestor.tagName === 'DETAILS' && !ancestor.open
                            && !ancestor.querySelector(':scope > summary')?.contains(element)) return false;
                    }
                    return true;
                });
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        ownedEvent(this, this.button, 'click', this.submitListener);
        ownedEvent(this, this.optIn, 'change', this.contextListener);
        ownedEvent(this, this.text, 'input', this.inputListener);
        ownedEvent(this, this.type, 'change', this.typeListener);
        ownedEvent(this, this.root, 'keydown', this.keyListener);
        this.updateCount();
        this.updateGuidance();
        this.setStatus('Reports go to the game operator. Do not include passwords or payment details.');
    }

    setStatus(message) { if (!this.disposed) this.status.textContent = message; }
    updateGuidance() {
        if (this.disposed || !this.guidance) return;
        const privacy = PRIVACY_REPORT_TYPES.has(this.type.value);
        this.optIn.disabled = Boolean(this.pending) || privacy;
        if (privacy) this.optIn.checked = false;
        if (privacy) {
            this.guidance.textContent = this.type.value === 'Account Data Export'
                ? 'Request an export of your own account data. An administrator will verify ownership, scope and a safe delivery method before preparing it. Submission does not generate or send an export. Do not include passwords, tokens or identity documents. No automatic diagnostics are attached.'
                : 'Request review of removal of your own account data. Submission does not delete your account, characters or history. An administrator must review ownership, shared trades, guild custody and backups before any separately authorized action. Current retention is unchanged; no automatic deletion. Do not include passwords, tokens or identity documents. No automatic diagnostics are attached.';
            return;
        }
        this.guidance.textContent = this.type.value === 'Moderation Appeal'
            ? 'Include the moderation notice or report reference, why you think the decision was wrong, and relevant facts. An appeal requests review; it does not automatically cancel a sanction. Do not include passwords or payment details.'
            : this.type.value === 'Player Report'
                ? 'Include the player name, approximate time and whether the issue is chat, a name or other conduct. Review any selected message before submitting; it is client-reported, not verified evidence. You can block contact or ignore chat in Player safety. Reports do not automatically punish anyone.'
            : 'Describe what happened and what you expected. Reports go to the game operator; do not include passwords or payment details.';
    }
    updateCount() { if (!this.disposed) this.count.textContent = `${[...this.text.value].length} / ${MAX_TEXT} characters`; }

    focusOnOpen() { if (!this.disposed) { this.opener = document.activeElement; this.text.focus(); } }
    restoreFocus() { this.exportDownload?.close(); if (!this.disposed && this.opener?.isConnected) this.opener.focus(); }

    startPlayerReport(username, context = '') {
        if (this.disposed) return false;
        if (this.pending) {
            this.setStatus('Your report is still saving. Wait for confirmation before adding another player.');
            return false;
        }
        const selected = `Player: ${username}\nContext: ${String(context).slice(0, 1200)}\nWhat happened (include approximate time):\n`;
        const draft = this.text.value.trim() ? `${this.text.value}\n\n${selected}` : selected;
        if ([...draft].length > MAX_TEXT) {
            this.setStatus('Your existing draft is too long to add this selection. Finish or shorten it first; nothing was replaced.');
            return false;
        }
        this.text.value = draft; this.type.value = 'Player Report';
        this.updateCount(); this.updateGuidance();
        this.setStatus('Review the selected player and context, add your explanation, then Submit. Nothing has been sent.');
        return true;
    }

    startModerationAppeal(noticeId) {
        if (this.disposed || typeof noticeId !== 'string' || !/^[a-f0-9]{64}$/.test(noticeId)) return false;
        if (this.pending) {
            this.setStatus('Your report is still saving. Wait for confirmation before starting an appeal.'); return false;
        }
        const selected = `Moderation notice: ${noticeId}\nWhy I request a review and relevant facts:\n`;
        const draft = this.text.value.trim() ? `${this.text.value}\n\n${selected}` : selected;
        if ([...draft].length > MAX_TEXT) {
            this.setStatus('Your existing draft is too long to add this notice. Finish or shorten it first; nothing was replaced.'); return false;
        }
        this.text.value = draft; this.type.value = 'Moderation Appeal';
        this.updateCount(); this.updateGuidance();
        this.setStatus('Appeal draft started. Add your explanation and review it before Submit. Nothing has been sent.');
        this.text.focus();
        return true;
    }

    refreshContext() {
        if (this.disposed || this.pending) return;
        if (PRIVACY_REPORT_TYPES.has(this.type.value)) {
            this.context = '';
            this.preview.textContent = 'Privacy request: no automatic context or diagnostics attached.';
            return;
        }
        this.context = formatReportContext(this.ui.getReportContext?.(this.optIn.checked));
        this.preview.textContent = this.context || 'Build and area unavailable.';
    }

    setPending(pending) {
        this.button.disabled = pending;
        this.text.readOnly = pending;
        this.type.disabled = pending;
        this.optIn.disabled = pending || PRIVACY_REPORT_TYPES.has(this.type.value);
        this.button.textContent = pending ? 'Saving…' : 'Submit';
    }

    submit() {
        if (this.disposed || this.pending) return;
        const text = this.text.value.trim();
        if (!text || [...text].length > MAX_TEXT || !REPORT_TYPES.has(this.type.value)) {
            this.setStatus(`Choose a report type and enter 1–${MAX_TEXT} characters.`);
            this.text.focus();
            return;
        }
        if (this.context === undefined || PRIVACY_REPORT_TYPES.has(this.type.value)) this.refreshContext();
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
            if (this.disposed || this.pending !== pending) return;
            this.pending = null;
            this.setPending(false);
            this.setStatus('Not connected. Your draft is still here; reconnect before submitting.');
            return;
        }
        if (this.disposed || this.pending !== pending) return;
        this.timer = setTimeout(() => {
            if (this.pending !== pending) return;
            this.pending = null;
            this.setPending(false);
            this.setStatus('Save not confirmed. The server may have received it. Your draft is retained; no automatic retry was sent.');
        }, 15000);
    }

    handleResult(result) {
        if (this.disposed || !this.pending || result?.requestId !== this.pending.requestId) return;
        const submitted = this.pending;
        clearTimeout(this.timer);
        this.pending = null;
        this.setPending(false);
        if (result.success === true) {
            if (this.text.value === submitted.draft && this.type.value === submitted.type) this.text.value = '';
            const id = typeof result.reportId === 'string' && /^[a-f0-9]{24}$/.test(result.reportId) ? result.reportId : '';
            this.lookup.remember(id);
            this.setStatus(`Report saved for operator review.${id ? ` Reference: ${id}.` : ''}`);
        } else {
            this.setStatus('The report could not be saved. Your draft is retained. Please try again later.');
        }
        this.updateCount();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.lookup?.dispose();
        this.exportDownload?.dispose();
        this.notice?.dispose();
        disposeOwnedEvents(this);
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
