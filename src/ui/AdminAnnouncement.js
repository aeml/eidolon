// Public messages only. Server role, audit, bounds and queue gates are authoritative.
export class AdminAnnouncement {
    constructor(host, submit) {
        this.submit = submit;
        this.root = document.createElement('details');
        this.root.className = 'administration-announcements';
        this.root.innerHTML = `<summary>Maintenance and incident notices</summary>
            <p>Send public server chat to connected players in every area. This does not stop the game or send email.</p>
            <form class="administration-operation-form"><fieldset disabled><legend>Prepare a public notice</legend>
                <label>Notice<select name="kind"><option value="maintenance">Maintenance</option>
                    <option value="incident">Incident update</option><option value="recovery">Recovery</option></select></label>
                <label>Public message<textarea name="message" required maxlength="220" rows="3"></textarea></label>
                <label>Next update (UTC; optional for recovery)<input name="nextUpdateAt" type="datetime-local" step="60"></label>
                <div class="administration-actions"><button type="submit">Review notice</button></div>
            </fieldset></form>
            <section data-review hidden aria-label="Review public notice"><p data-copy></p>
                <p>Check the public text and UTC time. Do not include private account, security or connection details.</p>
                <div class="administration-actions"><button type="button" data-confirm>Send this notice</button>
                <button type="button" data-cancel>Cancel</button></div></section>
            <p role="status" aria-live="polite"></p>`;
        host.append(this.root);
        this.form = this.root.querySelector('form');
        this.fields = this.root.querySelector('fieldset');
        this.review = this.root.querySelector('[data-review]');
        this.copy = this.root.querySelector('[data-copy]');
        this.confirm = this.root.querySelector('[data-confirm]');
        this.cancel = this.root.querySelector('[data-cancel]');
        this.status = this.root.querySelector('[role="status"]');
        this.form.onsubmit = event => { event.preventDefault(); this.prepare(); };
        this.form.oninput = () => { this.draft = null; this.review.hidden = true; };
        this.cancel.onclick = () => { this.draft = null; this.review.hidden = true; };
        this.confirm.onclick = () => {
            if (!this.authorized || this.busy || !this.draft) return;
            this.submittedID = this.draft.id;
            const { id, ...payload } = this.draft;
            this.draft = null; this.review.hidden = true;
            this.status.textContent = 'Awaiting acknowledgement. Do not resend an unconfirmed notice.';
            this.submit('admin_announcement', { ...payload, confirmed: true }, id);
        };
        this.setState({ authorized: false, busy: false });
    }

    setState({ authorized, busy }) {
        this.authorized = authorized === true; this.busy = busy === true;
        this.fields.disabled = this.confirm.disabled = this.cancel.disabled = !this.authorized || this.busy;
        if (!this.authorized) {
            this.draft = null; this.submittedID = null; this.review.hidden = true;
            this.copy.textContent = ''; this.form.reset(); this.status.textContent = '';
        }
    }

    prepare() {
        if (!this.authorized || this.busy) return;
        const kind = this.form.elements.kind.value;
        const message = this.form.elements.message.value.trim();
        const input = this.form.elements.nextUpdateAt.value;
        const stamp = input ? Date.parse(`${input}Z`) : NaN;
        const nextUpdateAt = Number.isFinite(stamp) ? new Date(stamp).toISOString() : '';
        const hasControl = Array.from(message).some(character => character.codePointAt(0) < 32 || (character.codePointAt(0) >= 127 && character.codePointAt(0) <= 159));
        if (!message || new TextEncoder().encode(message).length > 220 || hasControl
            || (input && !Number.isFinite(stamp)) || (kind !== 'recovery' && !nextUpdateAt)
            || (nextUpdateAt && (stamp <= Date.now() || stamp > Date.now() + 86400000))) {
            this.status.textContent = 'Use plain text up to 220 UTF-8 bytes and a future UTC update time within 24 hours (optional for recovery).';
            this.draft = null; this.review.hidden = true; return;
        }
        this.draft = { id: crypto.randomUUID(), kind, message, nextUpdateAt };
        this.copy.textContent = `[${kind}] ${message}${nextUpdateAt ? ` Next update: ${nextUpdateAt} (UTC).` : ''}`;
        this.review.hidden = false; this.status.textContent = 'Review only—nothing has been sent.';
        this.cancel.focus();
    }

    handleResult(result) {
        if (result?.id !== this.submittedID) return;
        this.submittedID = null;
        this.status.textContent = result.message || 'Outcome unconfirmed. Check server chat and activity history before sending a new notice.';
    }
}
