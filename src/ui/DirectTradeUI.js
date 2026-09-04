export class DirectTradeUI {
    constructor({ getLastPlayer, addGameMessage }) {
        this.getLastPlayer = getLastPlayer;
        this.addGameMessage = addGameMessage;
        this.window = document.getElementById('direct-trade-window');
        this.status = document.getElementById('direct-trade-status');
        this.ownItems = document.getElementById('direct-trade-own-items');
        this.otherItems = document.getElementById('direct-trade-other-items');
        this.otherGold = document.getElementById('direct-trade-other-gold');
        this.partnerTitle = document.getElementById('direct-trade-partner-title');
        this.gold = document.getElementById('direct-trade-gold');
        this.offerButton = document.getElementById('btn-direct-trade-offer');
        this.confirmButton = document.getElementById('btn-direct-trade-confirm');
        this.cancelButton = document.getElementById('btn-direct-trade-cancel');
        this.closeButton = document.getElementById('btn-close-direct-trade');
        this.trade = null;
        this.onOffer = null;
        this.onConfirm = null;
        this.onCancel = null;

        this.offerButton?.addEventListener('click', () => {
            if (!this.trade) return;
            const itemIds = Array.from(this.ownItems?.querySelectorAll('input:checked') || []).map((input) => input.value);
            this.onOffer?.(this.trade.id, itemIds, Math.max(0, Math.min(100000, Number(this.gold?.value) || 0)));
        });
        this.confirmButton?.addEventListener('click', () => this.trade && this.onConfirm?.(this.trade.id));
        this.cancelButton?.addEventListener('click', () => this.trade && this.onCancel?.(this.trade.id));
        this.closeButton?.addEventListener('click', () => this.trade && this.onCancel?.(this.trade.id));
    }

    update(payload, terminalState = '') {
        const trade = payload?.trade || null;
        const state = terminalState || payload?.state || '';
        if (state === 'complete' || state === 'cancelled') {
            this.addGameMessage?.('Trade', state === 'complete' ? 'Trade completed.' : 'Trade cancelled; escrow returned.');
            this.close();
            return;
        }
        if (!trade) return;
        this.trade = trade;
        if (this.window) this.window.style.display = 'block';
        this.render(state);
    }

    render(state) {
        const player = this.getLastPlayer?.();
        const myID = player?.id || '';
        const amA = myID === this.trade.playerAId;
        const ownOffer = amA ? this.trade.offerA : this.trade.offerB;
        const otherOffer = amA ? this.trade.offerB : this.trade.offerA;
        const ownConfirmed = amA ? this.trade.confirmedA : this.trade.confirmedB;
        const otherConfirmed = amA ? this.trade.confirmedB : this.trade.confirmedA;
        const partnerID = amA ? this.trade.playerBId : this.trade.playerAId;
		if (this.partnerTitle) this.partnerTitle.textContent = `${String(partnerID || 'Partner').replace(/^player-/, '')}'s offer`;
        if (this.gold) this.gold.value = String(ownOffer?.gold || 0);
        if (this.status) {
            this.status.textContent = state === 'rejected'
                ? 'Confirmation reset. Review capacity and offer rules.'
                : `You: ${ownConfirmed ? 'confirmed' : 'reviewing'} • Partner: ${otherConfirmed ? 'confirmed' : 'reviewing'}`;
        }
        if (this.confirmButton) this.confirmButton.disabled = !!ownConfirmed;

        const selected = new Set((ownOffer?.items || []).map((item) => item.id));
        const choices = [...(ownOffer?.items || []), ...(player?.inventory || []).filter(Boolean)]
            .filter((item, index, all) => item?.id && all.findIndex((candidate) => candidate?.id === item.id) === index);
        this.renderItems(this.ownItems, choices, { selectable: true, selected });
        this.renderItems(this.otherItems, otherOffer?.items || []);
        if (this.otherGold) this.otherGold.textContent = `${otherOffer?.gold || 0} gold`;
    }

    renderItems(container, items, { selectable = false, selected = new Set() } = {}) {
        if (!container) return;
        container.replaceChildren();
        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'direct-trade-item';
            empty.textContent = 'No items offered';
            container.appendChild(empty);
            return;
        }
        items.forEach((item) => {
            const row = document.createElement('label');
            row.className = 'direct-trade-item';
            if (selectable) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = item.id;
                checkbox.checked = selected.has(item.id);
                row.appendChild(checkbox);
            }
            row.appendChild(document.createTextNode(`${item.name || 'Item'}${item.stack > 1 ? ` ×${item.stack}` : ''}`));
            container.appendChild(row);
        });
    }

    close() {
        if (this.window) this.window.style.display = 'none';
        this.trade = null;
    }
}
