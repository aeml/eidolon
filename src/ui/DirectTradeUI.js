import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

const boundedGold = value => Math.trunc(Math.max(0, Math.min(100000, Number(value) || 0)));
const offerKey = (items, gold) => JSON.stringify([items.slice().sort(), Number(gold) || 0]);

export class DirectTradeUI {
    constructor({ getLastPlayer, addGameMessage }) {
        this.getLastPlayer = getLastPlayer;
        this.addGameMessage = addGameMessage;
        this.window = document.getElementById('direct-trade-window');
        this.status = document.getElementById('direct-trade-status');
        this.status?.setAttribute('role', 'status');
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

        ownedEvent(this, this.offerButton, 'click', () => {
            if (!this.canAct() || this.offerButton.disabled || !this.onOffer) return;
            if (this.gold) this.gold.value = String(boundedGold(this.gold.value));
            this.pendingOfferKey = this.draftKey();
            this.refreshReviewState();
            const itemIds = Array.from(this.ownItems?.querySelectorAll('input:checked') || []).map((input) => input.value);
            if (this.onOffer(this.trade.id, itemIds, boundedGold(this.gold?.value)) === false) {
                this.pendingOfferKey = null;
                this.baseStatus = 'Offer was not sent. Retry when connected.';
                this.refreshReviewState();
            }
        });
        ownedEvent(this, this.confirmButton, 'click', () => {
            if (!this.canAct()) return;
            this.refreshReviewState();
            if (!this.confirmButton.disabled) this.onConfirm?.(this.trade.id);
        });
        const cancel = () => this.canAct() && this.onCancel?.(this.trade.id);
        ownedEvent(this, this.cancelButton, 'click', cancel);
        ownedEvent(this, this.closeButton, 'click', cancel);
        ownedEvent(this, this.gold, 'input', () => this.refreshReviewState());
        ownedEvent(this, this.ownItems, 'change', () => this.refreshReviewState());
    }

    canAct() {
        const playerId = this.getLastPlayer?.()?.id;
        return !this.disposed && this.trade && this.ownerId === playerId &&
            [this.trade.playerAId, this.trade.playerBId].includes(playerId) &&
            this.window?.isConnected && this.window.style.display !== 'none';
    }

    ownOffer(trade = this.trade) {
        return (this.ownerId === trade?.playerAId ? trade?.offerA : trade?.offerB) || {};
    }

    ownOfferKey(trade = this.trade) {
        const offer = this.ownOffer(trade);
        return offerKey((offer.items || []).map(item => item.id), offer.gold);
    }

    draftKey() {
        const selected = Array.from(this.ownItems?.querySelectorAll('input:checked') || []).map(input => input.value);
        return offerKey(selected, this.gold?.value);
    }

    refreshReviewState() {
        if (!this.trade || this.disposed) return;
        const dirty = this.draftKey() !== this.ownOfferKey();
        const confirmed = this.ownerId === this.trade.playerAId ? this.trade.confirmedA : this.trade.confirmedB;
        if (this.confirmButton) this.confirmButton.disabled = dirty || !!this.pendingOfferKey || !!confirmed || ['saving', 'recovering'].includes(this.state);
        if (this.status) this.status.textContent = this.baseStatus + (this.pendingOfferKey
            ? ' Waiting for your offer update.' : dirty ? ' Update your offer before confirming.' : '');
    }

