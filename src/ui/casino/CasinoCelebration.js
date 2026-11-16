export const goldText = amount => Number(amount || 0).toLocaleString('en-US');

export function blackjackCount(cards = []) {
    let total = 0, aces = 0;
    for (const card of cards) {
        const rank = card % 13;
        if (rank === 0) { total += 11; aces++; }
        else total += Math.min(rank + 1, 10);
    }
    while (total > 21 && aces) { total -= 10; aces--; }
    return total > 21 ? `${total} · Bust` : `${total}${aces ? ' · Soft' : ''}`;
}

export function slotWinTier(payout, bet) {
    const multiple = payout / Math.max(1, bet);
    return multiple >= 100 ? 'GIGANTIC WIN' : multiple >= 50 ? 'HUGE WIN' : multiple >= 10 ? 'BIG WIN' : 'WIN';
}

// Presentation only. Server settlement never depends on dismissing this panel.
export class CasinoCelebration {
    constructor(parent) {
        this.root = document.createElement('div'); this.root.className = 'casino-celebration';
        this.root.hidden = true; this.root.setAttribute('role', 'status'); this.root.setAttribute('aria-live', 'polite');
        this.title = document.createElement('h3'); this.amount = document.createElement('strong'); this.detail = document.createElement('p');
        this.root.append(this.title, this.amount, this.detail); parent.append(this.root);
    }
    get active() { return !this.root.hidden; }
    show(title, amount, detail, onDone = null, duration = 3000) {
        this.clear(); this.title.textContent = title; this.amount.textContent = amount; this.detail.textContent = detail;
        this.root.hidden = false;
        this.timer = setTimeout(() => { this.clear(); onDone?.(); }, duration);
    }
    clear() { clearTimeout(this.timer); this.timer = null; this.root.hidden = true; }
}
