import { CasinoInfoDialog } from './CasinoInfoDialog.js';
import { CardTableScene } from './CardTableScene.js';
import { CasinoTableOrdering } from './CasinoTableOrdering.js';
import { CasinoCelebration, goldText } from './CasinoCelebration.js';
import { RoulettePresentation } from './RoulettePresentation.js';
import { BaccaratPresentation } from './BaccaratPresentation.js';
import { HouseHistory } from './HouseHistory.js';

const node = (tag, text = '', className = '') => {
    const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};
const sum = wagers => (wagers || []).reduce((total, wager) => total + wager.amount, 0);
const red = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const outsideLabels = { 'dozen-1':'1st 12', 'dozen-2':'2nd 12', 'dozen-3':'3rd 12',
    low:'1–18', even:'Even', red:'Red', black:'Black', odd:'Odd', high:'19–36',
    'column-1':'Column 1', 'column-2':'Column 2', 'column-3':'Column 3' };

export class HouseTableUI {
    constructor(send, sound = () => {}) {
        this.sound = sound;
        this.ordering = new CasinoTableOrdering();
        this.send = send; this.currency = 'Gold'; this.draft = new Map();
        this.root = node('div', '', 'house-game'); this.root.hidden = true;
        this.table = new CardTableScene('roulette');
        this.display = node('div', '', 'house-result'); this.table.center.append(this.display);
        this.stage = node('div', '', 'house-table-stage');
        this.stage.append(this.table.center, this.table.clock); this.table.root.append(this.stage);
        this.phase = node('p', '', 'casino-round-phase'); this.phase.setAttribute('role', 'status');
        this.summary = node('p'); this.summary.setAttribute('role', 'status');
        this.stakeLabel = node('label', 'Wager (Gold) ');
        this.stake = node('input'); this.stake.type = 'number'; this.stake.inputMode = 'numeric'; this.stake.value = '20'; this.stakeLabel.append(this.stake);
        this.adjustments = node('div', '', 'casino-bet-adjustments');
        for (const [label, factor] of [['½', .5], ['2×', 2]]) this.adjustments.append(this.button(label, () => {
            const step = Number(this.stake.step), minimum = Number(this.stake.min);
            this.stake.value = String(Math.max(minimum, Math.min(Number(this.stake.max), Math.floor(Number(this.stake.value) * factor / step) * step)));
            this.refreshControls();
        }));
        this.chips = node('div', '', 'casino-chip-rack'); this.chips.setAttribute('aria-label', 'Choose chip value');
        const builderLabel = node('label', 'Build multiple bets ');
        this.builder = node('input'); this.builder.type = 'checkbox'; builderLabel.prepend(this.builder);
        this.builder.onchange = () => { this.draft.clear(); this.draftSteps = []; this.refreshControls(); };
        this.board = node('div', '', 'house-betting-board');
        this.slip = node('p', '', 'house-bet-slip');
        this.confirm = this.button('Place bets', () => this.placeWagers(this.draftWagers())); this.confirm.className = 'casino-primary';
        this.clear = this.button('Clear slip', () => { this.draft.clear(); this.draftSteps = []; this.refreshControls(); });
        this.undo = this.button('Undo chip', () => {
            if (!this.canBet()) return;
            const step = this.draftSteps?.pop();
            if (step) { const amount = this.draft.get(step.spot) - step.amount; if (amount) this.draft.set(step.spot, amount); else this.draft.delete(step.spot); }
            this.refreshControls();
        });
        this.repeat = this.button('Reuse last slip', () => {
            if (!this.canBet() || !this.lastSlip?.wagers.length) return;
            this.builder.checked = true; this.draft = new Map(this.lastSlip.wagers.map(w => [w.spot, w.amount]));
            this.draftSteps = this.lastSlip.wagers.map(w => ({ ...w })); this.refreshControls();
        });
        this.rulesDialog = new CasinoInfoDialog('Roulette rules'); this.rules = this.rulesDialog.button;
        this.rulesText = node('p'); this.rulesDialog.body.append(this.rulesText);
        this.controls = node('div', '', 'card-table-controls');
        this.celebration = new CasinoCelebration(this.controls);
        this.controls.append(this.table.dealer);
        const toolbar = node('div', '', 'house-wager-toolbar'); toolbar.append(this.stakeLabel, this.adjustments, builderLabel);
        this.controls.append(this.phase, this.summary, toolbar, this.chips, this.board, this.slip, this.confirm, this.undo, this.clear, this.repeat, this.rules);
        this.history = new HouseHistory(this.controls);
        this.root.append(this.table.root, this.controls);
        this.table.onExpire = () => this.refreshControls();
    }

