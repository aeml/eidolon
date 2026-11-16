import { casinoCard } from './CasinoCard.js';
const node = (tag, text, className = '') => {
    const n = document.createElement(tag); n.textContent = text; n.className = className; return n;
};
const total = cards => cards.reduce((sum, c) => sum + Math.min(c % 13 + 1, 10) % 10, 0) % 10;

export class BaccaratPresentation {
    constructor(parent) {
        this.root = node('div', '', 'baccarat-theatre'); this.hands = {};
        for (const [side, label] of [['player', 'Player'], ['banker', 'Banker']]) {
            const root = node('section', '', `baccarat-result-hand ${side}`);
            const title = node('strong', label), cards = node('div', '', 'baccarat-cards');
            const score = node('span', '0', 'baccarat-score'); score.setAttribute('aria-label', `${label} score`);
            root.append(title, score, cards); this.root.append(root); this.hands[side] = { root, title, cards, score, label };
        }
        this.status = node('strong', '', 'baccarat-outcome'); this.status.setAttribute('role', 'status');
        this.root.append(this.status); parent.append(this.root);
    }

    update(view, scope) {
        if (this.scope !== scope) { this.scope = scope; this.shown = { player: [], banker: [] }; }
        const result = view.baccarat || view.dealt;
        for (const [side, hand] of Object.entries(this.hands)) {
            const incoming = result?.[side] || [];
            // Equal durable versions may arrive with different public reveal
            // timestamps. An older snapshot must never turn a dealt card back.
            if (incoming.length >= this.shown[side].length) this.shown[side] = incoming;
            const shown = this.shown[side];
            hand.title.textContent = `${hand.label}${shown.length ? ` · ${total(shown)}` : ''}`;
            hand.score.textContent = String(total(shown));
            const signature = JSON.stringify(shown);
            if (hand.signature !== `${scope}:${signature}`) {
                hand.signature = `${scope}:${signature}`;
                const cards = shown.map((card, i) => {
                    const old = hand.cards.children[i];
                    if (old?.dataset.card === String(card)) return old;
                    const n = casinoCard(card); n.classList.add('dealt');
                    n.dataset.card = String(card); n.setAttribute('aria-label', `${hand.label} card ${i + 1}: ${n.getAttribute('aria-label')}`); return n;
                });
                hand.cards.replaceChildren(...cards);
                if (!cards.length) for (let i = 0; i < 2; i++) {
                    const back = casinoCard(-1, 'Undealt card'); hand.cards.append(back);
                }
            }
            hand.root.classList.toggle('winning-hand', view.baccarat?.winner === side);
        }
        this.status.textContent = view.baccarat ? view.baccarat.winner === 'tie' ? 'Tie' : `${view.baccarat.winner} wins`
            : view.phase === 'revealing' ? 'Dealing · bets closed' : 'Choose Player, Banker or Tie';
    }

    dispose() { this.root.remove(); }
}
