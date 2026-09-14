import { CharacterPreview } from './CharacterPreview.js';
import { isActiveEquipment } from '../core/EquipmentSlots.js';

const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
};

export class CosmeticVendorUI {
    constructor({ getPlayer, send, createPreview = host => new CharacterPreview(host) }) {
        this.getPlayer = getPlayer; this.send = send; this.createPreview = createPreview;
        this.catalogue = []; this.collection = {};
        this.root = node('dialog', '', 'casino-entry-dialogue cosmetic-vendor');
        this.root.setAttribute('aria-label', 'Veyra’s cosmetic wardrobe');
        const header = node('header');
        header.append(node('h2', 'Veyra · VIP Outfitter'), this.button('Close', () => this.close()));
        this.balance = node('p');
        const intro = node('p', 'Permanent appearance unlocks only. No stats, no sellable items, no Gold resale. VIP membership is not required.');
        const body = node('div', '', 'cosmetic-vendor-body');
        this.list = node('div', '', 'cosmetic-catalogue');
        this.list.setAttribute('aria-label', 'Cosmetic collection');
        const details = node('section', '', 'cosmetic-detail');
        this.title = node('h3'); this.description = node('p');
        this.previewHost = node('div', '', 'character-preview cosmetic-preview');
        this.previewHost.innerHTML = `<div class="character-preview-label"></div><div class="character-preview-stage"><span class="character-preview-status" role="status">Select a look to preview.</span></div><div class="character-preview-controls"><button type="button" data-preview-turn="-0.785398" aria-label="Rotate preview left">↶</button><button type="button" data-preview-turn="reset">Front</button><button type="button" data-preview-turn="0.785398" aria-label="Rotate preview right">↷</button></div>`;
        this.compare = this.button('Show equipped look', () => { this.showOriginal = !this.showOriginal; this.renderPreview(); });
        this.buy = this.button('Unlock cosmetic', () => this.reviewPurchase());
        this.apply = this.button('Apply owned look', () => {
            if (!this.selected || this.apply.disabled) return;
            this.status.textContent = 'Applying your owned appearance…';
            this.send('select_appearance', { slot: this.selected.appearance.slot, key: this.lookKey(this.selected) });
        });
        this.confirmation = node('div', '', 'cosmetic-confirmation'); this.confirmation.hidden = true;
        this.cost = node('p');
        this.confirmation.append(this.cost, this.button('Confirm EP purchase', () => this.confirmPurchase()),
            this.button('Cancel', () => { this.confirmation.hidden = true; }));
        this.retry = this.button('Retry pending unlock', () => {
            if (this.pendingID) this.send('buy_cosmetic', { id: this.pendingID, priceEP: this.pendingPrice, confirmed: true });
        }); this.retry.hidden = true;
        this.status = node('p', '', 'cosmetic-status'); this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
        details.append(this.title, this.description, this.previewHost, this.compare, this.buy, this.apply, this.confirmation, this.retry);
        body.append(this.list, details);
        this.root.append(header, this.balance, intro, body, this.status);
        document.body.append(this.root);
        this.root.addEventListener('keydown', event => event.stopPropagation());
        this.root.addEventListener('close', () => { this.preview?.dispose(); this.preview = null; });
    }

    button(text, handler) { const button = node('button', text); button.type = 'button'; button.onclick = handler; return button; }
    lookKey(offer) { return `${offer.appearance.baseName}|${offer.appearance.rarity}`; }

    open() {
        const player = this.getPlayer();
        if (!player?.id) return false;
        if (this.playerID !== player.id) { this.pendingID = null; this.selected = null; }
        this.playerID = player.id;
        this.confirmation.hidden = true;
        this.list.replaceChildren(); this.buy.disabled = true; this.apply.disabled = true;
        this.status.textContent = 'Opening Veyra’s wardrobe…';
        if (!this.root.open) this.root.showModal();
        this.send('get_cosmetic_vendor', {});
        return true;
    }

    close() { if (this.root.open) this.root.close(); }

    refreshPlayer() {
        if (!this.root.open) return;
        const player = this.getPlayer(), p = player?.position;
        if (player?.id !== this.playerID || player?.state === 'DEAD' || player?.instanceId ||
            (p && (!Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.hypot(p.x - 12, p.z - 185) > 7))) this.close();
    }

