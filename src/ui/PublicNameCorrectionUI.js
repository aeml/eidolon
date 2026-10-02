import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

const validName = value => /^[A-Za-z][A-Za-z0-9 _'-]{2,23}$/.test(value) && value.trim() === value;

// Only the current authenticated login form owns this control. A notice read
// creates no mutation; review, confirmation and uncertain retry are separate.
export class PublicNameCorrectionUI {
    constructor({ parent, send, isCurrent }) {
        this.send = send; this.isCurrent = isCurrent;
        this.root = document.createElement('section'); this.root.className = 'public-name-correction'; this.root.hidden = true;
        this.root.innerHTML = `<h3>Correct your public name</h3>
          <p>Your login and saved progress stay unchanged. Other restrictions remain in effect.</p>
          <label class="support-field">New public name<input class="support-field__control" aria-label="New public name" maxlength="24" autocomplete="off"></label>
          <p>3–24 characters; start with a letter. Letters, numbers, spaces, apostrophes, hyphens and underscores only.</p>
          <button type="button" class="support-window__button">Review name correction</button>
          <div class="public-name-correction__confirmation" hidden><p class="public-name-correction__quote"></p>
            <button type="button" class="support-window__button">Confirm name correction</button>
            <button type="button" class="support-window__button">Cancel correction</button></div>
          <p class="public-name-correction__status" role="status"></p>`;
        parent.after(this.root);
        this.input = this.root.querySelector('input'); this.review = this.root.querySelector('button');
        this.confirmation = this.root.querySelector('.public-name-correction__confirmation'); this.quote = this.root.querySelector('.public-name-correction__quote');
        [this.confirm, this.cancel] = this.confirmation.querySelectorAll('button'); this.status = this.root.querySelector('[role="status"]');
        ownedEvent(this, this.review, 'click', () => this.reviewName());
        ownedEvent(this, this.confirm, 'click', () => this.submit());
        ownedEvent(this, this.cancel, 'click', () => {
            if (!this.current() || this.submitted) return;
            this.confirmed = null; this.render(); this.input.focus();
        });
    }

    current() { return !this.disposed && this.root.isConnected && this.isCurrent(); }

    setNotice(notice) {
        if (!this.current()) return;
        this.notice = notice?.kind === 'require_name_change' ? { id: notice.id } : null;
        if (!this.submitted) { this.confirmed = null; this.status.textContent = ''; }
        this.render();
    }

    render() {
        this.root.hidden = !this.notice && !this.confirmed && !this.status.textContent;
        this.input.disabled = !this.notice || Boolean(this.confirmed);
        this.review.disabled = !this.notice || Boolean(this.confirmed);
        this.confirmation.hidden = !this.confirmed;
        this.confirm.disabled = Boolean(this.pending);
        this.confirm.textContent = this.submitted ? 'Retry exact name correction' : 'Confirm name correction';
        this.cancel.disabled = Boolean(this.submitted);
        this.quote.textContent = this.confirmed ? `Change only your public name to “${this.confirmed.publicName}” and complete required-name-change notice ${this.confirmed.noticeId}. This does not lift a mute or suspension.` : '';
    }

    reviewName() {
        if (!this.current() || !this.notice || this.confirmed) return;
        if (!validName(this.input.value)) { this.status.textContent = 'Enter a valid 3–24 character public name, starting with a letter.'; this.input.focus(); return; }
        this.confirmed = Object.freeze({ id: crypto.randomUUID(), noticeId: this.notice.id, publicName: this.input.value, confirmed: true });
        this.status.textContent = 'Review the name and notice above. Nothing has been submitted.';
        this.render(); this.confirm.focus();
    }

    submit() {
        if (!this.current() || !this.confirmed || this.pending) return;
        const request = this.confirmed;
        this.pending = request;
        this.submitted = true;
        try {
            if (this.send('public_name_correction', request) !== true) throw new Error('offline');
        } catch {
            if (!this.current() || this.pending !== request) return;
            this.pending = null;
            this.status.textContent = 'Request not confirmed. Reconnect or retry this exact correction; no automatic retry was sent.';
            this.render(); return;
        }
        if (!this.current() || this.pending !== request) return;
        this.status.textContent = 'Saving your confirmed correction…'; this.render();
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            if (!this.current() || this.pending !== request) return;
            this.pending = null;
            this.status.textContent = 'Correction not confirmed. Check your notices or retry the exact request; no automatic retry was sent.';
            this.render();
        }, 10000);
    }

    handleResult(result) {
        if (!this.current() || !this.confirmed || result?.id !== this.confirmed.id || !this.submitted && !this.pending) return;
        clearTimeout(this.timer); this.pending = null;
        this.status.textContent = typeof result.message === 'string' && result.message.length <= 1000 ? result.message : 'Correction outcome is unavailable. Check your notices or retry the exact request.';
        if (result.final === true) {
            if (result.success === true) { this.notice = null; this.input.value = ''; }
            this.confirmed = null; this.submitted = false;
        }
        this.render();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true; disposeOwnedEvents(this); clearTimeout(this.timer);
        this.pending = null; this.confirmed = null; this.notice = null; this.root.remove();
    }
}
