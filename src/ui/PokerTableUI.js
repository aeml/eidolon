const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const suits = ['♣', '♦', '♥', '♠'];
const element = (tag, text = '', className = '') => {
    const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
};

export class PokerTableUI {
    constructor(send) {
        this.send = send;
        this.root = element('div', '', 'poker-game'); this.root.hidden = true;
        this.summary = element('p'); this.summary.setAttribute('role', 'status');
        this.lobby = element('div', '', 'poker-buy-in');
        const stakeLabel = element('label', 'Gold buy-in for this hand ');
        this.stake = element('select'); this.stake.setAttribute('aria-label', 'Poker Gold buy-in');
        for (const amount of [100, 200, 300, 400, 500]) { const option = element('option', String(amount)); option.value = String(amount); this.stake.append(option); }
        stakeLabel.append(this.stake);
        this.buy = this.button('Buy in · 100 Gold', () => this.buyIn()); this.lobby.append(stakeLabel, this.buy);
        this.stake.onchange = () => { this.buy.textContent = `Buy in · ${this.stake.value} Gold`; };
        const adjustments = element('div', '', 'casino-bet-adjustments');
        for (const [label, factor] of [['½', .5], ['2×', 2]]) adjustments.append(this.button(label, () => {
            if (!this.canAct()) return;
            this.stake.value = String(Math.max(100, Math.min(500, Math.floor(Number(this.stake.value) * factor / 100) * 100)));
            this.stake.onchange();
        }));
        this.lobby.insertBefore(adjustments, this.buy); this.buy.className = 'casino-primary';
        this.felt = element('div', '', 'poker-felt');
        this.board = element('div', '', 'poker-board'); this.board.setAttribute('aria-label', 'Community cards');
        this.pots = element('div', '', 'poker-pots'); this.players = element('div', '', 'poker-players');
        this.felt.append(this.board, this.pots, this.players);
        this.actions = element('div', '', 'poker-actions');
        const rules = element('details'); rules.append(element('summary', 'Hold’em rules · Gold and leaving'));
        rules.append(element('p', 'Two to six real players; no house opponents or rake. Buy in immediately reserves the selected 100–500 Gold for one hand. Two funded, connected players start a 15-second joining window. Leaving before the deal returns your buy-in. Every new hand requires a new buy-in click. Raise and All-in act immediately using your reserved stack.'));
        rules.append(element('p', 'No-limit Texas Hold’em: two private cards, five community cards, best five-card hand wins. Small/big blinds are 5/10 Gold. The dealer button rotates between funded seats. Heads-up, the button posts the small blind and acts first before the flop, last afterward.'));
        rules.append(element('p', 'Raise to means your total bet on this street, not extra Gold from your bag. The minimum raise increases the current bet by at least the last full raise (initially 10). A smaller all-in is allowed; it only reopens earlier players’ raises when the combined increase reaches their required full raise. A short call remains eligible only for its covered pots.'));
        rules.append(element('p', 'Turns last 30 seconds. A timeout checks for free or folds to a bet. Leaving after the deal folds a remaining stack; an all-in hand stays eligible. Disconnections reserve the seat for 60 seconds, but the turn timer keeps running. No bots take over.'));
        rules.append(element('p', 'Main and side pots settle separately. Uncalled Gold returns to its owner. Ties split each pot; odd Gold goes clockwise from the seat left of the dealer. All unspent stack and winnings return to your Gold balance after the hand, even if you leave or disconnect. Folded cards remain private.'));
        this.root.append(this.summary, this.lobby, this.felt, this.actions, rules);
    }

    button(text, action) { const b = element('button', text); b.type = 'button'; b.onclick = action; return b; }
    card(value) {
        const hidden = !Number.isInteger(value) || value < 0 || value >= 52;
        const label = hidden ? 'Hidden card' : `${ranks[value % 13]}${suits[Math.floor(value / 13)]}`;
        const card = element('span', hidden ? '✦' : label, `blackjack-card${hidden ? ' back' : [1, 2].includes(Math.floor(value / 13)) ? ' red' : ''}`);
        card.setAttribute('aria-label', label); return card;
    }

