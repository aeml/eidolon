import { jest } from '@jest/globals';
import { InputManager } from '../src/core/InputManager.js';
import { installUIManagerWindows } from '../src/ui/UIManagerWindows.js';

class Windows {}
installUIManagerWindows(Windows);

beforeEach(() => { localStorage.clear(); document.body.replaceChildren(); });
afterEach(() => { localStorage.clear(); document.body.replaceChildren(); });

const modes = ['direct', 'backdrop', 'switch', 'toggle', 'managed', 'all'];
const cases = modes.flatMap(mode => ['button', 'select'].map(control => ({ mode, control })));
test.each(cases)('$mode closing a modal releases its $control before the next gameplay key', ({ mode, control }) => {
    document.body.innerHTML = `<section style="display:block"><${control}>Control</${control}></section><aside style="display:none"></aside>`;
    const ui = new Windows();
    ui.settingsScreen = document.querySelector('section'); ui.reportScreen = document.querySelector('aside');
    ui.windowLayouts = new Map([['settings', { element: ui.settingsScreen }]]);
    ui.playUICue = jest.fn(); ui.syncStaticModalBackdrop = jest.fn(); ui.reflowVisibleWindows = jest.fn();
    const input = new InputManager(null, null), cast = jest.fn();
    input.keyboardBindings.hotbar0 = 'q'; input.subscribe('onHotbar', cast);
    const key = value => window.dispatchEvent(new KeyboardEvent('keydown', { key: value }));
    try {
        document.querySelector(control).focus();
        key('q');
        expect(cast).not.toHaveBeenCalled(); // Native controls still own input while open.
        if (mode === 'direct') ui.closeStaticModal(ui.settingsScreen);
        if (mode === 'backdrop') ui.closeOpenStaticModal();
        if (mode === 'switch') ui.toggleStaticModal(ui.reportScreen);
        if (mode === 'toggle') ui.toggleStaticModal(ui.settingsScreen);
        if (mode === 'managed') ui.closeManagedWindow('settings');
        if (mode === 'all') ui.closeAllStaticModals();
        // Same task: hidden controls must not wait for a browser layout/frame
        // before the remapped key resumes. The old numeric binding stays inert.
        key('q'); key('1');
        expect(cast.mock.calls).toEqual([[0]]);
        expect(ui.settingsScreen.contains(document.activeElement)).toBe(false);
    } finally { input.dispose(); }
});

test('closing a modal preserves focus owned by another visible control', () => {
    document.body.innerHTML = '<section style="display:block"><button>Close</button></section><button id="outside">Outside</button>';
    const ui = new Windows(); ui.settingsScreen = document.querySelector('section');
    ui.playUICue = jest.fn(); ui.syncStaticModalBackdrop = jest.fn();
    const outside = document.getElementById('outside'); outside.focus();
    ui.closeStaticModal(ui.settingsScreen);
    expect(document.activeElement).toBe(outside);
});
