// Presentation only: the server independently verifies role, exact target,
// confirmation, bounds and durable idempotency for every request.
export class AdminOperations {
    constructor(host, submit) {
        this.submit = submit;
        this.root = document.createElement('details');
        this.root.className = 'administration-operations';
        this.root.innerHTML = `<summary>Character operations</summary>
            <p>Every change is saved and audited. Choose an exact account and provide a reason.</p>
            <form class="administration-operation-form">
                <fieldset data-fields disabled><legend>Prepare a change</legend>
                    <label>Target account<input name="target" required maxlength="256" autocomplete="off"></label>
                    <div class="administration-actions"><button type="button" data-self>Use my account</button></div>
                    <label>Operation<select name="operation">
                        <option value="gold">Grant Gold</option><option value="item">Create item</option>
                        <option value="to-player">Teleport me to this player</option>
                        <option value="bring-player">Bring this player to me</option>
                        <option value="town">Send this character to town</option>
                    </select></label>
                    <div data-gold><label>Gold amount<input name="amount" type="number" required min="1" max="100000000" step="1" value="100"></label></div>
                    <fieldset data-item hidden disabled><legend>Canonical item</legend>
                        <label>Item<select name="item" required></select></label>
                        <label>Rarity<select name="rarity"><option>Common</option><option>Uncommon</option><option>Rare</option><option>Legendary</option></select></label>
                        <label>Level<input name="level" type="number" required min="1" max="100" step="1" value="1"></label>
                        <label>Quantity<input name="quantity" type="number" required min="1" max="25" step="1" value="1"></label>
                    </fieldset>
                    <p data-teleport hidden>Both characters must be online and available. Private-instance and VIP-floor entry rules still apply; the server finds a clear landing.</p>
                    <label>Reason<textarea name="reason" required maxlength="160" rows="2" placeholder="Why is this change needed?"></textarea></label>
                    <div class="administration-actions"><button type="submit">Review change</button></div>
                </fieldset>
            </form>
            <section data-review hidden aria-label="Confirm administration change">
                <p data-summary></p><p>This changes the selected character. Confirm only after checking the account, amount and reason.</p>
                <div class="administration-actions"><button type="button" data-confirm>Confirm change</button>
                    <button type="button" data-cancel>Cancel</button></div>
            </section>
            <div class="administration-actions"><button type="button" data-retry hidden>Check / retry the same operation</button></div>
            <p data-result role="status" aria-live="polite"></p>`;
        host.append(this.root);
        this.form = this.root.querySelector('form');
        this.fields = this.root.querySelector('[data-fields]');
        this.review = this.root.querySelector('[data-review]');
        this.summary = this.root.querySelector('[data-summary]');
        this.confirm = this.root.querySelector('[data-confirm]');
        this.cancel = this.root.querySelector('[data-cancel]');
        this.retry = this.root.querySelector('[data-retry]');
        this.result = this.root.querySelector('[data-result]');
        this.input = Object.fromEntries(['target', 'operation', 'amount', 'item', 'rarity', 'level', 'quantity', 'reason']
            .map(name => [name, this.form.elements.namedItem(name)]));
        this.root.querySelector('[data-self]').addEventListener('click', () => this.selectAccount(this.account));
        this.input.operation.addEventListener('change', () => this.updateFields());
        this.input.item.addEventListener('change', () => this.updateFields());
        this.form.addEventListener('submit', event => { event.preventDefault(); this.prepare(); });
        this.cancel.addEventListener('click', () => {
            this.preview = null; this.update(); this.input.target.focus();
        });
        this.confirm.addEventListener('click', () => {
            if (!this.ready() || !this.preview || this.operation) return;
            this.operation = { ...this.preview, id: crypto.randomUUID(), account: this.account };
            this.preview = null;
            this.sendOperation();
        });
        this.retry.addEventListener('click', () => this.sendOperation());
        this.updateFields();
        this.update();
    }

    ready() { return this.authorized && !this.busy && Boolean(this.account); }

    setState({ authorized, busy, account, items }) {
        this.authorized = authorized;
        this.busy = busy;
        if (typeof account === 'string' && account !== this.account) {
            // Never replay a departed administrator's request under another account.
            this.account = account;
            this.operation = this.preview = null;
            this.input.target.value = account;
            this.input.reason.value = '';
            this.result.textContent = '';
        }
        if (Array.isArray(items)) {
            const previous = this.input.item.value;
            this.items = items;
            this.input.item.replaceChildren(...items.map(item => {
                const option = document.createElement('option');
                option.value = item.id; option.textContent = item.name;
                return option;
            }));
            if (items.some(item => item.id === previous)) this.input.item.value = previous;
            this.updateFields();
        }
        if (!authorized) this.preview = null;
        this.update();
    }