    update(view, playerID) {
        this.view = view; this.playerID = playerID; this.root.hidden = !view;
        if (!view) { this.signature = null; this.pending = false; return; }
        const signature = JSON.stringify([view.roundId, view.phase, view.round?.revision, view.processing, view.available, view.gold, view.players, playerID]);
        const changed = signature !== this.signature; this.signature = signature;
        const actionKey = JSON.stringify([view.roundId, view.phase, view.round?.revision, view.players?.find(p => p.playerId === playerID), playerID]);
        if (actionKey !== this.actionKey) this.pending = false;
        this.actionKey = actionKey;
        if (!view.available) {
            this.summary.textContent = 'Poker is temporarily unavailable. Saved buy-ins and winnings remain pending, not discarded.';
            this.setDisabled(true); return;
        }
        const funded = view.players?.find(p => p.playerId === playerID);
        this.lobby.hidden = view.phase !== 'betting' || Boolean(funded);
        const round = view.round;
        this.felt.hidden = !round;
        const count = view.players?.length || 0;
        const waiting = count < 2 ? `Waiting for another real player · ${count}/2 minimum.` : 'Funded players are joining; waiting for the server to deal.';
        this.summary.textContent = view.processing ? 'Saving table Gold… please wait.' : view.phase === 'betting'
            ? `${view.gold} Gold available. ${waiting}${funded ? ` Your ${funded.buyIn} Gold buy-in is reserved.` : ''}`
            : view.phase === 'complete' ? `Hand complete · ${view.gold} Gold available. All cash-outs saved.`
                : view.phase === 'settling' ? 'Hand complete · saving each player’s unspent Gold and winnings…'
                    : `${round?.street || 'Dealing'} · ${view.gold} Gold in your bag. ${round?.turnPlayerId === playerID ? 'Your turn.' : `${this.name(round?.turnPlayerId)} to act.`}`;
        if (changed) {
            this.board.replaceChildren(); this.players.replaceChildren(); this.pots.replaceChildren(); this.actions.replaceChildren();
            if (round) {
                for (let i = 0; i < 5; i++) this.board.append(this.card(round.board?.[i]));
                for (const [index, pot] of (round.pots || []).entries()) {
                    this.pots.append(element('p', `${pot.uncalled ? 'Uncalled return' : index === 0 ? 'Main pot' : `Side pot ${index}`}: ${pot.amount} Gold${pot.winners?.length ? ` → ${pot.winners.map(id => this.name(id)).join(', ')}` : ''}`));
                }
                for (const p of round.players || []) {
                    const row = element('div', '', `poker-player${p.playerId === round.turnPlayerId ? ' current' : ''}${p.folded ? ' folded' : ''}`);
                    const status = p.folded ? 'Folded' : p.stack === 0 ? 'All-in' : `${p.stack} Gold stack`;
                    row.append(element('p', `${this.name(p.playerId)}${p.playerId === playerID ? ' · You' : ''}${p.seat === round.buttonSeat ? ' · Dealer' : ''} · ${status}`));
                    const cards = element('div'); for (const value of p.cards || []) cards.append(this.card(value)); row.append(cards);
                    row.append(element('small', round.phase === 'complete' ? `${p.hand ? `${p.hand} · ` : ''}${p.payout} Gold returned` : `${p.streetBet} on this street · ${p.committed} committed`));
                    this.players.append(row);
                }
                for (const action of round.actions || []) {
                    if (action === 'raise') {
                        const label = element('label', 'Raise to '); this.raise = element('input'); this.raise.type = 'number'; this.raise.step = '1';
                        this.raise.min = String(round.minimumRaiseTo); this.raise.max = String(round.maximumRaiseTo); this.raise.value = String(round.minimumRaiseTo);
                        this.raise.setAttribute('aria-label', 'Total Gold bet on this street'); label.append(this.raise); this.actions.append(label);
                    }
                    const stack = round.players?.find(p => p.playerId === playerID)?.stack;
                    const label = { fold: 'Fold', check: 'Check', call: `Call ${round.callAmount} Gold`, raise: 'Raise to selected Gold', all_in: `All-in · ${stack} Gold` }[action];
                    if (label) this.actions.append(this.button(label, () => this.choose(action)));
                }
                if (round.phase === 'playing') this.actions.append(element('small', `30-second turns · deadline ${new Date(round.deadline).toLocaleTimeString()}`));
            }
        }
        this.setDisabled(Boolean(view.processing || this.pending));
    }

    name(id) { return this.view?.players?.find(p => p.playerId === id)?.name || 'Player'; }
    setDisabled(disabled) {
        for (const control of this.root.querySelectorAll('button, input, select')) control.disabled = disabled;
    }
    canAct() { return Boolean(this.view?.available && !this.view.processing && !this.pending); }
    buyIn() {
        if (!this.canAct() || this.view.phase !== 'betting' || this.view.players?.some(p => p.playerId === this.playerID)) return;
        const bet = Number(this.stake.value);
        if (![100, 200, 300, 400, 500].includes(bet) || bet > this.view.gold) { this.summary.textContent = 'Choose a 100–500 Gold buy-in within your available balance.'; return; }
        this.submit({ action: 'poker_buy_in', roundId: this.view.roundId, bet });
    }
    choose(action) {
        const round = this.view?.round;
        if (!this.canAct() || round?.turnPlayerId !== this.playerID || !round.actions?.includes(action)) return;
        const payload = { action: 'poker_play', roundId: this.view.roundId, roundRevision: round.revision, gameAction: action };
        if (action === 'raise') {
            const bet = Number(this.raise?.value);
            if (!Number.isInteger(bet) || bet < round.minimumRaiseTo || bet > round.maximumRaiseTo) { this.summary.textContent = `Raise to ${round.minimumRaiseTo}–${round.maximumRaiseTo} Gold on this street.`; return; }
            payload.bet = bet;
        }
        this.submit(payload);
    }
    submit(payload) { this.pendingAction = payload; this.pending = true; this.setDisabled(true); this.send(payload); }
    rejectAction(error) {
        const p = this.pendingAction;
        if (!this.pending || !p || error.action !== p.action || error.roundId !== p.roundId || error.roundRevision !== (p.roundRevision || 0)) return;
        this.pending = false; this.pendingAction = null;
        this.update(this.view, this.playerID); this.summary.textContent = error.error;
    }
    dispose() { this.update(null); this.root.remove(); }
}
