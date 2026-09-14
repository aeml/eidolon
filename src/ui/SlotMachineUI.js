import { getSlotSymbolIcon } from '../art/ProceduralSlotIcons.js';
import { CasinoCelebration, goldText, slotWinTier } from './CasinoCelebration.js';

function node(tag, text = '', className = '') { const n = document.createElement(tag); n.textContent = text; n.className = className; return n; }

export class SlotMachineUI {
    constructor(send, sound = () => {}) {
        this.send = send; this.currency = 'Gold'; this.sound = sound; this.timers = [];
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
        const stakeLabel = node('label', 'Bet amount · Gold'); this.stakeLabel = stakeLabel; this.stake = node('input');
        this.stake.type = 'number'; this.stake.inputMode = 'numeric'; this.stake.min = '20'; this.stake.max = '40'; this.stake.step = '20'; this.stake.value = '20';
        stakeLabel.append(this.stake);
        this.stake.onchange = () => this.refreshControls();
        this.stake.oninput = () => this.refreshControls();
        this.adjustments = node('div', '', 'casino-bet-adjustments');
        for (const [label, factor] of [['½', .5], ['2×', 2]]) this.adjustments.append(this.button(label, () => {
            if (this.stake.disabled) return;
            const { min, max, step } = this.betLimits();
            this.stake.value = String(Math.max(min, Math.min(max, Math.floor(Number(this.stake.value) * factor / step) * step || min)));
            this.refreshControls();
        }));
        this.spin = this.button('Spin · 20 Gold', () => this.spinOnce()); this.spin.className = 'casino-primary'; this.controls.append(stakeLabel, this.adjustments, this.spin);
        this.modes = node('div', '', 'casino-play-modes');
        this.manualMode = this.button('Manual', () => this.setMode(false)); this.autoMode = this.button('Auto', () => this.setMode(true));
        this.modes.append(this.manualMode, this.autoMode);
        this.autoControls = node('div', '', 'slot-controls slot-auto-controls');
        const countLabel = node('label', 'Auto spins '); this.count = node('input');
        this.count.type = 'number'; this.count.min = '1'; this.count.max = '1000'; this.count.step = '1'; this.count.value = '50';
        countLabel.append(this.count); this.autoControls.append(countLabel);
        for (const count of [50, 100]) this.autoControls.append(this.button(String(count), () => { this.count.value = String(count); this.refreshControls(); }));
        this.count.oninput = () => this.refreshControls();
        this.auto = this.button('Start auto spins', () => this.startAuto());
        this.auto.className = 'casino-primary';
        this.stop = this.button('Stop auto spins', () => this.stopAuto('Auto spins stopped. Any current spin still settles.'));
        this.autoControls.append(this.auto, this.stop);
        this.autoStatus = node('p', '', 'slot-auto-status'); this.autoStatus.setAttribute('role', 'status');
        this.risk = node('p', 'Spin places the displayed wager immediately. Each spin can lose its full stake.', 'slot-lore');
        this.visibilityHandler = () => { if (document.hidden) this.stopAuto('Auto spins stopped while the game is hidden.'); };
        document.addEventListener('visibilitychange', this.visibilityHandler);
        this.bonus = node('div', '', 'slot-bonus'); this.bonus.hidden = true;
        this.rules = node('details'); this.rules.append(node('summary', 'Paylines, rewards & rules'));
        this.rulesBody = node('div'); this.rules.append(this.rulesBody);
        this.sidebar = node('div', '', 'slot-sidebar'); this.stage = node('div', '', 'slot-stage');
        this.betHelp = node('p', '', 'slot-bet-help');
        this.sidebar.append(this.summary, this.modes, this.controls, this.betHelp, this.autoControls, this.autoStatus, this.risk);
        this.stage.append(this.lore, this.grid, this.result, this.bonus);
        this.celebration = new CasinoCelebration(this.stage);
        this.root.append(this.sidebar, this.stage, this.rules);
        this.setMode(false);
    }

    button(text, action) { const n = node('button', text); n.type = 'button'; n.onclick = action; return n; }
    setMode(automatic) {
        if (!automatic && this.autoRemaining) this.stopAuto('Auto spins stopped. Any current spin still settles.');
        this.automaticMode = automatic; this.autoControls.hidden = !automatic; this.autoStatus.hidden = !automatic; this.spin.hidden = automatic;
        this.manualMode.setAttribute('aria-pressed', String(!automatic)); this.autoMode.setAttribute('aria-pressed', String(automatic));
    }
    betLimits() { return { min: this.view?.minBet || 20, max: this.view?.maxBet || 40, step: this.view?.betStep || 20 }; }
    clearAnimation() {
        this.timers.forEach(clearTimeout); this.timers = []; clearInterval(this.reelTimer);
        this.animating = false; this.grid.classList.remove('spinning');
        this.grid.querySelectorAll('.rolling').forEach(cell => cell.classList.remove('rolling'));
    }