    button(text, action) { const b = node('button', text); b.type = 'button'; b.onclick = action; return b; }
    draftWagers() { return [...this.draft].map(([spot, amount]) => ({ spot, amount })); }
    canBet() { return this.view?.available && !this.view.processing && this.view.phase === 'betting' && !this.pending && !this.own && !this.table.expired; }

    update(view, playerID, presence = {}) {
        if (this.disposed) return;
        if (!this.ordering.accept(view, playerID, presence.yourSeat)) view = this.view;
        const previous = this.view;
        this.view = view; this.playerID = playerID; this.root.hidden = !view;
        if (!view) {
            this.rulesDialog.close(false); this.combinationDialog?.close(false);
            this.pending = false; this.roundId = null; this.boardKey = null; this.boardEpoch = null;
            this.draft.clear(); this.draftSteps = []; this.history.clear(); this.presentation?.dispose(); this.presentation = null; this.presentationKind = null; this.table.clear(); this.celebration.clear(); return;
        }
        this.presence = presence;
        const slipScope = JSON.stringify([view.tableId, view.game, view.currency, playerID, presence.yourSeat?.sessionId]);
        if (this.slipScope !== slipScope) { this.lastSlip = null; this.slipScope = slipScope; }
        const currency = view.currency === 'ep' ? 'EP' : 'Gold';
        const changedGame = this.kind !== view.game || this.currency !== currency;
        if (changedGame) { this.rulesDialog.close(false); this.combinationDialog?.close(false); }
        this.rulesDialog.setTitle(`${view.game === 'roulette' ? 'Roulette' : 'Baccarat'} rules`);
        if (changedGame || this.roundId !== view.roundId) {
            this.pending = false; this.draft.clear(); this.draftSteps = []; this.celebration.clear(); this.resultKey = null;
        }
        this.kind = view.game; this.currency = currency; this.roundId = view.roundId;
        this.stake.min = String(view.minBet); this.stake.max = String(view.maxBet); this.stake.step = String(view.betStep);
        if (changedGame || !Number.isFinite(Number(this.stake.value))) this.stake.value = this.stake.min;
        this.stakeLabel.firstChild.nodeValue = `Wager (${currency}) `;
        this.own = view.players?.find(p => p.playerId === playerID);
        if (Array.isArray(this.own?.wagers)) { this.lastSlip = { wagers: this.own.wagers.map(w => ({ ...w })) }; this.draft.clear(); this.draftSteps = []; }
        if (this.own || view.phase !== 'betting') this.pending = false;
        this.table.root.setAttribute('aria-label', `${this.kind === 'roulette' ? 'Roulette' : 'Baccarat'} table and seats`);
        this.table.update(view, playerID, presence);
        const boardKey = JSON.stringify([view.game, currency, view.spots]);
        const replacedDraft = Boolean(this.boardKey && this.boardKey !== boardKey && this.draft.size);
        if (this.boardKey !== boardKey) { this.draft.clear(); this.buildBoard(view); this.boardKey = boardKey; }
        this.summary.textContent = !view.available ? 'Table unavailable. Confirmed wagers remain saved.' :
            `${goldText(view.balance)} ${currency} available · ${view.processing || this.pending ? view.phase === 'betting' ? 'Saving wager…' : 'Saving payouts…' : this.own && view.phase === 'betting' ? 'Wager confirmed.' :
                view.phase === 'betting' ? 'Click a betting spot to place your wager.' : view.phase === 'revealing' ? 'Bets closed. Watch the table!' :
                    view.phase === 'settling' ? 'Saving payouts…' : 'Payouts saved. Next round starts automatically.'}`;
        if (replacedDraft) this.summary.textContent += ' Unconfirmed slip cleared: betting options changed.';
        if (this.own && !Array.isArray(this.own.wagers)) this.summary.textContent = 'Wager details unavailable. Refresh the table before placing another bet.';
        this.rulesText.textContent = (this.kind === 'roulette' ? 'Single zero. Straight pays 35:1 profit; split 17:1; street/trio 11:1; corner/first four 8:1; six-line 5:1; dozen/column 2:1; other outside bets 1:1. Zero loses outside bets.' :
            'Eight decks reshuffled each round. Player pays 1:1; Banker pays 1:1 less 5% commission; Tie pays 8:1. Ties return Player/Banker stakes. Natural 8/9 stops the deal; other draws are automatic.') +
            ` Total bets: ${view.minBet}–${goldText(view.maxBet)} ${currency}, in steps of ${view.betStep}. Confirmed slips cannot change until next round. Leaving or disconnecting does not cancel a confirmed bet.`;
        this.phase.textContent = { betting: 'Bets open', revealing: this.kind === 'roulette' ? 'Ball in play' : 'Cards on the table', settling: 'Round result · saving payouts', complete: 'Round complete' }[view.phase] || 'Synchronizing table';
        this.phase.dataset.phase = view.phase;
        this.root.dataset.game = this.kind;
        this.history.update(view);
        this.buildChips(view);
        this.renderResult(view);
        const continuing = previous?.roundId === view.roundId && previous?.tableId === view.tableId && previous?.currency === view.currency && previous?.game === view.game;
        if (view.game === 'roulette' && view.phase === 'revealing' && (!continuing || previous.phase !== 'revealing')) {
            this.table.root.scrollTop = 0;
        }
        if (continuing && view.available && view.phase === 'revealing') {
            if (previous.phase === 'betting') this.sound(view.game === 'roulette' ? 'spin' : 'stop');
            const count = (view.dealt?.player.length || 0) + (view.dealt?.banker.length || 0);
            const before = (previous.dealt?.player.length || 0) + (previous.dealt?.banker.length || 0);
            if (count > before) this.sound('stop');
        }
        for (const seat of this.table.seats) {
            seat.hands.replaceChildren();
            const member = view.players?.find(p => p.seat === Number(seat.root.dataset.seat));
            const occupant = presence.occupants?.find(p => p.seat === Number(seat.root.dataset.seat));
            const earlier = presence.occupants && occupant?.playerId !== member?.playerId;
            const owner = earlier && member ? `${member.playerId === playerID ? 'Your' : `${member.name || 'Player'}’s`} earlier wager · ` : '';
            if (member) seat.hands.append(node('small', Array.isArray(member.wagers) ?
                `${owner}${goldText(sum(member.wagers))} ${currency} staked${member.paid ? ` · ${goldText(member.payout)} returned` : ''}` : 'Wager details unavailable'));
        }
        this.celebrateSavedWin();
        this.refreshControls();
    }

