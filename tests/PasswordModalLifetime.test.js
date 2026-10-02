import { jest } from '@jest/globals';
import { installUIManagerWindows } from '../src/ui/UIManagerWindows.js';
import { PasswordChangeUI } from '../src/ui/PasswordChangeUI.js';

class Windows {}
installUIManagerWindows(Windows);

test.each(['escape', 'backdrop', 'switch', 'toggle', 'managed', 'all'])('%s modal exit clears unsent passwords', mode => {
    document.body.innerHTML = '<section style="display:block"></section><aside style="display:none"></aside>';
    const ui = new Windows(); ui.settingsScreen = document.querySelector('section'); ui.reportScreen = document.querySelector('aside');
    ui.playUICue = jest.fn(); ui.syncStaticModalBackdrop = jest.fn(); ui.reflowVisibleWindows = jest.fn();
    ui.windowLayouts = new Map([['settings', { element: ui.settingsScreen }]]);
    const password = ui.passwordChange = new PasswordChangeUI({ parent: ui.settingsScreen, send: () => true, isCurrent: () => true });
    try {
        password.current.value = 'unsent-secret';
        if (mode === 'escape' || mode === 'backdrop') ui.closeOpenStaticModal();
        if (mode === 'switch') ui.toggleStaticModal(ui.reportScreen);
        if (mode === 'toggle') ui.toggleStaticModal(ui.settingsScreen);
        if (mode === 'managed') ui.closeManagedWindow('settings');
        if (mode === 'all') ui.closeAllStaticModals();
        expect(password.current.value).toBe('');
        expect(ui.settingsScreen.style.display).toBe('none');
    } finally { password.dispose(); }
});
