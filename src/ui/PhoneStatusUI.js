const node = (tag, className, text = '') => {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
};
const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };

// A non-modal reading surface: movement/combat/chat remain available. Timers
// update keyed rows in place instead of rebuilding focused or scrolled content.
export class PhoneStatusUI {
    constructor(host, launcherHost) {
        document.getElementById('phone-status-panel')?._statusOwner?.dispose();
        this.rows = new Map();
        this.launcher = node('button', 'phone-status-launcher', 'Effects · 0');
        this.launcher.id = 'btn-phone-status'; this.launcher.type = 'button';
        this.launcher.setAttribute('aria-controls', 'phone-status-panel');
        this.launcher.setAttribute('aria-expanded', 'false');
        this.launcher.onclick = () => this.isOpen ? this.close() : this.open();
        launcherHost.append(this.launcher);
        this.root = node('section', 'phone-status-panel');
        this.root.id = 'phone-status-panel'; this.root.hidden = true;
        this.root._statusOwner = this;
        this.root.setAttribute('role', 'region');
        this.root.setAttribute('aria-labelledby', 'phone-status-title');
        const header = node('header', 'phone-status-header');
        const title = node('h2', '', 'Status effects'); title.id = 'phone-status-title';
        this.closeButton = node('button', '', 'Close'); this.closeButton.type = 'button';
        this.closeButton.id = 'btn-close-phone-status'; this.closeButton.onclick = () => this.close();
        header.append(title, this.closeButton);
        this.body = node('div', 'phone-status-body'); this.body.tabIndex = 0;
        this.body.setAttribute('aria-label', 'Current buffs and debuffs');
        this.empty = node('p', 'phone-status-empty', 'No active effects. New buffs and debuffs will appear here.');
        this.body.append(this.empty); this.root.append(header, this.body); host.append(this.root);
        this.onKeyDown = event => {
            if (event.key === 'Escape') {
                event.preventDefault(); event.stopImmediatePropagation(); this.close();
            } else if (['i', 'c', 'q', 'm', 'o'].includes(event.key.toLowerCase()) &&
                !event.target?.closest('input, textarea, [contenteditable="true"]')) this.close(false);
        };
        this.onOutsideControl = event => {
            if (!this.root.contains(event.target) && event.target?.closest('.window, #chat-box, #mobile-top-right, #btn-phone-party')) this.close(false);
        };
    }

    get isOpen() { return !this.root.hidden; }

    open() {
        if (!this.mobile) return;
        this.root.hidden = false;
        this.launcher.setAttribute('aria-expanded', 'true');
        window.addEventListener('keydown', this.onKeyDown, true);
        document.addEventListener('pointerdown', this.onOutsideControl, true);
        this.closeButton.focus({ preventScroll: true });
    }

    close(restoreFocus = true) {
        if (!this.isOpen) return;
        this.root.hidden = true;
        this.launcher.setAttribute('aria-expanded', 'false');
        window.removeEventListener('keydown', this.onKeyDown, true);
        document.removeEventListener('pointerdown', this.onOutsideControl, true);
        if (restoreFocus && this.launcher.isConnected && this.mobile) this.launcher.focus({ preventScroll: true });
    }

    update(buffs, mobile, playerId) {
        this.mobile = mobile;
        if (!mobile || this.playerId !== playerId) this.close(false);
        if (this.playerId !== playerId) {
            for (const row of this.rows.values()) row.root.remove();
            this.rows.clear(); this.body.scrollTop = 0;
            this.lastSignature = null;
        }
        this.playerId = playerId;
        const active = (buffs || []).filter(buff => buff?.id && Number(buff.remainingSeconds) > 0);
        const signature = JSON.stringify(active.map(buff => [buff.id, buff.name, buff.detail, Boolean(buff.isDebuff), Number(buff.remainingSeconds).toFixed(1)]));
        if (signature === this.lastSignature) return;
        this.lastSignature = signature;
        const debuffs = active.filter(buff => buff.isDebuff).length;
        setText(this.launcher, `Effects · ${active.length}`);
        this.launcher.setAttribute('aria-label', `Status effects: ${active.length - debuffs} buffs, ${debuffs} debuffs`);
        this.empty.hidden = active.length > 0;
        const present = new Set();
        for (const buff of active) {
            present.add(buff.id);
            let row = this.rows.get(buff.id);
            if (!row) {
                row = { root: node('article', 'phone-status-effect'), name: node('h3', ''),
                    kind: node('span', 'phone-status-kind'), remaining: node('span', 'phone-status-remaining'),
                    detail: node('p', 'phone-status-detail') };
                row.root.dataset.buffId = buff.id;
                row.root.append(row.kind, row.remaining, row.name, row.detail);
                this.rows.set(buff.id, row); this.body.append(row.root);
            }
            row.root.classList.toggle('is-debuff', Boolean(buff.isDebuff));
            setText(row.kind, buff.isDebuff ? 'Debuff' : 'Buff');
            setText(row.name, buff.name || 'Unnamed effect');
            setText(row.remaining, `${Number(buff.remainingSeconds).toFixed(1)}s left`);
            setText(row.detail, buff.detail || 'A temporary effect on your character.');
        }
        for (const [id, row] of this.rows) {
            if (!present.has(id)) { row.root.remove(); this.rows.delete(id); }
        }
    }

    dispose() {
        this.close(false); this.launcher.remove(); this.root.remove(); this.rows.clear();
    }
}
