// A received event, not an inferred current-phase snapshot. Full dialogue stays
// in the Game log; this bounded notice never delays target or danger feedback.
const EFFECTS = Object.freeze({
    1: 'Orun shelters you: the King deals 20% less damage.',
    2: 'Neris restores 25% maximum health to living raiders.',
    3: 'Pyralis strikes the King; your damage to him rises 25%.',
    4: 'Aeral restores mana; your damage to the King rises 35%.'
});
const PHONE_EFFECTS = Object.freeze({
    1: 'King damage −20%', 2: 'Living allies heal 25% HP',
    3: 'King struck · your damage +25%', 4: 'Mana restored · damage +35%'
});

export class EidolonPhaseNotice {
    constructor(anchor) {
        this.anchor = anchor;
        this.position = () => {
            if (!this.root) return;
            const objectives = document.body.classList.contains('mobile-mode') && document.getElementById('objectives-panel');
            if (objectives) {
                const rect = objectives.getBoundingClientRect(), style = getComputedStyle(objectives);
                this.root.style.left = rect.width ? `${rect.left}px` : style.left;
                this.root.style.top = rect.width ? `${rect.top}px` : style.top;
                this.root.style.width = rect.width ? `${rect.width}px` : style.width;
                this.root.style.right = 'auto';
                return;
            }
            const rect = this.anchor.getBoundingClientRect();
            const style = getComputedStyle(this.anchor);
            const visible = rect.width > 0 && rect.height > 0;
            this.root.style.width = visible ? `${rect.width}px` : style.width;
            this.root.style.left = 'auto';
            this.root.style.right = style.right;
            this.root.style.top = `${visible ? rect.bottom + 8 : (parseFloat(style.top) || 0)}px`;
        };
    }

    show(phase) {
        if (!this.anchor || !Number.isInteger(phase?.phase) || !EFFECTS[phase.phase]) return;
        this.clear();
        this.root = document.createElement('aside');
        this.root.className = 'eidolon-phase-notice';
        document.body.classList.add('eidolon-aid-visible');
        this.root.setAttribute('role', 'status');
        this.root.setAttribute('aria-live', 'polite');
        const title = document.createElement('strong');
        title.className = 'eidolon-phase-notice__title';
        title.textContent = phase.title || `Eidolon Aid · ${phase.phase}/4 · ${phase.eidolon || phase.element || 'Resonance'}`;
        const meta = document.createElement('span');
        meta.className = 'eidolon-phase-notice__meta';
        meta.textContent = `Phase ${phase.phase} of 4 · ${phase.element || 'Resonance'}`;
        const effect = document.createElement('span');
        effect.className = 'eidolon-phase-notice__effect';
        effect.textContent = phase.effect || EFFECTS[phase.phase];
        const phoneTitle = document.createElement('strong');
        phoneTitle.className = 'eidolon-phase-notice__compact';
        phoneTitle.textContent = `Eidolon ${phase.phase}/4 · ${phase.eidolon || phase.element || 'Resonance'}`;
        const phoneEffect = document.createElement('span');
        phoneEffect.className = 'eidolon-phase-notice__compact';
        phoneEffect.textContent = PHONE_EFFECTS[phase.phase];
        this.root.append(title, meta, effect, phoneTitle, phoneEffect);
        document.body.append(this.root);
        this.position();
        window.addEventListener('resize', this.position);
        if (typeof ResizeObserver !== 'undefined') {
            this.observer = new ResizeObserver(this.position);
            this.observer.observe(this.anchor);
            const objectives = document.getElementById('objectives-panel');
            if (objectives) this.observer.observe(objectives);
        }
        this.timer = setTimeout(() => this.clear(), 8000);
    }

    clear() {
        clearTimeout(this.timer);
        this.timer = null;
        this.observer?.disconnect();
        this.observer = null;
        window.removeEventListener('resize', this.position);
        this.root?.remove();
        this.root = null;
        document.body.classList.remove('eidolon-aid-visible');
    }
}