    stopAuto(message = '') {
        this.autoRemaining = 0; clearTimeout(this.autoTimer);
        this.autoStatus.textContent = message; this.refreshControls();
    }

    startAuto() {
        if (!this.canSpin() || document.hidden || this.autoRemaining) return;
        const count = Number(this.count.value);
        if (!Number.isInteger(count) || count < 1 || count > 1000) { this.autoStatus.textContent = 'Choose 1–1000 spins.'; return; }
        this.autoRemaining = count; this.autoBet = Number(this.stake.value); this.spinOnce(true);
    }

    scheduleAuto() {
        clearTimeout(this.autoTimer);
        if (!this.autoRemaining || !this.canSpin()) return;
        this.autoTimer = setTimeout(() => this.spinOnce(true), 500);
    }

    update(view) {
        const previous = this.view; this.view = view; this.root.hidden = !view;
        if (!view) { this.clearAnimation(); this.celebration.clear(); this.waitingCelebration = null; clearTimeout(this.pendingTimer); this.pending = null; this.stopAuto(); return; }
        const changedCurrency = previous?.currency !== view.currency;
        this.currency = view.currency === 'ep' ? 'EP' : 'Gold';
        const s = view.session, machine = view.machine;
        this.stakeLabel.firstChild.nodeValue = `Bet amount · ${this.currency}`;
        if (changedCurrency) this.stake.value = String(s.bet || this.betLimits().min);
        const limits = this.betLimits();
        this.stake.min = String(limits.min); this.stake.max = String(limits.max); this.stake.step = String(limits.step);
        if (previous && (previous.machine?.theme !== machine.theme || changedCurrency)) { this.clearAnimation(); clearTimeout(this.pendingTimer); this.pending = null; this.stopAuto('Machine changed; auto spins stopped.'); }
        this.root.dataset.theme = machine.theme;
        if (!view.available) { this.stopAuto('Auto spins stopped while synchronizing.'); this.summary.textContent = 'Synchronizing saved machine progress…'; this.refreshControls(); return; }
        if (this.pending && s.revision !== this.pending.revision && !view.processing) { this.pending = null; clearTimeout(this.pendingTimer); }
        this.summary.textContent = `${view.balance ?? view.gold} ${this.currency} · ${s.freeSpins} free spins saved${view.processing ? ' · Saving settlement…' : ''}`;
        this.lore.textContent = machine.lore;
        if (s.freeSpins || s.bonus) this.stake.value = String(s.bet);
        if (this.machineID !== `${view.currency || 'gold'}:${machine.theme}`) { this.machineID = `${view.currency || 'gold'}:${machine.theme}`; this.buildRules(machine, view.lines); }
        const changed = changedCurrency || previous?.session?.revision !== s.revision || previous?.machine?.theme !== machine.theme;
        if (changed) {
            this.clearAnimation();
            this.celebration.clear();
            this.waitingCelebration = null;
            const last = s.last;
            if (last && previous?.available && previous.machine.theme === machine.theme && !changedCurrency && last.bonusPicked < 0) {
                this.startReels(last.landed);
                const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                const delay = reduced ? 150 : 1700;
                last.stages.forEach((stage, index) => this.timers.push(setTimeout(() => {
                    this.grid.classList.remove('spinning'); this.showStage(stage, index, last.stages.length);
                    if (index === last.stages.length - 1) { this.clearAnimation(); this.showResult(last); this.resultSound(last); this.celebrateResult(last); this.refreshControls(); this.scheduleAuto(); }
                }, delay + index * (reduced ? 0 : 650))));
            } else if (last) { this.showStage(last.stages.at(-1), last.stages.length - 1, last.stages.length); this.showResult(last); }
            else { this.showGrid(Array.from({ length: 5 }, (_, reel) => [reel % 6, (reel + 1) % 6, (reel + 2) % 6])); this.result.textContent = 'Choose a stake, then Spin.'; }
            if (last && !this.animating && previous?.available && previous.session.revision !== s.revision) { this.resultSound(last); this.celebrateResult(last); }
        }
        this.bonus.hidden = !s.bonus;
        if (s.bonus && this.autoRemaining) this.stopAuto('Auto spins stopped for your bonus choice. Free spins remain saved.');
        if (changed) this.bonus.replaceChildren();
        if (s.bonus && changed) {
            this.bonus.append(node('p', '✦ BONUS ROUND ✦', 'slot-bonus-kicker'), node('h3', machine.bonusTitle),
                node('p', `${s.freeSpins} FREE SPINS · ${machine.mechanic}`), node('p', 'Choose one sealed reward. Your bonus and free spins are saved; leaving does not forfeit them.'));
            machine.bonusChoices.forEach((label, choice) => this.bonus.append(this.button(label, () => this.act({ action: 'slot_bonus', choice, roundRevision: s.revision }))));
        }
        if (this.waitingCelebration && !view.processing && !this.animating) {
            const last = this.waitingCelebration; this.waitingCelebration = null; this.celebrateResult(last);
        }
        this.refreshControls();
        if (!this.animating) this.scheduleAuto();
    }

