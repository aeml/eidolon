function node(tag, text = '') { const element = document.createElement(tag); element.textContent = text; return element; }

// A voluntary aid for this casino visit, not an account lock or server policy.
export class CasinoPlayControls {
    constructor(onPause, now = () => performance.now()) {
        this.onPause = onPause; this.now = now; this.limitMinutes = 0;
        this.root = node('section'); this.root.className = 'casino-play-controls';
        this.root.setAttribute('aria-label', 'Voluntary casino play controls');
        const row = node('div'); row.className = 'casino-play-controls-row';
        this.status = node('span', 'Optional play-time limit'); this.status.setAttribute('role', 'status');
        this.pause = node('button', 'Take a break'); this.pause.type = 'button';
        this.pause.onclick = () => this.pausePlay('New play paused by you.');
        this.resume = node('button', 'Start new session'); this.resume.type = 'button'; this.resume.hidden = true;
        this.resume.onclick = () => { if (!this.disposed) this.startSession(); };
        row.append(this.status, this.pause, this.resume);
        this.details = node('details'); this.details.append(node('summary', 'Play-time limit & safety'));
        const label = node('label', 'Stop new play after '); this.minutes = node('select');
        for (const [value, text] of [[0, 'No timer'], [15, '15 minutes'], [30, '30 minutes'], [60, '60 minutes']]) {
            const option = node('option', text); option.value = String(value); this.minutes.append(option);
        }
        label.append(this.minutes); this.apply = node('button', 'Apply time limit'); this.apply.type = 'button';
        this.apply.onclick = () => {
            if (this.disposed) return;
            const minutes = Number(this.minutes.value);
            if (![0, 15, 30, 60].includes(minutes)) return;
            this.limitMinutes = minutes;
            if (!this.paused) this.startedAt = this.now();
            this.tick();
        };
        this.details.append(label, this.apply,
            node('p', 'Optional controls for this browser and casino visit only—not an account lock. Changing seats or floors does not reset the timer. Leaving the casino or closing the game clears it.'),
            node('p', 'A break stops queued spins and new paid spins, opening blackjack bets, poker buy-ins and roulette/baccarat wagers. Funded hand decisions, including extra split/double bets or poker raises, and saved free spins/bonus choices remain available. Confirmed outcomes still settle; winnings cannot be guaranteed.'),
            node('p', 'Gold and EP are separate. EP cannot return to Gold or buy combat power. Payment integration is not available.'));
        this.root.append(row, this.details); this.startedAt = this.now(); this.tick();
    }

    setContext(owner, inside) {
        if (this.disposed) return;
        if (this.owner === owner && this.inside === inside) return;
        const reset = this.owner !== owner || !inside;
        this.owner = owner; this.inside = inside;
        if (reset) { this.limitMinutes = 0; this.minutes.value = '0'; this.startSession(); }
    }

    startSession() {
        if (this.disposed) return;
        this.paused = false; this.reason = ''; this.startedAt = this.now(); this.tick();
    }

    pausePlay(reason) {
        if (this.disposed || this.paused) return;
        this.paused = true; this.reason = reason; this.onPause?.(reason); this.tick();
    }

    tick() {
        if (this.disposed) return;
        const seconds = this.limitMinutes ? Math.max(0, Math.ceil(this.limitMinutes * 60 - (this.now() - this.startedAt) / 1000)) : null;
        if (!this.paused && seconds === 0) this.pausePlay('Your play-time limit is reached. New play paused.');
        const text = this.paused ? this.reason : seconds === null ? 'Optional play-time limit' : `New play stops in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
        if (this.status.textContent !== text) this.status.textContent = text;
        this.pause.hidden = Boolean(this.paused); this.resume.hidden = !this.paused;
    }

    allows(payload, slotView) {
        this.tick();
        if (this.disposed) return false;
        if (!this.paused) return true;
        if (['bet', 'poker_buy_in', 'house_bet'].includes(payload.action)) return false;
        if (payload.action === 'slot_spin') return Boolean(slotView?.available && slotView.session?.freeSpins > 0);
        return true;
    }

    dispose() { this.disposed = true; this.root.remove(); }
}
