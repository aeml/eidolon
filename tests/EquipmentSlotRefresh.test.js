import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { InventoryUI } from '../src/ui/InventoryUI.js';

let ui, player;
const gear = (id, damage = 1) => ({ id, name: 'Wooden Staff', slot: 'mainHand', type: 'WEAPON',
    rarity: { name: 'Common', color: '#fff' }, stats: { damage }, level: 1 });
const refresh = item => ui.updateEquipSlot('slot-mainhand', item, 'MAIN HAND', 'mainHand');
beforeEach(() => {
    document.body.innerHTML = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html').body.innerHTML;
    player = { level: 10, inventory: [gear('new', 4)], equipment: { mainHand: gear('old') } };
    ui = new InventoryUI({ getLastPlayer: () => player, getItemIconPath: () => '',
        formatStatName: key => key, getRarityColor: () => '#fff', updateCharacterSheet: jest.fn() });
    window.game = { sendEquipMessage: jest.fn() };
    ui.showItemTooltip = jest.fn(); ui.hideTooltips = jest.fn();
    ui.onUnequipRequest = jest.fn();
});
afterEach(() => { ui.mobileDetails?.dispose(); delete window.game; });

test('unrelated stat refreshes preserve the live equipment drop target and its children', () => {
    refresh(player.equipment.mainHand);
    const slot = document.getElementById('slot-mainhand'), child = slot.firstChild;
    slot.focus();
    for (let count = 0; count < 10; count++) refresh({ ...player.equipment.mainHand });
    expect(document.getElementById('slot-mainhand')).toBe(slot);
    expect(slot.firstChild).toBe(child);
    expect(document.activeElement).toBe(slot);
    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { getData: () => JSON.stringify({ type: 'inventory', id: 0 }) } });
    slot.dispatchEvent(event);
    expect(window.game.sendEquipMessage).toHaveBeenCalledWith(player.inventory[0], 'mainHand');
});

test('equipment artwork and potency labels leave pointer handling to the stable slot', () => {
    const styles = document.createElement('style');
    styles.textContent = readFileSync('src/styles/windows.css', 'utf8');
    document.head.append(styles);
    try {
        refresh({ ...player.equipment.mainHand, potency: 2 });
        const slot = document.getElementById('slot-mainhand');
        expect(slot.children.length).toBeGreaterThanOrEqual(2);
        for (const child of slot.children) expect(getComputedStyle(child).pointerEvents).toBe('none');
        expect(getComputedStyle(slot).pointerEvents).not.toBe('none');
    } finally { styles.remove(); }
});

test('changed equipment updates art and tooltip on the same node without accumulating old handlers', () => {
    refresh(player.equipment.mainHand);
    const slot = document.getElementById('slot-mainhand'), child = slot.firstChild;
    const replacement = gear('replaced', 9);
    refresh(replacement); refresh({ ...replacement });
    expect(document.getElementById('slot-mainhand')).toBe(slot);
    expect(slot.firstChild).not.toBe(child);
    slot.dispatchEvent(new Event('mouseenter'));
    expect(ui.showItemTooltip).toHaveBeenCalledTimes(1);
    expect(ui.showItemTooltip.mock.calls[0][0]).toEqual(replacement);
    slot.click();
    expect(ui.onUnequipRequest).toHaveBeenCalledTimes(1);
});

test('clearing equipment removes obsolete tooltip/unequip actions but retains a drop target', () => {
    refresh(player.equipment.mainHand);
    const slot = document.getElementById('slot-mainhand');
    refresh(null);
    expect(document.getElementById('slot-mainhand')).toBe(slot);
    slot.dispatchEvent(new Event('mouseenter')); slot.click();
    expect(ui.showItemTooltip).not.toHaveBeenCalled();
    expect(ui.onUnequipRequest).not.toHaveBeenCalled();
    expect(slot.textContent).toBe('MAIN HAND');
    expect(typeof slot.ondrop).toBe('function');
});

test('same-ID Forge changes invalidate cached equipment presentation', () => {
    const item = player.equipment.mainHand;
    refresh(item);
    const slot = document.getElementById('slot-mainhand'), previous = slot.firstChild;
    item.potency = 3; item.stats.damage = 7;
    refresh(item);
    expect(slot.firstChild).not.toBe(previous);
    expect(slot.textContent).toContain('+3');
    slot.dispatchEvent(new Event('mouseenter'));
    expect(ui.showItemTooltip.mock.calls[0][0].stats.damage).toBe(7);
});

test('focused equipment refreshes its tooltip without losing keyboard focus', () => {
    refresh(player.equipment.mainHand);
    const slot = document.getElementById('slot-mainhand');
    slot.focus(); ui.showItemTooltip.mockClear();
    const replacement = gear('new', 4);
    refresh(replacement);
    expect(document.activeElement).toBe(slot);
    expect(ui.showItemTooltip).toHaveBeenCalledTimes(1);
    expect(ui.showItemTooltip.mock.calls[0][0]).toEqual(replacement);
    refresh(null);
    expect(document.activeElement).toBe(slot);
    expect(ui.hideTooltips).toHaveBeenCalled();
});
