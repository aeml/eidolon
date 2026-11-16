// One touch surface for both sides of storage. Rows only inspect; moving an
// item requires an explicit detail action backed by the normal server request.
export class PhoneStashUI {
    constructor(inventory) {
        this.inventory = inventory;
        this.tab = 'inventory';
        this.scroll = { inventory: 0, stash: 0 };
        document.getElementById('phone-stash')?.remove();
        this.root = document.createElement('section'); this.root.id = 'phone-stash';
        this.root.innerHTML = `<div class="phone-stash-tabs" role="tablist" aria-label="Storage location">
            <button type="button" role="tab" data-source="inventory" id="phone-stash-bag-tab" aria-controls="phone-stash-list">Bag</button>
            <button type="button" role="tab" data-source="stash" id="phone-stash-stored-tab" aria-controls="phone-stash-list">Stash</button>
            </div><p class="phone-stash-summary" role="status"></p>
            <div id="phone-stash-list" role="tabpanel" tabindex="0"></div>`;
        inventory.stashScreen.insertBefore(this.root,
            inventory.stashGrid?.parentNode === inventory.stashScreen ? inventory.stashGrid : null);
        this.list = this.root.querySelector('#phone-stash-list');
        this.summary = this.root.querySelector('.phone-stash-summary');
        for (const button of this.root.querySelectorAll('[role="tab"]')) {
            button.onclick = () => this.select(button.dataset.source);
            button.onkeydown = event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const tab = event.key === 'Home' ? 'inventory' : event.key === 'End' ? 'stash' :
                    this.tab === 'inventory' ? 'stash' : 'inventory';
                this.select(tab); this.root.querySelector(`[data-source="${tab}"]`).focus();
            };
        }
    }

    select(tab) {
        this.scroll[this.tab] = this.list.scrollTop;
        this.tab = tab; this.signature = null;
        this.update(this.inventory._getLastPlayer());
        this.list.scrollTop = this.scroll[tab];
    }

    update(player) {
        if (!player) return;
        if (this.player !== player) {
            this.player = player; this.tab = 'inventory';
            this.scroll = { inventory: 0, stash: 0 }; this.signature = null;
        }
        const items = player[this.tab] || [];
        for (const button of this.root.querySelectorAll('[role="tab"]')) {
            const active = button.dataset.source === this.tab;
            button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
            button.textContent = `${button.dataset.source === 'inventory' ? 'Bag' : 'Stash'} (${(player[button.dataset.source] || []).filter(item => item?.id).length})`;
            if (active) this.list.setAttribute('aria-labelledby', button.id);
        }
        const signature = JSON.stringify([this.tab, items]);
        if (signature === this.signature) return;
        this.signature = signature;
        const previousScroll = this.list.scrollTop;
        const focusedId = this.list.contains(document.activeElement) ? document.activeElement?.dataset.itemId : null;
        this.list.replaceChildren();
        const occupied = items.filter(item => item?.id).length;
        this.summary.textContent = this.tab === 'inventory'
            ? `${occupied} / 25 bag slots. Tap an item, then Store in stash. Quest items stay in your bag.`
            : `${occupied} / 100 stash slots. Tap an item, then Withdraw to bag.`;
        for (const [index, item] of items.entries()) {
            if (!item?.id) continue;
            const row = document.createElement('button'); row.type = 'button'; row.className = 'phone-stash-row';
            row.dataset.itemId = item.id;
            const icon = document.createElement('img'); icon.alt = ''; icon.src = this.inventory._getItemIconPath(item);
            const copy = document.createElement('span');
            const name = document.createElement('strong'); name.textContent = item.name || 'Unnamed item';
            const detail = document.createElement('span');
            detail.textContent = `${this.inventory._getItemRarityName(item)} · Level ${item.level || 1} · ${item.stack || 1} item${(item.stack || 1) === 1 ? '' : 's'}`;
            copy.append(name, detail); row.append(icon, copy);
            const source = { type: this.tab, index, itemId: item.id, context: 'stash' };
            row.onclick = () => this.inventory.mobileDetails.open(source, row);
            this.list.append(row);
        }
        if (!occupied) {
            const empty = document.createElement('p'); empty.className = 'phone-stash-empty';
            empty.textContent = this.tab === 'inventory' ? 'Your bag is empty.' : 'Your stash is empty. Select Bag to store an item.';
            this.list.append(empty);
        }
        this.list.scrollTop = previousScroll;
        if (focusedId) {
            const row = [...this.list.querySelectorAll('button')].find(button => button.dataset.itemId === focusedId);
            (row || this.list).focus({ preventScroll: true });
        }
    }
}
