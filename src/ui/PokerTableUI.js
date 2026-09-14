import { CasinoCelebration, goldText } from './CasinoCelebration.js';
import { CardTableScene } from './CardTableScene.js';

const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits = ['♣', '♦', '♥', '♠'];
const element = (tag, text = '', className = '') => {
    const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
};

export class PokerTableUI {
    constructor(send) {
        this.send = send; this.currency = 'Gold';
        this.root = element('div', '', 'poker-game'); this.root.hidden = true;
        this.summary = element('p'); this.summary.setAttribute('role', 'status');
        this.lobby = element('div', '', 'poker-buy-in');
        const stakeLabel = element('label', 'Gold buy-in for this hand '); this.stakeLabel = stakeLabel;
        this.stake = element('input'); this.stake.type = 'number'; this.stake.inputMode = 'numeric';
        this.stake.min = '100'; this.stake.max = '500'; this.stake.step = '100'; this.stake.value = '100'; this.stake.setAttribute('aria-label', 'Poker Gold buy-in');
        stakeLabel.append(this.stake);
        this.buy = this.button('Buy in · 100 Gold', () => this.buyIn()); this.lobby.append(stakeLabel, this.buy);
        this.stake.onchange = () => { this.buy.textContent = `Buy in · ${this.stake.value} ${this.currency}`; };
        this.stake.oninput = this.stake.onchange;
        const adjustments = element('div', '', 'casino-bet-adjustments');
        for (const [label, factor] of [['½', .5], ['2×', 2]]) adjustments.append(this.button(label, () => {
            if (!this.canAct()) return;
            this.stake.value = String(Math.max(Number(this.stake.min), Math.min(Number(this.stake.max), Math.floor(Number(this.stake.value) * factor / Number(this.stake.step)) * Number(this.stake.step))));
            this.stake.onchange();
        }));
        this.lobby.insertBefore(adjustments, this.buy); this.buy.className = 'casino-primary';
        this.table = new CardTableScene('poker'); this.felt = this.table.root; this.felt.classList.add('poker-felt');
        this.table.onExpire = () => this.setDisabled(true);
        this.board = element('div', '', 'poker-board'); this.board.setAttribute('aria-label', 'Community cards');
        this.pots = element('div', '', 'poker-pots'); this.players = this.table.root;
        this.table.center.append(this.board, this.pots);
        this.actions = element('div', '', 'poker-actions');
        const rules = element('details'); rules.append(element('summary', 'Hold’em rules · stakes and leaving'));
        this.stakeRules = element('p'); rules.append(this.stakeRules);
        rules.append(element('p', 'No-limit Texas Hold’em: two private cards, five community cards, best five-card hand wins. The dealer button rotates between funded seats. Heads-up, the button posts the small blind and acts first before the flop, last afterward.'));
        rules.append(element('p', 'Raise to means your total bet on this street, not extra funds from your wallet. The minimum raise increases the current bet by at least the last full raise. A smaller all-in is allowed; it only reopens earlier players’ raises when the combined increase reaches their required full raise. A short call remains eligible only for its covered pots.'));
        rules.append(element('p', 'Turns last 30 seconds. A timeout checks for free or folds to a bet. Leaving after the deal folds a remaining stack; an all-in hand stays eligible. Disconnections reserve the seat for 60 seconds, but the turn timer keeps running. No bots take over.'));
        rules.append(element('p', 'Main and side pots settle separately. Uncalled stakes return to their owner. Ties split each pot; odd units go clockwise from the seat left of the dealer. All unspent stack and winnings return to your table-currency balance after the hand, even if you leave or disconnect. Folded cards remain private.'));
        this.root.append(this.summary, this.felt, this.lobby, this.actions, rules);
    }

    button(text, action) { const b = element('button', text); b.type = 'button'; b.onclick = action; return b; }
    card(value) {
        const hidden = !Number.isInteger(value) || value < 0 || value >= 52;
        const label = hidden ? 'Hidden card' : `${ranks[value % 13]}${suits[Math.floor(value / 13)]}`;
        const card = element('span', hidden ? '✦' : label, `blackjack-card${hidden ? ' back' : [1, 2].includes(Math.floor(value / 13)) ? ' red' : ''}`);
        card.setAttribute('aria-label', label); return card;
    }

