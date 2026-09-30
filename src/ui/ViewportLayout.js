// Own the layout listeners for one UI session. The visual viewport may shrink
// for the keyboard without changing innerHeight; browser zoom is not a keyboard.
export class ViewportLayout {
    constructor(ui) {
        this.ui = ui;
        this.listeners = [];
        this.disposed = false;
        const listen = (target, event, callback) => {
            if (!target) return;
            target.addEventListener(event, callback);
            this.listeners.push([target, event, callback]);
        };
        this.refresh = () => {
            if (this.disposed) return;
            if (ui.isMobile) this.updateKeyboardBounds();
            ui.reflowVisibleWindows();
        };
        listen(window, 'resize', this.refresh);
        listen(window.visualViewport, 'resize', this.refresh);
        listen(window.visualViewport, 'scroll', this.refresh);
        if (ui.isMobile) {
            const afterFocus = () => queueMicrotask(this.refresh);
            listen(document, 'focusin', afterFocus);
            listen(document, 'focusout', afterFocus);
        }
        this.refresh();
    }

    updateKeyboardBounds() {
        const viewport = window.visualViewport;
        const height = Math.min(window.innerHeight, Number(viewport?.height) || window.innerHeight);
        const editing = document.activeElement?.closest('input, textarea, [contenteditable="true"]');
        const open = Boolean(editing && Number(viewport?.scale || 1) <= 1.02 && window.innerHeight - height > 140);
        const body = document.body;
        if (open) {
            body.dataset.phoneKeyboard = 'true';
            body.style.setProperty('--phone-visible-height', `${height}px`);
            body.style.setProperty('--phone-visible-top', `${Math.max(0, Number(viewport?.offsetTop) || 0)}px`);
        } else this.clearKeyboardBounds();
    }

    clearKeyboardBounds() {
        delete document.body.dataset.phoneKeyboard;
        document.body.style.removeProperty('--phone-visible-height');
        document.body.style.removeProperty('--phone-visible-top');
    }

    dispose() {
        this.disposed = true;
        for (const [target, event, callback] of this.listeners) target.removeEventListener(event, callback);
        this.listeners = [];
        if (this.ui.isMobile) this.clearKeyboardBounds();
    }
}
