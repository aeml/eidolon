// Visibility is only presentation. Every read (and future operation) must be
// independently authorized by the server against the current durable role.
export class AdminUI {
    constructor({ host, launcher, send, openWindow, closeWindow }) {
        Object.assign(this, { launcher, send, openWindow, closeWindow });
        this.authorized = false;
        this.view = 'players';
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
                <p>Read-only administration. Item grants, Gold grants and teleports are not available yet.</p>
                <div class="administration-actions" aria-label="Administration views">
                    <button type="button" data-view="players" aria-pressed="true">Online players</button>
                    <button type="button" data-view="history" aria-pressed="false">Activity history</button></div>
                <div class="administration-filters" hidden>
                    <label>Exact account<input data-actor maxlength="71" autocomplete="off" placeholder="All accounts"></label>
                    <label>Activity<select data-action><option value="">All activity</option>
                        <option value="admin_status">Access checks</option><option value="admin_players">Player list reads</option>
                        <option value="admin_history">History reads</option><option value="login">Login</option>
                        <option value="resume">Resume</option><option value="disconnect">Disconnect</option></select></label>
                </div>
                <div class="administration-actions"><button type="button" data-refresh>Refresh players</button>
                    <button type="button" data-next hidden>Next page</button></div>
                <p role="status" aria-live="polite"></p>
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
        this.actor = this.root.querySelector('[data-actor]');
        this.action = this.root.querySelector('[data-action]');
        this.views = [...this.root.querySelectorAll('[data-view]')];
        this.note = this.root.querySelector('.administration-note');
        this.open = () => {
            if (!this.authorized) return;
            this.openWindow(this.root);
            this.refreshView('');
            this.refresh.focus();
        };
        launcher?.addEventListener('click', this.open);
        this.root.querySelector('.close-btn').addEventListener('click', () => {
            this.closeWindow(this.root);
            if (!this.launcher?.hidden) this.launcher?.focus();
        });
        this.refresh.addEventListener('click', () => this.refreshView(''));
        this.next.addEventListener('click', () => this.refreshView(this.cursor));
        for (const button of this.views) button.addEventListener('click', () => {
            if (this.pending || !this.authorized) return;
            this.view = button.dataset.view;
            this.filters.hidden = this.view !== 'history';
            this.refresh.textContent = this.view === 'history' ? 'Refresh history' : 'Refresh players';
            this.list.setAttribute('aria-label', this.view === 'history' ? 'Activity history entries' : 'Online players');
            for (const view of this.views) view.setAttribute('aria-pressed', String(view === button));
            this.refreshView('');
        });
        for (const filter of [this.actor, this.action]) filter.addEventListener('input', () => {
            // Never combine a previous query's cursor with changed filters.
            this.cursor = '';
            this.next.hidden = true;
        });
        this.setAuthorized(false);
    }

    setAuthorized(value) {
        this.authorized = value === true;
        if (this.launcher) this.launcher.hidden = !this.authorized;
        this.role.textContent = this.authorized ? 'Administrator · verified by server' : 'Administrator access is unavailable.';
        this.refresh.disabled = !this.authorized;
        for (const view of this.views) view.disabled = !this.authorized;
        if (!this.authorized) {
            this.list.replaceChildren();
            this.next.hidden = true;
            this.cursor = '';
        }
    }

    request(type, payload = {}) {
        clearTimeout(this.timeout);
        const id = crypto.randomUUID();
        this.pending = { id, type };
        this.refresh.disabled = true;
        this.next.disabled = true;
        for (const view of this.views) view.disabled = true;
        this.actor.disabled = this.action.disabled = true;
        this.status.textContent = 'Loading from server…';
        this.root.setAttribute('aria-busy', 'true');
        this.timeout = setTimeout(() => {
            this.pending = null;
            this.root.setAttribute('aria-busy', 'false');
            this.setAuthorized(false);
            this.status.textContent = 'Administration did not respond. Reopen the game menu to verify access again.';
        }, 10_000);
        this.send(type, { id, ...payload });
    }

    refreshAccess() {
        if (!this.connected) return;
        this.setAuthorized(false);
        this.request('admin_status');
    }

    requestPlayers(after) {
        if (!this.connected || !this.authorized || this.pending) return;
        this.list.replaceChildren();
        this.request('admin_players', { after });
    }

    refreshView(cursor) {
        if (this.view === 'players') { this.requestPlayers(cursor); return; }
        if (!this.connected || !this.authorized || this.pending) return;
        this.list.replaceChildren();
        this.request('admin_history', { before: cursor, actor: this.actor.value, action: this.action.value });
    }

    handleResult(type, result) {
        if (!this.connected || !this.pending || result?.id !== this.pending.id || type !== `${this.pending.type}_result`) return;
        this.pending = null;
        clearTimeout(this.timeout);
        this.root.setAttribute('aria-busy', 'false');
        this.actor.disabled = this.action.disabled = false;
        this.setAuthorized(result.success === true && result.authorized === true);
        if (!this.authorized) {
            this.status.textContent = result.message || 'Administrator access is unavailable.';
            return;
        }
        this.status.textContent = result.message || 'Access verified.';
        if (type === 'admin_history_result') {
            this.renderHistory(result.history);
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
            this.list.append(row);
        }
        this.cursor = typeof result.next === 'string' ? result.next : '';
        this.next.hidden = !this.cursor;
        this.next.disabled = false;
        this.status.textContent = players.length ? `${players.length} online player${players.length === 1 ? '' : 's'} on this page.` : 'No authenticated players are currently in the world.';
    }

    renderHistory(history) {
        const entries = Array.isArray(history?.entries) ? history.entries.slice(0, 50) : [];
        for (const entry of entries) {
            const row = document.createElement('li');
            const title = document.createElement('strong');
            title.textContent = `${entry.action} · ${entry.result}`;
            const actor = document.createElement('span');
            actor.textContent = `${entry.actor}${entry.target ? ` → ${entry.target}` : ''} · ${new Date(entry.at).toLocaleString()}`;
            const summary = document.createElement('span');
            summary.textContent = entry.summary;
            row.append(title, actor, summary);
            this.list.append(row);
        }
        this.cursor = typeof history?.next === 'string' ? history.next : '';
        this.next.hidden = !this.cursor;
        this.next.disabled = false;
        this.note.textContent = `Newest first · up to 50 entries per page · retention: ${history?.retentionDays || 'unknown'} days. Session activity syncs every 5 seconds; pending records recover after a restart.`;
        this.status.textContent = entries.length ? `${entries.length} activity record${entries.length === 1 ? '' : 's'} on this page.` : 'No activity matches these filters.';
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
        this.connectionState('closed');
        this.launcher?.removeEventListener('click', this.open);
        this.root.remove();
    }
}
