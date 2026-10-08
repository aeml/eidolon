// Prepared beta tooling only; server configuration/role/audit gates own issuance.
export class AdminBetaInvitation {
    constructor(host, submit) {
        this.submit = submit;
        this.root = document.createElement('details');
        this.root.className = 'administration-announcements administration-invitations';
        this.root.innerHTML = `<summary>Beta invitations (preparation)</summary>
            <p>Does not activate closed beta or create accounts. Share a code privately; never post it in chat or reports.</p>
            <form><fieldset disabled><legend>Prepare an account-bound invitation</legend>
                <label>Exact new username<input name="username" maxlength="128" required autocomplete="off"></label>
                <label>Exact registration email (optional)<input name="email" maxlength="320" autocomplete="off"></label>
                <label>Expiry (UTC; within seven days)<input name="expiresAt" type="datetime-local" required step="60"></label>
                <div class="administration-actions"><button type="submit">Review invitation</button></div></fieldset></form>
            <section data-review hidden><p data-copy></p><p>No automatic email. This does not verify a mailbox.</p>
                <div class="administration-actions"><button type="button" data-confirm>Prepare this invitation</button><button type="button" data-cancel>Cancel</button></div></section>
            <div data-proof hidden><label>Private invitation code<input type="password" readonly autocomplete="off" spellcheck="false" aria-label="Private invitation code"></label>
                <div class="administration-actions"><button type="button" data-copy-code>Copy invitation code</button></div></div>
            <p role="status" aria-live="polite"></p>`;
        host.append(this.root);
        this.form = this.root.querySelector('form'); this.fields = this.root.querySelector('fieldset');
        this.review = this.root.querySelector('[data-review]'); this.copy = this.root.querySelector('[data-copy]');
        this.confirm = this.root.querySelector('[data-confirm]'); this.cancel = this.root.querySelector('[data-cancel]');
        this.proof = this.root.querySelector('[data-proof]'); this.code = this.proof.querySelector('input');
        this.copyCode = this.root.querySelector('[data-copy-code]'); this.status = this.root.querySelector('[role="status"]');
        this.form.onsubmit = event => { event.preventDefault(); this.prepare(); };
        this.form.oninput = () => this.clear(); this.cancel.onclick = () => this.clear();
        this.root.ontoggle = () => { if (!this.root.open) this.clear(); };
        this.confirm.onclick = () => {
            if (!this.authorized || this.busy || !this.draft) return;
            this.submitted = this.draft; this.draft = null; this.review.hidden = true;
            const { id, ...payload } = this.submitted;
            this.status.textContent = 'Awaiting private acknowledgement; no automatic resend.';
            this.submit('admin_beta_invitation', { ...payload, confirmed: true }, id);
        };
        this.copyCode.onclick = async () => {
            if (!this.authorized || this.busy || !this.code.value) return;
            const code = this.code.value;
            try {
                if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
                await navigator.clipboard.writeText(code);
                if (this.code.value === code) this.status.textContent = 'Copied privately. Share only with the reviewed account; clear your clipboard afterward.';
            } catch { this.status.textContent = 'Clipboard unavailable. Select the masked code field and copy it manually; do not share it publicly.'; }
        };
        this.setState({ authorized: false, busy: false });
    }

    clear() {
        this.draft = null; this.submitted = null; this.review.hidden = true; this.copy.textContent = '';
        this.code.value = ''; this.proof.hidden = true; this.status.textContent = '';
    }

    setState({ authorized, busy }) {
        this.authorized = authorized === true; this.busy = busy === true;
        this.fields.disabled = this.confirm.disabled = this.cancel.disabled = this.copyCode.disabled = !this.authorized || this.busy;
        if (!this.authorized) { this.clear(); this.form.reset(); }
    }

    prepare() {
        if (!this.authorized || this.busy) return;
        this.clear();
        const username = this.form.elements.username.value, email = this.form.elements.email.value;
        const stamp = Date.parse(`${this.form.elements.expiresAt.value}Z`);
        const controls = value => Array.from(value).some(char => char.codePointAt(0) < 32 || (char.codePointAt(0) >= 127 && char.codePointAt(0) <= 159));
        if (!username.trim() || new TextEncoder().encode(username).length > 128 || new TextEncoder().encode(email).length > 320 || controls(username) || controls(email)
            || !Number.isFinite(stamp) || stamp <= Date.now() || stamp > Date.now() + 7 * 86400000) {
            this.status.textContent = 'Use a valid exact identity and future UTC expiry within seven days.'; return;
        }
        this.draft = { id: crypto.randomUUID(), username, email, expiresAt: new Date(stamp).toISOString() };
        this.copy.textContent = `Username: ${username}; registration email: ${email || '(empty)'}; expires ${this.draft.expiresAt} (UTC).`;
        this.review.hidden = false; this.status.textContent = 'Review only—no invitation has been requested.'; this.cancel.focus();
    }

    handleResult(result) {
        const request = this.submitted;
        if (!request || result?.id !== request.id) return;
        this.submitted = null;
        if (this.authorized && result.authorized === true && result.success === true && result.final === true
            && /^[A-Za-z0-9_-]{76}$/.test(result.code || '') && result.username === request.username
            && Date.parse(result.expiresAt) === Date.parse(request.expiresAt)) {
            this.code.value = result.code; this.proof.hidden = false;
            this.status.textContent = 'Code prepared privately for the reviewed identity. No email or account creation occurred.';
        } else this.status.textContent = result.message || 'Outcome unconfirmed. No automatic resend was made.';
    }
}