    handleResult(result) {
        if (this.getPlayer()?.id !== this.playerID) { this.close(); return; }
        this.catalogue = Array.isArray(result?.catalogue) ? result.catalogue : [];
        this.collection = result?.collection || {};
        this.ep = Number.isSafeInteger(result?.ep) ? result.ep : 0;
        this.balance.textContent = `${this.ep.toLocaleString()} EP · Permanent cosmetic unlocks`;
        if (result?.id === this.pendingID && !result.pending) this.pendingID = null;
        this.retry.hidden = !this.pendingID;
        this.status.textContent = result?.message || 'Choose a look to preview.';
        this.list.replaceChildren();
        for (const offer of this.catalogue) {
            const owned = Boolean(this.collection[this.lookKey(offer)]);
            const button = this.button(`${offer.name} · ${owned ? 'Owned' : `${offer.priceEP} EP`}`, () => this.select(offer));
            button.dataset.offerId = offer.id;
            const swatch = node('span', offer.realm, 'cosmetic-swatch');
            swatch.style.borderColor = `#${Number(offer.primary).toString(16).padStart(6, '0')}`;
            button.prepend(swatch); this.list.append(button);
        }
        this.select(this.catalogue.find(offer => offer.id === this.selected?.id) || this.catalogue[0]);
        if (!result?.success) this.buy.disabled = true;
    }

    select(offer) {
        this.selected = offer; this.showOriginal = false; this.confirmation.hidden = true;
        if (!offer) { this.buy.disabled = true; this.apply.disabled = true; return; }
        this.title.textContent = offer.name;
        this.description.textContent = offer.description;
        this.list.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.offerId === offer.id)));
        const owned = Boolean(this.collection[this.lookKey(offer)]);
        this.buy.textContent = owned ? 'Already owned' : `Unlock for ${offer.priceEP} EP`;
        this.buy.disabled = owned || Boolean(this.pendingID) || this.ep < offer.priceEP;
        const item = this.getPlayer()?.equipment?.[offer.appearance.slot];
        this.apply.disabled = !owned || Boolean(this.pendingID) || !item?.id || !isActiveEquipment(offer.appearance.slot, item);
        this.apply.textContent = owned && !item?.id ? 'Equip gear in this slot to apply' : 'Apply owned look';
        this.renderPreview();
    }

    renderPreview() {
        if (!this.root.open || !this.selected) return;
        this.preview ||= this.createPreview(this.previewHost);
        const player = this.getPlayer(), look = this.selected.appearance, slot = look.slot;
        // Preview-only data, never placed in a bag or sent as a combat item.
        const model = this.showOriginal ? player : {
            ...player,
            equipment: { ...player.equipment, [slot]: { ...player.equipment?.[slot], id: 'cosmetic-preview', slot,
                type: ['mainHand', 'offHand'].includes(slot) ? 'WEAPON' : 'ARMOR', name: this.selected.base, rarity: 'Common' } },
            appearances: { ...player.appearances, [slot]: look }
        };
        this.preview.update(model);
        this.compare.textContent = this.showOriginal ? 'Show selected cosmetic' : 'Show equipped look';
    }

    reviewPurchase() {
        if (!this.selected || this.buy.disabled) return;
        this.cost.textContent = `Permanently unlock ${this.selected.name} for ${this.selected.priceEP} EP? This grants an appearance only, with no Gold resale or stat bonuses.`;
        this.confirmation.hidden = false;
    }

    confirmPurchase() {
        if (this.confirmation.hidden || this.buy.disabled || !this.selected || this.getPlayer()?.id !== this.playerID) return;
        this.pendingID = this.selected.id; this.confirmation.hidden = true;
        this.pendingPrice = this.selected.priceEP;
        this.buy.disabled = true; this.retry.hidden = false;
        this.status.textContent = 'Saving your cosmetic unlock…';
        this.send('buy_cosmetic', { id: this.pendingID, priceEP: this.pendingPrice, confirmed: true });
    }

    handleAppearanceResult(result) { if (this.root.open) { this.status.textContent = result?.message || 'Appearance updated.'; this.renderPreview(); } }
    dispose() { this.close(); this.preview?.dispose(); this.root.remove(); }
}
