import { readPreference, writePreference } from '../ui/PreferenceStorage.js';

export const KEYBOARD_BINDINGS_KEY = 'eidolon.keyboardBindings';
export const KEYBOARD_BINDINGS_EVENT = 'eidolon-keybindings-change';
export const KEYBOARD_ACTIONS = Object.freeze([
    { id: 'panUp', label: 'Pan camera up', key: 'w', held: 'w' },
    { id: 'panLeft', label: 'Pan camera left', key: 'a', held: 'a' },
    { id: 'panDown', label: 'Pan camera down', key: 's', held: 's' },
    { id: 'panRight', label: 'Pan camera right', key: 'd', held: 'd' },
    { id: 'cameraLock', label: 'Toggle camera lock', key: ' ', callback: 'onSpace' },
    { id: 'inspect', label: 'Inspect nearby lore / portal', key: 'e', callback: 'onInspect' },
    { id: 'character', label: 'Character', key: 'c', callback: 'onCharacter' },
    { id: 'inventory', label: 'Bag', key: 'i', callback: 'onInventory' },
    { id: 'journal', label: 'Quest journal', key: 'j', callback: 'onQuest' },
    { id: 'recall', label: 'Recall to Lanternhold', key: 'b', callback: 'onTeleport' },
    { id: 'map', label: 'World map', key: 'm', callback: 'onMap' },
    { id: 'social', label: 'Social', key: 'o', callback: 'onSocial' },
    { id: 'skills', label: 'Skills', key: 'k', callback: 'onSkills' },
    { id: 'abilities', label: 'Abilities', key: 'p', callback: 'onAbilities' },
    ...[0, 1, 2, 3].map(slot => ({ id: `hotbar${slot}`, label: `Ability slot ${slot + 1}`,
        key: String(slot + 1), callback: 'onHotbar', slot }))
]);
export const DEFAULT_KEYBOARD_BINDINGS = Object.freeze(Object.fromEntries(KEYBOARD_ACTIONS.map(action => [action.id, action.key])));
export const ALLOWED_BINDING_KEYS = Object.freeze(['', ...'abcdefghijklmnopqrstuvwxyz0123456789',
    'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ']);

export function bindingLabel(key) {
    if (!key) return 'Not bound';
    return ({ ' ': 'Space', arrowup: '↑', arrowleft: '←', arrowdown: '↓', arrowright: '→' })[key] || key.toUpperCase();
}

export function validateKeyboardBindings(bindings) {
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) return 'Invalid keyboard preferences.';
    const used = new Map();
    for (const action of KEYBOARD_ACTIONS) {
        const key = bindings[action.id];
        if (!ALLOWED_BINDING_KEYS.includes(key)) return `Choose a supported key for ${action.label}.`;
        if (key && used.has(key)) return `${bindingLabel(key)} is already used for ${used.get(key)}. Choose another key or unbind that action first.`;
        if (key) used.set(key, action.label);
    }
    return '';
}

export function loadKeyboardBindings() {
    try {
        const bindings = { ...DEFAULT_KEYBOARD_BINDINGS, ...JSON.parse(readPreference(KEYBOARD_BINDINGS_KEY) || '{}') };
        if (!validateKeyboardBindings(bindings)) return bindings;
    } catch { /* Corrupt or unavailable optional preferences must not disable input. */ }
    return { ...DEFAULT_KEYBOARD_BINDINGS };
}

export function saveKeyboardBindings(bindings) {
    if (validateKeyboardBindings(bindings)) return false;
    return writePreference(KEYBOARD_BINDINGS_KEY, JSON.stringify(bindings));
}
