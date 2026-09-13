import { getSlotSymbolIcon } from '../art/ProceduralSlotIcons.js';

function node(tag, text = '', className = '') { const n = document.createElement(tag); n.textContent = text; n.className = className; return n; }

export class SlotMachineUI {
    constructor(send, sound = () => {}) {
        this.send = send; this.sound = sound; this.timers = [];
        this.root = node('section', '', 'slot-game'); this.root.hidden = true; this.root.setAttribute('aria-label', 'Elemental slot machine');
        this.summary = node('p'); this.summary.setAttribute('role', 'status');
        this.lore = node('p', '', 'slot-lore');
        this.grid = node('div', '', 'slot-grid'); this.grid.setAttribute('aria-label', 'Five reels, three rows');
        this.cells = Array.from({ length: 5 }, () => []);
        for (let row = 0; row < 3; row++) for (let reel = 0; reel < 5; reel++) {
            const cell = node('div', '', 'slot-cell'), icon = node('img'), label = node('span');
            icon.alt = ''; cell.append(icon, label); this.grid.append(cell); this.cells[reel][row] = { cell, icon, label };
        }
        this.result = node('p', '', 'slot-result');
        this.controls = node('div', '', 'slot-controls');
        const stakeLabel = node('label', 'Total Gold stake '); this.stake = node('select');
        for (const bet of [20, 40]) { const option = node('option', String(bet)); option.value = bet; this.stake.append(option); }
        stakeLabel.append(this.stake);
        this.stake.onchange = () => this.clearQuote();
        this.spin = this.button('Review spin', () => this.reviewSpin()); this.controls.append(stakeLabel, this.spin);
        this.confirmation = node('div', '', 'slot-confirm'); this.confirmation.hidden = true;
        this.quoteText = node('p'); this.confirm = this.button('Confirm Gold spin', () => this.confirmSpin());
        this.confirmation.append(this.quoteText, this.confirm, this.button('Cancel', () => this.clearQuote()));
        this.bonus = node('div', '', 'slot-bonus'); this.bonus.hidden = true;
        this.rules = node('details'); this.rules.append(node('summary', 'Paylines, rewards & rules'));
        this.rulesBody = node('div'); this.rules.append(this.rulesBody);
        this.root.append(this.summary, this.lore, this.grid, this.result, this.controls, this.confirmation, this.bonus, this.rules);
    }

    button(text, action) { const n = node('button', text); n.type = 'button'; n.onclick = action; return n; }
    clearQuote() { this.quote = null; this.confirmation.hidden = true; }
    clearAnimation() { this.timers.forEach(clearTimeout); this.timers = []; this.animating = false; this.grid.classList.remove('spinning'); }

    update(view) {
        const previous = this.view; this.view = view; this.root.hidden = !view;
        if (!view) { this.clearAnimation(); this.clearQuote(); return; }
        const s = view.session, machine = view.machine;
        this.root.dataset.theme = machine.theme;
        if (!view.available) { this.clearAnimation(); this.clearQuote(); this.summary.textContent = 'Synchronizing saved machine progress…'; this.refreshControls(); return; }
        this.pending = false;
        this.summary.textContent = `${view.gold} Gold · ${s.freeSpins} free spins saved${view.processing ? ' · Saving settlement…' : ''}`;
        this.lore.textContent = machine.lore;
        if (s.freeSpins || s.bonus) this.stake.value = String(s.bet);
        if (this.quote && (this.quote.roundRevision !== s.revision || view.processing || s.freeSpins || s.bonus)) this.clearQuote();
        if (this.machineID !== machine.theme) { this.machineID = machine.theme; this.buildRules(machine, view.lines); }
        const changed = previous?.session?.revision !== s.revision || previous?.machine?.theme !== machine.theme;
        if (changed) {
            this.clearAnimation();
            const last = s.last;
            if (last && previous?.available && previous.machine.theme === machine.theme && last.bonusPicked < 0) {
                this.animating = true; this.grid.classList.add('spinning'); this.showGrid(last.landed);
                const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                const delay = reduced ? 0 : 700;
                last.stages.forEach((stage, index) => this.timers.push(setTimeout(() => {
                    this.grid.classList.remove('spinning'); this.showStage(stage, index, last.stages.length);
                    if (index === last.stages.length - 1) { this.animating = false; this.showResult(last); this.refreshControls(); }
                }, delay + index * (reduced ? 0 : 650))));
            } else if (last) { this.showStage(last.stages.at(-1), last.stages.length - 1, last.stages.length); this.showResult(last); }
            else { this.showGrid(Array.from({ length: 5 }, (_, reel) => [reel % 6, (reel + 1) % 6, (reel + 2) % 6])); this.result.textContent = 'Choose a stake and review it before spinning.'; }
            if (last && previous?.available && previous.session.revision !== s.revision) this.sound(last.stages.some(stage => stage.jackpot) ? 'jackpot' : s.bonus ? 'bonus' : last.payout || last.bonusPayout ? 'win' : 'stop');
        }
        this.bonus.hidden = !s.bonus;
        if (changed) this.bonus.replaceChildren();
        if (s.bonus && changed) {
            this.bonus.append(node('h3', machine.bonusTitle), node('p', 'Choose one sealed reward. Its Gold and your free spins are already saved; leaving does not forfeit them.'));
            machine.bonusChoices.forEach((label, choice) => this.bonus.append(this.button(label, () => this.act({ action: 'slot_bonus', choice, roundRevision: s.revision }))));
        }
        this.refreshControls();
    }

