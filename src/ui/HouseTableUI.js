import { CardTableScene } from './CardTableScene.js';
import { CasinoCelebration, goldText } from './CasinoCelebration.js';

const node = (tag, text = '', className = '') => {
    const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};
const sum = wagers => (wagers || []).reduce((total, wager) => total + wager.amount, 0);
const red = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const wheelOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

export class HouseTableUI {
    constructor(send) {
        this.send = send; this.currency = 'Gold'; this.draft = new Map();
        this.root = node('div', '', 'house-game'); this.root.hidden = true;
        this.table = new CardTableScene('roulette');
        this.display = node('div', '', 'house-result'); this.table.center.append(this.display);
        this.celebration = new CasinoCelebration(this.table.center);
        this.summary = node('p'); this.summary.setAttribute('role', 'status');
        this.stakeLabel = node('label', 'Wager (Gold) ');
        this.stake = node('input'); this.stake.type = 'number'; this.stake.value = '20'; this.stakeLabel.append(this.stake);
        this.adjustments = node('div', '', 'casino-bet-adjustments');
        for (const [label, factor] of [['½', .5], ['2×', 2]]) this.adjustments.append(this.button(label, () => {
            const step = Number(this.stake.step), minimum = Number(this.stake.min);
            this.stake.value = String(Math.max(minimum, Math.min(Number(this.stake.max), Math.floor(Number(this.stake.value) * factor / step) * step)));
        }));
        const builderLabel = node('label', 'Build multiple bets ');
        this.builder = node('input'); this.builder.type = 'checkbox'; builderLabel.prepend(this.builder);
        this.builder.onchange = () => { this.draft.clear(); this.refreshControls(); };
        this.board = node('div', '', 'house-betting-board');
        this.slip = node('p', '', 'house-bet-slip');
        this.confirm = this.button('Place bets', () => this.placeWagers(this.draftWagers())); this.confirm.className = 'casino-primary';
        this.clear = this.button('Clear slip', () => { this.draft.clear(); this.refreshControls(); });
        this.rules = node('details'); this.rules.append(node('summary', 'Rules & stakes')); this.rulesText = node('p'); this.rules.append(this.rulesText);
        this.controls = node('div', '', 'card-table-controls');
        const toolbar = node('div', '', 'house-wager-toolbar'); toolbar.append(this.stakeLabel, this.adjustments, builderLabel);
        this.controls.append(this.summary, toolbar, this.board, this.slip, this.confirm, this.clear, this.rules);
        this.root.append(this.table.root, this.controls);
        this.table.onExpire = () => this.refreshControls();
    }

    button(text, action) { const b = node('button', text); b.type = 'button'; b.onclick = action; return b; }
    draftWagers() { return [...this.draft].map(([spot, amount]) => ({ spot, amount })); }
    canBet() { return this.view?.available && !this.view.processing && this.view.phase === 'betting' && !this.pending && !this.own && !this.table.expired; }