    updateFields() {
        const item = this.input.operation.value === 'item';
        const gold = this.input.operation.value === 'gold';
        this.root.querySelector('[data-gold]').hidden = !gold;
        this.input.amount.disabled = !gold;
        const itemFields = this.root.querySelector('[data-item]');
        itemFields.hidden = !item; itemFields.disabled = !item;
        this.root.querySelector('[data-teleport]').hidden = gold || item;
        const material = this.items?.find(entry => entry.id === this.input.item.value)?.material === true;
        const rarities = material ? ['Eidolic'] : ['Common', 'Uncommon', 'Rare', 'Legendary'];
        if (!rarities.includes(this.input.rarity.value) || this.input.rarity.options.length !== rarities.length) {
            this.input.rarity.replaceChildren(...rarities.map(value => {
                const option = document.createElement('option'); option.value = value; option.textContent = value; return option;
            }));
        }
        this.input.level.max = material ? '1' : '100';
        if (material) this.input.level.value = '1';
        this.input.quantity.max = material ? '1000' : '25';
    }

    update() {
        this.root.hidden = !this.authorized;
        this.fields.disabled = !this.ready() || Boolean(this.operation || this.preview);
        this.review.hidden = !this.preview;
        this.confirm.disabled = this.cancel.disabled = !this.ready();
        this.retry.hidden = !this.operation;
        this.retry.disabled = !this.ready();
    }

    selectAccount(account) {
        if (!this.ready() || this.operation || this.preview || !account) return;
        this.input.target.value = account;
        this.root.open = true;
        this.input.operation.focus();
    }

    prepare() {
        if (!this.ready() || this.operation || this.preview || !this.form.reportValidity()) return;
        const target = this.input.target.value;
        const reason = this.input.reason.value;
        if (!target.trim() || !reason.trim()) {
            this.result.textContent = 'An exact account and a reason are required.'; return;
        }
        const payload = { target, reason, confirmed: true };
        let type, change;
        switch (this.input.operation.value) {
        case 'gold':
            type = 'admin_grant_gold'; payload.amount = Number(this.input.amount.value);
            change = `Grant ${payload.amount.toLocaleString()} Gold to ${target}`;
            break;
        case 'item':
            type = 'admin_grant_item';
            Object.assign(payload, { item: this.input.item.value, rarity: this.input.rarity.value,
                level: Number(this.input.level.value), quantity: Number(this.input.quantity.value) });
            change = `Create ${payload.quantity} × ${this.input.item.selectedOptions[0]?.textContent} (${payload.rarity}, level ${payload.level}) for ${target}`;
            break;
        case 'to-player':
            type = 'admin_teleport'; Object.assign(payload, { target: this.account, destination: 'player', destinationPlayer: target });
            change = `Teleport ${this.account} beside ${target}`;
            break;
        case 'bring-player':
            type = 'admin_teleport'; Object.assign(payload, { destination: 'player', destinationPlayer: this.account });
            change = `Teleport ${target} beside ${this.account}`;
            break;
        case 'town':
            type = 'admin_teleport'; payload.destination = 'town'; change = `Teleport ${target} to town`;
            break;
        default: return;
        }
        if (payload.destination === 'player' && payload.target === payload.destinationPlayer) {
            this.result.textContent = 'Choose another online player, or send your character to town.'; return;
        }
        this.preview = { type, payload, summary: `${change}. Reason: ${reason}` };
        this.summary.textContent = this.preview.summary;
        this.result.textContent = '';
        this.update(); this.confirm.focus();
    }

    sendOperation() {
        if (!this.ready() || !this.operation || this.operation.account !== this.account) return;
        this.result.textContent = `${this.operation.summary} Awaiting the server’s saved result…`;
        // The same payload AND request ID survive timeout/reconnect retries.
        this.submit(this.operation.type, this.operation.payload, this.operation.id);
    }

    handleResult(result) {
        if (result.id !== this.operation?.id) return;
        const summary = this.operation.summary;
        if (result.final === true) this.operation = null;
        this.result.textContent = `${result.message || 'No final result received.'} ${result.final === true ? '' : 'Keep this request; check it again after access is available.'} ${summary}`;
        this.update();
    }
}
