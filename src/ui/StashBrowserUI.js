import { isEquippableItem } from '../core/EquipmentSlots.js';

// Presentation-only storage browser. Filtered rows keep original slot indices;
// both explicit actions and shortcuts use the existing authoritative requests.
export class StashBrowserUI {
    constructor(inventory) {
        this.inventory = inventory;
        document.getElementById('stash-browser')?.remove();
        this.root = document.createElement('section'); this.root.id = 'stash-browser';
        this.root.innerHTML = `<div class="stash-browser-tools">
            <label>Find an item<input type="search" placeholder="Name, rarity or slot" maxlength="100"></label>
            <label>Show<select><option value="all">All items</option><option value="gear">Equipment</option>
                <option value="gems">Gems</option><option value="other">Other items</option></select></label>
            </div><p class="stash-browser-help">Click to inspect. Right-click to transfer. Quest items stay in your bag.</p>
            <div class="stash-browser-columns"></div>`;
        this.search = this.root.querySelector('input'); this.filter = this.root.querySelector('select');
        this.panes = {};
        for (const [source, title, capacity] of [['inventory', 'Bag', 25], ['stash', 'Stash', 100]]) {
            const pane = document.createElement('section'); pane.className = 'stash-browser-pane';
            pane.innerHTML = `<h3 id="stash-browser-${source}-title">${title}<span role="status"></span></h3>
                <div class="stash-browser-list" tabindex="0" aria-labelledby="stash-browser-${source}-title"></div>`;
            this.panes[source] = { list: pane.querySelector('.stash-browser-list'), count: pane.querySelector('[role="status"]'), capacity };
            this.root.querySelector('.stash-browser-columns').append(pane);
        }
        const changed = () => { this.signature = null; this.update(inventory._getLastPlayer());
            for (const pane of Object.values(this.panes)) pane.list.scrollTop = 0; };
        this.search.oninput = changed; this.filter.onchange = changed;
        inventory.stashScreen.classList.add('stash-browser-window');
        inventory.stashScreen.append(this.root);
    }

    focusTarget(source, id) {
        const list = this.panes[source]?.list;
        return [...(list?.querySelectorAll('button') || [])].find(row => row.dataset.itemId === id) || list;
    }

    update(player) {
        if (!player || !this.inventory.isStashOpen) return;
        if (this.player !== player) {
            this.player = player; this.search.value = ''; this.filter.value = 'all'; this.signature = null;
        }
        const query = this.search.value.trim().toLocaleLowerCase(), filter = this.filter.value;
        const signature = JSON.stringify([query, filter, player.inventory, player.stash]);
        if (signature === this.signature) return;
        this.signature = signature;
        for (const [source, pane] of Object.entries(this.panes)) {
            const scroll = pane.list.scrollTop;
            const focusId = pane.list.contains(document.activeElement) ? document.activeElement.dataset.itemId : null;
            const items = (player[source] || []).map((item, index) => ({ item, index })).filter(({ item }) => item?.id);
            pane.count.textContent = `${items.length} / ${pane.capacity}`;
            pane.count.classList.toggle('full', items.length >= pane.capacity);
            pane.list.replaceChildren();
            let shown = 0;
            for (const { item, index } of items) {
                const rarity = this.inventory._getItemRarityName(item);
                const category = isEquippableItem(item) ? 'gear' : String(item.type).toUpperCase() === 'GEM' ? 'gems' : 'other';
                const text = `${item.name || ''} ${rarity} ${item.slot || ''}`.toLocaleLowerCase();
                if ((filter !== 'all' && category !== filter) || (query && !text.includes(query))) continue;
                shown++;
                const row = document.createElement('button'); row.type = 'button'; row.className = 'stash-browser-item';
                row.dataset.itemId = item.id; row.dataset.source = source; row.dataset.slotIndex = index;
                row.style.setProperty('--stash-rarity', this.inventory._getRarityColor(item.rarity));
                const icon = document.createElement('img'); icon.alt = ''; icon.src = this.inventory._getItemIconPath(item);
                const copy = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('span');
                name.textContent = item.name || 'Unnamed item';
                detail.textContent = `${rarity} · Level ${item.level || 1} · ${item.stack || 1} item${(item.stack || 1) === 1 ? '' : 's'}`;
                copy.append(name, detail); row.append(icon, copy);
                row.onclick = () => this.inventory.mobileDetails.open({ type: source, index, itemId: item.id, context: 'stash' }, row);
                row.oncontextmenu = event => {
                    event.preventDefault(); event.stopPropagation();
                    const current = this.inventory._getLastPlayer()?.[source]?.[index];
                    if (!this.inventory.isStashOpen || current?.id !== item.id) return;
                    if (source === 'stash') this.inventory.onStashWithdraw?.(item.id);
                    else if (!item.id.startsWith('chronicle-item-')) this.inventory.onStashDeposit?.(item.id);
                };
                pane.list.append(row);
            }
            if (!shown) {
                const empty = document.createElement('p'); empty.className = 'stash-browser-empty';
                empty.textContent = items.length ? 'No matching items. Try another search or filter.'
                    : source === 'inventory' ? 'Your bag is empty.' : 'Your stash is empty. Choose an item from your bag to store it.';
                pane.list.append(empty);
            }
            pane.list.scrollTop = scroll;
            if (focusId) this.focusTarget(source, focusId)?.focus({ preventScroll: true });
        }
    }
}
