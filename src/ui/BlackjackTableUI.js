import { CasinoCelebration, blackjackCount, goldText } from './CasinoCelebration.js';
import { CardTableScene } from './CardTableScene.js';

const labels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits = ['♣', '♦', '♥', '♠'];

function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
}

export class BlackjackTableUI {
    constructor(send) {
        this.send = send; this.currency = 'Gold';
        this.root = node('div', '', 'blackjack-game'); this.root.hidden = true;
        this.summary = node('p'); this.summary.setAttribute('role', 'status');
        this.rules = node('details'); this.rules.append(node('summary', 'Rules & stakes'));
        this.rules.append(node('p', 'Six decks. Dealer stands on soft 17 and checks for blackjack. Blackjack pays 3:2 profit; other wins pay 1:1; pushes return your stake. Split 21 pays as an ordinary win.'));
        this.stakeRules = node('p'); this.rules.append(this.stakeRules);
        this.rules.append(node('p', 'You have 30 seconds per decision. Timeouts stand. Confirmed wagers continue if you leave or disconnect, and payouts are saved automatically. Betting windows run for 30 seconds without waiting for a first wager. After saved results, the next window opens automatically; no wager is placed for you.'));
        this.rules.append(node('p', 'Rule-based estimate: about 0.41% house edge per opening wager with correct basic strategy and a fresh shoe. Choices and timeouts can increase losses; individual rounds vary. All splits and doubles can commit up to eight times your opening stake.'));
        this.betBox = node('div', '', 'blackjack-bet');
        const label = node('label', 'Wager (Gold) '); this.stakeLabel = label;
        this.stake = node('input'); this.stake.type = 'number'; this.stake.min = '20'; this.stake.max = '500'; this.stake.step = '20'; this.stake.value = '100';
        label.append(this.stake);
        this.bet = this.button('Bet · 100 Gold', () => this.placeBet()); this.betBox.append(label, this.bet);
        this.stake.oninput = () => { this.bet.textContent = `Bet · ${this.stake.value || '…'} ${this.currency}`; };
        this.adjustments = node('div', '', 'casino-bet-adjustments');
        for (const [label, factor] of [['½', .5], ['2×', 2]]) this.adjustments.append(this.button(label, () => {
            if (this.stake.disabled) return;
            this.stake.value = String(Math.max(Number(this.stake.min), Math.min(Number(this.stake.max), Math.floor(Number(this.stake.value) * factor / Number(this.stake.step)) * Number(this.stake.step) || Number(this.stake.min))));
            this.stake.oninput();
        }));
        this.betBox.insertBefore(this.adjustments, this.bet); this.bet.className = 'casino-primary';
        this.table = new CardTableScene('blackjack'); this.cards = this.table.root; this.cards.classList.add('blackjack-hands');
        this.table.onExpire = () => this.root.querySelectorAll('button, input').forEach(control => { control.disabled = true; });
        this.actions = node('div', '', 'blackjack-actions');
        this.controls = node('div', '', 'card-table-controls');
        this.controls.append(this.summary, this.betBox, this.actions, this.rules);
        this.root.append(this.cards, this.controls);
        this.celebration = new CasinoCelebration(this.table.center);
    }

    button(text, handler) { const button = node('button', text); button.type = 'button'; button.onclick = handler; return button; }

