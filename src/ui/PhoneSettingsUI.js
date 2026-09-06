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
            ['play', 'Play', ['control-hint-level', 'auto-loot-enabled', 'camera-shake-enabled']],
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
        this.show('screen');
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
