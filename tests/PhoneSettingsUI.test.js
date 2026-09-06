import { jest } from '@jest/globals';
import { PhoneSettingsUI } from '../src/ui/PhoneSettingsUI.js';

describe('phone settings routes', () => {
    let root, body, input, ui;
    beforeEach(() => {
        document.body.innerHTML = `<div id="settings-screen"><div class="window-header">Settings</div><div class="support-window__body--settings">
            <div class="support-field"><label for="graphics-quality">Quality</label><select id="graphics-quality"></select></div>
            <div class="support-field"><label for="ui-scale">UI Scale</label><input id="ui-scale"><div class="support-field__hint"></div></div>
            <div class="support-field"><label for="auto-loot-enabled">Auto loot</label><input id="auto-loot-enabled" type="checkbox"></div>
            <div class="support-field"><label for="audio-enabled">Audio</label><input id="audio-enabled" type="checkbox"></div>
            <div class="asset-cache-panel">Device storage</div><div class="support-window__footer"><button>Close</button></div>
        </div></div>`;
        root = document.getElementById('settings-screen'); body = root.querySelector('.support-window__body--settings');
        input = document.getElementById('auto-loot-enabled');
        ui = new PhoneSettingsUI(root);
    });
    test('category navigation is outside the scroller and reuses live controls', () => {
        expect(body.contains(root.querySelector('.phone-settings-tabs'))).toBe(false);
        const change = jest.fn(); input.addEventListener('change', change);
        root.querySelector('[data-settings-route="play"]').click(); input.click();
        expect(change).toHaveBeenCalledTimes(1);
        expect(document.getElementById('auto-loot-enabled')).toBe(input);
        expect(root.querySelector('[data-settings-section="screen"]').hidden).toBe(true);
        expect(root.querySelector('[data-settings-section="play"]').hidden).toBe(false);
    });
    test('each category keeps its own reading position', () => {
        body.scrollTop = 180; root.querySelector('[data-settings-route="sound"]').click();
        expect(body.scrollTop).toBe(0); body.scrollTop = 65;
        root.querySelector('[data-settings-route="screen"]').click(); expect(body.scrollTop).toBe(180);
        root.querySelector('[data-settings-route="sound"]').click(); expect(body.scrollTop).toBe(65);
    });
    test('phone copy describes menu text without implying camera zoom changes', () => {
        expect(root.querySelector('label[for="ui-scale"]').textContent).toBe('Menu text size');
        expect(root.textContent).toContain('without changing camera framing');
        expect(ui.current).toBe('screen');
    });
});
