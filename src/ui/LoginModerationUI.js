import { ReportUI } from './ReportUI.js';
import { PublicNameCorrectionUI } from './PublicNameCorrectionUI.js';
import { PasswordChangeUI } from './PasswordChangeUI.js';
import { RecoveryEmailSetupUI } from './EmailRecoveryUI.js';
import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

// Reuse the ordinary private report form on the authenticated login socket.
// No game engine, world entry, background lookup or stored account catalog.
export class LoginModerationUI {
    constructor({ root, button, socket, isCurrent }) {
        if (!root || !button || !socket || typeof isCurrent !== 'function') throw new Error('Authenticated account support requires its current socket and form');
        root.__eidolonLoginSupport?.dispose();
        this.root = root; this.button = button; this.socket = socket; this.isCurrent = isCurrent;
        this.priorZIndex = root.style.zIndex;
        const type = root.querySelector('#report-type');
        this.options = [...type.options].map(option => ({ option, disabled: option.disabled }));
        this.options.forEach(({ option }) => { option.disabled = option.value !== 'Moderation Appeal'; });
        const ui = { reportScreen: root, reportText: root.querySelector('#report-text'), reportType: type,
            btnSubmitReport: root.querySelector('#btn-submit-report'),
            toggleReport: () => this.close(),
            onReportSubmit: (reportType, text, requestId) => reportType === 'Moderation Appeal'
                && this.send('report', { reportType, text, requestId }),
            onReportLookup: (reportId, requestId) => this.send('report_status', { reportId, requestId }),
            onModerationNoticeLookup: requestId => this.send('moderation_notice', { requestId }),
            getReportContext: () => ({ area: 'Account support outside the world' }) };
        this.report = new ReportUI(ui); type.value = 'Moderation Appeal'; this.report.updateGuidance();
        root.classList.add('support-window--login-report');
        root.__eidolonLoginSupport = this;
        this.nameCorrection = new PublicNameCorrectionUI({ parent: root.querySelector('#moderation-notice-status'),
            send: (type, payload) => this.send(type, payload), isCurrent: () => this.current() });
        this.passwordChange = new PasswordChangeUI({ parent: root.querySelector('.support-window__body') || root,
            send: payload => this.send('change_password', payload), isCurrent: () => this.current() });
        this.recoveryEmail = new RecoveryEmailSetupUI({ parent: root.querySelector('.support-window__body') || root,
            send: (type, payload) => this.send(type, payload), isCurrent: () => this.current() });
        button.hidden = false;
        ownedEvent(this, button, 'click', () => this.open());
        // Disabling Submit during persistence can move focus to the document.
        // Escape still closes this current login modal, not another session UI.
        ownedEvent(this, document, 'keydown', event => {
            if (event.key !== 'Escape' || !this.current() || this.root.style.display === 'none') return;
            event.preventDefault(); event.stopPropagation(); this.close();
        }, { capture: true });
        for (const id of ['btn-close-report-header', 'btn-cancel-report']) ownedEvent(this, root.querySelector(`#${id}`), 'click', () => this.close());
    }

    current() {
        return !this.disposed && !this.report?.disposed && this.root.__eidolonReportUI === this.report
            && this.root.__eidolonLoginSupport === this && this.isCurrent() && this.socket.readyState === 1;
    }

    send(type, payload) {
        if (!this.current()) return false;
        try { this.socket.send(JSON.stringify({ type, payload })); return true; } catch { return false; }
    }

    open() {
        if (!this.current()) return false;
        this.root.style.zIndex = '10005'; this.root.style.display = 'flex';
        this.passwordChange.refresh();
        this.recoveryEmail.refresh();
        this.root.querySelector('#btn-check-moderation')?.focus();
        return true;
    }

    close() {
        if (!this.current()) return;
        this.passwordChange.clearFields();
        this.recoveryEmail.clearFields();
        this.root.style.display = 'none'; this.button.focus();
    }

    handleMessage(message) {
        if (!this.current()) return false;
        switch (message?.type) {
            case 'email_recovery_result': return this.recoveryEmail.handleResult(message.payload);
            case 'password_change_result': this.passwordChange.handleResult(message.payload); return true;
            case 'report_result': this.report.handleResult(message.payload); return true;
            case 'report_status_result': this.report.lookup.handleResult(message.payload); return true;
            case 'moderation_notice_result': {
                const matched = Boolean(this.report.notice.pending && this.report.notice.pending.requestId === message.payload?.requestId);
                this.report.notice.handleResult(message.payload);
                if (matched) this.nameCorrection.setNotice(this.report.notice.notices?.find(notice => notice.kind === 'require_name_change'));
                return true;
            }
            case 'public_name_correction_result': this.nameCorrection.handleResult(message.payload); return true;
            default: return false;
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; disposeOwnedEvents(this);
        this.nameCorrection?.dispose();
        this.passwordChange?.dispose();
        this.recoveryEmail?.dispose();
        if (this.root.__eidolonLoginSupport === this) delete this.root.__eidolonLoginSupport;
        // Do not reset another UI's live fields if it already took ownership.
        if (this.root.__eidolonReportUI === this.report) {
            this.report.dispose(); this.root.style.display = 'none'; this.root.style.zIndex = this.priorZIndex;
            this.root.classList.remove('support-window--login-report');
            this.options.forEach(({ option, disabled }) => { option.disabled = disabled; });
            this.report.text.value = ''; this.report.status.textContent = '';
        }
        this.button.hidden = true;
    }
}
