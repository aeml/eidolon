import { rouletteColor } from './RoulettePresentation.js';

// Server-owned, table/currency-scoped history. No locally guessed or sample
// rounds; reopening the table receives the same persisted record.
export class HouseHistory {
    constructor(parent) {
        this.root = document.createElement('section'); this.root.className = 'casino-history';
        this.heading = document.createElement('h3'); this.heading.textContent = 'Recent rounds';
        this.list = document.createElement('ol'); this.list.setAttribute('aria-label', 'Recent table results, oldest first');
        this.list.tabIndex = 0;
        this.list.addEventListener('keydown', event => {
            if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) event.stopPropagation();
        });
        this.empty = document.createElement('p'); this.empty.textContent = 'Completed rounds will appear here.';
        this.root.append(this.heading, this.list, this.empty); parent.append(this.root);
    }
    update(view) {
        const history = view.history || [];
        const key = JSON.stringify([view.tableId, view.currency, view.game, history]);
        if (key === this.key) return; this.key = key;
        const scope = JSON.stringify([view.tableId, view.currency, view.game]);
        const scroll = this.list.scrollLeft;
        const follow = this.scope !== scope || this.list.scrollWidth - this.list.clientWidth - scroll <= 4;
        this.scope = scope;
        this.root.dataset.game = view.game;
        this.empty.hidden = Boolean(history.length); this.list.replaceChildren();
        for (const round of history) {
            const n = document.createElement('li');
            if (view.game === 'roulette') {
                n.textContent = String(round.number); n.dataset.color = rouletteColor(round.number);
                n.setAttribute('aria-label', `${round.number} ${rouletteColor(round.number)}`);
            } else {
                const r = round.baccarat;
                if (!r) continue;
                n.textContent = { player: 'P', banker: 'B', tie: 'T' }[r.winner]; n.dataset.color = r.winner;
                n.setAttribute('aria-label', `${r.winner}, Player ${r.playerTotal}, Banker ${r.bankerTotal}`);
            }
            n.title = `${n.getAttribute('aria-label')} · Round ${round.roundId}`;
            this.list.append(n);
        }
        cancelAnimationFrame(this.frame);
        // The controller reveals the panel after updating its game views.
        // Follow the newest result after that layout, while respecting a
        // reader who has scrolled back to inspect earlier rounds.
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            if (!this.root.isConnected || this.root.closest('[hidden]')) return;
            this.list.scrollLeft = follow ? this.list.scrollWidth : scroll;
        });
    }
    clear() { cancelAnimationFrame(this.frame); this.frame = null; this.key = null; }
}
