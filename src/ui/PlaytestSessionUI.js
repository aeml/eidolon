import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';
import { PlaytestSession, PLAYTEST_ACTIVITIES } from './PlaytestSession.js';

export class PlaytestSessionUI {
    constructor(host, { sample = () => ({}), appendDraft = () => false, now = () => performance.now() } = {}) {
        if (!host) return;
        host.__eidolonPlaytest?.dispose();
        host.__eidolonPlaytest = this;
        Object.assign(this, { host, sample, appendDraft, now });
        this.session = new PlaytestSession();
        this.root = document.createElement('details');
        this.root.className = 'help-guide help-alpha-status';
        this.root.innerHTML = `<summary>Optional playtest timer · local only</summary>
            <p>Off by default. Choose what you are doing and mark outside help. Your class, level bands and party roster size help us compare progression. Timer data stays in memory unless you choose to submit it in a report. Closing the page or changing character clears this session. Maximum eight hours.</p>
            <label>Current activity<select class="support-field__control" data-activity>${PLAYTEST_ACTIVITIES.map(value => `<option value="${value}">${value}</option>`).join('')}</select></label>
            <label><input type="checkbox" data-assisted> Receiving outside help (gear, gifts or carries)</label>
            <p>After 60 seconds without input, time is labeled idle. Hidden pages, lost connections and suspended gaps do not count as active play. These are estimates; update your activity when it changes.</p>
            <div class="support-window__actions"><button type="button" class="menu-btn" data-start>Start timer</button><button type="button" class="menu-btn" data-stop>Stop timer</button><button type="button" class="menu-btn" data-clear>Clear session</button></div>
            <p role="status" data-status>Not recording.</p>
            <pre class="administration-report-json" aria-label="Local playtest summary" data-summary></pre>
            <button type="button" class="menu-btn" data-attach>Append summary to report draft</button>
            <p>Stop first, review the summary, then optionally append it to your report. This does not submit the report. The timer records no names, chat, input contents, inventory or coordinates. A submitted report uses the usual account identity and report retention.</p>`;
        host.append(this.root);
        const query = selector => this.root.querySelector(selector);
        this.activity = query('[data-activity]'); this.assisted = query('[data-assisted]');
        this.status = query('[data-status]'); this.summary = query('[data-summary]');
        this.start = query('[data-start]'); this.stop = query('[data-stop]');
        this.clear = query('[data-clear]'); this.attach = query('[data-attach]');
        this.lastInput = this.now();
        this.noteInput = () => { this.lastInput = this.now(); };
        for (const type of ['pointerdown', 'pointermove', 'keydown', 'touchstart']) ownedEvent(this, document, type, this.noteInput, { passive: true });
        this.start.onclick = () => {
            this.lastInput = this.now();
            this.session.activity = this.activity.value; this.session.assisted = this.assisted.checked;
            if (this.session.start(this.now(), this.context())) {
                this.timer = setInterval(() => this.tick(), 1000);
                this.status.textContent = 'Recording locally. Activity labels are your estimates.';
            }
            this.render();
        };
        this.stop.onclick = () => {
            this.session.stop(this.now(), this.context()); clearInterval(this.timer);
            this.status.textContent = 'Stopped. Review before sharing; no report has been sent.'; this.render();
        };
        this.clear.onclick = () => {
            clearInterval(this.timer); this.session.clear(); this.activity.value = 'exploring'; this.assisted.checked = false;
            this.status.textContent = 'Local session cleared. Copies you added to report drafts are unchanged.'; this.render();
        };
        const change = () => {
            this.tick(); // Settle the old label first, then start the new interval.
            this.session.activity = this.activity.value; this.session.assisted = this.assisted.checked;
            this.session.tick(this.now(), this.context()); this.render();
        };
        this.activity.onchange = this.assisted.onchange = change;
        this.attach.onclick = () => {
            if (!this.session.started || this.session.running || !this.session.elapsed()) return;
            this.status.textContent = this.appendDraft(this.session.summary())
                ? 'Added to your report draft. Review and submit it separately.'
                : 'Draft unavailable, already saving, or too long. Your existing text is unchanged.';
        };
        this.render();
    }

    context() {
        const sample = this.sample();
        return { connected: sample.connected === true, level: sample.level,
            className: sample.className, partySize: sample.partySize,
            hidden: document.hidden, idle: this.now() - this.lastInput >= 60000 };
    }

    tick() {
        this.session.tick(this.now(), this.context());
        if (!this.session.running) clearInterval(this.timer);
        if (this.session.elapsed() >= 8 * 3600000) this.status.textContent = 'Stopped at the eight-hour limit. Review or clear this session.';
        this.render();
    }

    render() {
        this.start.disabled = this.session.started;
        this.stop.disabled = !this.session.running;
        this.attach.disabled = !this.session.started || this.session.running || !this.session.elapsed();
        this.summary.textContent = this.session.started ? this.session.summary() : 'No observations recorded.';
    }

    dispose() {
        disposeOwnedEvents(this);
        clearInterval(this.timer);
        for (const type of ['pointerdown', 'pointermove', 'keydown', 'touchstart']) document.removeEventListener(type, this.noteInput);
        this.session?.clear(); this.root?.remove();
        if (this.host?.__eidolonPlaytest === this) delete this.host.__eidolonPlaytest;
    }
}

// An explicit preview action, never a network submission or an overwrite.
export function appendPlaytestReportDraft(ui, summary) {
    if (!ui?.reportText || !ui.report || ui.report.pending || typeof summary !== 'string') return false;
    const draft = [ui.reportText.value, summary].filter(Boolean).join('\n\n');
    if ([...draft].length > 3200) return false;
    ui.reportText.value = draft;
    ui.report.updateCount();
    if (!ui.isElementVisible(ui.reportScreen)) ui.toggleReport();
    ui.report.setStatus('Playtest summary added locally. Review this draft and Submit only when ready.');
    return true;
}
