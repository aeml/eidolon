// This wallet never submits Gold casino wagers or grants VIP access.
export class EPWalletUI {
    constructor({ host, getPlayer, send }) {
        this.getPlayer = getPlayer;
        this.send = send;
        this.root = document.createElement('details');
        this.root.className = 'equipment-loadouts ep-wallet-panel';
        this.root.innerHTML = `<summary>Eidolon Points · EP</summary><div class="equipment-loadouts-body">
            <p data-balance>Open to load your balance.</p>
            <p data-vip-status>VIP membership months grant 100 EP each. Payment integration is not available.</p>
            <p>1 EP costs 1,000,000 Gold. This exchange is permanent: EP cannot become Gold, items, stats or progression. Spend EP on cosmetic appearances at Veyra’s VIP Outfitter beside the casino entrance. EP-only casino games are still being built; owning EP does not grant VIP access.</p>
            <label>EP to receive<input type="number" min="1" step="1" value="1" inputmode="numeric" aria-label="EP to receive"></label>
            <button type="button" data-review disabled>Review exchange</button>
            <div data-confirmation hidden><p data-cost></p><button type="button" data-confirm>Confirm permanent exchange</button> <button type="button" data-cancel>Cancel</button></div>
            <button type="button" data-retry hidden>Retry pending exchange</button>
            <p role="status" aria-live="polite">Exchange in town, alive and out of combat. No real-money purchases are available.</p>
        </div>`;
        host?.prepend(this.root);
        this.amount = this.root.querySelector('input');
        this.review = this.root.querySelector('[data-review]');
        this.confirmation = this.root.querySelector('[data-confirmation]');
        this.retry = this.root.querySelector('[data-retry]');
        this.status = this.root.querySelector('[role="status"]');
        this.root.addEventListener('toggle', () => {
            if (!this.root.open) return;
            this.refreshPlayer();
            this.send('get_vip_status', {});
            this.send('get_ep_wallet', {});
        });
        this.amount.addEventListener('input', () => { this.confirmation.hidden = true; });
        this.review.addEventListener('click', () => {
            if (!this.refreshPlayer() || this.pending || !this.ready) return;
            const amount = Number(this.amount.value), cost = amount * this.rate;
            if (!Number.isSafeInteger(amount) || amount < 1 || !Number.isSafeInteger(cost) || cost > this.gold) {
                this.status.textContent = 'Choose a positive whole number of EP you can afford.';
                return;
            }
            this.reviewedAmount = amount;
            this.root.querySelector('[data-cost]').textContent = `Permanently spend ${cost.toLocaleString()} Gold to receive ${amount.toLocaleString()} EP? There is no exchange back to Gold.`;
            this.confirmation.hidden = false;
        });
        this.root.querySelector('[data-cancel]').addEventListener('click', () => { this.confirmation.hidden = true; });
        this.root.querySelector('[data-confirm]').addEventListener('click', () => {
            if (!this.refreshPlayer() || this.pending || this.confirmation.hidden) return;
            this.pending = { id: crypto.randomUUID(), amount: this.reviewedAmount, confirmed: true };
            this.storePending();
            this.submitPending();
        });
        this.retry.addEventListener('click', () => { if (this.refreshPlayer()) this.submitPending(); });
    }

    refreshPlayer() {
        const id = this.getPlayer()?.id;
        if (id === this.playerID) return Boolean(id);
        this.playerID = id;
        this.ready = false;
        this.review.disabled = true;
        this.confirmation.hidden = true;
        this.pending = null;
        this.root.querySelector('[data-balance]').textContent = 'Loading EP wallet…';
        this.root.querySelector('[data-vip-status]').textContent = 'Loading VIP membership status…';
        try {
            const saved = JSON.parse(sessionStorage.getItem(this.storageKey()) || 'null');
            if (saved && typeof saved.id === 'string' && Number.isSafeInteger(saved.amount) && saved.amount > 0 && saved.confirmed === true) this.pending = saved;
        } catch { /* Wallet balance always comes from the server. */ }
        this.retry.hidden = !this.pending;
        return Boolean(id);
    }

    storageKey() { return `eidolon-ep-exchange:${this.playerID}`; }

    storePending() {
        try {
            if (this.pending) sessionStorage.setItem(this.storageKey(), JSON.stringify(this.pending));
            else sessionStorage.removeItem(this.storageKey());
        } catch { /* The live request still retains its idempotency receipt. */ }
    }

    submitPending() {
        if (!this.pending) return;
        this.confirmation.hidden = true;
        this.review.disabled = true;
        this.retry.hidden = false;
        this.status.textContent = 'Saving exchange… If interrupted, retry this same exchange; it will not charge twice.';
        this.send('exchange_gold_for_ep', this.pending);
    }

    handleResult(result) {
        if (!this.refreshPlayer() || !result) return;
        if (Number.isSafeInteger(result.ep) && result.ep >= 0 && Number.isSafeInteger(result.gold) &&
            result.gold >= 0 && result.goldPerEP === 1000000) {
            this.gold = result.gold;
            this.rate = result.goldPerEP;
            this.ready = true;
            this.root.querySelector('[data-balance]').textContent = `${result.ep.toLocaleString()} EP · ${result.gold.toLocaleString()} Gold`;
        }
        if (this.pending && result.id === this.pending.id && !result.pending) {
            this.pending = null;
            this.storePending();
        }
        this.review.disabled = !this.ready || Boolean(this.pending);
        this.retry.hidden = !this.pending;
        this.status.textContent = result.message || 'Wallet updated.';
    }

    handleVIPStatus(result) {
        this.handleResult(result);
        const until = result?.active ? new Date(result.until) : null;
        const date = until && Number.isFinite(until.getTime()) ? until.toLocaleDateString() : '';
        this.root.querySelector('[data-vip-status]').textContent = result?.success
            ? result.active ? `VIP active${date ? ` until ${date}` : ''} · 100 EP per membership month${result.awardedEP ? ` · ${result.awardedEP} EP just credited` : ''}.`
                : 'No active VIP membership. Existing EP and cosmetic unlocks remain yours.'
            : result?.message || 'VIP status is unavailable. Please refresh.';
    }
}
