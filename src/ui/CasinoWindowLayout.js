import { ownedEvent, disposeOwnedEvents } from './OwnedEvents.js';

export function clampCasinoWindow(left, top, width, height, viewportWidth, viewportHeight) {
    const margin = 8;
    return { left: Math.max(margin, Math.min(left, Math.max(margin, viewportWidth - width - margin))),
        top: Math.max(margin, Math.min(top, Math.max(margin, viewportHeight - height - margin))) };
}

// One movable presentation window. Preferences can be shared with UIManager;
// popup-only instances remember their position for this UI lifetime instead.
export class CasinoWindowLayout {
    constructor(root, header, preferences = null, id = 'casino') {
        this.root = root; this.header = header; this.preferences = preferences; this.id = id; this.positions = {};
        header.tabIndex = 0; header.title = 'Drag to move. Arrow keys move the window; Home centers it.';
        header.classList.add('casino-window-drag-handle');
        ownedEvent(this, header, 'pointerdown', event => {
            if (this.disposed || this.keyboardOpen() || event.button !== 0 || event.isPrimary === false || event.target.closest('button, input, select, a')) return;
            const rect = root.getBoundingClientRect();
            this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
            root.dataset.windowDragging = 'true';
            header.setPointerCapture?.(event.pointerId); event.preventDefault(); event.stopPropagation();
        });
        ownedEvent(this, header, 'pointermove', event => {
            if (!this.pointer || this.pointer.id !== event.pointerId) return;
            this.place(this.pointer.left + event.clientX - this.pointer.x, this.pointer.top + event.clientY - this.pointer.y);
            event.preventDefault(); event.stopPropagation();
        });
        const end = event => { if (this.pointer?.id === event.pointerId) this.stopDrag(true); };
        ownedEvent(this, header, 'pointerup', end); ownedEvent(this, header, 'pointercancel', end);
        ownedEvent(this, header, 'lostpointercapture', () => this.stopDrag(true));
        ownedEvent(this, header, 'keydown', event => {
            if (this.keyboardOpen() || event.target !== header || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(event.key)) return;
            const rect = root.getBoundingClientRect(), step = event.shiftKey ? 40 : 12;
            if (event.key === 'Home') this.center();
            else this.place(rect.left + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
                rect.top + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
            this.remember(); event.preventDefault(); event.stopPropagation();
        });
        ownedEvent(this, window, 'resize', () => {
            this.stopDrag(false);
            if (!this.visible() || this.keyboardOpen()) return;
            this.restore();
        });
    }
    keyboardOpen() { return document.body.classList.contains('mobile-mode') && document.body.dataset.phoneKeyboard === 'true'; }
    currentProfile() { return innerWidth >= 960 ? 'wide' : 'compact'; }
    visible() { return this.root.isConnected && !this.root.closest('[hidden]') && (this.root.tagName !== 'DIALOG' || this.root.open); }
    place(left, top) {
        if (this.keyboardOpen()) return;
        const rect = this.root.getBoundingClientRect(), p = clampCasinoWindow(left, top, rect.width, rect.height, innerWidth, innerHeight);
        const styles = { position:'fixed', margin:'0px', left:`${p.left}px`, top:`${p.top}px`, right:'auto', bottom:'auto', transform:'none' };
        for (const [key,value] of Object.entries(styles)) if (this.root.style[key] !== value) this.root.style[key] = value;
    }
    center() { const rect = this.root.getBoundingClientRect(); this.place((innerWidth - rect.width) / 2, (innerHeight - rect.height) / 2); }
    restore() {
        if (this.disposed || !this.visible() || this.keyboardOpen()) return;
        this.profile = this.currentProfile();
        const saved = this.preferences?.get(this.id, this.profile) || this.positions[this.profile];
        if (saved) this.place(saved.left, saved.top); else this.center();
    }
    remember() {
        if (this.keyboardOpen()) return;
        this.profile = this.currentProfile(); const rect = this.root.getBoundingClientRect();
        this.positions[this.profile] = { left:rect.left, top:rect.top };
        this.preferences?.remember(this.id, this.profile, rect);
    }
    stopDrag(remember) {
        if (!this.pointer) return;
        const id = this.pointer.id; this.pointer = null; delete this.root.dataset.windowDragging;
        if (this.header.hasPointerCapture?.(id)) this.header.releasePointerCapture(id);
        if (remember) this.remember();
    }
    reset() { this.positions = {}; if (this.visible()) this.center(); }
    dispose() { this.stopDrag(false); this.disposed = true; disposeOwnedEvents(this); }
}
