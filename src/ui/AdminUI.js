import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';
import { AdminOperations } from './AdminOperations.js';
import { AdminReportReview } from './AdminReportReview.js';
import { AdminChatModeration } from './AdminChatModeration.js';

// Visibility is only presentation. Every read and operation must be
// independently authorized by the server against the current durable role.
export class AdminUI {
    constructor({ host, launcher, send, openWindow, closeWindow }) {
        Object.assign(this, { launcher, send, openWindow, closeWindow });
        this.authorized = false;
        this.view = 'players';
        this.reportReviews = [];
        this.reportModerations = [];
        this.chatModerationEnabled = false; // Enable only after the server verifies the capability.
        this.root = document.createElement('section');
        this.root.id = 'administration-screen';
        this.root.className = 'window support-window administration-window';
        this.root.style.display = 'none';
        this.root.setAttribute('role', 'dialog');
        this.root.setAttribute('aria-labelledby', 'administration-title');
        this.root.innerHTML = `<div class="window-header"><span id="administration-title">Administration</span>
            <button type="button" class="close-btn" aria-label="Close administration">×</button></div>
            <div class="support-window__body administration-body">
                <p data-admin-role>Administrator access has not been verified.</p>
                <div class="administration-actions" aria-label="Administration views">
                    <button type="button" data-view="players" aria-pressed="true">Online players</button>
                    <button type="button" data-view="history" aria-pressed="false">Activity history</button>
                    <button type="button" data-view="reports" aria-pressed="false">Player reports</button></div>
                <div class="administration-filters" hidden>
                    <label>Exact account<input data-actor maxlength="71" autocomplete="off" placeholder="All accounts"></label>
                    <label>Activity<select data-action><option value="">All activity</option>
                        <option value="admin_status">Access checks</option><option value="admin_players">Player list reads</option>
                        <option value="admin_history">History reads</option><option value="admin_reports">Report reads</option><option value="admin_report_review">Report review requests</option><option value="login">Login</option>
                        <option value="admin_chat_moderation">Moderation decisions</option>
                        <option value="admin_chat_moderation_target">Moderation target checks</option>
                        <option value="resume">Resume</option><option value="disconnect">Disconnect</option>
                        <option value="admin_grant_gold">Gold grants</option><option value="admin_grant_item">Item creation</option>
                        <option value="admin_teleport">Teleports</option></select></label>
                    <label>UTC day<input data-day type="date"></label>
                </div>
                <div class="administration-filters" data-population-filters>
                    <label>Players<select data-population><option value="real">Real players</option>
                        <option value="all">All players</option><option value="tests">Test accounts only</option></select></label>
                    <span>Test accounts are identified by reserved codex-, codexq-, codexqa-, loadtest- and resource-journal- prefixes. Nothing is deleted.</span>
                </div>
                <div class="administration-filters" data-report-filters hidden>
                    <label>Report status<select data-report-status><option value="open">Open</option>
                        <option value="resolved">Resolved</option><option value="">All reports</option></select></label>
                    <label>Report category<select data-report-type><option value="">All categories</option>
                        <option value="Player Report">Player conduct</option><option value="Moderation Appeal">Moderation appeals</option>
                        <option value="Bug Report">Bug reports</option><option value="Feature Request">Feature requests</option>
                        <option value="Account Data Export">Account data exports</option><option value="Account Removal Request">Account removal requests</option></select></label>
                </div>
                <div class="administration-actions"><button type="button" data-refresh>Refresh players</button>
                    <button type="button" data-next hidden>Next page</button></div>
                <p role="status" aria-live="polite"></p>
                <p data-daily hidden></p>
                <ul class="administration-players" aria-label="Online players"></ul>
                <p class="administration-note">Up to 50 players per page. Presence can change between pages; Refresh starts again.</p>
            </div>`;
        host?.append(this.root);
        this.status = this.root.querySelector('[role="status"]');
        this.role = this.root.querySelector('[data-admin-role]');
        this.list = this.root.querySelector('ul');
        this.refresh = this.root.querySelector('[data-refresh]');
        this.next = this.root.querySelector('[data-next]');
        this.filters = this.root.querySelector('.administration-filters');
        this.populationFilters = this.root.querySelector('[data-population-filters]');
        this.population = this.root.querySelector('[data-population]');
        this.day = this.root.querySelector('[data-day]');
        this.day.value = new Date().toISOString().slice(0, 10);
        this.daily = this.root.querySelector('[data-daily]');
        this.reportFilters = this.root.querySelector('[data-report-filters]');
        this.reportStatus = this.root.querySelector('[data-report-status]');
        this.reportType = this.root.querySelector('[data-report-type]');
        this.actor = this.root.querySelector('[data-actor]');
        this.action = this.root.querySelector('[data-action]');
        this.views = [...this.root.querySelectorAll('[data-view]')];
        this.note = this.root.querySelector('.administration-note');
        this.operations = new AdminOperations(this.root.querySelector('.administration-body'), (type, payload, id) => this.request(type, payload, id));
        this.open = () => {
            if (!this.authorized) return;
            this.openWindow(this.root);
            this.refreshView('');
            this.refresh.focus();
        };
        ownedEvent(this, launcher, 'click', this.open);
        ownedEvent(this, this.root.querySelector('.close-btn'), 'click', () => {
            this.closeWindow(this.root);
            if (!this.launcher?.hidden) this.launcher?.focus();
        });
        ownedEvent(this, this.refresh, 'click', () => this.refreshView(''));
        ownedEvent(this, this.next, 'click', () => this.refreshView(this.cursor));
        for (const button of this.views) ownedEvent(this, button, 'click', () => {
            if (this.pending || !this.authorized) return;
            this.view = button.dataset.view;
            this.filters.hidden = this.view !== 'history';
            this.populationFilters.hidden = !['players', 'history'].includes(this.view);
            this.clearDaily();
            this.reportFilters.hidden = this.view !== 'reports';
            this.refresh.textContent = this.view === 'reports' ? 'Refresh reports' : this.view === 'history' ? 'Refresh history' : 'Refresh players';
            this.list.setAttribute('aria-label', this.view === 'reports' ? 'Submitted player reports' : this.view === 'history' ? 'Activity history entries' : 'Online players');
            for (const view of this.views) view.setAttribute('aria-pressed', String(view === button));
            this.refreshView('');
        });
        for (const filter of [this.actor, this.action, this.day, this.population, this.reportStatus, this.reportType]) ownedEvent(this, filter, 'input', () => {
            // Never combine a previous query's cursor with changed filters.
            this.cursor = '';
            this.next.hidden = true;
            this.clearDaily();
            this.clearReportReviews(); this.list.replaceChildren();
            this.status.textContent = `Filters changed. ${this.refresh.textContent} to load this selection.`;
        });
        this.setAuthorized(false);
    }