    refreshControls() {
        const v = this.view, s = v?.session;
        const busy = !v?.available || v.processing || this.pending || this.animating;
        this.spin.disabled = busy || Boolean(s?.bonus);
        this.stake.disabled = busy || Boolean(s?.freeSpins || s?.bonus);
        this.spin.textContent = s?.freeSpins ? `Use free spin · ${s.freeSpins} left` : 'Review Gold spin';
        this.confirm.disabled = busy;
        this.bonus.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    }

    showGrid(grid) {
        const machine = this.view.machine;
        for (let reel = 0; reel < 5; reel++) for (let row = 0; row < 3; row++) {
            const symbol = grid?.[reel]?.[row] ?? 0, { cell, icon, label } = this.cells[reel][row];
            cell.className = `slot-cell${symbol === 6 ? ' wild' : symbol === 7 ? ' scatter' : ''}`;
            icon.src = getSlotSymbolIcon(machine.theme, symbol); label.textContent = machine.symbols[symbol];
        }
    }

    showStage(stage, index, count) {
        if (!stage) return; this.showGrid(stage.grid);
        for (const win of stage.wins || []) for (let reel = 0; reel < win.count; reel++) this.cells[reel][this.view.lines[win.line][reel]].cell.classList.add('win');
        this.result.textContent = `${index ? `Cascade ${index}` : 'Reels settled'} · ${stage.jackpot ? 'JACKPOT · ' : ''}${stage.payout} Gold returned${count > 1 ? ` · stage ${index + 1}/${count}` : ''}`;
    }

    showResult(last) {
        this.result.textContent = `${last.stages.some(stage => stage.jackpot) ? 'JACKPOT · ' : ''}${last.payout} Gold returned${last.bonusPayout ? ` + ${last.bonusPayout} bonus Gold` : ''}${last.freeAwarded ? ` · ${last.freeAwarded} free spins awarded` : ''}. ${last.free ? 'Free spin: no Gold charged.' : `Stake: ${this.view.session.bet} Gold.`}`;
    }

    reviewSpin() {
        const v = this.view; if (!v?.available || v.processing || this.pending || this.animating || v.session.bonus) return;
        if (v.session.freeSpins) { this.act({ action: 'slot_spin', bet: v.session.bet, roundRevision: v.session.revision }); return; }
        const bet = Number(this.stake.value);
        if (![20, 40].includes(bet) || bet > v.gold) { this.summary.textContent = 'Choose an affordable stake of 20 or 40 Gold.'; return; }
        this.quote = { action: 'slot_spin', bet, roundRevision: v.session.revision };
        this.quoteText.textContent = `Spend ${bet} Gold across all 10 paylines? A spin can return no Gold. This is not a guaranteed reward.`;
        this.confirmation.hidden = false;
    }

    confirmSpin() {
        if (!this.quote || this.quote.roundRevision !== this.view?.session.revision || this.view.processing || this.pending || this.animating) return;
        const quote = this.quote; this.clearQuote(); this.act(quote);
    }
    act(payload) { if (!this.view?.available || this.pending || this.animating || this.view.processing) return; this.pending = true; this.clearQuote(); this.refreshControls(); this.sound('spin'); this.send(payload); }

    buildRules(machine, lines) {
        this.rulesBody.replaceChildren();
        for (const text of [machine.mechanic, '20 or 40 Gold buys all ten paylines equally. Each line pays its best left-to-right match of 3, 4 or 5 symbols. Wilds substitute except for scatters and the jackpot. Returns below include any returned stake.',
            'Five natural Eidolon symbols on the center line pay 100×total stake instead of that stage’s line wins. Three or more scatters on the original landed grid award a pick-one bonus (1×, 2× or 5×stake) and free spins. Cascades do not retrigger scatters.',
            `${machine.freeSpins} free spins per trigger; at most 12 can be banked. Their original stake is retained. Bonus choices and free spins survive leaving and reconnecting. Spins are manual, never automatic.`]) this.rulesBody.append(node('p', text));
        const table = node('table'); const header = node('tr');
        for (const text of ['Symbol', 'Weight /100', '3 / 4 / 5 (×line stake)']) header.append(node('th', text)); table.append(header);
        machine.symbols.forEach((name, index) => { const row = node('tr'); row.append(node('td', name), node('td', String(machine.weights[index])), node('td', machine.pays[index]?.join(' / ') || (index === 6 ? 'Wild' : 'Bonus'))); table.append(row); });
        this.rulesBody.append(table, node('p', 'Rows below run from left reel to right reel: top=1, middle=2, bottom=3.'));
        const list = node('ol'); lines.forEach(line => list.append(node('li', line.map(row => row + 1).join(' → ')))); this.rulesBody.append(list);
    }
    dispose() { this.clearAnimation(); this.root.remove(); }
}