    update(view, playerID, presence = {}) {
        this.view = view; this.playerID = playerID; this.root.hidden = !view;
        if (!view) { this.pending = false; this.roundId = null; this.draft.clear(); this.table.clear(); this.celebration.clear(); return; }
        const currency = view.currency === 'ep' ? 'EP' : 'Gold';
        const changedGame = this.kind !== view.game || this.currency !== currency;
        if (changedGame || this.roundId !== view.roundId) {
            this.pending = false; this.draft.clear(); this.celebration.clear(); this.resultKey = null;
        }
        this.kind = view.game; this.currency = currency; this.roundId = view.roundId;
        this.stake.min = String(view.minBet); this.stake.max = String(view.maxBet); this.stake.step = String(view.betStep);
        if (changedGame || !Number.isFinite(Number(this.stake.value))) this.stake.value = this.stake.min;
        this.stakeLabel.firstChild.nodeValue = `Wager (${currency}) `;
        this.own = view.players?.find(p => p.playerId === playerID);
        if (this.own || view.phase !== 'betting') this.pending = false;
        this.table.root.setAttribute('aria-label', `${this.kind === 'roulette' ? 'Roulette' : 'Baccarat'} table and seats`);
        this.table.update(view, playerID, presence);
        const boardKey = `${view.game}:${currency}:${view.spots?.length || 0}`;
        if (this.boardKey !== boardKey) { this.buildBoard(view); this.boardKey = boardKey; }
        this.summary.textContent = !view.available ? 'Table unavailable. Confirmed wagers remain saved.' :
            `${goldText(view.balance)} ${currency} available · ${view.processing || this.pending ? 'Saving wager…' : this.own && view.phase === 'betting' ? 'Wager confirmed.' :
                view.phase === 'betting' ? 'Click a betting spot to place your wager.' : view.phase === 'revealing' ? 'Bets closed. Watch the table!' :
                    view.phase === 'settling' ? 'Saving payouts…' : 'Payouts saved. Next round starts automatically.'}`;
        this.rulesText.textContent = (this.kind === 'roulette' ? 'Single zero. Straight pays 35:1 profit; split 17:1; street/trio 11:1; corner/first four 8:1; six-line 5:1; dozen/column 2:1; other outside bets 1:1. Zero loses outside bets.' :
            'Eight decks reshuffled each round. Player pays 1:1; Banker pays 1:1 less 5% commission; Tie pays 8:1. Ties return Player/Banker stakes. Natural 8/9 stops the deal; other draws are automatic.') +
            ` Total bets: ${view.minBet}–${goldText(view.maxBet)} ${currency}, in steps of ${view.betStep}. Confirmed slips cannot change until next round. Leaving or disconnecting does not cancel a confirmed bet.`;
        this.renderResult(view);
        for (const seat of this.table.seats) {
            seat.hands.replaceChildren();
            const member = view.players?.find(p => p.seat === Number(seat.root.dataset.seat));
            if (member) seat.hands.append(node('small', `${goldText(sum(member.wagers))} ${currency} staked${member.paid ? ` · ${goldText(member.payout)} returned` : ''}`));
        }
        if (view.phase === 'complete' && this.own?.paid && this.celebrated !== view.roundId) {
            this.celebrated = view.roundId;
            const profit = this.own.payout - sum(this.own.wagers);
            if (profit > 0) this.celebration.show('YOU WON', `+${goldText(profit)} ${currency}`,
                `${this.kind === 'roulette' ? `Number ${view.number}` : `${view.baccarat?.winner} wins`}. ${goldText(this.own.payout)} returned.`, null, 5000);
        }
        this.refreshControls();
    }

    buildBoard(view) {
        this.board.replaceChildren(); this.spotButtons = [];
        const add = (parent, id, label, color = '') => {
            const b = this.button(label, () => this.choose(id)); b.dataset.spot = id; b.className = color;
            b.setAttribute('aria-label', `Bet on ${label}`); this.spotButtons.push(b); parent.append(b);
        };
        if (view.game === 'baccarat') {
            this.board.className = 'house-betting-board baccarat-bets';
            for (const [id, label] of [['player', 'Player · 1:1'], ['tie', 'Tie · 8:1'], ['banker', 'Banker · 0.95:1']]) add(this.board, id, label);
        } else {
            this.board.className = 'house-betting-board';
            const numbers = node('div', '', 'roulette-number-board');
            for (let n = 0; n <= 36; n++) add(numbers, `number:${n}`, String(n), n === 0 ? 'zero' : red.has(n) ? 'red' : 'black');
            const outside = node('div', '', 'roulette-outside-board');
            for (const spot of view.spots || []) if (!spot.id.includes(':')) add(outside, spot.id, spot.label);
            const advanced = node('details'); advanced.append(node('summary', 'Inside combinations · splits, streets & corners'));
            this.combination = node('select'); this.combination.setAttribute('aria-label', 'Inside roulette combination');
            for (const spot of view.spots || []) if (spot.id.includes(':') && !spot.id.startsWith('number:')) {
                const option = node('option', `${spot.label} · ${spot.multiplier - 1}:1`); option.value = spot.id; this.combination.append(option);
            }
            this.combinationBet = this.button('Bet combination', () => this.choose(this.combination.value));
            advanced.append(this.combination, this.combinationBet); this.board.append(numbers, outside, advanced);
        }
    }

