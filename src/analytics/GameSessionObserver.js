/** Read-only adapter: analytics never changes gameplay or networking state. */
export class GameSessionObserver {
    constructor(tracker) {
        this.tracker = tracker;
        this.game = null;
    }

    sample(game, foreground) {
        if (this.game && (game !== this.game || game.isDestroyed)) this.end('exit');
        // A loading screen is not a successful world entry. Wait for the
        // server's first character sync before recording gameplay_start.
        if (!this.game && game && !game.isDestroyed && game._firstStateReceived && game.player?.hasSyncedLevel) {
            this.game = game;
            this.tracker.start(game.playerType);
        }
        if (!this.game) return;
        const connected = this.game.network?.socket?.readyState === 1 && !this.game.network?._reconnecting;
        this.tracker.setActive(Boolean(connected && foreground));
        this.tracker.tick();
    }

    end(reason) {
        this.tracker.end(reason);
        this.game = null;
    }
}
