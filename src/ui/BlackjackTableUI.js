import { CasinoCelebration, blackjackCount, goldText } from './CasinoCelebration.js';

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
        this.send = send;
        this.root = node('div', '', 'blackjack-game'); this.root.hidden = true;
        this.summary = node('p'); this.summary.setAttribute('role', 'status');
        this.rules = node('details'); this.rules.append(node('summary', 'Rules & Gold stakes'));
        this.rules.append(node('p', 'Six decks. Dealer stands on soft 17 and checks for blackjack. Blackjack pays 3:2 profit; other wins pay 1:1; pushes return your stake. Split 21 pays as an ordinary win.'));
        this.stakeRules = node('p'); this.rules.append(this.stakeRules);
        this.rules.append(node('p', 'You have 30 seconds per decision. Timeouts stand. Confirmed wagers continue if you leave or disconnect, and payouts are saved automatically. The dealer starts 15 seconds after the first confirmed wager.'));
        this.rules.append(node('p', 'Rule-based estimate: about 0.41% house edge per opening wager with correct basic strategy and a fresh shoe. Choices and timeouts can increase Gold losses; individual rounds vary. All splits and doubles can commit up to eight times your opening stake.'));
        this.betBox = node('div', '', 'blackjack-bet');
        const label = node('label', 'Wager (Gold) ');
        this.stake = node('input'); this.stake.type = 'number'; this.stake.min = '20'; this.stake.max = '500'; this.stake.step = '20'; this.stake.value = '100';
        label.append(this.stake);
        this.bet = this.button('Bet · 100 Gold', () => this.placeBet()); this.betBox.append(label, this.bet);
        this.stake.oninput = () => { this.bet.textContent = `Bet · ${this.stake.value || '…'} Gold`; };
        this.adjustments = node('div', '', 'casino-bet-adjustments');
        for (const [label, factor] of [['½', .5], ['2×', 2]]) this.adjustments.append(this.button(label, () => {
            if (this.stake.disabled) return;
            this.stake.value = String(Math.max(20, Math.min(this.view?.maxBet || 500, Math.floor(Number(this.stake.value) * factor / 20) * 20 || 20)));
            this.stake.oninput();
        }));
        this.betBox.insertBefore(this.adjustments, this.bet); this.bet.className = 'casino-primary';
        this.cards = node('div', '', 'blackjack-hands'); this.cards.setAttribute('aria-label', 'Cards at the table');
        this.actions = node('div', '', 'blackjack-actions');
        this.root.append(this.summary, this.rules, this.betBox, this.cards, this.actions);
        this.celebration = new CasinoCelebration(this.root);
    }

    button(text, handler) { const button = node('button', text); button.type = 'button'; button.onclick = handler; return button; }

    update(view, playerID) {
        this.view = view; this.playerID = playerID; this.root.hidden = !view;
        if (!view) { this.pendingKey = null; this.celebration.clear(); return; }
        this.stake.max = String(view.maxBet || 500);
        this.stakeRules.textContent = `Bet 20–${goldText(this.stake.max)} Gold in steps of 20. Double on two cards, including after splitting. Split equal-value pairs into at most four hands; split aces receive one card each. No insurance or surrender.`;
        if (this.celebrationRound !== view.roundId) this.celebration.clear();
        const own = view.players?.find(player => player.playerId === playerID);
        this.stateKey = JSON.stringify([view.roundId, view.phase, view.round?.revision, own, playerID]);
        if (this.pendingKey !== this.stateKey) this.pendingKey = null;
        this.summary.textContent = !view.available ? 'Blackjack is temporarily unavailable; saved wagers are retained.' :
            view.processing ? `Saving table funds… · ${view.gold} Gold available` :
            `${view.gold} Gold available · ${view.phase === 'betting' ? own ? 'Your wager is confirmed.' : 'Betting is open.' :
                view.phase === 'settling' ? 'Saving payouts…' : view.phase === 'complete' ? 'Payouts saved. Next round shortly.' : 'Round in progress.'}`;
        if (view.phase === 'betting' && view.dealAt && Date.parse(view.dealAt) > 0) this.summary.textContent += ` Dealing in ${Math.max(0, Math.ceil((Date.parse(view.dealAt) - Date.now()) / 1000))}s.`;
        this.betBox.hidden = !view.available || view.phase !== 'betting' || Boolean(own);
        this.bet.disabled = !this.canAct(); this.stake.disabled = !this.canAct();
        this.adjustments.querySelectorAll('button').forEach(button => { button.disabled = this.stake.disabled; });
        this.cards.replaceChildren(); this.actions.replaceChildren();
        if (view.round) {
            const round = view.round;
            this.hand('House dealer', round.dealer, round.dealerHidden);
            for (const player of round.players || []) {
                const participant = view.players.find(p => p.playerId === player.playerId);
                for (const [index, hand] of player.hands.entries()) {
                    const active = view.phase === 'playing' && round.turnPlayerId === player.playerId && round.turnHand === index;
                    const name = player.playerId === playerID ? 'You' : participant?.name || `Seat ${player.seat + 1}`;
                    const result = hand.outcome ? ` · ${hand.outcome} · ${hand.payout} Gold returned` : '';
                    this.hand(`${active ? '▶ ' : ''}${name} · hand ${index + 1} · ${hand.bet} Gold${result}`, hand.cards, false, active);
                }
            }
            if (view.phase === 'playing' && round.turnPlayerId === playerID) {
                this.actions.append(node('p', `Your turn · ${Math.max(0, Math.ceil((Date.parse(round.deadline) - Date.now()) / 1000))}s`));
                for (const action of round.actions || []) {
                    const cost = ['double', 'split'].includes(action) ? ` · +${round.players.find(p => p.playerId === playerID)?.hands[round.turnHand]?.bet} Gold` : '';
                    const button = this.button(action[0].toUpperCase() + action.slice(1) + cost, () => this.choose(action));
                    button.disabled = !this.canAct(); this.actions.append(button);
                }
            }
            if (view.available && !view.processing && view.phase === 'complete' && this.celebrationRound !== view.roundId) {
                this.celebrationRound = view.roundId;
                const hands = round.players.find(p => p.playerId === playerID)?.hands || [];
                const returned = hands.reduce((sum, h) => sum + h.payout, 0), staked = hands.reduce((sum, h) => sum + h.bet, 0);
                if (returned > staked) this.celebration.show('YOU WON', `+${goldText(returned - staked)} Gold`,
                    `${hands.map(h => h.outcome === 'blackjack' ? 'Blackjack' : `${blackjackCount(h.cards)} (${h.outcome})`).join(' · ')}. ${goldText(returned)} returned, ${goldText(staked)} staked.`, null, 5000);
            }
        } else {
            for (const player of view.players || []) this.cards.append(node('p', `${player.name || 'Player'} · ${player.bet} Gold confirmed`));
        }
    }

    hand(title, cards, hidden, active = false) {
        const row = node('div', '', `blackjack-hand${active ? ' current' : ''}`); row.append(node('p', title));
        for (const card of cards || []) {
            const suit = Math.floor(card / 13);
            row.append(node('span', `${labels[card % 13]}${suits[suit]}`, `blackjack-card${suit === 1 || suit === 2 ? ' red' : ''}`));
        }
        if (hidden) { const back = node('span', '✦', 'blackjack-card back'); back.setAttribute('aria-label', 'Dealer hidden card'); row.append(back); }
        row.append(node('strong', `${hidden ? 'Showing' : 'Total'}: ${blackjackCount(cards)}`, 'casino-hand-value'));
        this.cards.append(row);
    }

    canAct() { return Boolean(this.view?.available && !this.view.processing && !this.pendingKey); }
    placeBet() {
        if (!this.canAct() || this.view.phase !== 'betting' || this.view.players?.some(p => p.playerId === this.playerID)) return;
        const bet = Number(this.stake.value);
        if (!Number.isInteger(bet) || bet < 20 || bet > (this.view.maxBet || 500) || bet % 20 || bet > this.view.gold) {
            this.summary.textContent = `Choose 20–${goldText(this.view.maxBet || 500)} Gold in steps of 20, within your available balance.`; return;
        }
        this.submit({ action: 'bet', roundId: this.view.roundId, bet });
    }

    choose(action) {
        const round = this.view?.round;
        if (!this.canAct() || this.view.phase !== 'playing' || round?.turnPlayerId !== this.playerID || !round.actions?.includes(action)) return;
        const payload = { action: 'play', roundId: this.view.roundId, roundRevision: round.revision, gameAction: action };
        if (action === 'split' || action === 'double') {
            const hand = round.players.find(player => player.playerId === this.playerID)?.hands[round.turnHand];
            if (!hand || hand.bet > this.view.gold) { this.summary.textContent = 'Not enough Gold for that additional wager.'; return; }
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
        this.update(this.view, this.playerID); this.summary.textContent = error.error;
    }
    dispose() { this.update(null); this.root.remove(); }
}