    celebrateSavedWin() {
        const view = this.view;
        if (this.disposed || !view?.available || view.processing || view.phase !== 'complete' || !this.own?.paid ||
            !Array.isArray(this.own.wagers) || this.celebrated === view.roundId ||
            view.game === 'roulette' && this.presentation?.landing) return;
        this.celebrated = view.roundId;
        const profit = this.own.payout - sum(this.own.wagers);
        if (profit > 0) {
            this.sound('win'); this.celebration.show('YOU WON', `+${goldText(profit)} ${this.currency}`,
                `${this.kind === 'roulette' ? `Number ${view.number}` : `${view.baccarat?.winner} wins`}. ${goldText(this.own.payout)} returned.`, null, 5000);
            this.controls.scrollTop = 0;
        }
    }

    buildBoard(view) {
        this.combinationDialog?.dispose(); this.combinationDialog = null;
        this.board.replaceChildren(); this.spotButtons = [];
        const epoch = Symbol('house-board'); this.boardEpoch = epoch;
        this.combination = null; this.combinationBet = null; this.combinationHint = null;
        const choose = spot => { if (this.boardEpoch === epoch) this.choose(spot); };
        const add = (parent, id, label, color = '') => {
            const b = this.button(label, () => choose(id)); b.dataset.spot = id; b.className = color;
            if (id.startsWith('number:') && Number(id.slice(7)) > 0) { const n = Number(id.slice(7)); b.style.setProperty('--roulette-column', String(Math.floor((n - 1) / 3) + 2)); b.style.setProperty('--roulette-row', String(3 - (n - 1) % 3)); }
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
            const order = Object.keys(outsideLabels);
            const spots = (view.spots || []).filter(spot => !spot.id.includes(':'));
            spots.sort((a,b) => (order.includes(a.id) ? order.indexOf(a.id) : order.length) - (order.includes(b.id) ? order.indexOf(b.id) : order.length));
            for (const spot of spots) {
                const style = ['red','black'].includes(spot.id) ? spot.id : spot.id.startsWith('dozen-') || spot.id.startsWith('column-') ? 'wide-bet' : '';
                add(outside, spot.id, outsideLabels[spot.id] || spot.label, style);
            }
            this.combinationDialog = new CasinoInfoDialog('Roulette inside bets', 'Inside bets');
            const advanced = this.combinationDialog.body;
            this.combination = node('select'); this.combination.setAttribute('aria-label', 'Inside roulette combination');
            for (const spot of view.spots || []) if (spot.id.includes(':') && !spot.id.startsWith('number:')) {
                const option = node('option', `${spot.label} · ${spot.multiplier - 1}:1`); option.value = spot.id; this.combination.append(option);
            }
            const combination = this.combination; this.combinationHint = node('p'); this.combinationHint.setAttribute('role', 'status');
            const dialog = this.combinationDialog;
            this.combinationBet = this.button('Bet combination', () => { if (this.boardEpoch !== epoch) return; choose(combination.value); dialog.close(); });
            advanced.append(node('p', 'Choose a split, street, corner or six-line bet. Uses the chip value shown on the table.'), this.combinationHint, this.combination, this.combinationBet); this.board.append(numbers, outside, this.combinationDialog.button);
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
        this.draft.set(spot, (this.draft.get(spot) || 0) + amount);
        (this.draftSteps ||= []).push({ spot, amount }); this.refreshControls();
    }

    placeWagers(wagers) {
        if (!this.canBet() || !wagers.length) return;
        const total = sum(wagers);
        if (total > this.view.balance || total > this.view.maxBet) { this.summary.textContent = `Not enough ${this.currency} or total wager is over the table limit.`; return; }
        this.pending = true; this.refreshControls(); this.summary.textContent = 'Saving wager…';
        if (this.send({ action: 'house_bet', roundId: this.view.roundId, wagers }) === false && this.pending) {
            this.pending = false; this.summary.textContent = 'Connection lost. No new wager is confirmed.'; this.refreshControls();
        }
    }

    refreshControls() {
        const allowed = this.canBet();
        this.spotButtons?.forEach(b => {
            b.disabled = !allowed;
            const amount = this.draft.get(b.dataset.spot) || this.own?.wagers?.find?.(w => w.spot === b.dataset.spot)?.amount || 0;
            b.dataset.amount = amount ? goldText(amount) : '';
            b.setAttribute('aria-pressed', String(Boolean(amount)));
            b.classList.toggle('selected', this.draft.has(b.dataset.spot) || Boolean(Array.isArray(this.own?.wagers) && this.own.wagers.some(w => w.spot === b.dataset.spot)));
        });
        if (this.combinationBet) this.combinationBet.disabled = !allowed;
        if (this.combinationHint) this.combinationHint.textContent = `${goldText(Number(this.stake.value) || 0)} ${this.currency} per chip · ${this.builder.checked ? 'Adds to your draft; Place bets confirms the total.' : 'Bet combination places this wager immediately.'}`;
        this.confirm.hidden = this.clear.hidden = this.undo.hidden = !this.builder.checked;
        this.undo.disabled = !allowed || !this.draftSteps?.length;
        this.repeat.hidden = !this.lastSlip; this.repeat.disabled = !allowed;
        this.chips.querySelectorAll('button').forEach(b => { b.disabled = !allowed; b.setAttribute('aria-pressed', String(b.dataset.value === this.stake.value)); });
        this.adjustments.querySelectorAll('button').forEach(b => { b.disabled = !allowed; });
        this.confirm.disabled = !allowed || !this.draft.size; this.clear.disabled = !allowed;
        this.slip.hidden = !this.builder.checked && !this.own;
        this.slip.textContent = this.own ? Array.isArray(this.own.wagers) ? `${this.own.wagers.length} betting spots · ${goldText(sum(this.own.wagers))} ${this.currency} confirmed for this round` : 'Wager details unavailable. Refresh the table before placing another bet.' :
            `${this.draft.size} betting spots · ${goldText(sum(this.draftWagers()))} ${this.currency} total (not yet wagered)`;
        this.stake.disabled = this.builder.disabled = Boolean(this.pending);
    }

    rejectAction(error) {
        if (!this.view || error?.action !== 'house_bet' || error.roundId !== this.view.roundId) return;
        this.pending = false; this.summary.textContent = error.error || 'Wager rejected. Review the table.'; this.refreshControls();
    }

    buildChips(view) {
        const key = JSON.stringify([view.currency, view.minBet, view.maxBet, view.betStep]);
        if (key === this.chipKey) return; this.chipKey = key; this.chips.replaceChildren();
        for (const value of [...new Set([1, 5, 25, 100].map(n => Math.min(view.maxBet, view.minBet * n)))]) {
            const b = this.button(goldText(value), () => {
                if (!this.canBet()) return; this.stake.value = String(value); this.refreshControls();
            });
            b.dataset.value = String(value); b.setAttribute('aria-label', `Choose ${value} ${this.currency} chip`); this.chips.append(b);
        }
        this.stake.oninput = () => this.refreshControls();
    }

    renderResult(view) {
        this.display.classList.toggle('revealing', view.phase === 'revealing');
        if (this.presentationKind !== view.game) {
            this.presentation?.dispose(); this.display.replaceChildren();
            this.presentation = view.game === 'roulette' ? new RoulettePresentation(this.display) : new BaccaratPresentation(this.display);
            if (view.game === 'roulette') this.presentation.onResultVisible = () => this.celebrateSavedWin();
            this.presentationKind = view.game;
        }
        this.presentation.update(view, JSON.stringify([view.tableId, view.currency, view.roundId, this.playerID, this.presence?.yourSeat?.sessionId]));
    }

    dispose() { this.rulesDialog.dispose(); this.combinationDialog?.dispose(); this.update(null); this.disposed = true; this.root.remove(); }
}
