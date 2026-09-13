import { EQUIPMENT_SLOT_KEYS, itemFitsEquipmentSlot } from '../core/EquipmentSlots.js';

export class WardrobeUI {
    constructor({ host, getPlayer, send }) {
        this.getPlayer = getPlayer;
        this.send = send;
        this.collection = {};
        this.root = document.createElement('details');
        this.root.className = 'equipment-loadouts wardrobe-panel';
        this.root.innerHTML = `<summary>Wardrobe</summary><div class="equipment-loadouts-body">
            <p>Keep the looks you discover. Learn styles and rarity colours from gear in your bag, stash and equipment. Items are not consumed, and combat stats never change.</p>
            <button type="button" data-action="learn">Learn owned looks</button>
            <label>Equipment slot<select aria-label="Appearance slot"></select></label>
            <label>Collected look<select aria-label="Collected appearance"></select></label>
            <button type="button" data-action="apply" disabled>Apply appearance</button>
            <p role="status" aria-live="polite">Customize in town, out of combat. Choose Original gear to reset a slot.</p>
        </div>`;
        host?.prepend(this.root);
        [this.slot, this.look] = this.root.querySelectorAll('select');
        this.status = this.root.querySelector('[role="status"]');
        this.apply = this.root.querySelector('[data-action="apply"]');
        this.learn = this.root.querySelector('[data-action="learn"]');
        for (const slot of EQUIPMENT_SLOT_KEYS) {
            const option = document.createElement('option');
            option.value = slot;
            option.textContent = slot.replace(/([A-Z])/g, ' $1').replace(/(\d)/g, ' $1').replace(/^./, c => c.toUpperCase());
            this.slot.append(option);
        }
        this.root.addEventListener('toggle', () => {
            if (!this.root.open) return;
            this.refreshPlayer();
            this.apply.disabled = true;
            this.status.textContent = 'Loading your wardrobe…';
            this.send('get_wardrobe', {});
        });
        this.slot.addEventListener('change', () => this.renderLooks());
        this.learn.addEventListener('click', () => {
            this.status.textContent = 'Learning owned looks…';
            this.send('collect_appearances', {});
        });
        this.apply.addEventListener('click', () => {
            this.status.textContent = 'Applying appearance…';
            this.send('select_appearance', { slot: this.slot.value, key: this.look.value });
        });
        this.renderLooks();
    }

    refreshPlayer() {
        const player = this.getPlayer();
        if (player === this.player) return;
        this.player = player;
        this.collection = {};
        this.apply.disabled = true;
        this.root.querySelector('summary').textContent = 'Wardrobe';
        this.renderLooks();
    }

    renderLooks() {
        this.look.replaceChildren();
        const original = document.createElement('option');
        original.value = '';
        original.textContent = 'Original gear';
        this.look.append(original);
        const entries = Object.entries(this.collection).filter(([, look]) => itemFitsEquipmentSlot({ slot: look.slot, type: 'ARMOR' }, this.slot.value));
        entries.sort((a, b) => a[0].localeCompare(b[0]));
        for (const [key, look] of entries) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = `${look.baseName} · ${look.rarity}`;
            this.look.append(option);
        }
        const selected = this.getPlayer()?.appearances?.[this.slot.value];
        const key = selected ? `${selected.baseName}|${selected.rarity}` : '';
        this.look.value = entries.some(([id]) => id === key) ? key : '';
    }

    handleResult(result) {
        this.refreshPlayer();
        this.collection = result?.collection || {};
        const count = Object.keys(this.collection).length;
        this.root.querySelector('summary').textContent = `Wardrobe · ${count} ${count === 1 ? 'look' : 'looks'}`;
        this.apply.disabled = false;
        this.renderLooks();
        this.status.textContent = result?.message || 'Wardrobe ready.';
    }
}
