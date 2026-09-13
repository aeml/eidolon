// Presets are server-owned item references. This panel never moves local items
// or applies skill choices until the server confirms an actual swap.
export class EquipmentLoadoutUI {
    constructor({ host, getPlayer, send }) {
        this.getPlayer = getPlayer;
        this.send = send;
        this.profiles = [];
        this.root = document.createElement('details');
        this.root.className = 'equipment-loadouts';
        this.root.innerHTML = `<summary>Saved loadouts</summary>
            <div class="equipment-loadouts-body">
                <p>Save gear, specialization, talents, runes and four skill slots. Switch in town, out of combat. Gear must be equipped or in your bag. Build resets show their Gold cost before you confirm.</p>
                <label>Loadout slot<select aria-label="Loadout slot"><option value="0">1 — Empty</option><option value="1">2 — Empty</option><option value="2">3 — Empty</option></select></label>
                <label>Name<input type="text" maxlength="40" autocomplete="off" placeholder="e.g. Dungeon tank" aria-label="Loadout name"></label>
                <p class="loadout-preview"></p>
                <div class="loadout-actions"><button type="button" data-action="save">Save current gear</button><button type="button" data-action="apply" disabled>Equip loadout</button></div>
                <p class="loadout-status" role="status" aria-live="polite"></p>
            </div>`;
        host?.append(this.root);
        this.select = this.root.querySelector('select');
        this.name = this.root.querySelector('input');
        this.preview = this.root.querySelector('.loadout-preview');
        this.status = this.root.querySelector('.loadout-status');
        this.saveButton = this.root.querySelector('[data-action="save"]');
        this.saveButton.disabled = true;
        this.applyButton = this.root.querySelector('[data-action="apply"]');
        this.root.addEventListener('toggle', () => {
            this.confirmOverwrite = false;
            if (this.root.open) {
                this.refreshPlayer();
                this.loaded = false;
                this.saveButton.disabled = true;
                this.applyButton.disabled = true;
                this.status.textContent = 'Loading saved loadouts…';
                this.send('get_loadouts', {});
            }
        });
        this.select.addEventListener('change', () => this.renderSelection());
        this.name.addEventListener('input', () => {
            this.confirmOverwrite = false;
            this.saveButton.textContent = 'Save current gear';
        });
        this.saveButton.addEventListener('click', () => this.save());
        this.applyButton.addEventListener('click', () => {
            const index = Number(this.select.value);
            if (!this.profiles[index]?.name) return;
            const confirmedGold = this.costs?.[index] || 0;
            if (confirmedGold > 0 && !this.confirmApply) {
                this.confirmApply = true;
                this.applyButton.textContent = `Confirm ${confirmedGold.toLocaleString()} Gold`;
                this.status.textContent = 'This changes your specialization or talent allocation using the normal respec price. No Gold is spent if the swap cannot complete.';
                return;
            }
            this.confirmApply = false;
            this.status.textContent = 'Equipping loadout…';
            this.send('apply_loadout', { index, confirmedGold });
        });
    }

    refreshPlayer() {
        const player = this.getPlayer();
        if (this.player === player) return;
        this.player = player;
        this.loaded = false;
        this.profiles = [];
        this.costs = [];
        this.select.value = '0';
        this.renderOptions();
    }

    renderOptions() {
        [...this.select.options].forEach((option, index) => {
            option.textContent = `${index + 1} — ${this.profiles[index]?.name || 'Empty'}`;
        });
        this.renderSelection();
    }

    renderSelection() {
        const profile = this.profiles[Number(this.select.value)];
        this.confirmOverwrite = false;
        this.confirmApply = false;
        const cost = this.costs?.[Number(this.select.value)] || 0;
        this.applyButton.textContent = cost ? `Equip · ${cost.toLocaleString()} Gold` : 'Equip loadout';
        this.saveButton.textContent = 'Save current gear';
        this.name.value = profile?.name || '';
        this.saveButton.disabled = !this.loaded;
        this.applyButton.disabled = !this.loaded || !profile?.name;
        const skills = profile?.hotbar?.filter(Boolean) || [];
        this.preview.textContent = profile?.name
            ? `${Object.keys(profile.equipment || {}).length} gear slots · ${profile.build ? `Specialization ${profile.build.branch || 'none'} · ${Object.values(profile.build.talentRanks || {}).reduce((sum, rank) => sum + rank, 0)} talent points · ` : ''}${skills.join(', ') || 'Empty skill bar'}`
            : 'Equip your preferred gear and arrange your skill bar, then save here.';
        this.status.textContent = '';
    }

    save() {
        if (!this.loaded) return;
        const player = this.getPlayer();
        const name = this.name.value.trim();
        if (!player || !name) {
            this.status.textContent = 'Give this loadout a name first.';
            this.name.focus();
            return;
        }
        const index = Number(this.select.value);
        if (this.profiles[index]?.name && !this.confirmOverwrite) {
            this.confirmOverwrite = true;
            this.saveButton.textContent = 'Confirm overwrite';
            this.status.textContent = 'Replace this saved set with your current gear, build and skill bar? Click Confirm overwrite to continue.';
            return;
        }
        this.confirmOverwrite = false;
        this.saveButton.textContent = 'Save current gear';
        this.status.textContent = 'Saving loadout…';
        this.send('save_loadout', { index, name, hotbar: Array.from({ length: 4 }, (_, i) => player.hotbar?.[i] || '') });
    }

    handleResult(result) {
        this.refreshPlayer();
        this.loaded = true;
        this.profiles = Array.isArray(result?.profiles) ? result.profiles.slice(0, 3) : [];
        this.costs = Array.isArray(result?.costs) ? result.costs.slice(0, 3) : [];
        this.renderOptions();
        this.status.textContent = result?.message || 'Loadouts ready.';
    }
}
