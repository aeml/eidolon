import { jest } from '@jest/globals';
import { WardrobeUI } from '../src/ui/WardrobeUI.js';
import { equipmentWithAppearances } from '../src/core/EquipmentAppearance.js';
import { eidolon } from '../src/proto/state_pb.js';
import { equipmentVisualSignature } from '../src/art/ProceduralEquipment.js';

const look = { baseName: 'Silk Hood', rarity: 'Rare', slot: 'head' };
const gear = { id: 'combat-helm', name: 'Iron Helm', type: 'ARMOR', slot: 'head', rarity: 'Common', level: 70, potency: 5, sockets: 2, stats: { defense: 99 } };

test('rendering selects an earned silhouette without changing item stats, sockets or upgrades', () => {
    const equipment = { head: gear };
    const result = equipmentWithAppearances(equipment, { head: look });
    expect(result.head).toMatchObject({ baseName: 'Silk Hood', rarity: 'Rare', id: gear.id, level: 70, potency: 5, sockets: 2, stats: { defense: 99 } });
    expect(gear.name).toBe('Iron Helm');
    expect(gear.rarity).toBe('Common');
    expect(equipmentVisualSignature(result)).not.toBe(equipmentVisualSignature(equipment));
    expect(equipmentWithAppearances(equipment, {}).head).toBe(gear);
});

test('cosmetics cannot create empty equipment or cross slots', () => {
    expect(equipmentWithAppearances({}, { head: look })).toEqual({});
    expect(equipmentWithAppearances({ head: gear }, { head: { ...look, slot: 'chest' } }).head).toBe(gear);
});

test('multiplayer packets carry looks separately and an empty map resets them', () => {
    const packet = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ id: 'remote', appearances: { head: look }, equipment: { head: gear } }).finish());
    expect(packet.appearances.head.baseName).toBe('Silk Hood');
    expect(packet.equipment.head.name).toBe('Iron Helm');
    const reset = eidolon.state.Entity.decode(eidolon.state.Entity.encode({ id: 'remote', appearances: {} }).finish());
    expect(reset.appearances).toEqual({});
});

test('wardrobe offers owned compatible looks, requests server changes, and clears on character switch', () => {
    document.body.innerHTML = '<div id="host"></div>';
    let player = { equipment: { head: gear }, appearances: {} };
    const send = jest.fn();
    const ui = new WardrobeUI({ host: document.getElementById('host'), getPlayer: () => player, send });
    ui.handleResult({ collection: { 'Silk Hood|Rare': look, 'Robes|Rare': { baseName: 'Robes', rarity: 'Rare', slot: 'chest' } } });
    expect([...ui.look.options].map(o => o.value)).toEqual(['', 'Silk Hood|Rare']);
    ui.look.value = 'Silk Hood|Rare';
    ui.apply.click();
    expect(send).toHaveBeenCalledWith('select_appearance', { slot: 'head', key: 'Silk Hood|Rare' });
    expect(player.appearances).toEqual({});
    ui.learn.click();
    expect(send).toHaveBeenCalledWith('collect_appearances', {});
    player = { equipment: {}, appearances: {} };
    ui.refreshPlayer();
    expect(ui.look.options).toHaveLength(1);
    expect(ui.apply.disabled).toBe(true);
});