    setAuthorized(value) {
        this.authorized = value === true;
        if (this.launcher) this.launcher.hidden = !this.authorized;
        this.role.textContent = this.authorized ? 'Administrator · verified by server' : 'Administrator access is unavailable.';
        this.refresh.disabled = !this.authorized;
        this.reportStatus.disabled = this.reportType.disabled = !this.authorized || Boolean(this.pending);
        this.actor.disabled = this.action.disabled = this.day.disabled = this.population.disabled = !this.authorized || Boolean(this.pending);
        for (const view of this.views) view.disabled = !this.authorized;
        this.operations.setState({ authorized: this.authorized, busy: Boolean(this.pending) });
        for (const review of this.reportReviews) review.setState(Boolean(this.pending));
        for (const moderation of this.reportModerations) moderation.setState(Boolean(this.pending));
        if (!this.authorized) {
            this.chatModerationEnabled = false;
            this.clearReportReviews();
            this.list.replaceChildren();
            this.clearDaily();
            this.next.hidden = true;
            this.cursor = '';
        }
    }

    request(type, payload = {}, id = crypto.randomUUID()) {
        clearTimeout(this.timeout);
        this.pending = { id, type };
        this.refresh.disabled = true;
        this.next.disabled = true;
        for (const view of this.views) view.disabled = true;
        this.actor.disabled = this.action.disabled = this.day.disabled = this.population.disabled = this.reportStatus.disabled = this.reportType.disabled = true;
        this.status.textContent = 'Loading from server…';
        this.root.setAttribute('aria-busy', 'true');
        this.operations.setState({ authorized: this.authorized, busy: true });
        for (const review of this.reportReviews) review.setState(true);
        for (const moderation of this.reportModerations) moderation.setState(true);
        this.timeout = setTimeout(() => {
            const request = this.pending;
            this.pending = null;
            this.root.setAttribute('aria-busy', 'false');
            if (request && ['admin_chat_moderation', 'admin_chat_moderation_target'].includes(request.type)) {
                this.actor.disabled = this.action.disabled = this.next.disabled = false;
                const message = 'No reply was received. Chat decisions are unconfirmed; retry only the exact same decision or check the account again. Server permissions are rechecked on every request.';
                for (const moderation of this.reportModerations) moderation.handleResult(`${request.type}_result`,
                    { id: request.id, pending: request.type === 'admin_chat_moderation', message });
                this.setAuthorized(this.authorized); this.status.textContent = message;
                return;
            }
            this.setAuthorized(false);
            this.status.textContent = 'Administration did not respond. Reopen the game menu to verify access again.';
        }, 10_000);
        this.send(type, { ...payload, id });
    }

