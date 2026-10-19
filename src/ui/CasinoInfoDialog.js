import { CasinoWindowLayout } from './CasinoWindowLayout.js';

export class CasinoInfoDialog {
    constructor(title, buttonText = 'Rules', onOpen = null) {
        this.button = document.createElement('button'); this.button.type = 'button'; this.button.textContent = buttonText;
        this.button.className = 'casino-info-trigger'; this.button.setAttribute('aria-haspopup', 'dialog');
        this.root = document.createElement('dialog'); this.root.className = 'casino-info-dialog';
        this.header = document.createElement('header'); this.header.className = 'casino-info-header';
        this.title = document.createElement('h2'); this.closeButton = document.createElement('button'); this.closeButton.type = 'button';
        this.closeButton.textContent = '×'; this.closeButton.setAttribute('aria-label', 'Close popup');
        this.header.append(this.title, this.closeButton);
        this.body = document.createElement('div'); this.body.className = 'casino-info-body';
        this.root.append(this.header, this.body); this.setTitle(title);
        this.layout = new CasinoWindowLayout(this.root, this.header);
        this.button.onclick = () => {
            if (this.disposed || !this.button.isConnected || this.button.closest('[hidden]')) return;
            onOpen?.(); this.open();
        };
        this.closeButton.onclick = () => this.close();
        this.root.__closeMenu = restore => this.close(restore);
        this.root.addEventListener('close', () => this.restoreFocus());
        for (const type of ['pointerdown','pointerup','click','wheel','keydown','keyup']) this.root.addEventListener(type, event => {
            event.stopPropagation();
            if (type !== 'click' || event.target !== this.root) return;
            const r = this.root.getBoundingClientRect();
            if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) this.close();
        });
    }
    setTitle(title) { this.title.textContent = title; this.root.setAttribute('aria-label', title); }
    open() {
        if (this.disposed || this.root.open) return;
        if (!this.root.isConnected) document.body.append(this.root);
        for (const other of document.querySelectorAll('.casino-info-dialog[open]')) other.__closeMenu?.(false);
        this.returnFocus = this.button;
        if (this.root.showModal) this.root.showModal(); else this.root.setAttribute('open', '');
        this.layout.restore(); this.closeButton.focus({preventScroll:true});
    }
    restoreFocus() {
        const target = this.returnFocus; this.returnFocus = null;
        if (target?.isConnected && !target.closest('[hidden]')) target.focus({preventScroll:true});
    }
    close(restore = true) {
        this.layout.stopDrag(false);
        if (!restore) this.returnFocus = null;
        if (this.root.open) { if (this.root.close) this.root.close(); else this.root.removeAttribute('open'); }
        this.restoreFocus();
    }
    dispose() {
        if (this.disposed) return; this.disposed = true; this.close(false); this.layout.dispose();
        this.button.onclick = null; this.closeButton.onclick = null; this.root.__closeMenu = null; this.root.remove();
    }
}
