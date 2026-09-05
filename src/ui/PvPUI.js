export class PvPUI {
    constructor({ openManagedWindow, closeManagedWindow }) {
        this.openManagedWindow = openManagedWindow;
        this.closeManagedWindow = closeManagedWindow;
        this.state = { queued: 0, profile: { rating: 1000, wins: 0, losses: 0, honor: 0 }, opponents: [] };
        this.leaderboard = [];
        this.onRefresh = null;
        this.onDuelRespond = null;
        this.onQueue = null;
        this.onLeave = null;
        this.onLeaderboard = null;
        this.onFlag = null;
        this.window = this.createWindow();
        this.render();
    }

    createWindow() {
        const windowElement = document.createElement('div');
        windowElement.id = 'pvp-window';
        windowElement.className = 'window pvp-window content-aware-window';
        windowElement.style.display = 'none';
        windowElement.innerHTML = `
            <div class="window-header"><span>DUELS & ARENA</span><button class="close-btn" type="button" aria-label="Close PvP window">×</button></div>
            <div class="pvp-window__body" data-pvp-body></div>`;
        windowElement.querySelector('.close-btn')?.addEventListener('click', () => this.toggle(false));
        document.body.appendChild(windowElement);
        return windowElement;
    }

    toggle(show) {
        const opening = show ?? this.window.style.display === 'none';
        if (opening) {
            if (this.openManagedWindow) this.openManagedWindow('pvp');
            else this.window.style.display = 'block';
            this.onRefresh?.();
            this.onLeaderboard?.();
        } else if (this.closeManagedWindow) {
            this.closeManagedWindow('pvp');
        } else {
            this.window.style.display = 'none';
        }
    }

    update(payload = {}) {
        // Server updates are complete snapshots; absent transient fields mean
        // the challenge/match ended, not that the previous one should survive.
        this.state = { ...this.state, queued: 0, match: null, challenge: null, deserterUntil: null,
            ...payload, opponents: Array.isArray(payload.opponents) ? payload.opponents : [] };
        this.render();
    }

    updateLeaderboard(payload = {}) {
        this.leaderboard = Array.isArray(payload.profiles) ? payload.profiles : [];
        this.season = payload.season || '';
        this.render();
    }

    render() {
        const body = this.window.querySelector('[data-pvp-body]');
        if (!body) return;
        body.replaceChildren();
        const profile = this.state.profile || {};
        const stats = document.createElement('div');
        stats.className = 'pvp-stats';
        stats.textContent = `Rating ${profile.rating ?? 1000} · ${profile.wins || 0}W / ${profile.losses || 0}L · ${profile.honor || 0} honor`;
        body.appendChild(stats);

		const flagRow = document.createElement('div');
		flagRow.className = 'pvp-actions';
		const flagged = Boolean(this.state.openWorldFlagged);
		const flagButton = this.button(flagged ? 'Disable World PvP' : 'Enable World PvP', () => this.onFlag?.(!flagged));
		if (flagged && !this.state.inSafeZone) {
			flagButton.title = 'Return to the town safe zone to disable World PvP.';
		}
		flagRow.appendChild(flagButton);
		const safe = document.createElement('span');
		safe.textContent = this.state.inSafeZone ? 'Town PvP safe zone' : (flagged ? 'World PvP active' : 'World PvP opt-in off');
		flagRow.appendChild(safe);
		body.appendChild(flagRow);

        if (this.state.challenge) {
            const challenge = document.createElement('section');
            challenge.className = 'pvp-card pvp-card--challenge';
            const requester = String(this.state.challenge.requesterId || '').replace(/^player-/, '');
            const label = document.createElement('strong');
            label.textContent = `${requester} challenges you to a duel.`;
            challenge.append(label, this.button('Accept', () => this.onDuelRespond?.(this.state.challenge.requesterId, true), 'pvp-btn--success'));
            challenge.appendChild(this.button('Decline', () => this.onDuelRespond?.(this.state.challenge.requesterId, false), 'pvp-btn--danger'));
            body.appendChild(challenge);
        }

        const match = this.state.match;
        if (match) {
            const matchCard = document.createElement('section');
            matchCard.className = 'pvp-card pvp-card--match';
            const title = document.createElement('h3');
            title.textContent = `${String(match.mode).replaceAll('_', ' ').toUpperCase()} · Round ${match.round}`;
            const score = document.createElement('div');
            score.className = 'pvp-score';
            score.textContent = `${match.scoreA} — ${match.scoreB}`;
            const progress = document.createElement('p');
            const eliminated = new Set(match.eliminated || []);
            const standing = team => (team || []).filter(id => !eliminated.has(id)).length;
            progress.textContent = match.status === 'complete'
                ? 'Match complete. Returning you to your departure point…'
                : match.roundPending
                    ? 'Team eliminated. The next round starts shortly.'
                    : `Standing: ${standing(match.teamA)} vs ${standing(match.teamB)}. ${match.mode === 'duel' ? 'Practice duel — no ranked rewards.' : 'Eliminate the whole opposing team to win a round. First to two rounds wins.'}`;
            matchCard.append(title, score, progress);
            if (match.status !== 'complete') {
                matchCard.appendChild(this.button('Forfeit', () => this.onLeave?.(), 'pvp-btn--danger'));
            }
            body.appendChild(matchCard);
        } else {
            const queue = document.createElement('section');
            queue.className = 'pvp-card';
            queue.innerHTML = '<h3>Ranked Arena</h3><p>Best-of-three team elimination. PvP damage is reduced and burst-capped; equipment still matters. Leaving a ranked match forfeits it and applies a five-minute queue penalty.</p><p>Practice duels use player challenges and never change rating, honor, season points, or ranked wins and losses.</p>';
            if (this.state.queued) {
                const queued = document.createElement('strong');
                queued.textContent = `Queued for ${this.state.queued}v${this.state.queued}`;
                queue.append(queued, this.button('Leave Queue', () => this.onLeave?.(), 'pvp-btn--danger'));
            } else {
                queue.append(this.button('Queue 1v1', () => this.onQueue?.(1), 'pvp-btn--success'));
                queue.appendChild(this.button('Queue 2v2 Party', () => this.onQueue?.(2), ''));
            }
            body.appendChild(queue);
        }

        const leaderboard = document.createElement('section');
        leaderboard.className = 'pvp-card';
        const heading = document.createElement('h3');
        heading.textContent = `Leaderboard${this.season ? ` · ${this.season}` : ''}`;
        leaderboard.appendChild(heading);
        for (const [index, entry] of this.leaderboard.entries()) {
            const row = document.createElement('div');
            row.className = 'pvp-leader-row';
            row.textContent = `${index + 1}. ${String(entry.playerId || '').replace(/^player-/, '')} · ${entry.rating}`;
            leaderboard.appendChild(row);
        }
        if (!this.leaderboard.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No ranked results this season.';
            leaderboard.appendChild(empty);
        }
        body.appendChild(leaderboard);
    }

    button(label, handler, modifier) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `pvp-btn ${modifier}`.trim();
        button.textContent = label;
        button.addEventListener('click', handler);
        return button;
    }
}