    update(payload, terminalState = '') {
        if (this.disposed) return;
        const trade = payload?.trade || null;
        const state = terminalState || payload?.state || '';
        const playerId = this.getLastPlayer?.()?.id;
        if (!trade?.id || !playerId || ![trade.playerAId, trade.playerBId].includes(playerId)) return;
        if (state === 'complete' || state === 'cancelled') {
            if (this.trade && this.trade.id !== trade.id) return;
			this.addGameMessage?.('Trade', payload?.deliveryPending
                ? 'Trade resolved; delivery is retained or its save is pending. Free bag space or retry shortly.'
                : state === 'complete' ? 'Trade completed; delivery saved.' : 'Trade cancelled; escrow returned and saved.');
            this.close();
            return;
        }
        // An acknowledgement can arrive after the player starts another edit.
        // Keep that newer draft; confirmation still compares it with authority.
        const sameTrade = this.trade?.id === trade.id && this.ownerId === playerId;
        const keepDraft = sameTrade && (this.ownOfferKey() === this.ownOfferKey(trade) ||
            this.draftKey() !== this.ownOfferKey() || this.pendingOfferKey && this.draftKey() !== this.pendingOfferKey);
        const draft = keepDraft ? { gold: this.gold?.value,
            selected: new Set(Array.from(this.ownItems?.querySelectorAll('input:checked') || []).map(input => input.value)) } : null;
        if (!sameTrade || state === 'offer' && this.ownOfferKey(trade) === this.pendingOfferKey) this.pendingOfferKey = null;
        this.ownerId = playerId;
        this.trade = trade;
        this.state = state;
        if (this.window) this.window.style.display = 'block';
        this.render(state, state === 'recovering' ? null : draft);
    }

    render(state, draft = null) {
        const player = this.getLastPlayer?.();
        const myID = player?.id || '';
        const amA = myID === this.trade.playerAId;
        const ownOffer = amA ? this.trade.offerA : this.trade.offerB;
        const otherOffer = amA ? this.trade.offerB : this.trade.offerA;
        const ownConfirmed = amA ? this.trade.confirmedA : this.trade.confirmedB;
        const otherConfirmed = amA ? this.trade.confirmedB : this.trade.confirmedA;
        const partnerID = amA ? this.trade.playerBId : this.trade.playerAId;
		if (this.partnerTitle) this.partnerTitle.textContent = `${String(partnerID || 'Partner').replace(/^player-/, '')}'s offer`;
        if (this.gold) {
            this.gold.value = draft?.gold ?? String(ownOffer?.gold || 0);
            this.gold.disabled = state === 'recovering';
        }
        this.baseStatus = state === 'saving'
                ? 'Offer save pending. Retry the same offer or cancel after recovery.'
                : state === 'recovering'
                ? 'Save or decision pending. Custody is retained; retry after recovery.'
                : state === 'rejected'
                ? 'Confirmation reset. Review capacity and offer rules.'
                : `You: ${ownConfirmed ? 'confirmed' : 'reviewing'} • Partner: ${otherConfirmed ? 'confirmed' : 'reviewing'}`;
        if (this.offerButton) this.offerButton.disabled = state === 'recovering';

        const selected = draft?.selected || new Set((ownOffer?.items || []).map((item) => item.id));
        const choices = [...(ownOffer?.items || []), ...(player?.inventory || []).filter(Boolean)]
            .filter((item, index, all) => item?.id && all.findIndex((candidate) => candidate?.id === item.id) === index);
        const active = document.activeElement;
        const focusedItem = this.ownItems?.contains(active) ? active.value : null;
        this.renderItems(this.ownItems, choices, { selectable: true, selected, disabled: state === 'recovering' });
        if (focusedItem) Array.from(this.ownItems.querySelectorAll('input')).find(input => input.value === focusedItem && !input.disabled)?.focus({ preventScroll: true });
        this.renderItems(this.otherItems, otherOffer?.items || []);
        if (this.otherGold) this.otherGold.textContent = `${otherOffer?.gold || 0} gold`;
        this.refreshReviewState();
    }

    renderItems(container, items, { selectable = false, selected = new Set(), disabled = false } = {}) {
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
                checkbox.disabled = disabled;
                row.appendChild(checkbox);
            }
            row.appendChild(document.createTextNode(`${item.name || 'Item'}${item.stack > 1 ? ` ×${item.stack}` : ''}`));
            container.appendChild(row);
        });
    }

    close() {
        if (this.window) this.window.style.display = 'none';
        this.trade = null;
        this.pendingOfferKey = null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        disposeOwnedEvents(this);
        this.close();
    }
}