    refreshAccess() {
        if (!this.connected) return;
        this.setAuthorized(false);
        this.request('admin_status');
    }

    requestPlayers(after) {
        if (!this.connected || !this.authorized || this.pending) return;
        this.clearReportReviews(); this.list.replaceChildren();
        this.request('admin_players', { after, population: this.population.value });
    }

    refreshView(cursor) {
        if (this.view === 'players') { this.requestPlayers(cursor); return; }
        if (!this.connected || !this.authorized || this.pending) return;
        this.clearReportReviews(); this.list.replaceChildren();
        if (!cursor) this.clearDaily();
        if (this.view === 'reports') {
            this.request('admin_reports', { before: cursor, status: this.reportStatus.value,
                ...(this.reportType.value ? { reportType: this.reportType.value } : {}) });
            return;
        }
        this.request('admin_history', { before: cursor, actor: this.actor.value, action: this.action.value,
            population: this.population.value, day: this.day.value });
    }

    handleResult(type, result) {
        if (!this.connected || !this.pending || result?.id !== this.pending.id || type !== `${this.pending.type}_result`) return;
        this.pending = null;
        clearTimeout(this.timeout);
        this.root.setAttribute('aria-busy', 'false');
        this.actor.disabled = this.action.disabled = this.reportStatus.disabled = this.reportType.disabled = false;
        const mutation = ['admin_grant_gold_result', 'admin_grant_item_result', 'admin_teleport_result'].includes(type);
        const reviewResult = type === 'admin_report_review_result';
        const moderationResult = ['admin_chat_moderation_result', 'admin_chat_moderation_target_result'].includes(type);
        this.setAuthorized(result.authorized === true && (mutation || reviewResult || moderationResult || result.success === true));
        if (mutation) this.operations.handleResult(result);
        if (!this.authorized) {
            this.status.textContent = result.message || 'Administrator access is unavailable.';
            return;
        }
        this.status.textContent = result.message || 'Access verified.';
        if (moderationResult) {
            for (const moderation of this.reportModerations) moderation.handleResult(type, result);
            return;
        }
        if (reviewResult) {
            for (const review of this.reportReviews) review.handleResult(result);
            if (result.success === true) { this.reviewNotice = result.message; this.refreshView(''); }
            return;
        }
        if (type === 'admin_status_result') {
            this.chatModerationEnabled = result.moderationEnabled === true;
            this.operations.setState({ authorized: this.authorized, busy: false, account: result.account, items: result.items });
        }
        if (type === 'admin_history_result') {
            this.renderHistory(result.history);
            return;
        }
        if (type === 'admin_reports_result') {
            this.renderReports(result.reports);
            return;
        }
        if (type !== 'admin_players_result') return;
        this.note.textContent = 'Up to 50 players per page. Presence can change between pages; Refresh starts again.';
        const players = Array.isArray(result.players) ? result.players.slice(0, 50) : [];
        for (const player of players) {
            const row = document.createElement('li');
            const name = document.createElement('strong');
            name.textContent = player.name || player.account;
            const detail = document.createElement('span');
            detail.textContent = `${player.class} · Level ${player.level} · Account: ${player.account}`;
            if (player.auditAccount) detail.textContent += ` · History key: ${player.auditAccount}`;
            row.append(name, detail);
            const select = document.createElement('button');
            select.type = 'button'; select.textContent = 'Select for operation';
            select.addEventListener('click', () => this.operations.selectAccount(player.account));
            row.append(select);
            this.list.append(row);
        }
        this.cursor = typeof result.next === 'string' ? result.next : '';
        this.next.hidden = !this.cursor;
        this.next.disabled = false;
        this.status.textContent = players.length ? `${players.length} online player${players.length === 1 ? '' : 's'} on this page.` : 'No authenticated players are currently in the world.';
    }

