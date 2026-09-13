import { jest } from '@jest/globals';
import { EquipmentLoadoutUI } from '../src/ui/EquipmentLoadoutUI.js';

let ui, player, send;
const profile = { name: 'Tank', equipment: { mainHand: 'earned-sword' }, hotbar: ['Charge', '', '', ''] };
beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
    player = { hotbar: ['Charge', null, null, null] };
    send = jest.fn();
    ui = new EquipmentLoadoutUI({ host: document.getElementById('host'), getPlayer: () => player, send });
    ui.refreshPlayer();
    ui.handleResult({ profiles: [] });
});

test('saving sends a name and skills, never fabricated equipment or stats', () => {
    ui.name.value = '  Adventure  ';
    ui.saveButton.click();
    expect(send).toHaveBeenCalledWith('save_loadout', { index: 0, name: 'Adventure', hotbar: ['Charge', '', '', ''] });
});

test('overwriting requires a second explicit click and changing name cancels confirmation', () => {
    ui.handleResult({ profiles: [profile] });
    ui.saveButton.click();
    expect(send).not.toHaveBeenCalled();
    expect(ui.saveButton.textContent).toBe('Confirm overwrite');
    ui.name.dispatchEvent(new Event('input'));
    ui.saveButton.click();
    expect(send).not.toHaveBeenCalled();
    ui.saveButton.click();
    expect(send).toHaveBeenCalledTimes(1);
});

test('equipping requests the selected server slot and leaves the local character unchanged', () => {
    ui.handleResult({ profiles: [profile] });
    const before = JSON.stringify(player);
    ui.applyButton.click();
    expect(send).toHaveBeenCalledWith('apply_loadout', { index: 0, confirmedGold: 0 });
    expect(JSON.stringify(player)).toBe(before);
    ui.handleResult({ success: false, profiles: [profile], message: 'Retrieve missing gear from your stash.' });
    expect(ui.status.textContent).toContain('stash');
});

test('new characters cannot see old presets and saved names are plain text', () => {
    ui.handleResult({ profiles: [{ ...profile, name: '<img src=x onerror=alert(1)>' }] });
    expect(ui.root.querySelector('img')).toBeNull();
    player = { hotbar: [] };
    ui.refreshPlayer();
    expect(ui.name.value).toBe('');
    expect(ui.applyButton.disabled).toBe(true);
    expect(ui.saveButton.disabled).toBe(true);
    expect(ui.select.options[0].textContent).toBe('1 — Empty');
});

test('a paid build swap requires confirmation of the exact server quote', () => {
    ui.handleResult({ profiles: [profile], costs: [3000] });
    ui.applyButton.click();
    expect(send).not.toHaveBeenCalled();
    expect(ui.applyButton.textContent).toContain('3,000 Gold');
    ui.applyButton.click();
    expect(send).toHaveBeenCalledWith('apply_loadout', { index: 0, confirmedGold: 3000 });
    send.mockClear();
    ui.handleResult({ profiles: [profile], costs: [4000], success: false, message: 'Review the new cost' });
    ui.applyButton.click();
    expect(send).not.toHaveBeenCalled();
});