    update(view, playerID, presence = {}) {
        this.view = view; this.playerID = playerID; this.root.hidden = !view;
        if (!view) { this.signature = null; this.controlsKey = null; this.pending = false; this.table.clear(); this.celebration?.clear(); return; }
        this.presence = presence; this.table.update(view, playerID, presence);
        if (!this.celebration) this.celebration = new CasinoCelebration(this.table.center);
        const changedCurrency = this.currency !== (view.currency === 'ep' ? 'EP' : 'Gold');
        this.currency = view.currency === 'ep' ? 'EP' : 'Gold'; this.balance = view.balance ?? view.gold;
        this.stake.min = String(view.minBuyIn || 100); this.stake.step = String(view.buyInStep || 100);
        this.stake.max = String(view.maxBuyIn || 500);
        if (changedCurrency) this.stake.value = this.stake.min;
        this.stakeLabel.firstChild.nodeValue = `${this.currency} buy-in for this hand `;
        this.stake.setAttribute('aria-label', `Poker ${this.currency} buy-in`); this.stake.onchange();
        this.stakeRules.textContent = `Two to six real players; no house opponents or rake. Blinds: ${view.smallBlind || 5}/${view.bigBlind || 10} ${this.currency}. Buy in reserves ${this.stake.min}–${goldText(this.stake.max)} ${this.currency} in steps of ${this.stake.step} for one hand. Betting windows run for 30 seconds and reopen automatically after saved results. At least two connected, funded players are needed to deal; otherwise the window repeats and reserved buy-ins stay available. Leaving before the deal refunds your buy-in. Each new hand requires a buy-in click; raises and all-ins use your reserved stack.`;
        if (this.celebrationRound !== view.roundId) this.celebration.clear();
        const signature = JSON.stringify([view.roundId, view.phase, view.round?.revision, view.available, view.players, playerID, presence]);
        const changed = signature !== this.signature; this.signature = signature;
        const controlsKey = JSON.stringify([view.roundId, view.phase, view.available, view.round?.revision, view.round?.actions, playerID]);
        const controlsChanged = controlsKey !== this.controlsKey; this.controlsKey = controlsKey;
        const actionKey = JSON.stringify([view.roundId, view.phase, view.round?.revision, view.players?.find(p => p.playerId === playerID), playerID]);
        if (actionKey !== this.actionKey) this.pending = false;
        this.actionKey = actionKey;
        if (!view.available) {
            this.summary.textContent = 'Poker is temporarily unavailable. Saved buy-ins and winnings remain pending, not discarded.';
            this.setDisabled(true); return;
        }
        const funded = view.players?.find(p => p.playerId === playerID);
        this.lobby.hidden = view.phase !== 'betting';
        const round = view.round;
        this.felt.hidden = false;
        const count = view.players?.length || 0;
        const waiting = count < 2 ? `Waiting for another real player · ${count}/2 minimum.` : 'Funded players are joining; waiting for the server to deal.';
        this.summary.textContent = view.processing ? `Saving table ${this.currency}… please wait.` : view.phase === 'betting'
            ? `${this.balance} ${this.currency} available. ${waiting}${funded ? ` Your ${funded.buyIn} ${this.currency} buy-in is reserved.` : ''}`
            : view.phase === 'complete' ? `Hand complete · ${this.balance} ${this.currency} available. All cash-outs saved.`
                : view.phase === 'settling' ? 'Hand complete · saving each player’s unspent stake and winnings…'
                    : `${round?.street || 'Dealing'} · ${this.balance} ${this.currency} in your bag. ${round?.turnPlayerId === playerID ? 'Your turn.' : `${this.name(round?.turnPlayerId)} to act.`}`;
        if (changed) {
            this.board.replaceChildren(); this.pots.replaceChildren();
            if (controlsChanged) this.actions.replaceChildren();
            for (const seat of this.table.seats) seat.hands.replaceChildren();
            for (let i = 0; i < 5; i++) {
                if (round) this.board.append(this.card(round.board?.[i]));
                else this.board.append(element('span', '◇', 'card-table-board-placeholder'));
            }
            if (round) {
                for (const [index, pot] of (round.pots || []).entries()) {
                    this.pots.append(element('p', `${pot.uncalled ? 'Uncalled return' : index === 0 ? 'Main pot' : `Side pot ${index}`}: ${pot.amount} ${this.currency}${pot.winners?.length ? ` → ${pot.winners.map(id => this.name(id)).join(', ')}` : ''}`));
                }
                for (const p of round.players || []) {
                    const row = element('div', '', `poker-player${p.playerId === round.turnPlayerId ? ' current' : ''}${p.folded ? ' folded' : ''}`);
                    const cards = element('div'); for (const value of p.cards || []) cards.append(this.card(value)); row.append(cards);
                    if (p.bestHand || p.hand) row.append(element('strong', p.bestHand || p.hand, 'casino-hand-value'));
                    row.append(element('small', round.phase === 'complete' ? `${p.payout} ${this.currency} returned` : `${p.streetBet} bet · ${p.committed} total`));
                    this.table.seats[p.seat]?.hands.append(row);
                }
                for (const action of controlsChanged ? round.actions || [] : []) {
                    if (action === 'raise') {
                        const label = element('label', 'Raise to '); this.raise = element('input'); this.raise.type = 'number'; this.raise.step = '1';
                        this.raise.min = String(round.minimumRaiseTo); this.raise.max = String(round.maximumRaiseTo); this.raise.value = String(round.minimumRaiseTo);
                        this.raise.setAttribute('aria-label', `Total ${this.currency} bet on this street`); label.append(this.raise); this.actions.append(label);
                    }
                    const stack = round.players?.find(p => p.playerId === playerID)?.stack;
                    const label = { fold: 'Fold', check: 'Check', call: `Call ${round.callAmount} ${this.currency}`, raise: `Raise to selected ${this.currency}`, all_in: `All-in · ${stack} ${this.currency}` }[action];
                    if (label) this.actions.append(this.button(label, () => this.choose(action)));
                }
            }
        }
        this.setDisabled(Boolean(view.processing || this.pending || this.table.expired));
        if (view.available && !view.processing && view.phase === 'complete' && this.celebrationRound !== view.roundId) {
            this.celebrationRound = view.roundId;
            const own = round?.players.find(p => p.playerId === playerID);
            const won = round?.pots.some(p => !p.uncalled && p.winners?.includes(playerID));
            if (own && won) {
                const net = own.payout - (funded?.buyIn || 0);
                this.celebration.show('YOU WON', `${goldText(own.payout)} ${this.currency} returned`,
                    `${round.showdown === false ? 'Everyone else folded' : own.bestHand || own.hand || 'Winning hand'}. Net ${net >= 0 ? '+' : '−'}${goldText(Math.abs(net))} ${this.currency} after your buy-in.`, null, 5000);
            }
        }
    }

