import { jest } from '@jest/globals';
import { InputManager } from '../src/core/InputManager.js';
import { DEFAULT_KEYBOARD_BINDINGS, KEYBOARD_ACTIONS, KEYBOARD_BINDINGS_EVENT, KEYBOARD_BINDINGS_KEY,
    loadKeyboardBindings, saveKeyboardBindings, validateKeyboardBindings } from '../src/core/KeyboardBindings.js';
import { KeyboardSettingsUI } from '../src/ui/KeyboardSettingsUI.js';

let input;
beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
afterEach(() => { input?.dispose(); input = null; jest.restoreAllMocks(); localStorage.clear(); document.body.replaceChildren(); });

function settings() {
    document.body.innerHTML = `<details id="keyboard-bindings"><div class="keyboard-bindings-list"></div>
        <button data-reset-bindings>Defaults</button><p role="status"></p></details>
        <div class="hotbar-slot"><span class="hotbar-key">1</span></div>
        <strong data-keybinding-label="inspect">E:</strong>`;
    return new KeyboardSettingsUI(document.querySelector('details'));
}

test.each(KEYBOARD_ACTIONS)('default $id retains its original gameplay action', action => {
    input = new InputManager(null, null);
    const callback = jest.fn();
    if (action.callback) input.subscribe(action.callback, callback);
    input.onKeyDown({ key: action.key });
    if (action.held) {
        expect(input.keys[action.held]).toBe(true);
        input.onKeyUp({ key: action.key });
        expect(input.keys[action.held]).toBe(false);
    } else {
        expect(callback).toHaveBeenCalledTimes(1);
        if (action.slot !== undefined) expect(callback).toHaveBeenCalledWith(action.slot);
        else expect(callback).toHaveBeenCalledWith();
    }
});

test.each(['not json', '{"hotbar0":"2"}', '{"panUp":"escape"}'])('bad preference %s falls back to working defaults', stored => {
    localStorage.setItem(KEYBOARD_BINDINGS_KEY, stored);
    expect(loadKeyboardBindings()).toEqual(DEFAULT_KEYBOARD_BINDINGS);
});

test('unbinding is supported, but duplicate and reserved keys are rejected without writing', () => {
    const bindings = { ...DEFAULT_KEYBOARD_BINDINGS, hotbar0: '' };
    expect(saveKeyboardBindings(bindings)).toBe(true);
    expect(loadKeyboardBindings().hotbar0).toBe('');
    expect(validateKeyboardBindings({ ...bindings, inspect: 'c' })).toContain('already used');
    expect(saveKeyboardBindings({ ...bindings, inspect: 'tab' })).toBe(false);
    expect(loadKeyboardBindings()).toEqual(bindings);
});

test('remapping applies in-session, clears old held state and changes labels without changing hotbar slots', () => {
    input = new InputManager(null, null);
    const cast = jest.fn(); input.subscribe('onHotbar', cast);
    const ui = settings();
    input.onKeyDown({ key: 'w' });
    ui.apply({ ...ui.bindings, panUp: 'arrowup', hotbar0: 'q', inspect: 'r' });
    expect(input.keys.w).toBe(false);
    input.onKeyDown({ key: 'w' }); expect(input.keys.w).toBe(false);
    input.onKeyDown({ key: 'ArrowUp' }); expect(input.keys.w).toBe(true);
    // Release remains safe even after focus moves into a typing field.
    const text = document.createElement('input'); document.body.append(text); text.focus();
    input.onKeyUp({ key: 'ArrowUp' }); expect(input.keys.w).toBe(false);
    text.blur();
    input.onKeyDown({ key: '1' }); input.onKeyDown({ key: 'q' });
    expect(cast).toHaveBeenCalledTimes(1); expect(cast).toHaveBeenCalledWith(0);
    expect(document.querySelector('.hotbar-key').textContent).toBe('Q');
    expect(document.querySelector('[data-keybinding-label]').textContent).toBe('R:');
    expect(loadKeyboardBindings().hotbar0).toBe('q');
    document.querySelector('[data-reset-bindings]').click();
    expect(input.keyboardBindings).toEqual(DEFAULT_KEYBOARD_BINDINGS);
});

test('duplicate selection explains the conflict and preserves selection focus/current bindings', () => {
    const ui = settings();
    const select = ui.controls.get('hotbar0'); select.focus();
    select.value = 'c'; select.dispatchEvent(new Event('change'));
    expect(ui.status.textContent).toContain('already used for Character');
    expect(select.value).toBe('1'); expect(document.activeElement).toBe(select);
    expect(localStorage.getItem(KEYBOARD_BINDINGS_KEY)).toBeNull();
});

test.each(['input', 'textarea', 'select', 'button', 'summary', 'editable'])('%s focus never also casts a remapped ability', tag => {
    input = new InputManager(null, null);
    input.keyboardBindings.hotbar0 = 'q';
    const cast = jest.fn(); input.subscribe('onHotbar', cast);
    const node = document.createElement(tag === 'editable' ? 'div' : tag);
    if (tag === 'editable') { node.contentEditable = 'true'; node.setAttribute('contenteditable', 'true'); }
    node.tabIndex = 0; document.body.append(node); node.focus();
    input.onKeyDown({ key: 'q' });
    expect(cast).not.toHaveBeenCalled();
    node.blur(); input.onKeyDown({ key: 'q' });
    expect(cast).toHaveBeenCalledWith(0);
});

test('modified shortcuts and repeat do not toggle menus or re-run inspections', () => {
    input = new InputManager(null, null);
    const inspect = jest.fn(), character = jest.fn();
    input.subscribe('onInspect', inspect); input.subscribe('onCharacter', character);
    for (const flag of ['ctrlKey', 'altKey', 'metaKey', 'repeat']) {
        input.onKeyDown({ key: 'e', [flag]: true }); input.onKeyDown({ key: 'c', [flag]: true });
    }
    expect(inspect).not.toHaveBeenCalled(); expect(character).not.toHaveBeenCalled();
});

test('blocked browser storage still applies remapping for the session, with an honest message', () => {
    input = new InputManager(null, null);
    const ui = settings();
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    ui.apply({ ...ui.bindings, inspect: 'r' });
    expect(input.keyboardBindings.inspect).toBe('r');
    expect(ui.status.textContent).toContain('will not survive a reload');
});

test('invalid notifications do not replace bindings and disposed inputs stop observing changes', () => {
    input = new InputManager(null, null);
    window.dispatchEvent(new CustomEvent(KEYBOARD_BINDINGS_EVENT, { detail: {} }));
    expect(input.keyboardBindings).toEqual(DEFAULT_KEYBOARD_BINDINGS);
    input.dispose();
    window.dispatchEvent(new CustomEvent(KEYBOARD_BINDINGS_EVENT, { detail: { ...DEFAULT_KEYBOARD_BINDINGS, inspect: 'r' } }));
    expect(input.keyboardBindings.inspect).toBe('e');
});