    renderReports(page) {
        this.clearReportReviews();
        const reports = Array.isArray(page?.reports) ? page.reports.slice(0, 10) : [];
        for (const report of reports) {
            const row = document.createElement('li');
            const title = document.createElement('strong');
            title.textContent = `${report.reportType} · ${report.status}`;
            const author = document.createElement('span');
            author.textContent = `${report.username} · ${new Date(report.createdAt).toLocaleString()}`;
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = `Inspect report JSON · ${report.id}`;
            const json = document.createElement('pre');
            json.className = 'administration-report-json';
            json.textContent = JSON.stringify(report, null, 2);
            details.append(summary, json); row.append(title, author, details); this.list.append(row);
            const review = new AdminReportReview(row, report, this);
            this.reportReviews.push(review);
            if (this.chatModerationEnabled && ['Player Report', 'Moderation Appeal'].includes(report.reportType)) {
                this.reportModerations.push(new AdminChatModeration(row, report, this));
            }
        }
        this.cursor = typeof page?.next === 'string' ? page.next : '';
        this.next.hidden = !this.cursor; this.next.disabled = false;
        this.note.textContent = 'Private administrator view · up to 10 reports per page, newest IDs first. Viewing JSON does not resolve reports or punish players. Redact personal information before sharing.';
        this.status.textContent = `${this.reviewNotice ? this.reviewNotice + ' ' : ''}${reports.length ? `${reports.length} report${reports.length === 1 ? '' : 's'} on this page.` : 'No reports match these filters.'}`;
        this.reviewNotice = '';
    }

    clearReportReviews() {
        for (const review of this.reportReviews) review.dispose(); this.reportReviews = [];
        for (const moderation of this.reportModerations) moderation.dispose(); this.reportModerations = [];
    }

    renderHistory(history) {
        if (history?.daily) {
            const daily = history.daily;
            const valid = daily.day === this.day.value && [daily.uniqueLogins, daily.closedSessionSeconds, daily.missingDurations]
                .every(value => Number.isSafeInteger(value) && value >= 0);
            this.daily.hidden = false;
            this.daily.textContent = valid && daily.complete === true
                ? `${daily.day} UTC · ${daily.uniqueLogins} unique login accounts · ${this.sessionDuration(daily.closedSessionSeconds)} recorded closed-session time · ${daily.missingDurations} disconnects without duration.`
                : 'Daily totals are unavailable or exceed the bounded query limit. Narrow the account filter; partial totals are not displayed.';
        }
        const entries = Array.isArray(history?.entries) ? history.entries.slice(0, 50) : [];
        for (const entry of entries) {
            const row = document.createElement('li');
            const title = document.createElement('strong');
            title.textContent = `${entry.action} · ${entry.result}`;
            const actor = document.createElement('span');
            actor.textContent = `${entry.actor}${entry.target ? ` → ${entry.target}` : ''} · ${new Date(entry.at).toLocaleString()}`;
            const summary = document.createElement('span');
            summary.textContent = entry.summary;
            if (entry.action === 'disconnect') {
                const seconds = (Date.parse(entry.at) - Date.parse(entry.sessionStartedAt)) / 1000;
                summary.textContent += ` · Connected time: ${Number.isFinite(seconds) && seconds >= 0 ? this.sessionDuration(Math.floor(seconds)) : 'not recorded'}`;
            }
            row.append(title, actor, summary);
            if (entry.reason) {
                const reason = document.createElement('span'); reason.textContent = `Reason: ${entry.reason}`; row.append(reason);
            }
            this.list.append(row);
        }
        this.cursor = typeof history?.next === 'string' ? history.next : '';
        this.next.hidden = !this.cursor;
        this.next.disabled = false;
        this.note.textContent = `Newest first · up to 50 entries per page · retention: ${history?.retentionDays || 'unknown'} days. Choose a UTC day for totals (independent of Activity selection), or clear it for all retained history. Time is closed authenticated connections, not active play; currently open sessions and unrecorded legacy durations are excluded. Session activity syncs every 5 seconds.`;
        this.status.textContent = entries.length ? `${entries.length} activity record${entries.length === 1 ? '' : 's'} on this page.` : 'No activity matches these filters.';
    }

    sessionDuration(seconds) {
        return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;
    }

    clearDaily() {
        this.daily.hidden = true;
        this.daily.textContent = '';
    }

    connectionState(state) {
        clearTimeout(this.timeout);
        this.pending = null;
        this.connected = state === 'connected';
        this.setAuthorized(false);
        this.closeWindow(this.root);
        if (this.connected) this.refreshAccess();
    }

    dispose() {
        disposeOwnedEvents(this);
        this.connectionState('closed');
        this.launcher?.removeEventListener('click', this.open);
        this.root.remove();
    }
}
