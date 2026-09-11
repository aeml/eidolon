const CLASSES = new Set(['Fighter', 'Rogue', 'Wizard', 'Cleric']);

/** Counts elapsed foreground, connected play, capped by a 60-second idle window. */
export class GameSessionTracker {
    constructor(send, { now = () => performance.now(), idleMs = 60000, heartbeatMs = 30000 } = {}) {
        this.send = send;
        this.now = now;
        this.idleMs = idleMs;
        this.heartbeatMs = heartbeatMs;
        this.session = null;
    }

    start(playerClass) {
        if (this.session) return;
        const time = this.now();
        this.session = { playerClass: CLASSES.has(playerClass) ? playerClass : 'Unknown',
            started: time, checked: time, lastActivity: time, lastHeartbeat: time,
            active: false, pendingMs: 0, totalMs: 0 };
        this.emit('gameplay_start');
    }

    emit(name, parameters = {}) {
        try { this.send(name, { player_class: this.session.playerClass, ...parameters }); } catch { /* Best effort. */ }
    }

    accrue() {
        const session = this.session;
        if (!session) return;
        const time = this.now();
        if (session.active) {
            const elapsed = Math.max(0, Math.min(time, session.lastActivity + this.idleMs) - session.checked);
            session.pendingMs += elapsed;
            session.totalMs += elapsed;
        }
        session.checked = time;
    }

    setActive(active) {
        if (!this.session) return;
        this.accrue();
        if (this.session.active && !active) this.flush();
        this.session.active = active;
    }

    activity() {
        if (!this.session) return;
        this.accrue();
        this.session.lastActivity = this.now();
    }

    tick() {
        if (!this.session) return;
        this.accrue();
        if (this.now() - this.session.lastHeartbeat >= this.heartbeatMs) this.flush();
    }

    flush() {
        if (!this.session) return;
        this.accrue();
        // Only additive increments have active_play_seconds. Never repeat the
        // cumulative total on these events or GA4 sums would overcount time.
        if (this.session.pendingMs > 0) {
            this.emit('gameplay_engagement', { active_play_seconds: this.session.pendingMs / 1000 });
            this.session.pendingMs = 0;
        }
        this.session.lastHeartbeat = this.now();
    }

    end(reason = 'exit') {
        if (!this.session) return;
        this.flush();
        this.emit('gameplay_end', {
            total_active_play_seconds: this.session.totalMs / 1000,
            elapsed_session_seconds: Math.max(0, this.now() - this.session.started) / 1000,
            end_reason: reason
        });
        this.session = null;
    }
}