    update(view, playerID, presence = {}) {
        this.view = view; this.playerID = playerID; this.root.hidden = !view;
        if (!view) { this.pendingKey = null; this.renderKey = null; this.table.clear(); this.celebration.clear(); return; }
        this.presence = presence; this.table.update(view, playerID, presence);
        const changedCurrency = this.currency !== (view.currency === 'ep' ? 'EP' : 'Gold');
        this.currency = view.currency === 'ep' ? 'EP' : 'Gold'; this.balance = view.balance ?? view.gold;
        this.stake.min = String(view.minBet || 20); this.stake.step = String(view.betStep || 20);
        this.stake.max = String(view.maxBet || 500);
        if (changedCurrency) this.stake.value = this.stake.min;
        this.stakeLabel.firstChild.nodeValue = `Wager (${this.currency}) `; this.stake.oninput();
        this.stakeRules.textContent = `Bet ${this.stake.min}–${goldText(this.stake.max)} ${this.currency} in steps of ${this.stake.step}. Double on two cards, including after splitting. Split equal-value pairs into at most four hands; split aces receive one card each. No insurance or surrender.`;
        if (this.celebrationRound !== view.roundId) this.celebration.clear();
        const own = view.players?.find(player => player.playerId === playerID);
        this.stateKey = JSON.stringify([view.roundId, view.phase, view.round?.revision, own, playerID]);
        if (this.pendingKey !== this.stateKey) this.pendingKey = null;
        this.summary.textContent = !view.available ? 'Blackjack is temporarily unavailable; saved wagers are retained.' :
            view.processing ? `Saving table funds… · ${this.balance} ${this.currency} available` :
            `${this.balance} ${this.currency} available · ${view.phase === 'betting' ? own ? 'Your wager is confirmed.' : 'Betting is open.' :
                view.phase === 'settling' ? 'Saving payouts…' : view.phase === 'complete' ? 'Payouts saved. Next round shortly.' : 'Round in progress.'}`;
        this.betBox.hidden = view.phase !== 'betting';
        this.bet.disabled = !this.canAct() || view.phase !== 'betting' || Boolean(own); this.stake.disabled = this.bet.disabled;
        this.adjustments.querySelectorAll('button').forEach(button => { button.disabled = this.stake.disabled; });
        const renderKey = JSON.stringify([this.stateKey, view.round, presence]);
        const changed = this.renderKey !== renderKey; this.renderKey = renderKey;
        if (changed) {
            this.table.dealerCards.replaceChildren();
            for (const seat of this.table.seats) seat.hands.replaceChildren();
            this.actions.replaceChildren();
        }
        if (view.round) {
            const round = view.round;
            if (changed) {
                this.hand('', round.dealer, round.dealerHidden, false, this.table.dealerCards);
                for (const player of round.players || []) {
                    const participant = view.players.find(p => p.playerId === player.playerId);
                    for (const [index, hand] of player.hands.entries()) {
                        const active = view.phase === 'playing' && round.turnPlayerId === player.playerId && round.turnHand === index;
                        const result = hand.outcome ? ` · ${hand.outcome} · ${hand.payout} ${this.currency} returned` : '';
                        const seat = player.seat ?? participant?.seat;
                        this.hand(`${player.hands.length > 1 ? `Hand ${index + 1} · ` : ''}${hand.bet} ${this.currency}${result}`, hand.cards, false, active, this.table.seats[seat]?.hands);
                    }
                }
                if (view.phase === 'playing' && round.turnPlayerId === playerID) {
                    for (const action of round.actions || []) {
                        const cost = ['double', 'split'].includes(action) ? ` · +${round.players.find(p => p.playerId === playerID)?.hands[round.turnHand]?.bet} ${this.currency}` : '';
                        const button = this.button(action[0].toUpperCase() + action.slice(1) + cost, () => this.choose(action));
                        button.disabled = !this.canAct(); this.actions.append(button);
                    }
                }
            }
            if (view.available && !view.processing && view.phase === 'complete' && this.celebrationRound !== view.roundId) {
                this.celebrationRound = view.roundId;
                const hands = round.players.find(p => p.playerId === playerID)?.hands || [];
                const returned = hands.reduce((sum, h) => sum + h.payout, 0), staked = hands.reduce((sum, h) => sum + h.bet, 0);
                if (returned > staked) this.celebration.show('YOU WON', `+${goldText(returned - staked)} ${this.currency}`,
                    `${hands.map(h => h.outcome === 'blackjack' ? 'Blackjack' : `${blackjackCount(h.cards)} (${h.outcome})`).join(' · ')}. ${goldText(returned)} returned, ${goldText(staked)} staked.`, null, 5000);
            }
        }
        this.actions.querySelectorAll('button').forEach(button => { button.disabled = !this.canAct(); });
    }

    hand(title, cards, hidden, active = false, target) {
        const row = node('div', '', `blackjack-hand${active ? ' current' : ''}`);
        const caption = node('p', title); caption.title = title; row.append(caption);
        for (const card of cards || []) {
            const suit = Math.floor(card / 13);
            row.append(node('span', `${labels[card % 13]}${suits[suit]}`, `blackjack-card${suit === 1 || suit === 2 ? ' red' : ''}`));
        }
        if (hidden) { const back = node('span', '✦', 'blackjack-card back'); back.setAttribute('aria-label', 'Dealer hidden card'); row.append(back); }
        row.append(node('strong', `${hidden ? 'Showing' : 'Total'}: ${blackjackCount(cards)}`, 'casino-hand-value'));
        target?.append(row);
    }

    canAct() { return Boolean(this.view?.available && !this.view.processing && !this.pendingKey && !this.table.expired); }
    placeBet() {
        if (!this.canAct() || this.view.phase !== 'betting' || this.view.players?.some(p => p.playerId === this.playerID)) return;
        const bet = Number(this.stake.value);
        if (!Number.isInteger(bet) || bet < Number(this.stake.min) || bet > Number(this.stake.max) || bet % Number(this.stake.step) || bet > this.balance) {
            this.summary.textContent = `Choose ${this.stake.min}–${goldText(this.stake.max)} ${this.currency} in steps of ${this.stake.step}, within your available balance.`; return;
        }
        this.submit({ action: 'bet', roundId: this.view.roundId, bet });
    }

    choose(action) {
        const round = this.view?.round;
        if (!this.canAct() || this.view.phase !== 'playing' || round?.turnPlayerId !== this.playerID || !round.actions?.includes(action)) return;
        const payload = { action: 'play', roundId: this.view.roundId, roundRevision: round.revision, gameAction: action };
        if (action === 'split' || action === 'double') {
            const hand = round.players.find(player => player.playerId === this.playerID)?.hands[round.turnHand];
            if (!hand || hand.bet > this.balance) { this.summary.textContent = `Not enough ${this.currency} for that additional wager.`; return; }
        }
        this.submit(payload);
    }

    submit(payload) {
        this.pendingAction = payload;
        this.pendingKey = this.stateKey; this.bet.disabled = true; this.stake.disabled = true;
        this.adjustments.querySelectorAll('button').forEach(button => { button.disabled = true; });
        this.actions.querySelectorAll('button').forEach(button => { button.disabled = true; });
        this.send(payload);
    }

    rejectAction(error) {
        const p = this.pendingAction;
        if (!this.pendingKey || !p || error.action !== p.action || error.roundId !== p.roundId || error.roundRevision !== (p.roundRevision || 0)) return;
        this.pendingKey = null; this.pendingAction = null;
        this.update(this.view, this.playerID, this.presence); this.summary.textContent = error.error;
    }
    dispose() { this.update(null); this.root.remove(); }
}
