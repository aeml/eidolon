import { ALLOWED_BINDING_KEYS, DEFAULT_KEYBOARD_BINDINGS, KEYBOARD_ACTIONS, KEYBOARD_BINDINGS_EVENT,
    bindingLabel, loadKeyboardBindings, saveKeyboardBindings, validateKeyboardBindings } from '../core/KeyboardBindings.js';

export class KeyboardSettingsUI {
    constructor(root) {
        this.root = root;
        this.bindings = loadKeyboardBindings();
        this.status = root.querySelector('[role="status"]');
        const list = root.querySelector('.keyboard-bindings-list');
        list.replaceChildren();
        this.controls = new Map();
        for (const action of KEYBOARD_ACTIONS) {
            const label = document.createElement('label');
            label.className = 'keyboard-binding-row';
            const name = document.createElement('span');
            name.textContent = action.label;
            const select = document.createElement('select');
            select.dataset.bindingAction = action.id;
            for (const key of ALLOWED_BINDING_KEYS) {
                const option = document.createElement('option');
                option.value = key; option.textContent = bindingLabel(key);
                select.append(option);
            }
            select.addEventListener('change', () => this.apply({ ...this.bindings, [action.id]: select.value }));
            label.append(name, select); list.append(label);
            this.controls.set(action.id, select);
        }
        root.querySelector('[data-reset-bindings]').onclick = () => this.apply({ ...DEFAULT_KEYBOARD_BINDINGS });
        this.render();
    }

    apply(bindings) {
        const error = validateKeyboardBindings(bindings);
        if (error) {
            this.status.textContent = error;
            this.render();
            return;
        }
        this.bindings = bindings;
        const saved = saveKeyboardBindings(bindings);
        window.dispatchEvent(new CustomEvent(KEYBOARD_BINDINGS_EVENT, { detail: bindings }));
        this.status.textContent = saved ? 'Keyboard bindings saved for this device.'
            : 'Bindings applied for this session. Browser storage is unavailable; they will not survive a reload.';
        this.render();
    }

    render() {
        for (const [action, select] of this.controls) select.value = this.bindings[action];
        document.querySelectorAll('[data-keybinding-label]').forEach(node => {
            node.textContent = `${bindingLabel(this.bindings[node.dataset.keybindingLabel])}:`;
        });
        const pan = document.querySelector('[data-camera-pan-bindings]');
        if (pan) pan.textContent = `${['panUp', 'panLeft', 'panDown', 'panRight'].map(id => bindingLabel(this.bindings[id])).join(' / ')}:`;
        document.querySelectorAll('.hotbar-slot').forEach((slot, index) => {
            const label = slot.querySelector('.hotbar-key');
            if (label) label.textContent = this.bindings[`hotbar${index}`] ? bindingLabel(this.bindings[`hotbar${index}`]) : '—';
        });
    }
}
