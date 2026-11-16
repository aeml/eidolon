// Progress is presentation only. Only an authoritative completion may teleport
// the player or confirm a discovery; elapsed local time never grants either.
export class InteractionCastUI {
    constructor(parent = document.body) {
        this.root = document.createElement('div');
        this.root.id = 'interaction-cast';
        Object.assign(this.root.style, { position: 'fixed', left: '50%', bottom: '160px', transform: 'translateX(-50%)',
            width: 'min(320px, 85vw)', padding: '12px', background: '#181b20', border: '1px solid #b89c65',
            borderRadius: '6px', color: '#f3e5c8', textAlign: 'center', pointerEvents: 'none', zIndex: '120', display: 'none' });
        this.label = document.createElement('div');
        this.label.setAttribute('role', 'status');
        this.progress = document.createElement('progress');
        this.progress.max = 1;
        this.progress.style.width = '100%';
        this.hint = document.createElement('div');
        this.hint.textContent = 'Move to cancel';
        this.root.append(this.label, this.progress, this.hint);
        parent.append(this.root);
    }

    handle(event) {
        if (!event || !Number.isSafeInteger(event.id) || !['recall', 'chronicle_inspect', 'quest_pickup'].includes(event.kind)) return;
        if (event.state === 'started') {
            if (event.duration !== 3) return;
            this.clear();
            this.id = event.id;
            this.label.textContent = event.kind === 'recall' ? 'Recalling to Lanternhold…' : 'Interacting…';
            this.progress.setAttribute('aria-label', this.label.textContent);
            this.root.style.display = 'block';
            const start = performance.now();
            const update = () => { this.progress.value = Math.min(1, (performance.now() - start) / 3000); };
            update();
            this.timer = setInterval(update, 100);
        } else if (event.id === this.id && ['cancelled', 'completed'].includes(event.state)) {
            this.clear();
        }
    }

    clear() {
        clearInterval(this.timer);
        this.timer = null;
        this.id = null;
        this.root.style.display = 'none';
    }

    dispose() { this.clear(); this.root.remove(); }
}
