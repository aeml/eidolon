import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';
import { EQUIPMENT_SLOT_KEYS, itemFitsEquipmentSlot } from '../core/EquipmentSlots.js';

export class WardrobeUI {
    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.ready = false;
        disposeOwnedEvents(this); this.root.remove();
    }

    constructor({ host, getPlayer, send }) {
        this.getPlayer = getPlayer;
        this.send = send;
        this.disposed = false;
        this.ready = false;
        this.collection = {};
        this.root = document.createElement('details');
        this.root.className = 'equipment-loadouts wardrobe-panel';
        this.root.innerHTML = `<summary>Wardrobe</summary><div class="equipment-loadouts-body">
            <p>Keep the looks you discover. Learn styles and rarity colours from gear in your bag, stash and equipment, and claim medallions from settled arena seasons. Current projections are not earned looks. Items are not consumed, and combat stats never change.</p>
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
        ownedEvent(this, this.root, 'toggle', () => {
            if (this.disposed || !this.root.open) return;
            this.refreshPlayer();
            if (!this.playerID) return;
            this.setReady(false);
            this.status.textContent = 'Loading your wardrobe…';
            this.send('get_wardrobe', {});
        });
        ownedEvent(this, this.slot, 'change', () => { if (this.canAct()) this.renderLooks(); });
        ownedEvent(this, this.learn, 'click', () => {
            if (!this.canAct()) return;
            this.setReady(false);
            this.status.textContent = 'Learning owned looks and checking settled season rewards…';
            this.send('collect_appearances', {});
        });
        ownedEvent(this, this.apply, 'click', () => {
            if (!this.canAct() || this.apply.disabled) return;
            this.setReady(false);
            this.status.textContent = 'Applying appearance…';
            this.send('select_appearance', { slot: this.slot.value, key: this.look.value });
        });
        this.refreshPlayer();
        this.setReady(false);
    }

    canAct() { return !this.disposed && this.root.open && this.ready && Boolean(this.playerID) && this.getPlayer()?.id === this.playerID; }

    setReady(ready) { this.ready = ready; this.apply.disabled = !ready; this.learn.disabled = !ready; }

    refreshPlayer() {
        if (this.disposed) return;
        const player = this.getPlayer();
        if (player?.id === this.playerID) return;
        this.playerID = player?.id;
        this.collection = {};
        this.setReady(false);
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
        if (this.disposed) return false;
        this.refreshPlayer();
        if (!this.playerID || result?.playerID !== this.playerID || typeof result.success !== 'boolean' ||
            !Object.hasOwn(result, 'collection') || (result.collection !== null && typeof result.collection !== 'object') ||
            Array.isArray(result.collection)) return false;
        // An untouched character's nil Go map is legitimately encoded as null.
        this.collection = result.collection || {};
        const count = Object.keys(this.collection).length;
        this.root.querySelector('summary').textContent = `Wardrobe · ${count} ${count === 1 ? 'look' : 'looks'}`;
        this.setReady(true);
        this.renderLooks();
        this.status.textContent = result?.message || 'Wardrobe ready.';
        return true;
    }
}
