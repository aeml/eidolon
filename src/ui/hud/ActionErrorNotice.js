// One nonblocking, text-only notice above game windows; no growing toast queue.
export class ActionErrorNotice {
    show(message) {
        if (typeof message !== 'string' || !message.trim()) return false;
        const text = message.trim().slice(0, 500);
        const now = Date.now();
        if (this.lastMessage === text && now - this.lastShown < 1000) return false;
        this.lastMessage = text;
        this.lastShown = now;
        if (!this.root) {
            this.root = document.createElement('aside');
            this.root.className = 'action-error-notice';
            this.root.setAttribute('role', 'alert');
            this.root.setAttribute('aria-live', 'assertive');
            const heading = document.createElement('strong');
            heading.textContent = 'Action not completed';
            this.message = document.createElement('p');
            const close = document.createElement('button');
            close.type = 'button';
            close.textContent = '×';
            close.setAttribute('aria-label', 'Dismiss error');
            close.addEventListener('click', event => { event.stopPropagation(); this.clear(); });
            this.root.addEventListener('pointerdown', event => event.stopPropagation());
            this.root.addEventListener('click', event => event.stopPropagation());
            this.root.append(heading, this.message, close);
            document.body.append(this.root);
        }
        this.message.textContent = text;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.clear(), 6000);
        return true;
    }

    clear() {
        clearTimeout(this.timer);
        this.timer = null;
        this.root?.remove();
        this.root = null;
        this.message = null;
    }

    dispose() { this.clear(); }
}
