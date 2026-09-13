// Reparent existing controls so their settings bindings and native input
// behavior remain intact. Phone routes only change composition and copy.
export class PhoneSettingsUI {
    constructor(root) {
        this.root = root;
        this.body = root.querySelector('.support-window__body--settings');
        this.scroll = new Map();
        this.current = 'screen';
        const oldSections = [...root.querySelectorAll('.phone-settings-section')];
        root.querySelector('.phone-settings-tabs')?.remove();
        this.tabs = document.createElement('nav');
        this.tabs.className = 'phone-settings-tabs';
        this.tabs.setAttribute('aria-label', 'Settings categories');
        const groups = [
            ['screen', 'Screen', ['graphics-quality', 'graphics-brightness', 'ui-scale', 'fullscreen-enabled']],
            ['play', 'Play', ['control-hint-level', 'auto-loot-enabled', 'camera-shake-enabled', 'camera-shake-strength']],
            ['sound', 'Sound', ['audio-enabled', 'audio-volume', 'audio-detail-level']],
            ['device', 'Device', []]
        ];
        this.sections = new Map();
        for (const [key, label, ids] of groups) {
            const section = document.createElement('section');
            section.className = 'phone-settings-section'; section.dataset.settingsSection = key;
            section.setAttribute('aria-label', `${label} settings`);
            for (const id of ids) {
                const field = root.querySelector(`#${id}`)?.closest('.support-field');
                if (field) section.append(field);
            }
            if (key === 'device') {
                const assets = root.querySelector('.asset-cache-panel');
                if (assets) section.append(assets);
            }
            this.body.append(section); this.sections.set(key, section);
            const button = document.createElement('button');
            button.type = 'button'; button.textContent = label; button.dataset.settingsRoute = key;
            button.onclick = () => this.show(key);
            this.tabs.append(button);
        }
        oldSections.forEach(section => section.remove());
        const footer = this.body.querySelector('.support-window__footer');
        if (footer) this.body.append(footer);
        root.insertBefore(this.tabs, this.body);
        const scale = root.querySelector('#ui-scale');
        const label = root.querySelector('label[for="ui-scale"]');
        if (label) label.textContent = 'Menu text size';
        const hint = scale?.closest('.support-field')?.querySelector('.support-field__hint');
        if (hint) hint.textContent = 'Enlarge phone menu text without changing camera framing. Phone and desktop preferences save separately and apply immediately.';
        this.addTouchPreferences();
        this.show('screen');
    }

    addTouchPreferences() {
        const section = this.sections.get('play');
        const field = document.createElement('div');
        field.className = 'support-field';
        field.innerHTML = `<label for="phone-control-hand">Touch layout</label>
            <select id="phone-control-hand"><option value="right">Actions on right</option><option value="left">Actions on left</option></select>
            <p class="support-field__hint">Swap the movement stick and combat controls to suit your hands.</p>`;
        const sizeField = document.createElement('div');
        sizeField.className = 'support-field';
        sizeField.innerHTML = `<label for="phone-control-size">Touch control size <output id="phone-control-size-value" for="phone-control-size"></output></label>
            <input id="phone-control-size" type="range" min="100" max="120" step="5">
            <p class="support-field__hint">Enlarge buttons independently of menu text and camera zoom. Very short landscape screens use standard size to keep combat visible. Saved for this device.</p>`;
        section.prepend(field, sizeField);
        const hand = field.querySelector('select');
        const size = sizeField.querySelector('input');
        hand.value = localStorage.getItem('eidolon.phoneControlHand') === 'left' ? 'left' : 'right';
        const stored = Number(localStorage.getItem('eidolon.phoneControlSize'));
        size.value = String(Number.isFinite(stored) ? Math.max(100, Math.min(120, stored)) : 100);
        const apply = (save = false) => {
            window.game?.inputManager?.clearInputState?.();
            document.documentElement.dataset.phoneControlHand = hand.value;
            document.documentElement.style.setProperty('--phone-control-scale', String(Number(size.value) / 100));
            sizeField.querySelector('output').textContent = `${size.value}%`;
            if (save) {
                localStorage.setItem('eidolon.phoneControlHand', hand.value);
                localStorage.setItem('eidolon.phoneControlSize', size.value);
            }
        };
        hand.onchange = () => apply(true);
        size.oninput = () => apply(true);
        apply();
    }

    show(key) {
        if (!this.sections.has(key)) return;
        this.scroll.set(this.current, this.body.scrollTop);
        this.current = key;
        for (const [id, section] of this.sections) section.hidden = id !== key;
        for (const button of this.tabs.children) button.setAttribute('aria-pressed', String(button.dataset.settingsRoute === key));
        this.body.scrollTop = this.scroll.get(key) || 0;
    }
}