    choose(spot) {
        if (!this.canBet()) return;
        const amount = Number(this.stake.value), view = this.view;
        if (!Number.isSafeInteger(amount) || amount < view.minBet || amount > view.maxBet || amount % view.betStep) {
            this.summary.textContent = `Choose ${view.minBet}–${goldText(view.maxBet)} ${this.currency} in steps of ${view.betStep}.`; return;
        }
        if (!this.builder.checked) { this.placeWagers([{ spot, amount }]); return; }
        if (sum(this.draftWagers()) + amount > Math.min(view.balance, view.maxBet)) { this.summary.textContent = 'The complete slip exceeds your balance or the table limit.'; return; }
        this.draft.set(spot, (this.draft.get(spot) || 0) + amount); this.refreshControls();
    }

    placeWagers(wagers) {
        if (!this.canBet() || !wagers.length) return;
        const total = sum(wagers);
        if (total > this.view.balance || total > this.view.maxBet) { this.summary.textContent = `Not enough ${this.currency} or total wager is over the table limit.`; return; }
        this.pending = true; this.refreshControls(); this.summary.textContent = 'Saving wager…';
        if (this.send({ action: 'house_bet', roundId: this.view.roundId, wagers }) === false) {
            this.pending = false; this.summary.textContent = 'Connection lost. No new wager is confirmed.'; this.refreshControls();
        }
    }

    refreshControls() {
        const allowed = this.canBet();
        this.spotButtons?.forEach(b => { b.disabled = !allowed; b.classList.toggle('selected', this.draft.has(b.dataset.spot)); });
        if (this.combinationBet) this.combinationBet.disabled = !allowed;
        this.confirm.hidden = this.clear.hidden = !this.builder.checked;
        this.confirm.disabled = !allowed || !this.draft.size; this.clear.disabled = !allowed;
        this.slip.hidden = !this.builder.checked;
        this.slip.textContent = `${this.draft.size} betting spots · ${goldText(sum(this.draftWagers()))} ${this.currency} total (not yet wagered)`;
        this.stake.disabled = this.builder.disabled = Boolean(this.pending);
    }

    rejectAction(error) {
        if (!this.view || error?.action !== 'house_bet' || error.roundId !== this.view.roundId) return;
        this.pending = false; this.summary.textContent = error.error || 'Wager rejected. Review the table.'; this.refreshControls();
    }

    renderResult(view) {
        const key = JSON.stringify([view.roundId, view.phase, view.number, view.baccarat]);
        if (key === this.resultKey) return; this.resultKey = key;
        this.display.replaceChildren(); this.display.classList.toggle('revealing', view.phase === 'revealing');
        if (view.game === 'roulette') {
            const wheel = node('div', '', 'roulette-wheel');
            for (const [index, n] of wheelOrder.entries()) {
                const marker = node('span', String(n), `roulette-pocket ${n === 0 ? 'zero' : red.has(n) ? 'red' : 'black'}`);
                marker.style.setProperty('--angle', `${index * 360 / 37}deg`); marker.classList.toggle('winner', n === view.number); wheel.append(marker);
            }
            this.display.append(wheel, node('strong', Number.isInteger(view.number) ? `${view.number} · ${view.number === 0 ? 'Green' : red.has(view.number) ? 'Red' : 'Black'}` : view.phase === 'revealing' ? 'Spinning…' : 'Place your bets'));
        } else {
            for (const [side, label] of [['player','Player'], ['banker','Banker']]) {
                const hand = node('div', '', 'baccarat-result-hand'); hand.append(node('strong', `${label}${view.baccarat ? ` · ${view.baccarat[`${side}Total`]}` : ''}`));
                for (const card of view.baccarat?.[side] || [-1,-1]) {
                    const suit = Math.floor(card / 13);
                    hand.append(node('span', card < 0 ? '✦' : `${['A','2','3','4','5','6','7','8','9','10','J','Q','K'][card % 13]}${['♣','♦','♥','♠'][suit]}`, `blackjack-card${suit === 1 || suit === 2 ? ' red' : ''}`));
                }
                this.display.append(hand);
            }
            if (view.baccarat) this.display.append(node('strong', view.baccarat.winner === 'tie' ? 'Tie' : `${view.baccarat.winner} wins`));
        }
    }

    dispose() { this.table.clear(); this.celebration.clear(); this.root.remove(); }
}
