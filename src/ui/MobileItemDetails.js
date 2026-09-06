import { SET_DEFINITIONS, UNIQUE_EFFECTS } from '../core/ItemSystem.js';

// A touch-first detail route. Item identity is revalidated at every action;
// acknowledgements and inventory mutations remain owned by the game/server.
export class MobileItemDetails {
    constructor(inventory) {
        this.inventory = inventory;
        const previous = document.getElementById('phone-item-details');
        previous?.close?.();
        previous?.remove();
        this.dialog = document.createElement('dialog');
        this.dialog.id = 'phone-item-details';
        this.dialog.setAttribute('aria-labelledby', 'phone-item-title');
        this.dialog.innerHTML = `
            <header class="phone-item-header"><button type="button" id="phone-item-back">Back</button><h2 id="phone-item-title"></h2></header>
            <div class="phone-item-scroll"><div id="phone-item-description"></div><section id="phone-item-comparison" hidden></section></div>
            <footer class="phone-item-footer"><p id="phone-item-status" role="status"></p><div class="phone-item-actions">
                <button type="button" id="phone-item-compare">Compare equipped</button>
                <button type="button" id="phone-item-equip">Equip</button>
                <button type="button" id="phone-item-unequip">Unequip</button>
                <button type="button" id="phone-item-sell">Sell</button>
                <button type="button" id="phone-item-stash">Store in stash</button>
                <button type="button" id="phone-item-drop">Drop stack</button>
            </div></footer>`;
        document.body.append(this.dialog);
        this.get('back').onclick = () => this.close();
        for (const action of ['compare', 'equip', 'unequip', 'sell', 'stash', 'drop']) {
            this.get(action).onclick = () => this.act(action);
        }
        // Escape dismisses this route, not another menu underneath it.
        for (const event of ['keydown', 'keyup']) this.dialog.addEventListener(event, e => e.stopPropagation());
        this.dialog.addEventListener('close', () => {
            this.inventory.selectedSlot = -1;
            this.source = null;
            this.confirmStack = null;
            const origin = this.returnFocus?.isConnected ? this.returnFocus : this.inventory.btnCloseInventory;
            origin?.focus({ preventScroll: true });
        });
    }

    get(id) { return this.dialog.querySelector(`#phone-item-${id}`); }
    close() { if (this.dialog.open) this.dialog.close(); }
    dispose() { this.close(); this.dialog.remove(); }

    currentItem() {
        const player = this.inventory._getLastPlayer();
        const item = this.source?.type === 'equipment'
            ? player?.equipment?.[this.source.slot]
            : player?.inventory?.[this.source?.index];
        return item?.id === this.source?.itemId ? item : null;
    }

    open(source, origin) {
        this.source = source;
        const item = this.currentItem();
        if (!item) return;
        this.returnFocus = origin;
        this.confirmStack = null;
        this.inventory.hideTooltips();
        window.game?.inputManager?.clearInputState?.();
        this.get('title').textContent = item.name || 'Item details';
        this.describe(this.get('description'), item);
        this.get('comparison').hidden = true;
        this.get('comparison').replaceChildren();
        this.get('compare').textContent = 'Compare equipped';
        this.get('status').textContent = item.id.startsWith('chronicle-item-')
            ? 'Quest item — protected from dropping.' : '';
        const bag = source.type === 'inventory';
        const equippable = this.inventory._isEquippableItem(item);
        this.get('equip').hidden = !bag || !equippable;
        this.get('unequip').hidden = bag;
        this.get('compare').hidden = !bag || !equippable;
        this.get('drop').hidden = !bag || item.id.startsWith('chronicle-item-');
        this.get('sell').hidden = !bag || !this.inventory.isShopOpen || item.id.startsWith('chronicle-item-');
        this.get('stash').hidden = !bag || !this.inventory.isStashOpen || item.id.startsWith('chronicle-item-');
        for (const button of this.dialog.querySelectorAll('.phone-item-actions button')) button.disabled = false;
        this.get('equip').disabled = Number(item.level || 0) > this.inventory._getLastPlayer().level;
        if (this.get('equip').disabled && !this.get('equip').hidden) this.get('status').textContent = `Requires level ${item.level}.`;
        this.get('drop').textContent = 'Drop stack';
        this.dialog.querySelector('.phone-item-scroll').scrollTop = 0;
        if (!this.dialog.open) this.dialog.showModal();
        this.get('back').focus({ preventScroll: true });
    }

