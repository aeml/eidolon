import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { PhoneStatusUI } from '../src/ui/PhoneStatusUI.js';
import { wellRestedBuff } from '../src/core/WellRested.js';

const buff = { id: 'arcane_shield', name: 'Arcane Shield', remainingSeconds: 24.8, detail: 'Absorbs 500 damage.' };

test('status reading has an opaque surface without expanding its encounter footprint', () => {
    const css = readFileSync('src/styles/phone-status.css', 'utf8');
    const panel = css.split('.mobile-mode .phone-status-panel:not([hidden]) {')[1].split('}')[0];
    expect(panel).toContain('background: #111923;');
    expect(panel).toContain('max-height: min(38dvh,');
    expect(panel).toContain('bottom: auto;');
});
let ui;
beforeEach(() => {
    document.body.innerHTML = '<div id="ui-layer"><div id="minimap-hud"></div></div><div id="chat-box"><input></div>';
    ui = new PhoneStatusUI(document.getElementById('ui-layer'), document.getElementById('minimap-hud'));
    ui.update([buff], true, 'player');
});
afterEach(() => ui.dispose());

test('a deliberate tap opens readable status details without a modal backdrop', () => {
    expect(ui.root.hidden).toBe(true); ui.launcher.click();
    expect(ui.root.hidden).toBe(false);
    expect(ui.root.getAttribute('role')).toBe('region');
    expect(ui.root.textContent).toContain('24.8s left');
    expect(ui.root.textContent).toContain('Absorbs 500 damage.');
    expect(document.activeElement).toBe(ui.closeButton);
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
});

test('close and Escape return focus without opening the pause menu', () => {
    const bubbled = jest.fn(); window.addEventListener('keydown', bubbled);
    ui.open(); ui.closeButton.click(); expect(document.activeElement).toBe(ui.launcher);
    ui.open(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(ui.root.hidden).toBe(true); expect(bubbled).not.toHaveBeenCalled();
    window.removeEventListener('keydown', bubbled);
});

test('timers update keyed rows without replacing focus or scroll content', () => {
    ui.open(); ui.body.focus(); ui.body.scrollTop = 120;
    const row = ui.rows.get(buff.id).root;
    ui.update([{ ...buff, remainingSeconds: 23.5 }], true, 'player');
    expect(ui.rows.get(buff.id).root).toBe(row);
    expect(document.activeElement).toBe(ui.body);
    expect(ui.body.scrollTop).toBe(120);
    expect(row.textContent).toContain('23.5s left');
});

test('unchanged frames do not rewrite row text', () => {
    const textNode = ui.rows.get(buff.id).name.firstChild;
    ui.update([{ ...buff, remainingSeconds: 24.79 }], true, 'player');
    expect(ui.rows.get(buff.id).name.firstChild).toBe(textNode);
});

test('expired effects disappear while the open reading surface stays available', () => {
    ui.open(); ui.update([{ ...buff, remainingSeconds: 0 }], true, 'player');
    expect(ui.isOpen).toBe(true); expect(ui.rows.size).toBe(0);
    expect(ui.empty.hidden).toBe(false);
    expect(ui.launcher.getAttribute('aria-label')).toBe('Status effects: 0 buffs, 0 debuffs');
});

test('shield expiry preserves the earned resting row instead of showing an empty panel', () => {
    const rested = { ...wellRestedBuff({ wellRestedSeconds: 30, safeZoneId: 'lanternhold' }), remainingSeconds: 30 };
    ui.update([buff, rested], true, 'player');
    ui.open();
    const row = ui.rows.get('well_rested').root;
    ui.update([{ ...buff, remainingSeconds: 0 }, rested], true, 'player');
    expect(ui.rows.has('arcane_shield')).toBe(false);
    expect(ui.rows.size).toBe(1);
    expect(ui.rows.get('well_rested').root).toBe(row);
    expect(row.textContent).toContain('Resting');
    expect(ui.isOpen).toBe(true);
    expect(ui.empty.hidden).toBe(true);
    expect(ui.launcher.getAttribute('aria-label')).toBe('Status effects: 1 buffs, 0 debuffs');
});

test('debuffs have text labels, and untrusted names/details stay literal', () => {
    ui.update([{ ...buff, isDebuff: true, name: '<img src=x>', detail: '<script>bad()</script>' }], true, 'player');
    const row = ui.rows.get(buff.id);
    expect(row.kind.textContent).toBe('Debuff');
    expect(row.root.classList.contains('is-debuff')).toBe(true);
    expect(row.root.querySelector('img, script')).toBeNull();
    expect(ui.launcher.getAttribute('aria-label')).toBe('Status effects: 0 buffs, 1 debuffs');
});

test('chat interaction closes the sheet without changing chat visibility or stealing focus', () => {
    ui.open(); const input = document.querySelector('#chat-box input'); input.focus();
    input.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(ui.isOpen).toBe(false); expect(document.activeElement).toBe(input);
    expect(document.getElementById('chat-box').hidden).toBe(false);
});

test('desktop transition and changed character close and clear stale reading state', () => {
    ui.open(); ui.update([buff], false, 'player'); expect(ui.isOpen).toBe(false);
    ui.open(); expect(ui.isOpen).toBe(false);
    ui.update([buff], true, 'player'); ui.open();
    ui.update([], true, 'other-player');
    expect(ui.isOpen).toBe(false); expect(ui.rows.size).toBe(0); expect(ui.body.scrollTop).toBe(0);
});

test('recreation disposes old controls and Escape listeners', () => {
    ui.open(); const old = ui;
    ui = new PhoneStatusUI(document.getElementById('ui-layer'), document.getElementById('minimap-hud'));
    expect(document.querySelectorAll('#phone-status-panel')).toHaveLength(1);
    expect(document.querySelectorAll('#btn-phone-status')).toHaveLength(1);
    expect(old.root.isConnected).toBe(false);
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
});