    refreshControls() {
        const v = this.view, s = v?.session;
        const busy = !v?.available || v.processing || this.pending || this.animating || this.celebration.active;
        this.bonus.hidden = !s?.bonus || Boolean(this.animating || this.celebration.active);
        this.spin.disabled = busy || Boolean(s?.bonus || this.autoRemaining);
        this.stake.disabled = busy || Boolean(s?.freeSpins || s?.bonus || this.autoRemaining);
        this.adjustments.querySelectorAll('button').forEach(button => { button.disabled = this.stake.disabled; });
        const limits = this.betLimits();
        this.betHelp.textContent = s?.freeSpins || s?.bonus ? `Bonus stake locked at ${s.bet} ${this.currency} until saved bonus/free spins finish.` : `10 paylines · ${limits.min}–${limits.max} ${this.currency} in steps of ${limits.step}. Change your next bet between spins.`;
        this.spin.textContent = s?.freeSpins ? `Use free spin · ${s.freeSpins} left` : `Spin · ${this.stake.value} ${this.currency}`;
        this.autoControls.querySelectorAll('input, button').forEach(control => { control.disabled = busy || Boolean(s?.bonus || this.autoRemaining); });
        this.stop.disabled = !this.autoRemaining;
        this.auto.textContent = `Start ${this.count.value || '…'} auto spins`;
        const count = Number(this.count.value), stake = Number(this.stake.value);
        this.risk.textContent = `Spin wagers immediately and can lose its full stake. Auto: ${Number.isInteger(count) && count > 0 && count <= 1000 ? `up to ${count * stake} ${this.currency} in total stakes` : 'choose 1–1000 spins'}; free spins cost no ${this.currency}. Winnings may fund later spins.`;
        if (this.autoRemaining) this.autoStatus.textContent = `${this.autoRemaining} spins left to start · ${this.autoBet} ${this.currency} per paid spin. Stop keeps the current result.`;
        else if (!this.autoStatus.textContent) this.autoStatus.textContent = 'Free spins count toward the queue. No queued spins continue after leaving.';
        this.bonus.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    }

    startReels(landed) {
        this.animating = true; this.grid.classList.add('spinning');
        this.result.textContent = landed ? 'Reels spinning…' : 'Spinning · waiting for the saved result…';
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const stopped = new Set(); let tick = 0;
        const draw = () => {
            const grid = Array.from({ length: 5 }, (_, reel) => stopped.has(reel) ? landed[reel] : Array.from({ length: 3 }, (_, row) => (tick + reel * 3 + row) % 8));
            this.showGrid(grid);
            for (let reel = 0; reel < 5; reel++) for (const { cell } of this.cells[reel]) cell.classList.toggle('rolling', !stopped.has(reel));
            tick++;
        };
        draw(); this.reelTimer = setInterval(draw, 90);
        if (landed) for (let reel = 0; reel < 5; reel++) this.timers.push(setTimeout(() => {
            stopped.add(reel); draw(); this.sound('stop');
            if (reel === 4) clearInterval(this.reelTimer);
        }, 650 + reel * 220));
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
        this.result.textContent = `${index ? `Cascade ${index}` : 'Reels settled'} · ${stage.jackpot ? 'JACKPOT · ' : ''}${stage.payout} ${this.currency} returned${count > 1 ? ` · stage ${index + 1}/${count}` : ''}`;
    }

    showResult(last) {
        this.result.textContent = `${last.stages.some(stage => stage.jackpot) ? 'JACKPOT · ' : ''}${last.payout} ${this.currency} returned${last.bonusPayout ? ` + ${last.bonusPayout} bonus ${this.currency}` : ''}${last.freeAwarded ? ` · ${last.freeAwarded} free spins awarded` : ''}. ${last.free ? 'Free spin: no stake charged.' : `Stake: ${this.view.session.bet} ${this.currency}.`}`;
    }

    resultSound(last) { this.sound(last.stages.some(stage => stage.jackpot) ? 'jackpot' : this.view.session.bonus ? 'bonus' : last.payout || last.bonusPayout ? 'win' : 'stop'); }

