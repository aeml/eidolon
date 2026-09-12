// Requests never mutate the shared character. Completion needs the matching
// receipt and actual replicated build, or a fresh reconnect snapshot.
export class DesktopTalentConfirmation {
    constructor(getPlayer, render) {
        this.getPlayer = getPlayer;
        this.render = render;
        this.pending = null;
        this.feedback = '';
    }

    get disabled() { return Boolean(this.pending || this.disconnected); }

    synchronize(player) {
        if (this.playerId && this.playerId !== player?.id) {
            this.pending = null; this.feedback = '';
        }
        this.playerId = player?.id;
        if (this.pending?.acknowledged && this.pending.confirmed(player)) {
            this.feedback = `Confirmed: ${this.pending.label}.`;
            this.pending = null;
        }
    }

    request(label, confirmed, callback) {
        if (this.disabled || !callback) return;
        const requestId = crypto.randomUUID();
        this.pending = { requestId, label, confirmed, acknowledged: false };
        this.feedback = ''; this.render();
        try { callback(requestId); }
        catch {
            this.pending = null;
            this.feedback = 'Could not send the change. Please try again.';
            this.render();
        }
    }

    receive(payload) {
        if (!this.pending || payload?.requestId !== this.pending.requestId) return;
        if (payload.ok === true) this.pending.acknowledged = true;
        else {
            this.pending = null;
            this.feedback = payload.message || 'The change was rejected. Review your build and try again.';
        }
        this.render();
    }

    connection(state) {
        this.disconnected = true;
        this.waitForSnapshot = state === 'connected';
        this.render();
    }

    snapshot() {
        if (!this.waitForSnapshot) return;
        this.synchronize(this.getPlayer());
        this.waitForSnapshot = false; this.disconnected = false;
        if (this.pending) {
            this.feedback = this.pending.confirmed(this.getPlayer())
                ? `Confirmed: ${this.pending.label}, restored after reconnect.`
                : 'Connection restored. The previous change was not confirmed; review your build before trying again.';
            this.pending = null;
        }
        this.render();
    }
}
