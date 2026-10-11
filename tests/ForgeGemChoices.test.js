import { jest } from '@jest/globals';
import { ForgeUI } from '../src/ui/ForgeUI.js';

function setup() {
    const groups = ['forge-gem-equipment', 'forge-gem-inventory',
        'forge-gem-combine-inventory', 'forge-gem-combine-result', 'forge-gem-remove-equipment'];
    document.body.innerHTML = `<div id="forge-screen" style="display:flex"><div class="window-body">
        ${groups.map(id => `<div id="${id}"></div>`).join('')}
        <div id="forge-gem-info"><div id="forge-gem-socket-slots"></div></div>
        <div id="forge-gem-remove-info"><div id="forge-gem-remove-slots"></div></div>
        <div id="forge-gem-combine-slots"><span></span><span></span><span></span></div>
        <button id="btn-forge-insert-gem"></button><button id="btn-forge-combine-gem"></button>
        <button id="btn-forge-remove-gem"></button></div></div>`;
    const player = { equipment: { mainHand: { id: 'staff', name: 'Ash Staff', slot: 'mainHand',
        sockets: 2, gems: [{ type: 'Ruby', quality: 'Chipped', stats: {} }] } }, inventory: [
        { id: 'ruby', type: 'GEM', gemType: 'Ruby', gemQuality: 'Chipped', stack: 6 },
        { id: 'sapphire', type: 'Gem', gemType: 'Sapphire', gemQuality: 'Chipped', stack: 3 },
        { id: 'radiant', type: 'GEM', gemType: 'Ruby', gemQuality: 'Radiant', stack: 3 }
    ] };
    const forge = new ForgeUI({ getLastPlayer: () => player, getItemIconPath: () => '', formatStatName: n => n });
    forge.refreshGemPanels(player);
    return { forge, player };
}

test('insertion choices expose names and selection, exclude filled sockets, and submit the displayed quote once', () => {
    const { forge, player } = setup();
    forge.onForgeInsertGem = jest.fn();
    forge.forgeGemEquipment.firstElementChild.click();
    const gem = forge.forgeGemInventory.firstElementChild;
    expect(gem.tagName).toBe('BUTTON');
    expect(gem.getAttribute('aria-label')).toContain('Chipped Ruby');
    gem.focus(); gem.click();
    expect(document.activeElement.getAttribute('aria-label')).toContain('Chipped Ruby');
    expect(document.activeElement.getAttribute('aria-pressed')).toBe('true');
    const [filled, empty] = forge.forgeGemSocketSlots.children;
    expect(filled.disabled).toBe(true);
    expect(filled.getAttribute('aria-label')).toContain('Socket 1');
    expect(empty.disabled).toBe(false);
    empty.focus(); empty.click();
    expect(document.activeElement.getAttribute('aria-pressed')).toBe('true');
    expect(forge.btnForgeInsertGem.disabled).toBe(false);
    forge.btnForgeInsertGem.click(); forge.btnForgeInsertGem.click();
    expect(forge.onForgeInsertGem).toHaveBeenCalledTimes(1);
    expect(forge.onForgeInsertGem).toHaveBeenCalledWith('mainHand', 0, 1,
        expect.objectContaining({ itemId: 'staff', gemIds: ['ruby'], gemCounts: [6] }));
    expect(player.equipment.mainHand.gems).toHaveLength(1);
    expect(player.inventory[0].stack).toBe(6);
});

test('combine preserves focused stack, rejects incompatible and maximum-quality gems, and allows deselection', () => {
    const { forge, player } = setup();
    forge.onForgeCombineGem = jest.fn();
    let ruby = forge.forgeGemCombineInventory.firstElementChild;
    ruby.focus(); ruby.click();
    ruby = forge.forgeGemCombineInventory.firstElementChild;
    expect(document.activeElement).toBe(ruby);
    expect(ruby.getAttribute('aria-pressed')).toBe('true');
    expect(ruby.getAttribute('aria-label')).toContain('3 selected');
    expect(forge.forgeGemCombineInventory.children[1].disabled).toBe(true);
    expect(forge.forgeGemCombineInventory.children[2].disabled).toBe(true);
    ruby.click();
    expect(forge.selectedCombineGemIndices).toEqual([]);
    expect(forge.forgeGemCombineInventory.children[1].disabled).toBe(false);
    forge.forgeGemCombineInventory.firstElementChild.click();
    forge.btnForgeCombineGem.click(); forge.btnForgeCombineGem.click();
    expect(forge.onForgeCombineGem).toHaveBeenCalledTimes(1);
    expect(forge.onForgeCombineGem).toHaveBeenCalledWith([0, 0, 0],
        { gemIds: ['ruby', 'ruby', 'ruby'], gemCounts: [6, 6, 6] });
    expect(player.inventory[0].stack).toBe(6);
});

test('inventory refresh keeps focus on the same gem identity without redirecting a selected insertion', () => {
    const { forge, player } = setup();
    forge.forgeGemEquipment.firstElementChild.click();
    const ruby = forge.forgeGemInventory.firstElementChild;
    ruby.focus(); ruby.click();
    forge.forgeGemInventory.scrollTop = 71;
    player.inventory.reverse(); forge.refreshGemPanels(player);
    expect(document.activeElement.getAttribute('aria-label')).toContain('Chipped Ruby');
    expect(forge.selectedGemInvIndex).toBeNull();
    expect(forge.btnForgeInsertGem.disabled).toBe(true);
    expect(forge.forgeGemInventory.scrollTop).toBe(71);
    player.inventory = player.inventory.filter(gem => gem.id !== 'ruby'); forge.refreshGemPanels(player);
    expect(document.activeElement).toBe(forge.forgeGemInventory);
    expect(document.activeElement.getAttribute('aria-label')).toBe('Gems in inventory');
    expect(forge.selectedGemInvIndex).toBeNull();
});

test('removal preserves socket focus but clears a destructive choice when the equipped item changes', () => {
    const { forge, player } = setup();
    forge.onForgeRemoveGem = jest.fn();
    forge.forgeGemRemoveEquipment.firstElementChild.click();
    const socket = forge.forgeGemRemoveSlots.firstElementChild;
    expect(socket.tagName).toBe('BUTTON');
    expect(socket.getAttribute('aria-label')).toContain('Chipped Ruby');
    socket.focus(); socket.click();
    expect(document.activeElement.getAttribute('aria-pressed')).toBe('true');
    player.equipment.mainHand = { ...player.equipment.mainHand, id: 'replacement-staff' };
    forge.refreshGemPanels(player);
    expect(forge.selectedRemoveSocketIndex).toBeNull();
    expect(forge.btnForgeRemoveGem.disabled).toBe(true);
    forge.btnForgeRemoveGem.click();
    expect(forge.onForgeRemoveGem).not.toHaveBeenCalled();
    delete player.equipment.mainHand; forge.refreshGemPanels(player);
    expect(document.activeElement).toBe(forge.forgeGemRemoveEquipment);
});