    name(id) { return this.presence?.occupants?.find(p => p.playerId === id)?.name || this.view?.players?.find(p => p.playerId === id)?.name || 'Player'; }
    setDisabled(disabled) {
        for (const control of this.root.querySelectorAll('button, input, select')) control.disabled = disabled;
        for (const control of this.lobby.querySelectorAll('button, input')) control.disabled = disabled || this.view?.phase !== 'betting' || Boolean(this.view?.players?.some(p => p.playerId === this.playerID));
    }
    canAct() { return Boolean(this.view?.available && !this.view.processing && !this.pending && !this.table.expired); }
    buyIn() {
        if (!this.canAct() || this.view.phase !== 'betting' || this.view.players?.some(p => p.playerId === this.playerID)) return;
        const bet = Number(this.stake.value);
        if (!Number.isInteger(bet) || bet < Number(this.stake.min) || bet > Number(this.stake.max) || bet % Number(this.stake.step) || bet > this.balance) { this.summary.textContent = `Choose a ${this.stake.min}–${goldText(this.stake.max)} ${this.currency} buy-in in steps of ${this.stake.step} within your available balance.`; return; }
        this.submit({ action: 'poker_buy_in', roundId: this.view.roundId, bet });
    }
    choose(action) {
        const round = this.view?.round;
        if (!this.canAct() || round?.turnPlayerId !== this.playerID || !round.actions?.includes(action)) return;
        const payload = { action: 'poker_play', roundId: this.view.roundId, roundRevision: round.revision, gameAction: action };
        if (action === 'raise') {
            const bet = Number(this.raise?.value);
            if (!Number.isInteger(bet) || bet < round.minimumRaiseTo || bet > round.maximumRaiseTo) { this.summary.textContent = `Raise to ${round.minimumRaiseTo}–${round.maximumRaiseTo} ${this.currency} on this street.`; return; }
            payload.bet = bet;
        }
        this.submit(payload);
    }
    submit(payload) { this.pendingAction = payload; this.pending = true; this.setDisabled(true); this.send(payload); }
    rejectAction(error) {
        const p = this.pendingAction;
        if (!this.pending || !p || error.action !== p.action || error.roundId !== p.roundId || error.roundRevision !== (p.roundRevision || 0)) return;
        this.pending = false; this.pendingAction = null;
        this.update(this.view, this.playerID, this.presence); this.summary.textContent = error.error;
    }
    dispose() { this.update(null); this.root.remove(); }
}