    celebrateResult(last) {
        if (!this.view?.available || this.view.processing) { this.waitingCelebration = last; return; }
        const bonusPicked = last.bonusPicked >= 0;
        const payout = bonusPicked ? last.bonusPayout || 0 : last.payout || 0;
        const free = bonusPicked ? this.view.session.freeSpins : last.freeAwarded || 0;
        if (!payout && !free) return;
        const bet = this.view.session.bet;
        const title = bonusPicked ? 'BONUS REVEALED' : payout ? slotWinTier(payout, bet) : 'FREE SPINS';
        const detail = `${free ? `${free} free spins · ` : ''}${bonusPicked ? this.view.machine.bonusTitle : last.free ? 'Free spin · no stake charged' : `${goldText(bet)} ${this.currency} staked · total return, not net profit`}`;
        this.celebration.show(title, payout ? `${goldText(payout)} ${this.currency} returned` : `${free} free spins awarded`, detail,
            () => { this.refreshControls(); this.scheduleAuto(); }, payout >= bet * 50 ? 4000 : 2500);
    }

    canSpin() { const v = this.view; return Boolean(v?.available && !v.processing && !this.pending && !this.animating && !this.celebration.active && !v.session.bonus); }
    spinOnce(automatic = false) {
        if (!this.canSpin() || (automatic && (!this.autoRemaining || document.hidden)) || (!automatic && this.autoRemaining)) return;
        const v = this.view, bet = v.session.freeSpins ? v.session.bet : automatic ? this.autoBet : Number(this.stake.value);
        const { min, max, step } = this.betLimits();
        if (!Number.isInteger(bet) || bet < min || bet > max || bet % step || (!v.session.freeSpins && bet > (v.balance ?? v.gold))) { this.stopAuto(`Choose a valid stake within your ${this.currency} balance.`); this.summary.textContent = `Choose ${min}–${max} ${this.currency} in steps of ${step}, within your balance.`; return; }
        if (automatic) this.autoRemaining--;
        this.act({ action: 'slot_spin', bet, roundRevision: v.session.revision });
        if (automatic && !this.autoRemaining) this.autoStatus.textContent = 'Final queued spin. No further spins will start.';
    }
    act(payload) {
        if (!this.view?.available || this.pending || this.animating || this.celebration.active || this.view.processing) return;
        this.pending = { revision: payload.roundRevision, action: payload.action };
        if (payload.action === 'slot_spin') { this.startReels(); this.sound('spin'); }
        this.refreshControls();
        this.pendingTimer = setTimeout(() => {
            this.clearAnimation(); this.stopAuto('Result not confirmed. Auto spins stopped; reconnect to synchronize.');
        }, 10000);
        if (this.send(payload) === false) { this.clearAnimation(); this.stopAuto('Connection unavailable. Auto spins stopped.'); }
    }

    rejectAction(error) {
        if (!this.pending || error.roundRevision !== this.pending.revision || error.action !== this.pending.action) return;
        this.pending = null; clearTimeout(this.pendingTimer); this.clearAnimation();
        this.stopAuto(`Auto spins stopped: ${error.error}`);
        this.result.textContent = 'Result not confirmed. Synchronizing saved machine state…';
    }

    buildRules(machine, lines) {
        this.rulesBody.replaceChildren();
        for (const text of [machine.mechanic, 'The displayed total stake buys all ten paylines equally. Each line pays its best left-to-right match of 3, 4 or 5 symbols. Wilds substitute except for scatters and the jackpot. Returns below include any returned stake.',
            'Five natural Eidolon symbols on the center line pay 100×total stake instead of that stage’s line wins. Three or more scatters on the original landed grid award a pick-one bonus (1×, 2× or 5×stake) and free spins. Cascades do not retrigger scatters.',
            `${machine.freeSpins} free spins per trigger; at most 12 can be banked. Their original stake is retained. Bonus choices and free spins survive leaving and reconnecting. Auto spins run one at a time at the selected stake; free spins count toward the selected total. Stop cancels unstarted spins, not the current wager. Leaving, hiding the game, connection trouble, insufficient ${this.currency} or a bonus choice stops the queue. Queues are never restored on reconnect.`]) this.rulesBody.append(node('p', text));
        const table = node('table'); const header = node('tr');
        for (const text of ['Symbol', 'Weight /100', '3 / 4 / 5 (×line stake)']) header.append(node('th', text)); table.append(header);
        machine.symbols.forEach((name, index) => { const row = node('tr'); row.append(node('td', name), node('td', String(machine.weights[index])), node('td', machine.pays[index]?.join(' / ') || (index === 6 ? 'Wild' : 'Bonus'))); table.append(row); });
        this.rulesBody.append(table, node('p', 'Rows below run from left reel to right reel: top=1, middle=2, bottom=3.'));
        const list = node('ol'); lines.forEach(line => list.append(node('li', line.map(row => row + 1).join(' → ')))); this.rulesBody.append(list);
    }
    dispose() { this.update(null); document.removeEventListener('visibilitychange', this.visibilityHandler); this.root.remove(); }
}
