import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';
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

    dispose() {
        this.disposed = true;
        disposeOwnedEvents(this);
        this.isOpen = false;
        clearTimeout(this.queueRefresh);
        clearInterval(this.challengeClock);
        clearInterval(this.arenaClock);
        this.window.remove();
    }

    createWindow() {
        const windowElement = document.createElement('div');
        windowElement.id = 'pvp-window';
        windowElement.className = 'window pvp-window content-aware-window';
        windowElement.style.display = 'none';
        windowElement.innerHTML = `
            <div class="window-header"><span>DUELS & ARENA</span><button class="close-btn" type="button" aria-label="Close PvP window">×</button></div>
            <div class="pvp-window__body" data-pvp-body></div>`;
        ownedEvent(this, windowElement.querySelector('.close-btn'), 'click', () => this.toggle(false));
        document.body.appendChild(windowElement);
        return windowElement;
    }

    toggle(show) {
        if (this.disposed) return;
        const opening = show ?? this.window.style.display === 'none';
        this.isOpen = opening;
        clearTimeout(this.queueRefresh);
        clearInterval(this.challengeClock);
        clearInterval(this.arenaClock);
        if (opening) {
            if (this.openManagedWindow) this.openManagedWindow('pvp');
            else this.window.style.display = 'block';
            this.onRefresh?.();
            this.onLeaderboard?.();
            this.startChallengeClock();
            this.startArenaClock();
            this.scheduleArenaRefresh();
        } else if (this.closeManagedWindow) {
            this.closeManagedWindow('pvp');
        } else {
            this.window.style.display = 'none';
        }
    }

    update(payload = {}) {
        if (this.disposed) return;
        const previousChallenge = this.state.challenge?.id;
        // Server updates are complete snapshots; absent transient fields mean
        // the challenge/match ended, not that the previous one should survive.
        this.state = { ...this.state, queued: 0, queuePractice: false, queuedAt: null, ratingWindow: null, queuedSeconds: 0, match: null, challenge: null, deserterUntil: null,
            ...payload, opponents: Array.isArray(payload.opponents) ? payload.opponents : [] };
        this.arenaSnapshotTime = Date.now();
        this.render();
        // A challenge must be visible to its recipient, but repeated state
        // refreshes must not reopen a deliberately closed window.
        if (this.state.challenge?.id && this.state.challenge.id !== previousChallenge && !this.isOpen) this.toggle(true);
        else this.startChallengeClock();
        this.startArenaClock();
        this.scheduleArenaRefresh();
    }

    updateLeaderboard(payload = {}) {
        if (this.disposed) return;
        this.leaderboard = Array.isArray(payload.profiles) ? payload.profiles : [];
        this.season = payload.season || '';
        this.render();
    }

    startChallengeClock() {
        clearInterval(this.challengeClock);
        this.updateChallengeClock();
        if (this.isOpen && this.state.challenge?.id) this.challengeClock = setInterval(() => this.updateChallengeClock(), 1000);
    }

    scheduleArenaRefresh() {
        clearTimeout(this.queueRefresh);
        if (this.disposed || !this.isOpen || !this.state.queued) return;
        // Keep refreshing even if a single response is delayed or missing.
        // The local clock does not issue additional per-second requests.
        this.queueRefresh = setTimeout(() => {
            if (this.disposed || !this.isOpen || !this.state.queued) return;
            this.onRefresh?.();
            this.scheduleArenaRefresh();
        }, 5000);
    }

    startArenaClock() {
        clearInterval(this.arenaClock);
        this.updateArenaClock();
        if (!this.disposed && this.isOpen && (this.state.queued || this.penaltySeconds() > 0 || this.state.match?.status === 'active')) {
            this.arenaClock = setInterval(() => this.updateArenaClock(), 1000);
        }
    }

    penaltySeconds() {
        const deadline = Date.parse(this.state.deserterUntil);
        return Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 0;
    }

    updateArenaClock() {
        if (this.disposed) return;
        const elapsed = Math.max(0, Math.floor((Date.now() - (this.arenaSnapshotTime ?? Date.now())) / 1000));
        const snapshotSeconds = Number(this.state.queuedSeconds);
        const seconds = (Number.isFinite(snapshotSeconds) ? Math.max(0, Math.floor(snapshotSeconds)) : 0) + elapsed;
        const queue = this.window.querySelector('[data-arena-queue-clock]');
        if (queue) queue.textContent = `${this.state.queuePractice ? 'Practice' : 'Ranked'} ${this.state.queued}v${this.state.queued} · waiting ${seconds}s`;
        const penalty = this.penaltySeconds();
        const notice = this.window.querySelector('[data-arena-penalty]');
        if (notice) notice.textContent = penalty > 0
            ? `Arena queue restricted for ${Math.floor(penalty / 60)}:${String(penalty % 60).padStart(2, '0')} after leaving a ranked match. Your teammate does not receive this restriction.`
            : 'Queue restriction expired. The server rechecks eligibility when you join.';
        this.window.querySelectorAll('[data-arena-queue]').forEach(button => { button.disabled = penalty > 0; });
        const matchClock = this.window.querySelector('[data-arena-match-clock]');
        if (matchClock) {
            const remaining = Math.ceil((Date.parse(this.state.match?.endsAt) - Date.now()) / 1000);
            matchClock.textContent = !Number.isFinite(remaining) ? '' : remaining > 0
                ? `Match limit ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} remaining`
                : 'Match limit reached. Waiting for the authoritative result…';
        }
        if (!this.state.queued && penalty === 0 && this.state.match?.status !== 'active') clearInterval(this.arenaClock);
    }

    requestArenaQueue(size, practice = false) {
        if (this.disposed || this.state.queued || this.state.match || this.penaltySeconds() > 0) return;
        if (practice) this.onQueue?.(size, true);
        else this.onQueue?.(size);
    }

    updateChallengeClock() {
        const challenge = this.state.challenge;
        const remaining = Math.max(0, Math.ceil((Date.parse(challenge?.expiresAt) - Date.now()) / 1000));
        const usable = Boolean(challenge?.id) && Number.isFinite(remaining) && remaining > 0;
        const clock = this.window.querySelector('[data-duel-clock]');
        if (clock) clock.textContent = usable ? `Respond within ${remaining}s · practice, no ranked rewards or PvE losses.` : 'Challenge expired. Request a new duel.';
        this.window.querySelectorAll('[data-duel-response]').forEach(button => { button.disabled = !usable; });
        if (!usable) clearInterval(this.challengeClock);
    }

    respondToChallenge(challenge, accepted) {
        if (this.disposed) return;
        if (!challenge?.id || this.state.challenge?.id !== challenge.id || !Number.isFinite(Date.parse(challenge.expiresAt)) || Date.now() >= Date.parse(challenge.expiresAt)) {
            this.onRefresh?.();
            return;
        }
        this.onDuelRespond?.(challenge.requesterId, challenge.id, accepted);
    }

    render() {
        const body = this.window.querySelector('[data-pvp-body]');
        if (!body) return;
        const focusedAction = body.contains(document.activeElement) ? document.activeElement.dataset.pvpAction : null;
        const disclosures = new Map([...body.querySelectorAll('details[data-pvp-disclosure]')]
            .map(element => [element.dataset.pvpDisclosure, element.open]));
        const scrollTop = body.scrollTop;
        body.replaceChildren();
        const profile = this.state.profile || {};
        const stats = document.createElement('div');
        stats.className = 'pvp-stats';
        stats.textContent = `Rating ${profile.rating ?? 1000} · ${profile.wins || 0}W / ${profile.losses || 0}L · ${profile.honor || 0} honor`;
        body.appendChild(stats);

        const season = document.createElement('details');
        season.className = 'pvp-card pvp-card--season';
        season.dataset.pvpDisclosure = 'season';
        const seasonTitle = document.createElement('summary');
        seasonTitle.dataset.pvpAction = 'season-rules';
        seasonTitle.textContent = `${profile.season || 'Current season'} · ${profile.seasonVictories || 0} eligible ranked wins`;
        const seasonRules = document.createElement('p');
        seasonRules.textContent = 'UTC-quarter seasons run January–April, April–July, July–October and October–January, ending at 00:00 UTC on the first day of the next quarter. Season-end medals: Bronze requires 10 eligible wins (250 Honor); Silver requires 25 wins and 1200 finishing rating (600 Honor); Gold requires 50 wins and 1500 rating (1200 Honor). Only the highest earned tier pays. Forfeits and repeated-opponent restricted matches do not qualify. Rewards settle once when you next open/join the arena or collect wardrobe looks after the UTC quarter ends; your rating resets to 1000 and earned Honor stays. In town, open Character → Wardrobe → Learn owned looks to claim the matching cosmetic medallion from settled history. Repeat claims do not grant extra copies or currency; current projections cannot unlock a look. Medallions are not sold for EP and have no combat stats. Eligible-win tracking starts with Alpha 1.7; older W/L records are preserved but do not grant retroactive qualification.';
        season.append(seasonTitle, seasonRules);
        const projected = this.state.seasonReward;
        if (projected) {
            const preview = document.createElement('p');
            const ends = new Date(projected.endsAt);
            preview.textContent = `Current projection: ${projected.medal} · ${projected.honor} Honor (not awarded yet).${Number.isNaN(ends.getTime()) ? '' : ` Season ends ${ends.toISOString().slice(0, 10)} at 00:00 UTC.`}`;
            season.appendChild(preview);
        }
        const history = Array.isArray(profile.seasonHistory) ? profile.seasonHistory : [];
        for (const record of [...history].reverse()) {
            const row = document.createElement('p');
            row.textContent = `${record.season} · ${record.medal} · rating ${record.rating} · ${record.wins}W/${record.losses}L · ${record.eligibleWins} eligible wins · ${record.honorAwarded} Honor settled`;
            season.appendChild(row);
        }
        if (!history.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No completed seasons recorded yet.';
            season.appendChild(empty);
        }
        body.appendChild(season);

        const result = profile.lastResult;
        if (!this.state.match && result?.matchId) {
            const card = document.createElement('section');
            card.className = 'pvp-card pvp-card--result';
            const title = document.createElement('h3');
            title.textContent = `Last ranked result · ${result.won ? 'Victory' : 'Defeat'}${result.forfeit ? ' by forfeit' : ''}`;
            const score = document.createElement('p');
            score.textContent = `Your team ${result.teamScore} — ${result.opponentScore} opponents`;
            const rewards = document.createElement('p');
            const delta = Number(result.ratingChange) || 0;
            rewards.textContent = `Rating ${result.ratingBefore} → ${result.ratingBefore + delta} (${delta >= 0 ? '+' : ''}${delta}) · +${result.honorAwarded} Honor · +${result.seasonAwarded} season points`;
            const reason = document.createElement('p');
            reason.textContent = result.reason || '';
            card.append(title, score, rewards, reason);
            body.appendChild(card);
        }

		const flagRow = document.createElement('div');
		flagRow.className = 'pvp-actions';
		const flagged = Boolean(this.state.openWorldFlagged);
		const flagButton = this.button(flagged ? 'Disable World PvP' : 'Enable World PvP', () => this.onFlag?.(!flagged));
		if (flagged && !this.state.inSafeZone) {
			flagButton.title = 'Return to the town safe zone to disable World PvP.';
			flagButton.disabled = true;
		}
		flagRow.appendChild(flagButton);
		const safe = document.createElement('span');
		safe.textContent = this.state.inSafeZone ? 'Town PvP safe zone' : (flagged ? 'World PvP active' : 'World PvP opt-in off');
		flagRow.appendChild(safe);
		body.appendChild(flagRow);

        if (this.state.challenge) {
            const challenge = document.createElement('section');
            challenge.className = 'pvp-card pvp-card--challenge';
            const currentChallenge = this.state.challenge;
            const requester = String(currentChallenge.requesterId || '').replace(/^player-/, '');
            const label = document.createElement('strong');
            label.textContent = `${requester} challenges you to a duel.`;
            const clock = document.createElement('p');
            clock.dataset.duelClock = '';
            challenge.append(label, clock);
            for (const [text, accepted, modifier] of [['Accept', true, 'pvp-btn--success'], ['Decline', false, 'pvp-btn--danger']]) {
                const response = this.button(text, () => this.respondToChallenge(currentChallenge, accepted), modifier);
                response.dataset.duelResponse = '';
                // A replacement challenge must not inherit focused consent.
                response.dataset.pvpAction = `${text}:${currentChallenge.id}`;
                challenge.appendChild(response);
            }
            body.appendChild(challenge);
            this.updateChallengeClock();
        }

        const match = this.state.match;
        if (match) {
            const matchCard = document.createElement('section');
            matchCard.className = 'pvp-card pvp-card--match';
            const title = document.createElement('h3');
            title.textContent = `${String(match.mode).replaceAll('_', ' ').toUpperCase()} · Round ${match.round}`;
            if (match.practice) title.textContent = `PRACTICE · ${title.textContent}`;
            const score = document.createElement('div');
            score.className = 'pvp-score';
            score.textContent = `${match.scoreA} — ${match.scoreB}`;
            const progress = document.createElement('p');
            const eliminated = new Set(match.eliminated || []);
            const standing = team => (team || []).filter(id => !eliminated.has(id)).length;
            progress.textContent = match.settlementPending
                ? 'Saving the ranked result. Combat is finished; please wait while the server secures it.'
                : match.status === 'complete'
                ? 'Match complete. Returning you to your departure point…'
                : match.roundPending
                    ? 'Team eliminated. The next round starts shortly.'
                    : `Standing: ${standing(match.teamA)} vs ${standing(match.teamB)}. ${match.mode === 'duel' ? 'Practice duel — no ranked rewards.' : 'Eliminate the whole opposing team to win a round. First to two rounds wins.'}${match.practice ? ' Practice: no rating, honor or season rewards.' : ''}`;
            matchCard.append(title, score, progress);
            const roster = document.createElement('div');
            roster.className = 'pvp-match-roster';
            for (const [label, players] of [['Team A', match.teamA], ['Team B', match.teamB]]) {
                const team = document.createElement('section');
                const heading = document.createElement('h4');
                heading.textContent = label;
                const list = document.createElement('ul');
                for (const id of players || []) {
                    const row = document.createElement('li');
                    row.className = eliminated.has(id) ? 'pvp-match-player pvp-match-player--eliminated' : 'pvp-match-player';
                    const name = document.createElement('span');
                    name.textContent = String(id).replace(/^player-/, '');
                    name.title = name.textContent;
                    const status = document.createElement('span');
                    status.textContent = match.status === 'complete' ? 'Finished' : eliminated.has(id) ? 'Eliminated' : 'Standing';
                    status.className = 'pvp-match-player__status';
                    row.append(name, status);
                    list.appendChild(row);
                }
                team.append(heading, list);
                roster.appendChild(team);
            }
            matchCard.appendChild(roster);
            if (match.status === 'active') {
                const clock = document.createElement('p');
                clock.dataset.arenaMatchClock = '';
                matchCard.appendChild(clock);
            }
            if (match.status !== 'complete') {
                matchCard.appendChild(this.button('Forfeit', () => this.onLeave?.(), 'pvp-btn--danger'));
            }
            body.appendChild(matchCard);
        } else {
            const queue = document.createElement('section');
            queue.className = 'pvp-card pvp-card--arena';
            queue.innerHTML = '<h3>Arena · ranked or practice</h3><p>Best-of-three team elimination. Current combat rules: your level, equipment and build still matter—there is no hidden stat normalization. Player damage is reduced to 65% and each hit is capped at 35% of the target’s maximum health. Each round starts with full health and mana; leaving restores your pre-match amounts, so the arena is not a recovery service. Leaving a ranked match forfeits it and applies a five-minute queue penalty.</p><p>Ranked searches start within ±100 average team rating and widen by 50 every 30 seconds, to ±500. Both teams must allow the rating gap. Practice queues are separate, ignore rating gaps, and never award rating, honor, season points or ranked records. Practice duels also remain available through player challenges; leave your arena queue and any shared party before challenging each other.</p>';
            const rules = document.createElement('details');
            rules.dataset.pvpDisclosure = 'arena-rules';
            const rulesTitle = document.createElement('summary');
            rulesTitle.dataset.pvpAction = 'arena-rules';
            rulesTitle.textContent = 'Combat, matchmaking and reward rules';
            rules.appendChild(rulesTitle);
            for (const paragraph of [...queue.querySelectorAll('p')]) rules.appendChild(paragraph);
            if (this.state.queued) {
                const queued = document.createElement('strong');
                queued.dataset.arenaQueueClock = '';
                queued.textContent = `${this.state.queuePractice ? 'Practice' : 'Ranked'} ${this.state.queued}v${this.state.queued} · waiting ${Math.max(0, Math.floor(this.state.queuedSeconds || 0))}s`;
                queue.append(queued, this.button('Leave Queue', () => this.onLeave?.(), 'pvp-btn--danger'));
                const search = document.createElement('p');
                search.textContent = this.state.queuePractice ? 'Waiting for another real practice team. No bots or ranked rewards.'
                    : `Team rating ${this.state.teamRating ?? 1000} · current search ±${this.state.ratingWindow ?? 100}. No estimated match time is promised.`;
                queue.append(search);
            } else {
                const controls = document.createElement('div');
                controls.className = 'pvp-arena-actions';
                for (const [label, size, practice] of [['Queue 1v1', 1, false], ['Queue 2v2 Party', 2, false], ['Practice 1v1', 1, true], ['Practice 2v2 Party', 2, true]]) {
                    const button = this.button(label, () => this.requestArenaQueue(size, practice), practice ? '' : 'pvp-btn--success');
                    button.dataset.arenaQueue = '';
                    controls.appendChild(button);
                }
                queue.appendChild(controls);
            }
            if (this.state.deserterUntil && Number.isFinite(Date.parse(this.state.deserterUntil))) {
                const penalty = document.createElement('p');
                penalty.className = 'pvp-arena-penalty';
                penalty.dataset.arenaPenalty = '';
                queue.appendChild(penalty);
            }
            const rewardRules = document.createElement('p');
            rewardRules.textContent = 'Ranked ratings use team-strength Elo (K=32). Eligible wins award 50 Honor and 3 season points; losses award neither. Forfeits change rating but award neither team currency or season points. Only the first three meetings with each opponent per UTC day change rating or award rewards, even when teams change. Later matches still record wins and losses. Daily history is capped at 256 opponents.';
            rules.appendChild(rewardRules);
            const roundRules = document.createElement('p');
            roundRules.textContent = 'Combat effects and cooldowns start fresh on entry and each round. Temporary shields, buffs, damage-over-time and summons do not carry between rounds or back into the world. Your original skill cooldown deadlines are restored on exit; Well Rested continues counting down normally inside the arena.';
            rules.appendChild(roundRules);
            queue.appendChild(rules);
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
        this.updateArenaClock();
        body.querySelectorAll('details[data-pvp-disclosure]').forEach(element => {
            element.open = disclosures.get(element.dataset.pvpDisclosure) ?? false;
        });
        if (focusedAction) {
            [...body.querySelectorAll('[data-pvp-action]')]
                .find(element => element.dataset.pvpAction === focusedAction && !element.disabled)?.focus({ preventScroll: true });
        }
        body.scrollTop = scrollTop;
    }

    button(label, handler, modifier) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `pvp-btn ${modifier}`.trim();
        button.textContent = label;
        button.dataset.pvpAction = label;
        button.addEventListener('click', handler);
        return button;
    }
}