    describe(container, item) {
        container.replaceChildren();
        const line = (text, className = '') => {
            const p = document.createElement('p'); p.className = className; p.textContent = text; container.append(p);
        };
        const icon = document.createElement('img');
        icon.src = this.inventory._getItemIconPath(item); icon.alt = ''; icon.className = 'phone-item-icon'; container.append(icon);
        line(`${this.inventory._getItemRarityName(item)} · ${this.inventory._formatEquipmentSlotLabel(item.slot)} · Level ${item.level || 1}`, 'phone-item-meta');
        if (item.description) line(item.description);
        if (item.stack > 1) line(`Stack: ${item.stack} / ${item.maxStack || 1000}`);
        if (item.potency > 0) line(`Potency +${item.potency}`);
        for (const key of this.inventory.getOrderedItemStatKeys(item.stats)) {
            line(`${Number(item.stats[key]) >= 0 ? '+' : ''}${item.stats[key]} ${this.inventory._formatStatName(key)}`);
        }
        if (this.inventory._isGemItem(item)) {
            line(`${this.inventory._getGemQualityInfo(item)?.name || item.gemQuality || ''} ${this.inventory._getGemTypeInfo(item)?.name || item.gemType || ''} gem`);
        }
        if (item.sockets) line(`Sockets: ${(item.gems || []).filter(Boolean).length} / ${item.sockets} filled`);
        for (const gem of item.gems || []) {
            if (gem) line(`◆ ${this.inventory._getGemQualityInfo(gem)?.name || gem.quality || ''} ${this.inventory._getGemTypeInfo(gem)?.name || gem.type || ''}`);
        }
        const set = SET_DEFINITIONS[item.setId];
        if (set) {
            const count = Object.values(this.inventory._getLastPlayer()?.equipment || {}).filter(e => e?.setId === item.setId).length;
            line(`${set.name} — ${count}/${set.slots.length} equipped`, 'phone-item-section');
            for (const pieces of [2, 4, 6]) if (set[`bonus${pieces}`]) {
                line(`${pieces} pieces (${count >= pieces ? 'active' : 'inactive'}): ${this.inventory.formatSetBonus(set[`bonus${pieces}`])}`);
            }
        }
        const effect = UNIQUE_EFFECTS[item.uniqueEffect];
        if (effect) { line(effect.name, 'phone-item-section'); line(effect.description); }
    }

    refresh() {
        if (!this.dialog.open || this.currentItem()) return;
        this.get('status').textContent = 'This item or slot changed. Go back and select it again.';
        for (const button of this.dialog.querySelectorAll('.phone-item-actions button')) button.disabled = true;
    }

    act(action) {
        const item = this.currentItem();
        if (!item) { this.refresh(); return; }
        const ui = this.inventory;
        const player = ui._getLastPlayer();
        const bag = this.source.type === 'inventory';
        if (action === 'compare' && bag && ui._isEquippableItem(item)) {
            const comparison = ui._getComparisonTarget(player, item);
            const section = this.get('comparison');
            section.hidden = !section.hidden;
            if (!section.hidden) {
                section.replaceChildren();
                const heading = document.createElement('h3');
                heading.textContent = `${comparison.slotLabel}: ${comparison.equippedItem?.name || 'Empty'}`;
                section.append(heading);
                if (comparison.equippedItem) { const contents = document.createElement('div'); section.append(contents); this.describe(contents, comparison.equippedItem); }
                section.scrollIntoView?.({ block: 'start' });
            }
            this.get('compare').textContent = section.hidden ? 'Compare equipped' : 'Hide comparison';
            return;
        }
        if (action === 'drop' && bag && !item.id.startsWith('chronicle-item-')) {
            const stack = item.stack || 1;
            if (this.confirmStack !== stack) {
                this.get('status').textContent = `${this.confirmStack !== null ? 'Stack changed. ' : ''}Drop ${stack} × ${item.name}? Ground loot expires after one minute. Back cancels.`;
                this.confirmStack = stack;
                this.get('drop').textContent = 'Confirm drop';
                return;
            }
            if (!window.game?.dropInventoryItem(this.source.index, item.id)) {
                this.get('status').textContent = 'Cannot drop now. Check your connection and try again.';
                return;
            }
        } else if (action === 'equip' && bag && ui._isEquippableItem(item) && player.level >= Number(item.level || 0)) {
            if (!player.isMultiplayer) player.inventory[this.source.index] = null;
            if (!player.equipItem(item)) {
                if (!player.isMultiplayer) player.inventory[this.source.index] = item;
                this.get('status').textContent = 'This item cannot be equipped right now.';
                return;
            }
            ui.updateInventory(player); ui._updateCharacterSheet(player);
        } else if (action === 'unequip' && !bag && ui.onUnequipRequest) ui.onUnequipRequest(this.source.slot);
        else if (action === 'sell' && bag && ui.isShopOpen && !item.id.startsWith('chronicle-item-')) ui.sellItem(player, this.source.index);
        else if (action === 'stash' && bag && ui.isStashOpen && !item.id.startsWith('chronicle-item-') && ui.onStashDeposit) ui.onStashDeposit(item.id);
        else return;
        this.close();
    }
}
